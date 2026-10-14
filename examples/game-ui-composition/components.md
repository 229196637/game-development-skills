# EntranceButton 表现契约

位置：`UiCompositionDemo/item/EntranceButton.xml`，编辑器分配包 ID `r9hwuu4d`、组件 ID `dfr80`。页面 ID `dfr81`。所有五个实例 src 都是 `dfr80`，没有五套结构。

| 节点或属性 | 作用 | 实例配置 |
| --- | --- | --- |
| base / loader | 共享浮岛底座，320×320 | 默认共享底座 URL |
| icon / loader | 独立主体，保持原比例 | 原生 Button.icon URL |
| title / text | 游戏标题，200×48 | 原生 Button.title |
| art 控制器 | 五组接触锚点对应的位置和尺寸 | shop=0、quest=1、dungeon=2、friends=3、mail=4 |
| button 控制器 | up、down、over、selectedOver | 原生按钮状态；不含业务条件 |
| selectScale | 按下，从 1 到 1.08，0.18s Back.Out | 统一组件表现 |
| deselectScale | 回弹，从 1.08 到 1，0.14s Quad.Out | 统一组件表现 |

主体 URL 与 art 页应配套配置。换同类素材时读取其接触锚点并新增对应位置/尺寸页，不把 PNG 缩成新原尺寸。实际原图始终是 1254×1254；320×545 是按钮布局尺寸。

基于已有 MainTapBtn 动画结构调整初始比例到 1，以匹配设计像素；动作、时长、曲线及 title/icon 约定保留。修改这里的标题样式、底座或缩放表现会被五实例共同引用。动画与标题效果需真实预览验收，目前仅完成结构检查。

原组件影响范围：独立工程仅五个使用方；原游戏 MainTapBtn 与公共包未修改。只在此演示功能包复用，不声称这套美术按钮已经稳定到适合全项目公共包。
