# 策划检查工具

依赖 Python 3.12+ 和 PyYAML（`python -m pip install PyYAML`）。只读运行：

```text
python scripts/design_tool.py check --root <项目docs/策划>
```

相对路径以当前工作目录解析。JSON 输出 ok、files、issues；成功退出0，发现问题退出1。检查 meta、时间、README、相对链接/标题锚点、依赖路径、核心流程图及规则表。链接可引用 docs 内其他目录，不能越过 docs；不抓取外部网页、不运行 Mermaid/HTML、不修改文件、不读取目录链接外部内容。

工具只能校验结构，不能证明规则合理、图表好读、决定确由用户作出或待确认记录完整；人工核对用户消息及图表。规划读取策划全文和相关待确认记录，不能只看工具返回 ok。
