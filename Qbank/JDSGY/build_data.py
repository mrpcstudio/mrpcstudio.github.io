#!/usr/bin/env python3
"""
从 JSON 源文件构建 data.js 题库数据库。

用法:
    python build_data.py

读取当前目录下 S1.json ~ S10.json, Z1.json ~ Z2.json，
按序合并后写入 data.js（格式: const qbankData = [...]）。
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 源文件列表（按顺序）
SOURCE_FILES = [
    "S1.json",  "S2.json",  "S3.json",  "S4.json",  "S5.json",
    "S6.json",  "S7.json",  "S8.json",  "S9.json",  "S10.json",
    "Z1.json",  "Z2.json",
]

OUTPUT_FILE = "data.js"

# 验证每个源文件的基本结构
EXPECTED_KEYS = {"chapter", "title", "subject"}
OPTIONAL_KEYS = {"single_choice", "multiple_choice"}


def validate_chapter(obj: dict, filename: str) -> None:
    """检查章节对象是否包含必要字段"""
    missing = EXPECTED_KEYS - set(obj.keys())
    if missing:
        print(f"  ⚠  {filename}: 缺少字段 {missing}, 继续处理")
    # 检查题目数组格式
    for qtype in ("single_choice", "multiple_choice"):
        items = obj.get(qtype, [])
        if not isinstance(items, list):
            print(f"  ✗ {filename}: {qtype} 不是数组, 跳过")
            obj[qtype] = []
        for item in items:
            if not isinstance(item, dict):
                print(f"  ✗ {filename}: {qtype} 中存在非对象条目, 已跳过")
                continue
            if "id" not in item or "question" not in item or "options" not in item:
                print(f"  ✗ {filename}: {qtype} 中题目缺少 id/question/options 字段")


def build() -> None:
    chapters = []
    total_single = 0
    total_multiple = 0

    print("工作目录: " + SCRIPT_DIR)
    print()

    for fname in SOURCE_FILES:
        fpath = os.path.join(SCRIPT_DIR, fname)
        if not os.path.isfile(fpath):
            print("  [SKIP] " + fname + ": 文件不存在")
            continue

        try:
            with open(fpath, encoding="utf-8") as f:
                chapter = json.load(f)
        except Exception as e:
            print("  [ERR] " + fname + ": 读取失败 - " + str(e))
            sys.exit(1)

        validate_chapter(chapter, fname)

        sc = len(chapter.get("single_choice", []))
        mc = len(chapter.get("multiple_choice", []))
        total_single += sc
        total_multiple += mc
        chapters.append(chapter)

        print("  [OK] " + fname + ": " + chapter.get('chapter', '?') + " - " + chapter.get('title', '?') + " (单选" + str(sc) + " 多选" + str(mc) + ")")

    # 写入 data.js
    out_path = os.path.join(SCRIPT_DIR, OUTPUT_FILE)
    try:
        content = "const qbankData = " + json.dumps(
            chapters,
            ensure_ascii=False,
            indent=2
        ) + ";\n"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("﻿")  # BOM
            f.write(content)
    except Exception as e:
        print("\n  [ERR] 写入 " + OUTPUT_FILE + " 失败: " + str(e))
        sys.exit(1)

    print()
    print("[DONE] 写入 " + OUTPUT_FILE)
    print("     共 " + str(len(chapters)) + " 章, 单选 " + str(total_single) + " 题, 多选 " + str(total_multiple) + " 题, 总计 " + str(total_single + total_multiple) + " 题")


if __name__ == "__main__":
    build()
