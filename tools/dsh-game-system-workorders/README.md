# DSH 游戏开发工单

原生 DSH Host/Client 插件：在会话内查看 game-system 技能的 Markdown 工单、按最近更新选择任务，在当前会话排队启动规划或执行。工单文件是唯一状态来源，插件不另建任务数据库，不修改工单或绕过领取/测试/验收门禁。

## 使用

- `/game-tickets`：独立只读扫描当前工作目录下的 `docs/规划`。在输入区的「查看工单」或会话「游戏工单」视图中查看，无须等待当前模型工作结束。
- `/game-execute`：打开未完成任务选择器，不会静默执行最新任务。输入该命令时，插件提供最近任务候选；可点选补全路径。也支持 `/game-execute "D:\\Project\\Example\\docs\\规划\\背包"`；命令的双引号路径采用 JSON 转义，界面会自动处理。
- `/game-plan 需要规划的功能需求`：向当前会话提交规划请求，只生成文档与工单，不自动执行。

界面按钮启动前会显示确认目标。忙碌会话使用原生 queue，不 steer、不新开模型会话。界面查询通过独立静态只读 Remote 直接完成，不进入模型队列，也不追加命令历史；显式 slash 命令仍保留原生命令记录。没有工单时显示空状态，不伪造演示任务。

## 界面

会话视图与输入区临时卡片共享所选任务。支持任务名称/项目搜索、最近更新时间排序、包含已完成任务、扫描子目录、工单状态过滤；显示领取者、依赖、下一就绪项、工作项、最近测试与验收及报告路径。可读取所选任务入口、类工单和直接职责文档原文。工单完成率与工作项完成率分开显示；工单完成不代表分支合并或任务级收尾已完成。

可见卡片每 15 秒刷新所选任务，隐藏页面暂停。后台文件变化时保留旧快照并提示不稳定，禁止用不稳定快照启动。仅存储会话的所选任务路径偏好，不存任务状态。

扫描限额：深度 6、目录 1500、目录条目 15000、任务入口 100；跳过隐藏、依赖及生成目录。触限显示 partial，需指定更具体的扫描子目录；不是全盘无限搜索。错误入口单独显示，不当作已完成隐藏。文档预览限 256 KiB，快照输出限 1 MiB。

## 技能分工

- `game-system-development-documentation`：API 改为 `<类型>.cs.api.md` / `.ts.api.md` / `.py.api.md`。API 仅公开用途、原语言签名、必要参数返回和关键约束，链接到职责文档的操作、协作、生命周期与失败处理详情。正式与 planned/mixed 设计态仍分开。
- `game-system-development-planning`：维护类工单与 README 顺序；新增只读 `planning_tool.py dashboard --root <任务目录>`。结构化状态以类工单为准，入口不复制状态。
- `game-system-development-execution`：复用相邻规划技能的任务存储；领取、锁、owner、依赖和完成证据门禁保持不变。

文档技能提供 `migrate_api_documents.py <授权项目文档根>`，默认 dry-run；先阅读其 `--help` 和迁移预览，显式 `--apply` 才写入。仅文档 API 声明受支持，不改生产源码/SDK。目标冲突、职责归属歧义或包含实现会拒绝；新文档验证、修复授权范围引用后才删旧文件。迁移保真保留长注释到职责章节，需人工润色，进程内事务回滚不等于断电恢复。不会自动迁移其他项目。

## 构建与回归

先 `npm ci --ignore-scripts` 安装锁定的运行/测试依赖；`node scripts/build.mjs` 生成安装产物；`node --test tests/*.test.mjs` 测试 Host 操作与 Client 注册。Python 技能回归位于 `tests/workorders` 与 `tests/api-documents`，分别使用 `python -B -m unittest discover -s <目录> -v`，需要 PyYAML（本次 6.0.3）。

在本仓库中回归时，先将 `WORKORDER_SKILLS_ROOT` 环境变量设为仓库根目录（含三套相邻技能），再进入本插件目录执行以上命令。这样验证的是仓库内技能，而不是个人已安装副本。源码、测试与 lock 文件纳入 Git，`node_modules`、`dist`、`*.tgz`、缓存和临时运行样例均忽略。

零第三方构建依赖、无安装脚本。运行需要当前 DSH 的 commands/tools/fs/subprocess/skills/workingDirectory/sessionController 服务及会话 slot；Python 3 在运行环境可用，可用插件配置 `python` 指定可执行路径。技能通过 DSH skills 服务动态解析，不写死用户目录。

## 安装、兼容与恢复

先 `npm ci --ignore-scripts`、`node scripts/build.mjs` 和 `npm pack --ignore-scripts`，再使用官方 `plugin_manager install_bundle` 安装生成的 `.tgz`；不安装源码目录的 link（本次观察到 link 切归档时源目录被清空，已恢复并独立备份）。运行依赖固定为与宿主匹配的协议包 0.2.1-rc.4 与 Cordis 4.0.5，源码直接运行也需安装这些依赖。不要手改 profile 文件，不要直接复制到 DSH 核心。安装前备份插件状态和三个技能，安装只新增本包，其他插件启用状态不变。以安装返回的 live/restart-required 为准；需要重启时先保存会话，重启现有 DSH 再刷新原 GUI，不另起替代服务器。

初始目标环境为桌面 2.0.21-next、DSH 0.2.1-rc.4。Client 使用宿主 React 与原生 slot/Remote，没有私有组件导入。卸载/禁用本包应清理 slot、监听器和定时器；不删除项目工单或技能文档。技能备份可单独恢复，不能覆盖还原其他插件的后续设置。

安装成功、Host 激活、Client slot 挂载、实际视觉及忙碌交互是不同验收层级，必须分别报告。不能仅以编译、日志或 slot 存在代替实际用户交互验收。
