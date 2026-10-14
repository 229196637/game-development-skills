# 验证记录

状态：**源工程与技能已实现；真实 FGUI 预览、视觉/状态验收和资源发布未完成。** 本记录不把桥接返回“已启动”或 XML 检查当作视觉验收。

已实际执行：

- 编辑器分配 UiCompositionDemo 包和两个组件 ID；六张素材由原生导入操作或 FPackage.ImportResource 登记，后两张导入任务状态返回 completed 和真实 ID。
- FPackage.CreatePath/MoveItem/Save 将组件放入 item、素材放入 Image，保留全部 ID；五页面实例共用一个 EntranceButton。
- 布局映射包含五主体、共享底座、五独立文本，排除技术标注与背景。PNG 保持 1254×1254 和透明通道；原尺寸和显示尺寸分别记录。
- 工具检查真实实例 src、标题/icon 配置、依赖和路径边界。测试涵盖错误实例、未知跨包依赖、已有隔离目录、越界路径以及没有 FUI 时拒绝报告导出成功。结构结果见 [structural-checks.json](structural-checks.json)。
- 源与隔离 Publish 设置均关闭 allowGenCode、sceCodeGeneration.enabled。原工程 assets、settings 与既有 C# 绑定共 73 个文件哈希未变：[baseline-check.json](baseline-check.json)。没有修改游戏业务代码。

未通过的实际尝试：

1. 当前编辑器 6.1.4 的 Puerts 无 Node fs，原 CSharpUiBindingExporter 编辑器回调加载失败。已有导出函数可由外部 Node 调用，兼容入口已提供；端到端仍须真实发布后验证。
2. 现有 MCPBridge 的 Touch/reload 返回成功，但预览沿用了创建时的空组件缓存，docContainer 下设备容器宽高为零。截图返回空/不可读像素，未产生合格预览。失败适配不随技能交付。
3. 官方命令行 `-batchmode -p` 实际启动 Unity 编辑器，日志返回 `This feature is only avaliable in professional FairyGUI-Editor.`，没有导出 FUI/图集：[editor-publish.log](editor-publish.log)。当前专业版能力不可用，没有绕过授权。
4. 代码切换工程后桥接未重新连接，命令超时。仅提供源文件，未将“已调度”写成成功。

用户要求停止桌面操作后，未继续使用鼠标键盘工具；后续使用文件、API 桥接与隐藏命令行。正常 -p 加载尝试也未连接到目标桥接。制作过程中缓存和截图问题已记录，不保留假预览或伪造二进制。

尚需真实编辑器完成：读取最终 XML 后观察五入口排布与锚点接触，标题/字体溢出，按钮按下回弹、点击范围，公共表现修改在五实例生效；发布并检查跨包引用、图集切片、字体和 package/text/button manifests。`check-export` 在缺少真实产物时应失败。

不需要 Client/Server 编译：本次没有修改游戏代码；工具/文档检查不能替代上述视觉验收。示例采用已有美术演示布局，不代替用户最终风格选择。

检查时间：2026-10-15 00:08:12 +08:00。技能格式校验通过，52 项结构/路径/资源/链接检查通过；4 张 Mermaid 已实际渲染为带超链接的 SVG。外部 Node 成功加载现有插件的五个资源导出函数；此项仅证明调用入口可用，不代表本例已发布。
