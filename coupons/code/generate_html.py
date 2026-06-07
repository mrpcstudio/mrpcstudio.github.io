import json

# 读取增强数据
with open("brand_catalog_enhanced.json", "r", encoding="utf-8") as f:
    data = json.load(f)

data_json = json.dumps(data, ensure_ascii=False)

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>立创商城 · 品牌优惠券类目浏览</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#f0f2f5; color:#333; }}

.header {{ background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#fff; padding:18px 28px; }}
.header h1 {{ font-size:20px; }}
.header .stats {{ font-size:13px; opacity:.85; margin-top:2px; }}

.controls {{ display:flex; gap:8px; padding:12px 20px; background:#fff; border-bottom:1px solid #e0e0e0; flex-wrap:wrap; align-items:center; }}
.controls input,.controls select {{ padding:7px 12px; border:1px solid #d0d0d0; border-radius:5px; font-size:13px; outline:none; }}
.controls input:focus,.controls select:focus {{ border-color:#667eea; }}
.controls .search-box {{ flex:1; min-width:150px; }}
.controls .filter-select {{ min-width:110px; }}
.controls .badge {{ background:#667eea; color:#fff; border-radius:20px; padding:3px 10px; font-size:11px; white-space:nowrap; }}

.main {{ display:flex; height:calc(100vh - 130px); }}

.brand-list {{ width:370px; min-width:370px; overflow-y:auto; background:#fff; border-right:1px solid #e0e0e0; }}
.brand-item {{ padding:10px 16px; cursor:pointer; border-bottom:1px solid #f0f0f0; transition:.12s; }}
.brand-item:hover {{ background:#f0f2ff; }}
.brand-item.active {{ background:#667eea; color:#fff; }}
.brand-item .btop {{ display:flex; align-items:center; gap:6px; }}
.brand-item .bname {{ font-size:13px; font-weight:500; }}
.brand-item .bid {{ font-size:10px; opacity:.5; }}
.brand-item .bbottom {{ display:flex; gap:4px; flex-wrap:wrap; margin-top:3px; }}
.brand-item .tag {{ display:inline-block; font-size:10px; padding:1px 6px; border-radius:3px; }}
.tag-d16 {{ background:#e8f5e9; color:#2e7d32; }}
.tag-d21 {{ background:#fff3e0; color:#e65100; }}
.tag-other {{ background:#f3e5f5; color:#7b1fa2; }}
.tag-new {{ background:#e3f2fd; color:#1565c0; }}
.tag-brandnew {{ background:#fce4ec; color:#c62828; }}
.brand-item .bcount {{ font-size:10px; opacity:.6; }}
.brand-item.active .tag {{ opacity:.9; }}

.detail {{ flex:1; padding:20px 24px; overflow-y:auto; }}
.detail .dh {{ margin-bottom:14px; }}
.detail .dh h2 {{ font-size:18px; }}
.detail .dh .sub {{ color:#888; font-size:12px; margin-top:2px; }}
.detail .dh .coupon-summary {{ display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }}

.coupon-card {{ background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:10px 14px; margin-bottom:14px; }}
.coupon-card h4 {{ font-size:13px; margin-bottom:6px; color:#555; }}
.coupon-card table {{ width:100%; border-collapse:collapse; font-size:12px; }}
.coupon-card th,.coupon-card td {{ padding:4px 8px; text-align:left; border-bottom:1px solid #f0f0f0; }}
.coupon-card th {{ color:#888; font-weight:500; }}

.catalog-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:8px; }}
.cat-card {{ background:#fff; border:1px solid #e8e8e8; border-radius:6px; padding:8px 12px; font-size:12px; display:flex; align-items:center; gap:8px; transition:.12s; cursor:pointer; }}
.cat-card:hover {{ border-color:#667eea; box-shadow:0 2px 8px rgba(102,126,234,.15); }}
.cat-card .dot {{ width:6px;height:6px;border-radius:50%;background:#52c41a;flex-shrink:0; }}

.empty {{ text-align:center; color:#bbb; padding:50px 20px; font-size:14px; }}

/* 类目浏览模式 */
.cat-browse {{ display:none; }}
.cat-browse.active {{ display:block; }}
.brand-tag {{ display:inline-block; background:#f0f2ff; color:#555; border-radius:14px; padding:3px 10px; margin:2px; font-size:11px; cursor:pointer; border:1px solid #e0e4ff; transition:.1s; }}
.brand-tag:hover {{ background:#667eea; color:#fff; border-color:#667eea; }}
.cat-group {{ margin-bottom:14px; }}
.cat-group h3 {{ font-size:14px; margin-bottom:4px; color:#555; }}

.sort-btn {{ padding:7px 12px; border:1px solid #d0d0d0; border-radius:5px; background:#fff; cursor:pointer; font-size:12px; transition:.1s; }}
.sort-btn:hover {{ border-color:#667eea; color:#667eea; }}
.sort-btn.active {{ background:#667eea; color:#fff; border-color:#667eea; }}
.jump-link {{ display:inline-flex; align-items:center; gap:2px; color:#667eea; text-decoration:none; font-size:11px; padding:2px 6px; border-radius:3px; transition:.1s; cursor:pointer; }}
.jump-link:hover {{ background:#667eea; color:#fff; }}
.jump-link-sm {{ font-size:10px; padding:1px 4px; opacity:.6; cursor:pointer; }}
.jump-link-sm:hover {{ opacity:1; color:#667eea; }}</style>
</head>
<body>

<div class="header">
    <h1>🔌 立创商城 · 品牌 + 优惠券 + 类目</h1>
    <div class="stats" id="stats"></div>
</div>

<div class="controls">
    <input class="search-box" type="text" id="searchBrand" placeholder="🔍 搜索品牌..." oninput="applyFilters()">
    <input class="search-box" type="text" id="searchCatalog" placeholder="📂 搜索类目..." oninput="applyFilters()" style="flex:0.6;min-width:120px;">
    <select class="filter-select" id="filterDiscount" onchange="applyFilters()">
        <option value="">全部优惠</option>
        <option value="满16减15">满16减15</option>
        <option value="满21减20">满21减20</option>
    </select>
    <select class="filter-select" id="filterUserType" onchange="applyFilters()">
        <option value="">全部人群</option>
        <option value="品牌新人">品牌新人</option>
        <option value="商城新人">商城新人</option>
        <option value="无限制">无限制/其他</option>
    </select>
    <select class="filter-select" id="sortBy" onchange="applyFilters()">
    </select>
    <button class="sort-btn" id="viewToggle" onclick="toggleView()">📋 类目视图</button>
    <span class="badge" id="countBadge">0</span>
</div>

<div class="main">
    <div class="brand-list" id="brandList"></div>
    <div class="detail" id="detail">
        <div class="empty">👈 选择一个品牌查看详情</div>
    </div>
</div>

<script>
const EMBEDDED_DATA = {data_json};

let brands = EMBEDDED_DATA.brands;
let categories = EMBEDDED_DATA.categories;
let currentBrandId = null;
let currentCategory = null;
let viewMode = 'brand'; // 'brand' or 'category'

// 提前计算每个类目有多少品牌
const catBrandCount = {{}};
categories.forEach(c => {{ catBrandCount[c] = 0; }});
brands.forEach(b => {{
    b.catalogs.forEach(c => {{ if (catBrandCount[c]!==undefined) catBrandCount[c]++; }});
}});

function init() {{
    document.getElementById('stats').textContent =
        `${{brands.length}} 个品牌 · ${{categories.length}} 个类目`;
    updateSortOptions();
    applyFilters();
}}

function updateSortOptions() {{
    const sel = document.getElementById('sortBy');
    const cur = sel.value;
    if (viewMode === 'brand') {{
        sel.innerHTML =
            '<option value="alpha">品牌: 字母 A-Z</option>' +
            '<option value="discount">品牌: 优惠力度 ↓</option>' +
            '<option value="catalogs">品牌: 类目数 ↓</option>';
    }} else {{
        sel.innerHTML =
            '<option value="catAlpha">类目: 字母 A-Z</option>' +
            '<option value="catBrands">类目: 品牌数 ↓</option>';
    }}
    // 尝试保持之前选择的同类别选项
    if (cur === 'catAlpha' || cur === 'catBrands') {{
        if (viewMode === 'category') sel.value = cur;
    }} else if (cur === 'alpha' || cur === 'discount' || cur === 'catalogs') {{
        if (viewMode === 'brand') sel.value = cur;
    }}
}}

function toggleView() {{
    viewMode = (viewMode === 'brand') ? 'category' : 'brand';
    document.getElementById('viewToggle').textContent =
        (viewMode === 'brand') ? '📋 类目视图' : '🏷️ 品牌视图';
    currentBrandId = null;
    currentCategory = null;
    updateSortOptions();
    document.getElementById('searchBrand').value = '';
    document.getElementById('searchCatalog').value = '';
    applyFilters();
}}

function applyFilters() {{
    const qBrand = document.getElementById('searchBrand').value.trim().toLowerCase();
    const qCat = document.getElementById('searchCatalog').value.trim().toLowerCase();
    const discF = document.getElementById('filterDiscount').value;
    const userF = document.getElementById('filterUserType').value;
    const sort = document.getElementById('sortBy').value;

    if (viewMode === 'brand') {{
        applyBrandView(qBrand, qCat, discF, userF, sort);
    }} else {{
        applyCategoryView(qBrand, qCat, discF, userF, sort);
    }}
}}

// ========== 品牌视图 ==========
function applyBrandView(qBrand, qCat, discF, userF, sort) {{
    let filtered = brands.filter(b => {{
        if (qBrand && !b.name.toLowerCase().includes(qBrand)) return false;
        if (qCat) {{
            if (!b.catalogs.some(c => c.toLowerCase().includes(qCat))) return false;
        }}
        if (discF && (!b.discount_types || !b.discount_types.includes(discF))) return false;
        if (userF) {{
            if (userF === '无限制') {{ if (b.user_types && b.user_types.length > 0) return false; }}
            else {{ if (!b.user_types || !b.user_types.includes(userF)) return false; }}
        }}
        return true;
    }});

    if (sort === 'alpha') filtered.sort((a,b) => a.name.localeCompare(b.name, 'zh'));
    else if (sort === 'discount') filtered.sort((a,b) => (b.max_discount||0) - (a.max_discount||0));
    else if (sort === 'catalogs') filtered.sort((a,b) => (b.catalog_count||0) - (a.catalog_count||0));

    renderBrands(filtered);
    document.getElementById('countBadge').textContent = filtered.length;
}}

// ========== 类目视图 ==========
function applyCategoryView(qBrand, qCat, discF, userF, sort) {{
    // 品牌视图: searchBrand=搜品牌, searchCatalog=搜类目
    // 类目视图: searchBrand=搜类目, searchCatalog=搜品牌
    // 所以参数 qBrand 在类目视图中是类目搜索词，qCat 是品牌搜索词
    let qCatName = qBrand;  // 类目搜索词
    let qBrandName = qCat;  // 品牌搜索词

    let filteredCats = categories.filter(c => {{
        if (qCatName && !c.toLowerCase().includes(qCatName)) return false;
        return true;
    }});

    if (sort === 'catAlpha' || sort === 'alpha') {{
        filteredCats.sort((a,b) => a.localeCompare(b, 'zh'));
    }} else if (sort === 'catBrands') {{
        filteredCats.sort((a,b) => (catBrandCount[b]||0) - (catBrandCount[a]||0));
    }}

    renderCategories(filteredCats, qBrandName, discF, userF);
    document.getElementById('countBadge').textContent = filteredCats.length;
}}

function renderCategories(list, qBrandName, discF, userF) {{
    const el = document.getElementById('brandList');
    if (!list.length) {{
        el.innerHTML = '<div class="empty">没有匹配的类目</div>';
        return;
    }}

    el.innerHTML = list.map(c => {{
        let matchedBrands = brands.filter(b => {{
            if (!b.catalogs.includes(c)) return false;
            if (qBrandName && !b.name.toLowerCase().includes(qBrandName)) return false;
            if (discF && (!b.discount_types || !b.discount_types.includes(discF))) return false;
            if (userF) {{
                if (userF === '无限制') {{ if (b.user_types && b.user_types.length > 0) return false; }}
                else {{ if (!b.user_types || !b.user_types.includes(userF)) return false; }}
            }}
            return true;
        }});
        const count = matchedBrands.length;
        const isActive = c === currentCategory;
        return `<div class="brand-item${{isActive?' active':''}}" onclick="selectCategory(this)" data-cat="${{c.replace(/"/g,'&quot;')}}">
            <div class="btop">
                <span class="bname">${{c}}</span>
                <span class="bid">${{count}} 个品牌</span>
            </div>
        </div>`;
    }}).join('');
}}

function selectCategory(el) {{
    const cat = el.dataset.cat;
    currentCategory = cat;
    document.querySelectorAll('.brand-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');

    // 找出该类目下所有品牌（考虑筛选条件）
    const discF = document.getElementById('filterDiscount').value;
    const userF = document.getElementById('filterUserType').value;
    const qBrand = document.getElementById('searchCatalog').value.trim().toLowerCase();

    let matchedBrands = brands.filter(b => {{
        if (!b.catalogs.includes(cat)) return false;
        if (qBrand && !b.name.toLowerCase().includes(qBrand)) return false;
        if (discF && (!b.discount_types || !b.discount_types.includes(discF))) return false;
        if (userF) {{
            if (userF === '无限制') {{ if (b.user_types && b.user_types.length > 0) return false; }}
            else {{ if (!b.user_types || !b.user_types.includes(userF)) return false; }}
        }}
        return true;
    }});

    matchedBrands.sort((a,b) => a.name.localeCompare(b.name, 'zh'));

    let html = `<div class="dh">
        <h2>${{cat}} <span style="font-weight:400;font-size:13px;color:#888;">(${{matchedBrands.length}} 个品牌)</span></h2>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">`;
    matchedBrands.forEach(b => {{
        let tags = '';
        if (b.discount_types && b.discount_types.includes('满16减15')) tags += '<span class="tag tag-d16">满16减15</span> ';
        if (b.discount_types && b.discount_types.includes('满21减20')) tags += '<span class="tag tag-d21">满21减20</span> ';
        if (b.user_types && b.user_types.includes('品牌新人')) tags += '<span class="tag tag-brandnew">品牌新人</span> ';
        if (b.user_types && b.user_types.includes('商城新人')) tags += '<span class="tag tag-new">商城新人</span> ';
        html += `<div class="cat-card" onclick="selectBrand('${{b.id}}')" style="cursor:pointer;">
            <div class="dot"></div>
            <span>${{b.name}} <span style="color:#999;font-size:11px;">(#${{b.id}})</span></span>
            <span style="font-size:10px;color:#888;">${{b.catalog_count}}类目</span>
            <span class="jump-link jump-link-sm" onclick="event.stopPropagation();gotoBrand('${{b.id}}')" title="在立创打开品牌页">🔗</span>
            ${{tags}}
        </div>`;
    }});
    html += '</div>';
    document.getElementById('detail').innerHTML = html;
}}

function gotoBrand(id) {{
    window.open('https://list.szlcsc.com/brand/' + id + '.html', '_blank');
}}

// ========== 品牌列表渲染 ==========
function renderBrands(list) {{
    const el = document.getElementById('brandList');
    if (!list.length) {{
        el.innerHTML = '<div class="empty">没有匹配的品牌</div>';
        return;
    }}
    el.innerHTML = list.map(b => {{
        const isActive = b.id === currentBrandId;
        let tags = '';
        if (b.discount_types && b.discount_types.includes('满16减15')) tags += '<span class="tag tag-d16">满16减15</span>';
        if (b.discount_types && b.discount_types.includes('满21减20')) tags += '<span class="tag tag-d21">满21减20</span>';
        if (b.user_types && b.user_types.includes('品牌新人')) tags += '<span class="tag tag-brandnew">品牌新人</span>';
        if (b.user_types && b.user_types.includes('商城新人')) tags += '<span class="tag tag-new">商城新人</span>';
        if (b.max_discount && b.max_discount > 20) tags += '<span class="tag tag-other">' + b.max_discount + '元券</span>';

        return `<div class="brand-item${{isActive?' active':''}}" data-id="${{b.id}}" onclick="selectBrand('${{b.id}}')">
            <div class="btop">
                <span class="bname">${{b.name}}</span>
                <span class="bid">#${{b.id}}</span>
                <span class="jump-link jump-link-sm" onclick="event.stopPropagation();gotoBrand('${{b.id}}')" title="在立创打开品牌页">🔗</span>
            </div>
            <div class="bbottom">
                <span class="bcount">${{b.catalog_count}} 个类目</span>
                ${{tags}}
            </div>
        </div>`;
    }}).join('');
}}

function selectBrand(bid) {{
    currentBrandId = bid;
    const b = brands.find(x => x.id === bid);
    if (!b) return;

    document.querySelectorAll('.brand-item').forEach(el => el.classList.remove('active'));
    const ae = document.querySelector(`.brand-item[data-id="${{bid}}"]`);
    if (ae) ae.classList.add('active');

    let couponHtml = '';
    if (b.coupons && b.coupons.length > 0) {{
        couponHtml = `<div class="coupon-card">
            <h4>🎫 优惠券 (${{b.coupons.length}} 张)</h4>
            <table><tr><th>优惠</th><th>类型</th></tr>`;
        b.coupons.forEach(c => {{
            let label = c.discount_text;
            let typeLabel = '通用';
            if (c.desc.includes('品牌新人')) typeLabel = '品牌新人';
            else if (c.desc.includes('商城新人')) typeLabel = '商城新人';
            couponHtml += `<tr><td>${{label}}</td><td>${{typeLabel}}</td></tr>`;
        }});
        couponHtml += `</table></div>`;
    }}

    document.getElementById('detail').innerHTML = `
        <div class="dh">
            <h2>${{b.name}} <span style="font-weight:400;font-size:13px;color:#888;">#${{b.id}}</span>
                <span class="jump-link" onclick="gotoBrand('${{b.id}}')" style="font-size:12px;vertical-align:middle;margin-left:6px;">🔗 立创品牌页</span>
            </h2>
            <div class="sub">共 ${{b.catalog_count}} 个类目${{b.max_discount?' · 最大优惠: '+b.max_discount+'元':''}}</div>
            <div class="coupon-summary">
                ${{b.discount_types&&b.discount_types.map(t=>'<span class="tag tag-d16">'+t+'</span>').join('')}}
                ${{b.user_types&&b.user_types.map(t=>'<span class="tag tag-brandnew">'+t+'</span>').join('')}}
            </div>
        </div>
        ${{couponHtml}}
        <h4 style="font-size:14px;margin-bottom:8px;color:#666;">📦 经营类目</h4>
        <div class="catalog-grid">
            ${{b.catalogs.map(c => `<div class="cat-card" onclick="searchCat('${{c}}')"><div class="dot"></div><span>${{c}}</span></div>`).join('')}}
        </div>
    `;
}}

function searchCat(cat) {{
    if (viewMode === 'brand') {{
        document.getElementById('searchCatalog').value = cat;
    }} else {{
        document.getElementById('searchBrand').value = cat;
    }}
    applyFilters();
}}

init();
</script>
</body>
</html>
"""

with open("brand_catalog_viewer.html", "w", encoding="utf-8") as f:
    f.write(html)

print(f"HTML 重写完成! ({len(html)/1024:.1f} KB)")
