# 布局与资源映射

实际查看参考图，记录源宽高与设计宽高，坐标转换为 x×1920/源宽、y×1080/源高。裁切或留白时明确偏移，不直接对非同比例图拉伸。

元素框的四边分别换算、取整再求宽高，不能因为单独生成图更大而放大display_rect。正式PNG原大小应等于设计框；提取或替换已有元素时读取reference_region/design_rect并检查handoff。整体设计到运行分辨率的统一缩放与单项错误尺寸不同，需在映射说明中明确，不能把原稿缩放预览称为正式尺寸完成。

记录每个元素的矩形、层级、对齐、间距、标题、点击范围和重复结构。排除场景背景及素材清单技术文字。接触锚点使用素材原坐标；显示坐标等于实例位置加素材偏移加锚点乘显示比例。

映射 JSON 使用 `design_size`、`reference`、`style_id` 和 `elements`。每行包含 `element`、`asset_id`、`version`、`native_size`、`display_rect`、`package`、`component`、`instance`、`decision` 与 `reason`；独立文字或无素材节点可以不填 asset_id，并解释原因。记录资源来源相对路径及 SHA256，避免新版本素材悄悄替换。

盘点组件要看 XML 内部结构、title/icon 约定、控制器动作和 transition，查所有 src/pkg 及 ui:// 引用。分析资料和技术审阅图放 `review/`，不进入游戏页面。
