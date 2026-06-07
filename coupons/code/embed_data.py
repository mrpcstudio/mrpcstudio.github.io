import json

json_file = "brand_catalog_data.json"
html_file = "brand_catalog_viewer.html"

# 读取 JSON
with open(json_file, "r", encoding="utf-8") as f:
    data = json.load(f)
json_str = json.dumps(data, ensure_ascii=False)

# 读取 HTML
with open(html_file, "r", encoding="utf-8") as f:
    html = f.read()

# 定位替换的起止标记
start_marker = "<script>\nlet data = null;\nlet currentBrandId = null;\nlet viewMode = 'brand'; // 'brand' or 'category'"
end_marker = "    });\n\nfunction init() {"

start_idx = html.find(start_marker)
end_idx = html.find(end_marker, start_idx)
if end_idx != -1:
    end_idx += len(end_marker)

if start_idx == -1 or end_idx == -1:
    print("not found")
    exit(1)

replacement = (
    "<script>\n"
    "// data embedded, can open directly in Edge/Chrome\n"
    f"const EMBEDDED_DATA = {json_str};\n"
    "\n"
    "let data = null;\n"
    "let currentBrandId = null;\n"
    "let viewMode = 'brand';\n"
    "\n"
    "data = EMBEDDED_DATA;\n"
    "init();\n"
    "\n"
    "function init() {"
)

new_html = html[:start_idx] + replacement + html[end_idx:]

with open(html_file, "w", encoding="utf-8") as f:
    f.write(new_html)

size_kb = len(json_str) / 1024
print(f"Done! Embedded data: {size_kb:.1f} KB")
