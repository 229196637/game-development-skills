# 资源工具

## 独立缩略图与资料卡

`scripts/preview_tool.cjs` 使用Node.js与sharp生成派生预览，不调用生图、不改原图。依赖路径从当前环境的workspace dependencies获取；需要时设置NODE_PATH，技能不硬编码机器路径。缺依赖先报告，不自动安装。

```text
node preview_tool.cjs build --root <实际库根> [--output previews] [--max-edge 640]
node preview_tool.cjs check --root <实际库根> [--output previews]
```

build递归读取库内PNG/JPEG/WebP，跳过符号链接、Git与自身输出目录；从JSON记录读取名称，缺名称时用真实文件名，不捏造。生成独立WebP、预览索引和下方资料卡，原图摘要保持不变。缩略图只做等比缩小，无裁切、无放大；不作为正式尺寸导出。输出目录必须为空或有本工具标识，避免覆盖生产manifest和页面；相同内容派生图可复用，已有不同内容不覆盖。动画需另选静态预览，不默认丢帧。

check只读，实测原图与缩略图尺寸、字节、摘要、比例、覆盖范围及生成页面，缺图/被替换/页面信息不符退出1，成功退出0。新图加入后重新build/check；旧派生图不自动删除。既有制作页面使用此索引查原图path并加载thumbnail.path，下方补名称、文件名、原图与缩略图像素/体积和原图链接；标注不烘焙进图片。

入口 `scripts/art_tool.py`，Python 3.10+；图片检查依赖 Pillow。缺少依赖时报告环境缺口，不自动安装。命令输出 JSON；错误退出 1。

```text
python art_tool.py init --root <库根>
python art_tool.py find --root <库根> [--style <ID>] [--purpose <用途>] [--tag <标签>]
python art_tool.py get --root <库根> --id <资源ID> --version <版本>
python art_tool.py handoff --root <库根> --id <资源ID> --version <版本>
python art_tool.py register --root <库根> --source <已有图片路径> --metadata <JSON文件>
python art_tool.py check --root <库根>
```

init 创建空索引，不覆盖已有索引。register 的元数据按资源契约填写，format/width/height 可省略由工具实测；如提供则必须匹配。先创建风格档案、在 catalog.styles 登记其路径，再创建生产清单和提示词；登记元数据放生产目录。register 只复制图片、实测并更新索引，不生成或编辑像素。失败不覆盖已有文件；索引更新失败清理本次新副本。

find 支持多个 `--tag`，全部匹配；purpose 匹配用途文字，style 精确匹配 ID。find 返回登记信息，inspection=registered-metadata；get 要求精确版本，重新读取 PNG 并校验来源/尺寸/哈希，inspection=live-file。旧资源未定义设计尺寸时 size_matches_design=null，不据此承诺按设计原大小交付。check 核对索引、风格、来源引用、实际图像和生产清单、组合引用。文件存在与 alpha 检查通过仍需视觉验收。

工具仅限单写入者使用，不支持多个 agent 同时登记同一个库。登记前写好完整任务清单；生产中尚未登记的资源可暂时使 check 报告缺口，完成全部登记后必须检查通过。

handoff只读并实测精确版本：正式交付需要名称、设计基准、native_size_required=true、PNG尺寸严格等于design_size，且未标runtime_ready=false/art-master。提取素材还须有reference_region及design_rect。就绪退出0；记录可读但不具备正式尺寸交付条件退出2并给出gaps；无效记录/文件退出1。get/check仍可盘点历史原稿，不代表它们已经通过handoff。

提供reference_region时，register/get/check/handoff都会核对参考图真实尺寸与SHA256、区域不越界、设计矩形与四边映射一致，以及design_size等于design_rect宽高。工具不会替用户定位图中元素，字段格式见资源契约。
