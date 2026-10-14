---
schema_version: 1
status: confirmed
scope: project
design_canvas:
  width: 1920
  height: 1080
candidates_file: productions/xianxia-paper-fusion/selection.json
discussion_file: productions/xianxia-style-exploration/discussion.md
selected:
  style_id: xianxia-paper-collage
  style_version: v2
  style_file: styles/xianxia-paper-collage/v2/style.md
  reference_images:
  - path: styles/xianxia-paper-collage/v2/references/user-approved-v1.png
    sha256: 032749fd460a5b53fd31de4e44717c95a9addb8f99fc19bde6f8ad63ff8fa055
  - path: styles/xianxia-paper-collage/v2/references/ui-approved-controls-v1.png
    sha256: c18e5996c8fafa08410a30d09c12fabc700366a16efce6a6f3517d82e0418b6f
  - path: styles/xianxia-paper-collage/v2/references/ui-approved-inventory-v1.png
    sha256: 6825c553af48f49489ce2222b9160aa7a4495406e57bb99f182557d983f5d14e
confirmation:
  user_message: 还是这种把；记录这个风格 统一了 目前 然后基于这个生成多几个常见的ui元素 例如按钮 界面 背景 等等
  source: 当前对话，用户附图明确确定全游戏风格
  ui_user_message: 这一套可以 再跑多几个版本 尤其是哪个x按钮的设计 要求有点特色；反正带有中国特色就行
---
# 仙侠游戏美术定稿

状态：已确认；适用范围：目前整个游戏。设计基准1920×1080。

用户选定纸艺融合柔彩v2，保留纸张浅浮雕、青绿朱砂奶白、柔和光照及适量花枝云纹，主体与支撑统一。v7大幅简化稿未采用，旧候选保留。

[完整风格描述](styles/xianxia-paper-collage/v2/style.md) · [用户认可的真实参考图](styles/xianxia-paper-collage/v2/references/user-approved-v1.png) · [历史讨论](productions/xianxia-style-exploration/discussion.md)

后续制作统一先读本入口，再实际读取完整风格和参考图。常用UI美术不烘焙业务文字；背景独立存放，不叠加进默认UI检查预览。改变已确认风格建立新版本。

## UI制作约束

用户反馈第一批UI装饰过多，随后克制版又太简单。全游戏风格不变；UI需保留游戏设计感，边框可带细云纹、折角和分层轮廓，标题有造型，内容区清楚，避免密集花枝。当前待反馈：[适度纹饰UI新稿](productions/paper-ui-designed-v3/README.md)。入口道具的装饰密度不直接照搬到按钮、物品槽和内容区。

## 认可的UI基线与关闭按钮讨论

用户认可适度纹饰UI整套，实际上传的控件板和背包图已保存为同版本参考。全游戏方向继续v2，UI基线沿用paper-ui-designed-v3；[关闭按钮及配套UI三版](productions/paper-ui-close-variants-v4/README.md)仍待选择。
