"""
合并优惠券数据到品牌类目数据库，生成增强版HTML浏览页面
"""
import json
import csv

# ========== 1. 读取品牌类目数据 ==========
with open("brand_catalog_data.json", "r", encoding="utf-8") as f:
    brand_data = json.load(f)

# 建立 brand_id -> brand 的索引
brand_map = {b["id"]: b for b in brand_data["brands"]}

# ========== 2. 读取优惠券数据 ==========
# brand_id -> {coupons: [], discount_types: set, user_types: set}
coupon_map = {}

with open("szlcsc_coupons_with_brand_id.csv", "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        bid = row.get("品牌编号", "").strip()
        bname = row.get("品牌名称", "").strip()
        discount = row.get("优惠金额", "").strip()
        amt_cat = row.get("金额分类", "").strip()
        usr_cat = row.get("使用限制分类", "").strip()
        desc = row.get("规则详细说明", "").strip()

        if not bid or not bname:
            continue

        if bid not in coupon_map:
            coupon_map[bid] = {
                "coupons": [],
                "discount_types": set(),
                "user_types": set(),
            }

        # 解析优惠信息
        amount = 0
        min_amount = 0
        if "满" in discount and "减" in discount:
            try:
                parts = discount.replace("满", "").split("减")
                min_amount = float(parts[0])
                amount = float(parts[1])
            except:
                pass

        coupon_map[bid]["coupons"].append({
            "amount": amount,
            "min_amount": min_amount,
            "discount_text": discount,
            "desc": desc
        })

        if amt_cat and amt_cat != "其它金额":
            coupon_map[bid]["discount_types"].add(amt_cat)
        if usr_cat and usr_cat not in ("其它限制", ""):
            coupon_map[bid]["user_types"].add(usr_cat)

# ========== 3. 合并数据 ==========
for bid, info in coupon_map.items():
    if bid in brand_map:
        brand_map[bid]["coupons"] = info["coupons"]
        brand_map[bid]["discount_types"] = sorted(info["discount_types"])
        brand_map[bid]["user_types"] = sorted(info["user_types"])
        # 计算最大优惠力度
        if info["coupons"]:
            brand_map[bid]["max_discount"] = max(c["amount"] for c in info["coupons"])
        else:
            brand_map[bid]["max_discount"] = 0
    else:
        # 有优惠券但不在品牌类目中的品牌（极少），添加一条
        brand_data["brands"].append({
            "id": bid,
            "name": info["coupons"][0].get("brand_name", ""),
            "catalog_count": 0,
            "catalogs": [],
            "coupons": info["coupons"],
            "discount_types": sorted(info["discount_types"]),
            "user_types": sorted(info["user_types"]),
            "max_discount": max(c["amount"] for c in info["coupons"]) if info["coupons"] else 0
        })

# 确保所有品牌都有 coupons 字段
for b in brand_data["brands"]:
    if "coupons" not in b:
        b["coupons"] = []
        b["discount_types"] = []
        b["user_types"] = []
        b["max_discount"] = 0

brand_data["total_brands"] = len(brand_data["brands"])
brand_data["total_categories"] = len(brand_data["categories"])

print(f"品牌数: {brand_data['total_brands']}")
print(f"类目数: {brand_data['total_categories']}")
print(f"有优惠券的品牌: {sum(1 for b in brand_data['brands'] if b.get('coupons'))}")

# ========== 4. 生成增强JSON ==========
enhanced_json = json.dumps(brand_data, ensure_ascii=False)
with open("brand_catalog_enhanced.json", "w", encoding="utf-8") as f:
    f.write(enhanced_json)
print(f"增强JSON已保存 ({len(enhanced_json)/1024:.1f} KB)")

# ========== 5. 嵌入到HTML ==========
with open("brand_catalog_viewer.html", "r", encoding="utf-8") as f:
    html = f.read()

# 找到嵌入的数据并替换
start_marker = "const EMBEDDED_DATA = "
start_idx = html.find(start_marker)
if start_idx == -1:
    print("错误: 未找到 EMBEDDED_DATA 标记")
    exit(1)

# 找到数据结束位置 (下一个分号)
end_idx = html.find(";\n", start_idx)
if end_idx == -1:
    print("错误: 未找到数据结束标记")
    exit(1)

# 替换数据
new_html = html[:start_idx + len(start_marker)] + enhanced_json + html[end_idx:]

with open("brand_catalog_viewer.html", "w", encoding="utf-8") as f:
    f.write(new_html)

print(f"HTML已更新 ({len(new_html)/1024:.1f} KB)")
