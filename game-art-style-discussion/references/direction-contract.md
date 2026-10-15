# 定稿入口与保存契约

默认库根为项目 `art-library/`；已有资源库或用户指定路径沿用。消费入口 `art-direction.md` 默认位于库根，使用 YAML frontmatter 加人可读正文。所有元数据文件路径相对库根，不相对机器、不引用工具默认缓存。

若目标项目或当前任务仓库有 `art-library.location.json`，先读取其 `local_root`，相对定位文件目录解析为实际库根，沿用其中 `repository` 和 `direction`。定位文件描述跨仓库位置，不改变库内相对路径契约；工具不会自动发现定位文件，调用者将解析结果传给 `--root`。显式用户路径优先；已有定位但目录未就绪时说明缺口或按授权取得私库，不回退向历史目录写新图。技能规则属于技能 Git，图片、文字档案、提示词、候选和资源索引属于美术 Git；旧上传例子按保留策略留存，不追加新美术、不自动双向同步。

```text
art-library/
  art-direction.md
  styles/<style-id>/<version>/
    style.md
    references/<认可图版本>.png
  productions/<讨论任务>/
    README.md
    discussion.md
    selection.json
    prompts/
    previews/
```

不重复复制已有图或风格文档，引用实际版本文件。候选 selection.json 沿用已有格式，记录候选ID、文字/图片路径、模型原尺寸和提示词；新讨论使用确有需要的记录，不建空目录。

## art-direction.md 元数据

- schema_version：1。
- status：discussing / confirmed。中文正文对应“讨论中 / 已确认”。
- scope：默认 project；用户另指定时用实际范围文字。
- design_canvas：width / height，正整数，默认1920/1080。
- selected：讨论中可为null；确定后包含 style_id、style_version、style_file 与 reference_images。
- reference_images：每项 path 和 sha256，必须是该风格版本 references/ 下的实际图片；从保存原件计算校验值，不能捏造。
- confirmation：确定后包含真实 user_message；可补记录时间和来源，工具不把记录存在当成独立用户授权证据。
- candidates_file / discussion_file：可选，引用已保存候选与讨论记录。

完整文字只存 styles/<ID>/<版本>/style.md，包含艺术描述、配色、材质、笔触、光照/视角、造型、分层约束、固定提示词及避免项；入口正文写决定、适用边界和后续制作约束，通过链接指向全文。确认后不静默改写该版本，换风格保留旧资料并另建版本。

参考图是完整的认可方向图，不要求必须1920×1080原像素；记录模型实际尺寸与设计基准区别。正式素材尺寸交由美术资源契约。入口的校验值防止参考图在同一路径被改掉后还当成原定稿。

制作任务引用定稿文件和 style_id/version，消费者先读取入口，再读取style_file并实际查看reference_images；不能凭候选编号、style名称或 catalog 中的candidate状态开工。若已存在 catalog.json，选定ID/版本/文档路径必须与其对应条目一致；没有catalog的独立风格讨论也可使用。
