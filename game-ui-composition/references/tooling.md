# 工具调用契约

Python 3 标准库即可执行 `scripts/composition_tool.py`。参数路径相对当前工作目录；工程内引用须相对工程。所有检查输出 JSON，失败退出非零；`visual_verified=false` 表示结构检查不能替代看图。

```powershell
python scripts/composition_tool.py inspect --project <FGUI工程>
python scripts/composition_tool.py check-mapping --project <FGUI工程> --mapping <映射JSON>
python scripts/composition_tool.py prepare-export --project <FGUI工程> --destination <新的隔离根> --packages <目标包>
python scripts/composition_tool.py bridge --project <隔离根/FGUIProject> --queue-module <已有CommandQueue.py> --action list_packages
python scripts/composition_tool.py check-export --project <隔离根/FGUIProject>
```

`prepare-export` 保留目标包及递归跨包依赖、字体、设置与现有插件，拒绝覆盖已有目标。导出前检查实际插件固定写出位置。脚本只准备工程，不打开编辑器、不发布。

`bridge` 用 importlib 加载项目既有 `.mcp/FairyGUI-MCP/src/mcp_fairygui/bridge/command_queue.py` 的 `CommandQueue`，不另外实现通信。编辑器须打开同一个 --project，并加载其 MCPBridge。可传 `--params '{"package_name":"UiCompositionDemo","component_name":"UiCompositionDemo"}'`；Shell 必须使用实际 JSON，Windows PowerShell 的引号行为按版本核对。

动作先查现有 command_handler.lua。常用顺序：reload → open_component → start_test → capture_preview → stop_test → publish_all。create_component 使用编辑器分配 ID。发布返回 success 仍须 check-export。

当用户要求只通过代码处理时，不使用桌面鼠标键盘。当前适配提供 `install-bridge-adapter --project <独立工程>`，将少量动作加入既有 handlers，并使用既有 reload_signal 热重载。适配来自编辑器随附 `StreamingAssets/Scripts/Puerts/editor.d.ts` 中实际 FPackage API，保持同一 CommandQueue 协议：

- `composition_import`：package_name、name（带扩展名）、source（实际文件）、path（如 /Image/）；使用 ImportResource 返回异步任务，started 不是导入完成。
- `composition_import_status`：name；读取任务完成状态，返回编辑器生成的 id 后才继续。
- `composition_move`：package_name、name（资源名无扩展名）、path；使用 CreatePath/MoveItem/Save 保留 ID。目标重名需先调查，不能覆盖未知文件。

原生 import 和 move 已在 6.1.4 验证；此适配不增加项目切换或渲染器。安装前检查桥接版本，源工程不修改原游戏插件。新增图像的技术元数据可由 Python 读取；素材修改仍路由到美术技能。

官方 [命令行发布文档](https://www.fairygui.com/docs/editor/publish/) 的 `-batchmode -p` 在本机 6.1.4 返回专业版授权限制，不能绕过。桥接与命令行均不可用时交付源工程，记录未预览/未导出；不能交付伪造 FUI。

FairyGUI 6.1.4 的 Puerts 缺少 Node `fs`，当前 CSharpUiBindingExporter 无法在编辑器内加载。此版本可在编辑器真实发布之后，使用外部 Node 调用**同一插件已有**资源导出函数；不调用 generateFiles/writeGeneratedFiles，不改原插件，不伪造 FUI：

```powershell
python scripts/composition_tool.py inspect --project <隔离工程> > inventory.json
node scripts/finalize_export.cjs <隔离工程> <现有CSharpUiBindingExporter/main.js> inventory.json
python scripts/composition_tool.py check-export --project <隔离工程>
```

插件主模块的外部 require 已是现有单元测试使用方式。桥接、编辑器和 Node 属于环境依赖，不随技能假装安装成功。若实际插件 API 不符，停止该适配并报告未完成项。

映射检查验证每行组件、复用理由、矩形与素材版本尺寸；盘点输出用于进一步核对页面实例/src、嵌套 loader 覆盖与 XML 文字。导出检查核对 FGUI 包头/ID/哈希、字体及图集存在、清单 JSON、无生成 C#。仍需实际查看切片、文字、按下回弹及所有使用方。
