"""
快速测试：爬取5个品牌的类目，验证方法可行
"""
import time
import random
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    page = context.new_page()
    
    page.goto("https://www.szlcsc.com/huodong.html", wait_until="networkidle")
    page.wait_for_timeout(2000)
    
    brands = page.evaluate("""
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
                                seen[id] = {id: id, name: name};
                                if (Object.keys(seen).length >= 5) break;
                            }
                        }
                    }
                }
            }
            return Object.values(seen).slice(0, 5);
        }
    """)
    
    print(f"测试爬取前 {len(brands)} 个品牌:")
    print("-" * 60)
    
    for b in brands:
        bid = b["id"]
        bname = b["name"]
        url = f"https://list.szlcsc.com/brand/{bid}.html"
        
        print(f"\n> {bname} (ID={bid})")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1500)
        
        data = page.evaluate("""
            () => {
                try {
                    const pp = window.__NEXT_DATA__.props.pageProps;
                    const groups = JSON.parse(pp.brandResult.catalogGroupJson || '[]');
                    return groups.map(g => ({name: g.label, count: g.count}));
                } catch(e) {
                    try {
                        const pp = window.__NEXT_DATA__.props.pageProps;
                        const cat = pp.catalog || '';
                        return cat.split('\u3001').filter(c => c.trim()).map(c => ({name: c, count: null}));
                    } catch(e2) { return []; }
                }
            }
        """)
        
        for cat in data:
            c_str = f" ({cat['count']}件)" if cat['count'] else ""
            print(f"    - {cat['name']}{c_str}")
        
        time.sleep(random.uniform(0.5, 1))
    
    browser.close()
    print("\n测试完成！")
