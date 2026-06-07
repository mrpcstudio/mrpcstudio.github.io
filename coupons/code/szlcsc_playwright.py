import logging
import csv
from playwright.sync_api import sync_playwright

def crawl_coupons():
    print("启动 Playwright 爬虫...")
    with sync_playwright() as p:
        # 启动 Chromium 浏览器，针对反爬虫，可以使用 headless=False 看界面，这里默认无头
        browser = p.chromium.launch(headless=True)
        # 创建上下文，可以提供一个符合真实用户的 User-Agent 
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        target_url = "https://www.szlcsc.com/huodong.html"
        print(f"正在访问页面: {target_url}")
        
        # 跳转页面，等待网络空闲
        page.goto(target_url, wait_until="networkidle")
        
        print("等待页面数据加载，这可能需要几秒钟...")
        
        # 等待具有券信息的关键 DOM 加载
        # '样品券专区-content' ID 通常在页面中，也可以放宽等待条件
        page.wait_for_timeout(3000)
        
        # 提取由 NEXT.js 生成的全局数据
        # 包含整个页面的所有预渲染数据，解析 JSON 比纯 DOM 解析更准确稳定
        next_data = page.evaluate("window.__NEXT_DATA__")
        
        if not next_data:
            print("未找到页面的数据对象，可能页面结构已更改。将尝试 DOM 解析方式。")
            # Fallback 的 DOM 解析这里暂略...
            browser.close()
            return
            
        print("成功获取 __NEXT_DATA__！正在解析 JSON 数据进行分类...")
        
        # 接下来递归寻找带有优惠券信息的数据（含有 couponType 或 amount）
        raw_coupons = []
        
        # 提取 couponsDataList 中的真实优惠券信息
        page_props = next_data.get("props", {}).get("pageProps", {})
        coupons_data_list = page_props.get("couponsDataList", {})
        coupon_map = coupons_data_list.get("couponModelVOListMap", {})
        
        unique_coupons = {}
        for partition, coupons in coupon_map.items():
            if not isinstance(coupons, list):
                continue
            for coupon in coupons:
                code = coupon.get("uuid") or str(coupon.get("couponId"))
                if code and code not in unique_coupons:
                    unique_coupons[code] = coupon
                    
        print(f"共提取到 {len(unique_coupons)} 张优惠券的数据，开始按照规则分类...")
        
        # 分类字典
        categorized = {
            "amount": {
                "满16减15": [],
                "满21减20": [],
                "其它金额": []
            },
            "user_type": {
                "每月可重复领取": [],
                "品牌新人": [],
                "商城新人": [],
                "其它限制": []
            }
        }
        
        for coupon in unique_coupons.values():
            # 判断是否为样品券。专区2通常是样品券，或者名字中含有样品券
            amount = coupon.get("couponAmount", 0)       # 减免金额
            min_amount = coupon.get("minOrderMoney", 0) # 满减门槛
            brand_name = coupon.get("brandNames") or coupon.get("brandName") or ""
            remark = coupon.get("remark") or coupon.get("couponName") or ""    # 规则或描述
            
            # 简化输出的字典
            item_info = {
                "brand": brand_name,
                "discount": f"满{min_amount}减{amount}",
                "desc": remark.strip(),
            }
            
            # --- 按金额分类 ---
            if min_amount == 16 and amount == 15:
                categorized["amount"]["满16减15"].append(item_info)
            elif min_amount == 21 and amount == 20:
                categorized["amount"]["满21减20"].append(item_info)
            else:
                categorized["amount"]["其它金额"].append(item_info)
                
            # --- 按优惠次数/受众分类 ---
            remark_lower = remark.replace(" ", "")
            if "品牌新" in remark_lower or "终身" in remark_lower:
                categorized["user_type"]["品牌新人"].append(item_info)
            elif "新用户" in remark_lower or "商城新" in remark_lower:
                categorized["user_type"]["商城新人"].append(item_info)
            elif "每月" in remark_lower or "重复" in remark_lower:
                categorized["user_type"]["每月可重复领取"].append(item_info)
            else:
                categorized["user_type"]["其它限制"].append(item_info)

        print("\n================ 分类结果 ================\n")
        
        print("【按金额分类】")
        for key, arr in categorized["amount"].items():
            print(f">>> {key} (共 {len(arr)} 张):")
            for item in arr[:3]:  # 仅展示前三条作为示例
                print(f"  - 品牌: {item['brand']} | 优惠: {item['discount']}")
            if len(arr) > 3: print("    ...")
            print()
            
        print("【按受众分类】")
        for key, arr in categorized["user_type"].items():
            print(f">>> {key} (共 {len(arr)} 张):")
            for item in arr[:3]:
                print(f"  - 品牌: {item['brand']} | 优惠: {item['discount']} | 说明: {item['desc']}")
            if len(arr) > 3: print("    ...")
            print()

        csv_file = "szlcsc_coupons_with_brand_id.csv"
        print(f"\n正在将所有优惠券数据导出到 {csv_file} ...")
        with open(csv_file, mode='w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['品牌名称', '品牌编号', '品牌链接', '优惠金额', '金额分类', '使用限制分类', '规则详细说明'])
            
            for coupon in unique_coupons.values():
                amount = coupon.get("couponAmount", 0)       
                min_amount = coupon.get("minOrderMoney", 0) 
                brand_name = coupon.get("brandNames") or coupon.get("brandName") or ""
                brand_ids = coupon.get("brandIds") or ""
                remark = coupon.get("remark") or coupon.get("couponName") or ""    
                
                discount_text = f"满{min_amount}减{amount}"
                remark_lower = remark.replace(" ", "")
                
                # 处理品牌编号与链接（可能多个品牌，逗号分隔）
                if brand_ids:
                    # 取第一个品牌ID构造链接
                    first_id = brand_ids.split(",")[0].strip()
                    brand_link = f"https://list.szlcsc.com/brand/{first_id}.html"
                else:
                    brand_link = ""
                    
                # 判断金额分类
                if min_amount == 16 and amount == 15:
                    amt_cat = "满16减15"
                elif min_amount == 21 and amount == 20:
                    amt_cat = "满21减20"
                else:
                    amt_cat = "其它金额"
                    
                # 判断受众分类
                if "品牌新" in remark_lower or "终身" in remark_lower:
                    usr_cat = "品牌新人"
                elif "新用户" in remark_lower or "商城新" in remark_lower:
                    usr_cat = "商城新人"
                elif "每月" in remark_lower or "重复" in remark_lower:
                    usr_cat = "每月可重复领取"
                else:
                    usr_cat = "其它限制"
                    
                writer.writerow([brand_name, brand_ids, brand_link, discount_text, amt_cat, usr_cat, remark.strip()])
                
        print("CSV 文件保存成功！可以直接用 Excel 打开。")

        browser.close()
        print("爬虫执行完毕！")

if __name__ == "__main__":
    try:
        crawl_coupons()
    except Exception as e:
        print("出现异常:", e)
