import requests
import json
from bs4 import BeautifulSoup
import re

def fetch_coupons():
    url = "https://www.szlcsc.com/huodong.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    print("开始请求网页:", url)
    response = requests.get(url, headers=headers)
    response.encoding = 'utf-8'

    if response.status_code not in (200, 203):
        print("请求失败，状态码:", response.status_code)
        return

    print("请求成功，正在解析...")
    soup = BeautifulSoup(response.text, "html.parser")
    next_data_script = soup.find("script", id="__NEXT_DATA__")
    
    if not next_data_script:
        print("未找到 __NEXT_DATA__ 数据，页面结构可能发生变化")
        return

    data = json.loads(next_data_script.string)
    
    # 我们先将获取到的数据保存到一个本地文件进行调试检查
    with open("next_data_debug.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("数据已保存至 next_data_debug.json")

if __name__ == "__main__":
    fetch_coupons()