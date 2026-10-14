# 资源管理与消费契约

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

工具额外记录 SHA256、alpha 是否存在透明/可见像素、`content_bounds`（任何非零 alpha）与 `opaque_content_bounds`（alpha ≥128）。低透明度光晕或零星像素可能使 content_bounds 到达画布边缘，不能据此直接判定主体被裁切；使用两个边界辅助查看，仍需视觉核对完整轮廓。

生产清单包含 `task_id`、`style`（id/version）、`assets`（id/version 列表）、`compositions`。组合项包含 `id`、`layers`；每层为 `asset_id`、`version`、`order`、`placement`。placement 按预览基准像素记录 x/y/width/height，属于示例搭配建议，不能声称是运行 UI 布局。analysis.md 记录已有素材候选及实际复用或拒绝理由。

消费技能用 `find --style ... --purpose ... --tag ...` 检索，再以 ID/版本 `get`。返回资源元数据和风格文档路径，使用库根解析相对路径；消费方必须实际读取风格文档、查看素材，并遵循自身目标项目规范。查不到就输出缺口，不能悄悄混用另一风格。精确版本引用防止后续变更影响已有使用者。

归档不覆写原图、风格或既有资源版本；新增版本必须显式给出版本号。`register` 检查重复 ID、目标路径与图片后复制，更新索引；检索和检查只读。登记重复版本会拒绝且保留原文件。移动库目录后引用仍有效。已被其它任务引用的资源不自动删除。
