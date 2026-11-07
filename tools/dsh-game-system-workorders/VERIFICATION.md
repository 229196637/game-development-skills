# 交付与验证记录

## 技能仓库集成回归（2026-11-07）

- 用户在热修复后反馈目前可以，并授权将插件与三技能更新放入已有 game-development-skills 仓库；仓库按用户最后确认保持公开，不修改可见性。
- 插件源码置于 `tools/dsh-game-system-workorders`，技能保留仓库根下的相邻布局；不提交 node_modules、dist、tgz、缓存或个人 profile。
- 从集成目录实际执行 `npm ci --ignore-scripts --no-audit --no-fund`、构建及 Node 全套 18 项通过；将 WORKORDER_SKILLS_ROOT 指向仓库根后，工单 23 项、API 文档 20 项均通过，共 61 项。测试的是仓库内技能，而不是个人安装目录的替代副本。
- GitHub 的常规 checkout 因 TLS/历史美术大文件未能完成，采用相同提交的 GitHub API 获取本次范围文本并逐一核对 Git blob SHA；历史图片及其他工具保持原提交对象，不重新上传或改写。

## 0.1.4 查询依赖热修复（2026-11-07）

- 用户实际浏览器操作报告 `cannot get property "remote.gameWorkorders" without inject`。此前 0.1.3 的 Host 读取和 Slot 挂载验证没有覆盖这一依赖访问检查，不能当作 UI 查询成功。
- 根因：`$mount` 在兄弟 fiber 提供 `remote.gameWorkorders`；父 `remote` 的注入不授权该子服务属性访问。修为每次查询用 `ctx.get('remote.gameWorkorders')` 可选读取并判断服务就绪。不能把自身在 apply 内挂载的服务直接加到顶层硬依赖，否则启动互相等待。
- 新增 `tests/client-injection.test.mjs`：真实 Cordis Context/Service、兄弟 provider 与生产 Client 源码。旧源码实跑重现同一错误，修复后发现/快照/文档查询均通过；服务撤销时显示可用性错误，不退回命令历史或模型执行。
- 本次 Node 全部 18 项通过（206.6ms），包含新增依赖访问回归；Python 与技能未改动，没有把上轮结果冒充本轮重跑。
- 官方卸载旧包并安装 0.1.4 归档：application=applied；读取已安装 package.json 为 0.1.4，已安装 dist/client.js:84 确认使用 ctx.get。实时 composer.dock 工单项 active，未改其他插件状态。独立完整备份 complete-source-0.1.4；归档 SHA256 38B0FDCF7B4B77BCEDE28368899CB4CC8FA360CB05656C253E8ABAC0F0EAE0B5。
- 本次没有浏览器控制，自动测试不冒充更新后的实际浏览器点击验收。请刷新页面后重试查看工单；未要求重启进程。原 0.1.3 的分层验证保留在下方作为历史。

## 0.1.3 历史记录（非热修复状态）

- 日期：2026-11-07，重启后复核于 13:03–13:05（Asia/Shanghai）。
- 安装包：@local/dsh-game-system-workorders 0.1.3。
- 当前宿主：DSH 0.2.1-rc.4；当前 GUI：http://127.0.0.1:61638。
- 通过官方 plugin_manager 安装归档，返回 application=applied；不修改 DSH 核心，不另开服务。

## 已验证

1. 当前安装目录 package.json 为 0.1.3；Host 入口与查询注册文件完整，依赖声明为协议包 0.2.1-rc.4、Cordis 4.0.5。源码与独立备份均存在。
2. 重启后的实时 Client Slots 在 conversation.composer.dock 与 conversation.view 均包含 active 的 game-system-workorders；原生入口保留。
3. 重启后的已安装 game_workorders 工具在独立拥有的测试目录实际执行 discover、snapshot、document。返回待执行 1、阻塞 1、下一就绪 LiveBase、LiveDependent 依赖 LiveBase、已勾工作项 1/3、stable=true，并成功读取任务 README。
4. 查询前后的完整文件清单、SHA256、mtime_ns 一致，未改工单或追加执行记录；marker 保护的测试目录已清理，不将演示任务留在用户项目。
5. 当前 Node 16 项通过，包含实际 Cordis Service 生命周期、协议描述符校验、注册与卸载、切换任务/文档/扫描竞态、只读查询与排队启动隔离。
6. 当前恢复后的工单 Python 套件 23 项、API 文档 Python 套件 20 项均由主代理独立重跑通过。合计当前套件 59 项，不将恢复前的历史测试数量重复累计。

## 验证边界

- 没有浏览器控制或当前页面截图，因此没有声称已实际点击界面、检查浅色/深色排版或完成真实忙碌会话交互测试。
- game_workorders 工具与 UI 复用 Host operations；上述真实工具读取不等于已跨浏览器 Remote 全链路点击验收。Client 挂载与 Remote 相关测试另列，不混为同一层验证。
- 规划/执行的原生 queue admission、明确目标及去重由自动测试覆盖；未为验收向用户的生产工单发送实际执行请求。
- Service Inspect 使用宿主内置静态 API catalog（dsh-tool-cordis 的 providers.js 引用 api-catalog.js），不是新插件服务的实时注册目录。`no catalogued Service` 不能用于判定本插件没有激活。此前据此建议重启的诊断不准确，现已纠正。
- 全工作区发现有深度与数量限制，partial 不等于任务不存在。必要时填写更具体的项目扫描目录。

## 页面验收方式

1. 在当前会话输入区点击「查看工单」，或打开会话「游戏工单」视图。
2. 选择实际项目目录扫描，确认任务按最近更新排序，查看工单状态、依赖与两种进度。没有任务应显示空状态，而非演示数据。
3. 在主模型工作期间展开临时卡片，确认查询能独立返回且后台刷新不持续追加命令卡；输入 /game-tickets 本身仍有正常原生命令记录。
4. 输入 /game-execute 检查候选补全；选定目标后显式确认，任务在当前会话排队，不中断正在运行的工作。规划命令 /game-plan 只规划，不自动执行。

## 技能与文档

- 已更新用户技能根下 documentation / planning / execution 三技能；更新前完整备份位于 D:\Project\AIProject\dsh-game-system-workorders-backup\20261107-112831。
- 新 API 产物为 <类型>.cs.api.md / .ts.api.md / .py.api.md，原语言签名在 Markdown 围栏中；API 简明说明用途与必要约束，操作和详细契约在职责文档，API 链接过去。
- 旧独立声明模板已移除；旧项目迁移默认 dry-run，只有对指定 docs 或文档根显式 --apply 才写入，不自动改其他项目或 SDK。
- 迁移遇冲突、含实现、职责歧义或无法安全修复的引用时拒绝；进程内回滚不是断电安全事务，复杂语法与范围外引用需人工确认。

## 安装与源码安全

- 当前使用 tgz 归档安装，不再使用源码 link；此前 link 切归档期间观察到源码目录清空，已完整恢复并重建测试，不能将其未经证明地归因到某个具体内部操作。
- 最终源码与归档独立备份：D:\Project\AIProject\dsh-game-system-workorders-backup\complete-source-0.1.3。
- 最终归档 sha1：58d5c2da826d90d69e2fc22f5bc038643cee9871。
- 没有重置其他插件状态，也没有将原有 experimental-inspector 警告冒充本插件的加载错误。
