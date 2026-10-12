---
name: sce-log-adapter
description: 将项目 debug-tools、sce-preview-verify 和 client-only-debug 的日志定位规则提炼为 SCE/WasiCore 可选适配。
---
# SCE 日志适配

本适配来自项目内 debug-tools 的 Logs、sce-preview-verify 的 Evidence Rules、client-only-debug 的日志解析规则，以及项目 Runtime Logs 指令。原技能仍负责启动/预览，不复制它们的启动、部署、输入或资源操作到只读日志技能。

## 先解析根目录
查项目文档和已有启动结果中 workingDirectory、logsRoot。纯客户端项目可查现有 helper 的已保存解析结果/启动输出；需要 ResolveOnly 时先读当前 helper 文档和代码，确认该选项只做路径解析，不直接套未知脚本。缺配置时明确让用户提供编辑器位置或打开项目补齐，不扫全盘。

编辑器内置运行的日志根通常是 <EditorRoot>/logs，具体根必须从当前环境核实，不硬编码来源机器的盘符/用户名：
- client/：客户端 wasm 运行日志。
- server/：服务端 wasm 运行日志。
- lua/、CSharp/、Network/ 等兄弟目录及根文件：宿主、脚本初始化、编译或网络子系统；按实际子目录选择。

用户问“编辑器日志”时先列根目录近期文件，再按问题查宿主或客户端/服务端。角色/战斗/场景故障优先本次服务端和客户端 wasm 日志，宿主 Lua 在项目打开或事件桥接异常时补查。

## 识别会话与日志类别
常见运行文件包含 wasm-default-*（client）、wasm-game-server-*（server）；只是候选命名，仍核对内容。项目根 Client-Debug.log/Server-Debug.log 往往是 dotnet build 输出，不能用作运行证据。纯客户端不存在服务端运行，不能将它的成功当作服务端/多人协作验证。

需要纯客户端模式判据时查实际输出，例如 Client-only mode、RunMode=ClientOnly；路径权限问题可查 WASI user_files main preopen、writable。也查项目、客户端 PID/槽位及启动模式，避免混淆旧 launcher 与真实 sce 子进程。

## 分析边界
正常模式场景需读服务端加载/切图与客户端本地就绪日志；加载受理不等于完成。黑屏等表现还需要截图/实际 UI 或渲染证据，日志本身不能确认画面正确。SDK 缺资源、烘焙缺失与旧 DLL 均先依据实际日志/API/构建部署记录区分，不能直接执行 resource_statistics 或重新部署。

日志可能有缓冲；没有刷新不证明事件未发生。Game.FlushLogs 仅在已授权的 smoke/复现代码和真实 API 中考虑，不能为“读取日志”自行插入生产埋点或启动程序。进程残留先调查相关日志/进程身份，不按进程名批量结束。
