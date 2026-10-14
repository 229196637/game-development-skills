# 当前工程制作工具快照

MCPBridge 和 CSharpUiBindingExporter 从现有 FGUI 工程读取后原样复制，供复现使用；不是业务或生成绑定交付。复制所需目录到独立工程 plugins 后，使用 skill 的 `install-bridge-adapter` 加入已测试的 import/status/move 动作。CommandQueue 仍从已安装 FairyGUI-MCP 项目读取。

FairyGUI 6.1.4 的 Puerts 缺少 Node fs，CSharpUiBindingExporter 的编辑器回调无法加载。若已得到编辑器真实 FUI 和图集，外部 Node 可通过 `finalize_export.cjs` 复用此插件 publishPackageManifest/publishAtlasImages/publishFonts/publishTextManifest/publishButtonManifest；不调用代码生成函数。

本次尚未得到真实发布产物，此步骤未完成端到端验证。编辑器 API 以随附 `StreamingAssets/Scripts/Puerts/editor.d.ts` 为依据；[官方插件说明](https://www.fairygui.com/docs/editor/plugin/) 提供插件能力范围。
