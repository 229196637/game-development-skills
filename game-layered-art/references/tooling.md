# 资源工具

入口 `scripts/art_tool.py`，Python 3.10+；图片检查依赖 Pillow。缺少依赖时报告环境缺口，不自动安装。命令输出 JSON；错误退出 1。

```text
python art_tool.py init --root <库根>
python art_tool.py find --root <库根> [--style <ID>] [--purpose <用途>] [--tag <标签>]
python art_tool.py get --root <库根> --id <资源ID> --version <版本>
python art_tool.py register --root <库根> --source <已有图片路径> --metadata <JSON文件>
python art_tool.py check --root <库根>
```

init 创建空索引，不覆盖已有索引。register 的元数据按资源契约填写，format/width/height 可省略由工具实测；如提供则必须匹配。先创建风格档案、在 catalog.styles 登记其路径，再创建生产清单和提示词；登记元数据放生产目录。register 只复制图片、实测并更新索引，不生成或编辑像素。失败不覆盖已有文件；索引更新失败清理本次新副本。

find 支持多个 `--tag`，全部匹配；purpose 匹配用途文字，style 精确匹配 ID。get 要求精确版本。check 核对索引、风格、来源引用、实际图像和生产清单、组合引用。文件存在与 alpha 检查通过仍需视觉验收。

工具仅限单写入者使用，不支持多个 agent 同时登记同一个库。登记前写好完整任务清单；生产中尚未登记的资源可暂时使 check 报告缺口，完成全部登记后必须检查通过。
