# 资源管理与消费契约

## 浏览缩略图

大图需要独立缩略文件，不能只在HTML用CSS缩放完整原图。统一图库默认放 `previews/index.html`、`previews/manifest.json` 和 `previews/thumbnails/`；缩略图默认WebP、最长边640，等比缩小、不裁切、不放大，透明区域保留。相同源图可共享派生图，原件与catalog不改。

预览索引通过原图库相对 `path` 映射，记录 `name`、`id`（可空）、`width/height`、`bytes`、`sha256`，以及 `thumbnail.path/width/height/bytes/format/sha256`；原记录有design_size时沿用，不从缩略图推断。每张图片下方显示名称、实际资源文件名、原图像素尺寸和体积、缩略图像素尺寸和体积；保留原图链接。候选/效果稿也采用此规范，不能因有缩略图就当成通过资源。

消费技能通过原图path查缩略索引用于浏览，制作/FGUI导入仍使用原件和精确资源版本。`art_tool.py check`不检查独立预览索引；使用`preview_tool.cjs check`核对覆盖、文件摘要、实测尺寸和资料卡。补派生文件到当前配置的美术库，旧技能仓库历史原件不改。

```text
art-library/
  catalog.json
  styles/<style-id>/<version>/style.md
  styles/<style-id>/<version>/references/
  assets/<style-id>/backgrounds|subjects|shared/
  productions/<task-id>/README.md
  productions/<task-id>/analysis.md
  productions/<task-id>/prompts/
  productions/<task-id>/manifest.json
  productions/<task-id>/previews/
```

索引 `schema_version: 1`、`styles`、`assets`。风格条目为 `id`、`version`、`path`。资源条目唯一键为 `id + version`；同一公共资源只存一份，多任务用 ID/版本引用。路径均相对库根，禁止绝对路径和越界引用。

资源必填：`id`、`version`、`category`（backgrounds/subjects/shared）、`purpose`、`tags`、`style_id`、`style_version`、`path`、`format`、`width`、`height`、`requires_alpha`、`source`、`production`。工具检测文件格式/尺寸；路径以 .png 结尾。`source` 记录生成/已有资源来源说明、参考路径和实际提示词路径（如适用）。`production` 指向含该资源及相同风格版本的生产清单。只让视觉检查合格的资源进入索引。

新增资源同时记录 `name`（易读名称）、`design_canvas`（默认 width=1920/height=1080）、`design_size`（正式 PNG 目标宽高），以及 `native_size_required`。需要按设计原大小交付时设置 native_size_required=true，检查实测尺寸严格等于目标；已有历史条目没有这些字段时仍可读取，但不能据此声称满足新尺寸契约。工具返回 `size_matches_design` 实测结果。一个任务的 design_canvas 与引用资源的设计基准必须一致。

需要搭配公共底座的主体可记录 `pairing`：base_id/base_version 指向已登记底座，contact_anchor 的 x/y 是该正式 PNG 原像素坐标中的实际支撑点（必须在图像范围内）。visible_width_at_design 记录本次可见主体占用宽度。任务清单单独记录底座的 base_support_anchor；其它技能按显示比例映射两个锚点，不能以图像外框底边取代接触点。未来导出不同尺寸资源版本时重新映射并验证锚点。source.references 可列出本次实际使用的所有参考图相对路径，工具检查它们存在。

工具额外记录 SHA256、alpha 是否存在透明/可见像素、`content_bounds`（任何非零 alpha）与 `opaque_content_bounds`（alpha ≥128）。低透明度光晕或零星像素可能使 content_bounds 到达画布边缘，不能据此直接判定主体被裁切；使用两个边界辅助查看，仍需视觉核对完整轮廓。

生产清单包含 `task_id`、`style`（id/version）、`assets`（id/version 列表）、`compositions`。组合项包含 `id`、`layers`；每层为 `asset_id`、`version`、`order`、`placement`。placement 按预览基准像素记录 x/y/width/height，属于示例搭配建议，不能声称是运行 UI 布局。analysis.md 记录已有素材候选及实际复用或拒绝理由。

消费技能用 `find --style ... --purpose ... --tag ...` 检索，再以 ID/版本 `get`。返回资源元数据和风格文档路径，使用库根解析相对路径；消费方必须实际读取风格文档、查看素材，并遵循自身目标项目规范。查不到就输出缺口，不能悄悄混用另一风格。精确版本引用防止后续变更影响已有使用者。

归档不覆写原图、风格或既有资源版本；新增版本必须显式给出版本号。`register` 检查重复 ID、目标路径与图片后复制，更新索引；检索和检查只读。登记重复版本会拒绝且保留原文件。移动库目录后引用仍有效。已被其它任务引用的资源不自动删除。
