"""
立创商城 · 全量数据一键刷新工具
- 爬取所有专区优惠券（样品券+工业品券+周年庆+精选+PLUS）
- 8线程并发爬取品牌类目
- 自动合并、去重、导出
- 生成可直接打开的HTML浏览页面
"""
import json, csv, time, random, os, sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from playwright.sync_api import sync_playwright

# ==================== 配置 ====================
BRAND_THREADS = 8          # 品牌类目爬取线程数
HUODONG_URL = "https://www.szlcsc.com/huodong.html"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# ==================== 第一阶段：爬取优惠券 ====================
def crawl_all_coupons():
    """爬取所有专区的优惠券数据，返回品牌字典和原始券数据"""
    print("[1/5] 爬取优惠券数据（所有专区）...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT)
        page = ctx.new_page()
        page.goto(HUODONG_URL, wait_until="networkidle")
        page.wait_for_timeout(3000)

        data = page.evaluate("""
            () => {
                const pp = window.__NEXT_DATA__.props.pageProps;
                const map = pp.couponsDataList.couponModelVOListMap;
                const zoneNames = {'1':'精选','2':'样品券','3':'周年庆','5':'工业品','13':'更多优惠券','plus':'PLUS'};
                const result = {coupons: [], brands: {}};
                for (const zone of Object.keys(map)) {
                    for (const c of map[zone]) {
                        const coupon = {
                            zone: zoneNames[zone] || zone,
                            couponId: c.couponId,
                            couponName: c.couponName || '',
                            couponAmount: c.couponAmount || 0,
                            minOrderMoney: c.minOrderMoney || 0,
                            brandIds: c.brandIds || '',
                            brandNames: c.brandNames || '',
                            targetUrl: c.targetUrl || '',
                            couponType: c.couponType || '',
                            useCouponLimit: c.useCouponLimit || '',
                            customerType: c.customerType || '',
                            grantTimeType: c.grantTimeType || '',
                            receiveCustomerNum: c.receiveCustomerNum || 0,
                            totalCouponNum: c.totalCouponNum || 0,
                        };
                        result.coupons.push(coupon);
                        // 收集品牌
                        if (c.brandIds && c.brandNames) {
                            const ids = c.brandIds.split(',');
                            const names = c.brandNames.split(',');
                            for (let i = 0; i < ids.length; i++) {
                                const id = ids[i].trim();
                                const name = names[i]?.trim();
                                if (id && name && !result.brands[id]) {
                                    result.brands[id] = name;
                                }
                            }
                        }
                    }
                }
                return result;
            }
        """)
        browser.close()

    all_coupons = data["coupons"]
    brand_dict = data["brands"]
    print(f"  -> 共 {len(all_coupons)} 张优惠券, {len(brand_dict)} 个品牌")
    
    # 按专区统计
    zone_stats = {}
    for c in all_coupons:
        z = c["zone"]
        zone_stats[z] = zone_stats.get(z, 0) + 1
    for z, cnt in sorted(zone_stats.items(), key=lambda x: -x[1]):
        print(f"     {z}: {cnt} 张")

    return all_coupons, brand_dict

# ==================== 第二阶段：分析优惠券 ====================
def analyze_coupons(all_coupons, brand_dict):
    """分析每张优惠券的金额分类和受众分类"""
    print("\n[2/5] 分析优惠券分类...")
    
    # brand_id -> {coupons, discount_types, user_types, max_discount}
    brand_coupon_info = {}
    for bid in brand_dict:
        brand_coupon_info[bid] = {
            "coupons": [], "discount_types": set(), "user_types": set(), "max_discount": 0
        }

    for c in all_coupons:
        bid_list = [x.strip() for x in c["brandIds"].split(",") if x.strip()] if c["brandIds"] else []
        if not bid_list:
            continue
        
        amt = c["couponAmount"] or 0
        min_amt = c["minOrderMoney"] or 0
        name = c["couponName"] or ""
        discount_text = f"满{min_amt}减{amt}" if min_amt and amt else f"{amt}元券"
        
        # 金额分类
        if min_amt == 16 and amt == 15:
            amt_cat = "满16减15"
        elif min_amt == 21 and amt == 20:
            amt_cat = "满21减20"
        else:
            amt_cat = None  # 不算样品券
        
        # 受众分类
        usr_cat = None
        if "品牌新人" in name or "品牌新" in name:
            usr_cat = "品牌新人"
        elif "商城新人" in name or "商城新" in name:
            usr_cat = "商城新人"
        
        for bid in bid_list:
            if bid not in brand_coupon_info:
                continue
            info = brand_coupon_info[bid]
            info["coupons"].append({
                "amount": amt, "min_amount": min_amt,
                "discount_text": discount_text, "desc": name,
                "zone": c["zone"]
            })
            if amt_cat:
                info["discount_types"].add(amt_cat)
            if usr_cat:
                info["user_types"].add(usr_cat)
            if amt > info["max_discount"]:
                info["max_discount"] = amt

    # 统计
    has_sample = sum(1 for v in brand_coupon_info.values() if v["discount_types"])
    has_brand_new = sum(1 for v in brand_coupon_info.values() if "品牌新人" in v["user_types"])
    has_mall_new = sum(1 for v in brand_coupon_info.values() if "商城新人" in v["user_types"])
    print(f"  -> 有样品券的品牌: {has_sample}")
    print(f"  -> 有品牌新人券: {has_brand_new}")
    print(f"  -> 有商城新人券: {has_mall_new}")
    
    return brand_coupon_info

# ==================== 第三阶段：多线程爬品牌类目 ====================
def crawl_brand_catalogs_parallel(brand_dict, max_workers=BRAND_THREADS):
    """多线程并发爬取所有品牌类目（每个线程复用单个浏览器）"""
    print(f"\n[3/5] 并发爬取品牌类目 ({max_workers} 线程)...")
    items = list(brand_dict.items())
    total = len(items)
    
    # 将品牌列表分片，每个线程处理一批
    chunk_size = (total + max_workers - 1) // max_workers
    chunks = [items[i:i+chunk_size] for i in range(0, total, chunk_size)]
    
    brand_catalogs = {}
    all_catalogs = set()
    lock = __import__('threading').Lock()
    
    def process_chunk(chunk):
        """单个线程：打开一个浏览器，处理一批品牌"""
        local_catalogs = {}
        local_all = set()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                ctx = browser.new_context(user_agent=USER_AGENT)
                page = ctx.new_page()
                
                for bid, bname in chunk:
                    url = f"https://list.szlcsc.com/brand/{bid}.html"
                    try:
                        page.goto(url, wait_until="networkidle", timeout=15000)
                        page.wait_for_timeout(600)
                        cats = page.evaluate("""
                            () => {
                                try {
                                    const pp = window.__NEXT_DATA__.props.pageProps;
                                    const groups = JSON.parse(pp.brandResult.catalogGroupJson || '[]');
                                    return groups.map(g => g.label);
                                } catch(e) {
                                    try {
                                        const pp = window.__NEXT_DATA__.props.pageProps;
                                        return (pp.catalog || '').split('\u3001').filter(c => c.trim());
                                    } catch(e2) { return []; }
                                }
                            }
                        """)
                        cats = cats if isinstance(cats, list) else []
                        local_catalogs[bid] = cats
                        for c in cats:
                            local_all.add(c)
                    except Exception:
                        local_catalogs[bid] = []
                    time.sleep(random.uniform(0.15, 0.4))
                
                browser.close()
        except Exception:
            pass
        
        # 合并回全局
        with lock:
            brand_catalogs.update(local_catalogs)
            all_catalogs.update(local_all)
            completed = len(brand_catalogs)
            print(f"    进度: {completed}/{total}", flush=True)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(process_chunk, ch) for ch in chunks]
        for f in as_completed(futures):
            pass
    
    print(f"  -> 完成! {len(brand_catalogs)} 个品牌, {len(all_catalogs)} 个类目")
    return brand_catalogs, sorted(all_catalogs)

# ==================== 第四阶段：合并数据 ====================
def merge_data(brand_dict, brand_coupon_info, brand_catalogs, all_catalogs):
    """合并品牌、优惠券、类目数据"""
    print("\n[4/5] 合并数据...")
    
    brands_list = []
    for bid, bname in brand_dict.items():
        cats = brand_catalogs.get(bid, [])
        cinfo = brand_coupon_info.get(bid, {})
        brands_list.append({
            "id": bid,
            "name": bname,
            "catalog_count": len(cats),
            "catalogs": cats,
            "coupons": cinfo.get("coupons", []),
            "discount_types": sorted(cinfo.get("discount_types", [])),
            "user_types": sorted(cinfo.get("user_types", [])),
            "max_discount": cinfo.get("max_discount", 0),
        })
    
    # 按字母排序
    brands_list.sort(key=lambda b: b["name"].lower())
    
    data = {
        "brands": brands_list,
        "categories": all_catalogs,
        "total_brands": len(brands_list),
        "total_categories": len(all_catalogs)
    }
    return data

# ==================== 第五阶段：保存 ====================
def save_all(data, all_coupons):
    """保存到 SQLite + JSON + CSV，并生成 HTML"""
    print("\n[5/5] 保存数据...")
    
    # 1. SQLite
    db_path = "brand_catalog.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    c.execute("""CREATE TABLE brands (
        id TEXT PRIMARY KEY, name TEXT, catalog_count INTEGER,
        max_discount REAL, discount_types TEXT, user_types TEXT
    )""")
    c.execute("""CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE
    )""")
    c.execute("""CREATE TABLE brand_categories (
        brand_id TEXT, category_id INTEGER,
        PRIMARY KEY (brand_id, category_id)
    )""")
    c.execute("""CREATE TABLE coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_id TEXT, zone TEXT, coupon_name TEXT,
        amount REAL, min_amount REAL, discount_text TEXT,
        coupon_type TEXT, use_limit TEXT, total_num INTEGER, received_num INTEGER
    )""")
    
    cat_map = {}
    for cat in data["categories"]:
        c.execute("INSERT INTO categories (name) VALUES (?)", (cat,))
        cat_map[cat] = c.lastrowid
    
    for b in data["brands"]:
        c.execute("""INSERT INTO brands VALUES (?,?,?,?,?,?)""",
            (b["id"], b["name"], b["catalog_count"], b["max_discount"],
             ",".join(b["discount_types"]), ",".join(b["user_types"])))
        for cat_name in b["catalogs"]:
            cid = cat_map.get(cat_name)
            if cid:
                c.execute("INSERT OR IGNORE INTO brand_categories VALUES (?,?)", (b["id"], cid))
    
    for cp in all_coupons:
        c.execute("""INSERT INTO coupons (brand_id, zone, coupon_name, amount, min_amount,
                    discount_text, coupon_type, use_limit, total_num, received_num)
                    VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (cp["brandIds"], cp["zone"], cp["couponName"], cp["couponAmount"],
             cp["minOrderMoney"],
             f"满{cp['minOrderMoney']}减{cp['couponAmount']}" if cp['minOrderMoney'] and cp['couponAmount'] else f"{cp['couponAmount']}元",
             cp["couponType"], cp["useCouponLimit"], cp["totalCouponNum"], cp["receiveCustomerNum"]))
    
    conn.commit()
    conn.close()
    print(f"  SQLite: {db_path} ({os.path.getsize(db_path)/1024:.1f} KB)")

    # 2. JSON (同时保存两份，供 generate_html.py 读取)
    json_path = "brand_catalog_data.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=(2 if data["total_brands"] < 500 else None))
    # generate_html.py 读取的是 brand_catalog_enhanced.json
    with open("brand_catalog_enhanced.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=(2 if data["total_brands"] < 500 else None))
    print(f"  JSON: {json_path} ({os.path.getsize(json_path)/1024:.1f} KB)")

    # 3. CSV - 品牌类目矩阵
    csv_path = "brand_catalog_matrix.csv"
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["品牌名称", "品牌编号", "类目数", "优惠券张数", "最大优惠",
                     "优惠类型", "受众类型"] + data["categories"])
        for b in data["brands"]:
            cat_set = set(b["catalogs"])
            row = [b["name"], b["id"], b["catalog_count"], len(b["coupons"]),
                   b["max_discount"], " ".join(b["discount_types"]), " ".join(b["user_types"])]
            row += ["✓" if c in cat_set else "" for c in data["categories"]]
            w.writerow(row)
    print(f"  CSV: {csv_path}")

    # 4. CSV - 优惠券明细
    cp_csv = "szlcsc_coupons_all.csv"
    with open(cp_csv, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["专区", "品牌编号", "品牌名称", "优惠券名称", "优惠金额", "满减门槛",
                     "优惠描述", "券类型", "使用限制", "总数量", "已领取"])
        for cp in all_coupons:
            w.writerow([cp["zone"], cp["brandIds"], cp["brandNames"], cp["couponName"],
                        cp["couponAmount"], cp["minOrderMoney"],
                        f"满{cp['minOrderMoney']}减{cp['couponAmount']}" if cp['minOrderMoney'] and cp['couponAmount'] else f"{cp['couponAmount']}元",
                        cp["couponType"], cp["useCouponLimit"],
                        cp["totalCouponNum"], cp["receiveCustomerNum"]])
    print(f"  优惠券CSV: {cp_csv}")

    # 5. 嵌入到HTML
    embed_html()
    
    print("\n✅ 全部完成！")
    print(f"   品牌: {data['total_brands']}")
    print(f"   类目: {data['total_categories']}")
    print(f"   优惠券: {len(all_coupons)}")
    print(f"   直接打开 brand_catalog_viewer.html 浏览")

def embed_html():
    """调用 generate_html.py 生成内嵌数据的HTML浏览页面"""
    if not os.path.exists("generate_html.py"):
        print("  generate_html.py 不存在，跳过HTML生成")
        return
    import subprocess
    result = subprocess.run(
        ["e:/EE/newspace/.venv/Scripts/python.exe", "generate_html.py"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"  HTML: brand_catalog_viewer.html")
    else:
        print(f"  HTML生成失败: {result.stderr[:200]}")

# ==================== 主流程 ====================
def refresh_all():
    print("=" * 55)
    print("  立创商城 · 全量数据一键刷新")
    print("=" * 55)
    start = time.time()
    
    # 第一阶段
    all_coupons, brand_dict = crawl_all_coupons()
    
    # 第二阶段
    brand_coupon_info = analyze_coupons(all_coupons, brand_dict)
    
    # 第三阶段 - 品牌类目
    brand_catalogs, all_catalogs = crawl_brand_catalogs_parallel(brand_dict)
    
    # 第四阶段
    data = merge_data(brand_dict, brand_coupon_info, brand_catalogs, all_catalogs)
    
    # 第五阶段
    save_all(data, all_coupons)
    
    elapsed = time.time() - start
    print(f"\n总耗时: {elapsed/60:.1f} 分钟 ({elapsed:.0f} 秒)")

if __name__ == "__main__":
    refresh_all()
