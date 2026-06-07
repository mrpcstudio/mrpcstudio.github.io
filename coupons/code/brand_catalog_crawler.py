"""
爬取立创商城每个品牌的类目信息，存入SQLite，并导出JSON用于Web浏览
"""
import csv
import json
import time
import random
import sqlite3
from playwright.sync_api import sync_playwright


def save_to_sqlite(db_path, brand_dict, brand_catalogs, all_catalogs):
    """将品牌-类目数据存入SQLite"""
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("DROP TABLE IF EXISTS brand_categories")
    c.execute("DROP TABLE IF EXISTS brands")
    c.execute("DROP TABLE IF EXISTS categories")

    c.execute("""CREATE TABLE brands (
        id INTEGER PRIMARY KEY,
        brand_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL
    )""")

    c.execute("""CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )""")

    c.execute("""CREATE TABLE brand_categories (
        brand_id TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (brand_id, category_id),
        FOREIGN KEY (brand_id) REFERENCES brands(brand_id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )""")

    # 插入类目
    cat_to_id = {}
    sorted_cats = sorted(all_catalogs)
    for cat_name in sorted_cats:
        c.execute("INSERT INTO categories (name) VALUES (?)", (cat_name,))
        cat_to_id[cat_name] = c.lastrowid

    # 插入品牌
    for bid, bname in brand_dict.items():
        c.execute("INSERT INTO brands (brand_id, name) VALUES (?, ?)", (bid, bname))

    # 插入关系
    for bid, cats in brand_catalogs.items():
        for cat_name in cats:
            cat_id = cat_to_id.get(cat_name)
            if cat_id:
                c.execute("INSERT OR IGNORE INTO brand_categories (brand_id, category_id) VALUES (?, ?)",
                          (bid, cat_id))

    conn.commit()
    conn.close()
    print(f"SQLite 数据库已保存到: {db_path}")


def export_to_json(json_path, brand_dict, brand_catalogs, all_catalogs):
    """导出JSON供HTML页面使用"""
    sorted_cats = sorted(all_catalogs)
    brands_list = []
    for bid, bname in brand_dict.items():
        cats = brand_catalogs.get(bid, [])
        cat_set = set(cats)
        brands_list.append({
            "id": bid,
            "name": bname,
            "catalog_count": len(cat_set),
            "catalogs": cats
        })

    data = {
        "brands": brands_list,
        "categories": sorted_cats,
        "total_brands": len(brand_dict),
        "total_categories": len(sorted_cats)
    }

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON 数据已保存到: {json_path}")


def crawl_brand_catalog_matrix():
    print("=" * 60)
    print("立创商城 品牌类目爬取工具")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        # ========== 第一步：提取品牌列表 ==========
        print("\n[1/3] 从优惠券数据中提取品牌ID和名称...")
        page.goto("https://www.szlcsc.com/huodong.html", wait_until="networkidle")
        page.wait_for_timeout(2000)

        brand_dict = page.evaluate("""
            () => {
                const pp = window.__NEXT_DATA__.props.pageProps;
                const map = pp.couponsDataList.couponModelVOListMap;
                const seen = {};
                for (const partition of Object.keys(map)) {
                    for (const c of map[partition]) {
                        if (c.brandIds && c.brandNames) {
                            const ids = c.brandIds.split(',');
                            const names = c.brandNames.split(',');
                            for (let i = 0; i < ids.length; i++) {
                                const id = ids[i].trim();
                                const name = names[i]?.trim();
                                if (id && name && !seen[id]) {
                                    seen[id] = name;
                                }
                            }
                        }
                    }
                }
                return seen;
            }
        """)

        print(f"共获取到 {len(brand_dict)} 个品牌，开始爬取各类目...")

        # ========== 第二步：爬取每个品牌的类目 ==========
        print("\n[2/3] 逐品牌爬取类目信息...")

        brand_catalogs = {}
        all_catalogs = set()

        brand_items = list(brand_dict.items())
        total = len(brand_items)

        for idx, (bid, bname) in enumerate(brand_items, 1):
            url = f"https://list.szlcsc.com/brand/{bid}.html"
            catalogs = []

            try:
                print(f"  [{idx}/{total}] {bname} (ID={bid})...", end=" ", flush=True)
                page.goto(url, wait_until="networkidle")
                page.wait_for_timeout(1000)

                catalog_data = page.evaluate("""
                    () => {
                        try {
                            const pp = window.__NEXT_DATA__.props.pageProps;
                            const json = pp.brandResult.catalogGroupJson;
                            if (json) {
                                const groups = JSON.parse(json);
                                return groups.map(g => g.label);
                            }
                        } catch(e) {}
                        try {
                            const pp = window.__NEXT_DATA__.props.pageProps;
                            const cat = pp.catalog || "";
                            return cat.split('\u3001').filter(c => c.trim());
                        } catch(e) {}
                        return [];
                    }
                """)

                catalogs = catalog_data if isinstance(catalog_data, list) else []
                print(f"找到 {len(catalogs)} 个类目")

                for c in catalogs:
                    all_catalogs.add(c)

                brand_catalogs[bid] = catalogs
                time.sleep(random.uniform(0.3, 0.8))

            except Exception as e:
                print(f"出错: {e}")
                brand_catalogs[bid] = []
                continue

        # ========== 第三步：保存数据 ==========
        print(f"\n[3/3] 保存数据...")
        print(f"共 {len(brand_dict)} 个品牌, {len(all_catalogs)} 个类目")

        # 保存SQLite
        save_to_sqlite("brand_catalog.db", brand_dict, brand_catalogs, all_catalogs)

        # 保存JSON供Web页面使用
        export_to_json("brand_catalog_data.json", brand_dict, brand_catalogs, all_catalogs)

        # 同时保留CSV矩阵
        sorted_catalogs = sorted(all_catalogs)
        with open("brand_catalog_matrix_result.csv", 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['品牌名称', '品牌编号', '类目数'] + sorted_catalogs)
            for bid, bname in brand_items:
                cats = brand_catalogs.get(bid, [])
                cat_set = set(cats)
                row = [bname, bid, len(cat_set)]
                for cat in sorted_catalogs:
                    row.append('\u2713' if cat in cat_set else '')
                writer.writerow(row)

        print(f"CSV 矩阵已保存到: brand_catalog_matrix.csv")
        browser.close()
        print("\n爬取完毕！")


if __name__ == "__main__":
    crawl_brand_catalog_matrix()
