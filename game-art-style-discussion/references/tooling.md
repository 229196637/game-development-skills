# 只读定稿检查工具

入口 scripts/direction_tool.py，Python3.10+，依赖PyYAML和Pillow（已有美术工具同样使用Pillow）。缺依赖时报告，不自动安装。

```text
python direction_tool.py check --root <art-library> [--direction art-direction.md]
python direction_tool.py handoff --root <art-library> [--direction art-direction.md]
```

check 检查文件、元数据和已选参考，输出valid/ready/gaps；讨论中且记录合法时退出0、ready=false。handoff 只有confirmed且文件检查通过才输出style_file与reference_images供制作；讨论中退出2，不能用于素材生产。格式、路径、文件或校验值错误退出1。

工具只读，不生成图片、不改状态、不确认风格、不推进工单。确认记录存在不能证明人类实际同意，执行者仍必须对照真实用户消息。check结构通过也不能证明图片好看；定稿、素材尺寸和组合协调分别验收。

路径相对库根。工具拒绝绝对/越界路径、错误风格版本对应、缺失参考及图像被替换后的SHA256不匹配；返回相对路径和图片实测宽高，搬库后仍可使用。
