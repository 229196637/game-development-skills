# 交付与验证记录

## 0.6.1 依赖图连线走向修正（2026-11-07）

- 用户反馈（附截图）：「这个线条太乱了吗 这两根线是啥。。优化一下」。截图里两卡之间看似有两条细曲线，其实是**同一条边**：控制点向两侧外扩形成 S 形，中段又被流动虚线遮住，两端弧线看上去就成了两条。
- 修正 `edgePath`：不再按 `hash32` 随机选边方向，改为只朝目标方向倾斜（`lean = sign(dx)`），控制点取 `x1 + bow*0.5` 与 `x2 - bow*0.5`，曲线因此始终单调、不会回折；两端水平差小于 6px 时 `bow = 0`，上下对齐的卡片直接走直线。弓幅改为 `min(|dx| * 0.5, 88)`，跨层 ×1.3。
- 同时降低排布抖动：行偏移强度 0.5→0.35、上限 ±240→±140；层内横向错落 ±10..28→±4..12、纵向 ±14→±10；链条更竖直，扇开只出现在真正的分叉处。
- 流动虚线弱化：`stroke-dasharray` 7 9→5 7、线宽 2→1.8，并加 `stroke-linecap: round`。
- 测试：`tests/graph.test.mjs` 增 2 项——上下对齐时控制点落在两端轴线上（不再是 S 形）、任意水平差下控制点都夹在两端点之间（不会回折）。全套 `node --test tests/*.test.mjs` 共 **84 项**通过。
- 打包与安装：`local-dsh-game-system-workorders-0.6.1.tgz`，52,962 bytes，SHA256 `1E7E0C43528C58A55574F8B07C94C153DE5B31881084F372B034650DB241DAB9`；官方 remove + install 归档 `application=applied`，版本 0.6.1；已安装 `dist/client.js` 121,808 bytes、SHA256 `36FF581C4ABC8F00423D91FE5A6169146937E679D02DEC5DB9588D486CB3C8AE`，与本地构建一致。
- 验证边界：仍无浏览器控制，曲线观感需用户刷新后确认；本轮未 commit/push。

## 0.6.0 依赖图流水动效、非网格排布与并行展示（2026-11-07）

- 需求（用户原话）：「工单如果推进的时候 这个线条可以来一点特效 这样好看一些。 就是流水的感觉 如果是工单相互依赖能搞清楚吗？ 最好可以 排布不是一条直线 而是这样的 。 同时我想知道 这个执行支持并行吗？ 就有时候可能一些任务是可以并行的 这些支持吗？」
- 根因：`graph.js` 原来把每层节点放在同一条基线上并按固定间距排开，`edgePath` 的两个控制点都落在两节点 y 的同一中点，于是所有连线都是同一种竖直 S 曲线；节点状态变化也没有任何视觉反馈。并行能力只存在于技能脚本与文档里，界面看不到。
- 排布：`buildGraph` 新增 `layout`（默认 `organic`，可传 `layered`）。`organic` 先按原网格给初值，再把每行朝其前置的平均位置偏移，随后按 `hash32(id)` 做确定性的层内错落，最后按 x 排序强制同层最小间距 `NODE_W + 18`，再归一化到非负坐标（0.6.1 把偏移强度与抖动幅度都调小，见上节）。层间距 142 减去纵向抖动仍大于卡片高度，所以跨层不会重叠；同层由强制间距保证不重叠。原来「每层水平居中」的网格保留在 `layered` 模式。
- 连线：`edgePath(from, to, options)` 的控制点改到 40%/75% 高度，按水平差与跨层数产生 bow；0.6.0 曾用 `hash32` 决定弯向，0.6.1 起改为只朝目标倾斜（见上节），`options.bow` 仍可显式覆盖，`{bow:0}` 退化为竖直线。端点始终在源卡底边中点与目标卡顶边中点，箭头语义不变。
- 动效：`edgeElements` 给每条边加 `data-flow`——目标是 `doing` 时为 `active`，本次快照刚进入 `doing`/`completed` 时为 `recent`（`progressedTargets(previous, next)` 纯函数计算，1.6 秒后清除，定时器在卸载时清理）。CSS 只用 `.gwo` 作用域与主题 token：`stroke-dasharray` + `@keyframes gwo-flow`（`stroke-dashoffset: -16`，负偏移即沿依赖方向流动），`recent` 另加一次 `gwo-flash`。`prefers-reduced-motion: reduce` 下全部动画与虚线关闭；工具条另有「关闭动效」开关，按会话与任务根记在 `viewState.graphs[root].motion`，关闭时整块 `data-motion="off"`。
- 并行展示：`buildGraph` 新增 `parallel`（就绪集合，按层序）、`waves`（每层 id）与节点 `band`；图区标题显示「可并行 N」、图区提示写明「{n} 项就绪工单可同时领取」，可领取卡片加 `data-parallel`（品牌色内描边），右上详情列出「同批可并行」并可点击跳转。
- 排布切换：工具条在动效开关旁提供「展开排布 / 分层排布」按钮，按会话与任务根记在 `viewState.graphs[root].layout`；切换只重算坐标，不丢缩放与平移。
- 并行事实（写进 README，不改脚本）：`task_store.py:264-267` 的 `candidates()` 是「`todo` + 无领取人 + 所有前置 `completed`」，因此可同时多项就绪；`execution_tool.py claim` 在 `.execution.lock` 内按入口顺序发放，不同 owner 依次领取即可并行推进。边界：写入串行、不能越过未完成前置、锁不替代源码并行修改协调。看板只读展示，不派发、不批量领取、不改 owner。
- 测试：`tests/graph.test.mjs` 由 19 增到 23（`parallel`/`waves`、`layered` 仍单基线而 `organic` 错落、bow 与端点/确定性、跨层 bow 更大）；`tests/graph-view.test.mjs` 由 12 增到 15（doing 只让入边 `data-flow=active`、就绪卡片带 `data-parallel`、动效按钮持久化）；新增 `tests/graph-motion.test.mjs` 3 项（`progressedTargets` 只认状态迁移、CSS 的 token/作用域/reduced-motion、动画选择器不越出 `.gwo`）。全套 `node --test tests/*.test.mjs` 共 **82 项**通过。
- 打包与安装：`local-dsh-game-system-workorders-0.6.0.tgz`，15 files、52,901 bytes，SHA256 `BCC707BEC79CF356A6334D1055EBEAF49E05450E0A484F1B266D559B092A7AAA`；官方 remove + install 归档 `application=applied`，版本 0.6.0，唯一 warning 仍是既有 experimental-inspector `globalThis.fetch` accessor，其他插件启用状态未改。已安装 `dist/client.js` 121,636 bytes、SHA256 `056BC163C8932922DB00B9479D40875C96684216071D7B97E92B70E28C6D1015`，与本地构建逐字节一致；含 `layoutOrganic/layoutLayered`、`progressedTargets`、`data-flow`、`data-parallel`、`gwo-flow`。
- 真实工具：隔离 `tests/runtime-check` 的 `game_workorders snapshot` 返回 `ready:["LiveBase"]`、`next` LiveBase、`LiveDependent depends_on ["LiveBase"]`、items 1/3、`consistency.stable:true`、`cached:false`，字段契约未变；`python -B scripts/live-fixture.py cleanup` 返回 `removed:true`。技能回归 `tests/workorders` 23 项、`tests/api-documents` 20 项，退出码均 0。
- 验证边界：仍无浏览器控制。曲线观感、流动速度、层内错落的密度、窄屏与壁纸下的可读性，都需要用户在刷新后的 GUI 里手测；自动测试只证明几何不重叠、确定性、类名与数据流，不等于视觉通过。本轮未 commit/push。

## 0.5.0 右键平移与工单加载缓存（2026-11-07）

- 需求（用户原话）：「我需要你右键拖动。。 不是鼠标中键」；「工单系统可以做一个缓存。 这样不需要每次都加载这么久」。
- 平移手势：`MapView` 的 `onPointerDown` 改为右键（`button === 2`）在任意位置（含卡片上）开始拖拽；中键（`1`）不再平移并 `preventDefault` 抑制浏览器自动滚动；左键仅在空白画布处平移，按在卡片上仍然只做选择。视口绑定 `onContextMenu` 阻止右键菜单，指针捕获改在视口元素上，拖动时输出 `data-panning` 供 CSS 切 `cursor: grabbing`。
- 根因：`dashboard` 每次都要让 Python 全量枚举 `docs/规划` 下所有 Markdown、逐个读字节算 SHA256、对输入签名比对 2–3 轮；客户端每次打开工作台还先跑一次 1500 目录 BFS 的 `discover`。两者都与「只是看一眼工单」不成比例。
- Host 缓存（新 `src/host/cache.js`，纯逻辑可注入时钟）：指纹取自**上一次结果派生**的路径集合（任务入口、每个工单与其职责文档、`references`、最新测试报告、验收证据里的路径），逐项 `fs.stat` 取 `type/size/version`，再加每条路径所在目录的版本（新增/删除/改名会改目录版本，纯内容改写不会）。命中要求「不超过 10 分钟」且指纹全等；LRU 8 条；同任务并发请求合并为一次真实读取，单个调用方取消不会掐断共享运行。命中返回原 `readAt` 并附 `cached`/`servedAt`，不伪造新鲜度。
- 缓存接在 `operations` 层（`dashboardCached`），因此现有测试替身能覆盖；`snapshot` 与 `document` 共用同一次读取；`submit('execute')` 强制 `fresh: true`，执行前仍读真实工单并拒绝不稳定状态。`discover` 另加 60 秒 TTL，只影响任务选择器，「重扫」强制绕过。
- Client 缓存（`src/client/index.js`）：`localStorage` 键 `dsh-game-workorders/snapshot/v1`，最多 4 个任务、单条 512 KiB，按 `at` 淘汰，解析/配额失败静默丢弃。命中就先 `update({snapshot, stale:true, cachedAt})` 立即出画面，同时后台 `select` 复核；复核成功写缓存并清 `stale`。`stale` 时「继续执行」禁用并提示「正在校验最新工单」，`start('execute')` 在客户端也直接拒绝；规划不受限。
- 顺带修掉一个真实缺陷：原来「记住的任务路径」存在 `gwo:selected:<会话>:<discovery.cwd>` 键里，而缓存优先打开时还没有 `discovery`，键对不上就永远找不到上次的任务。现在新增与会话绑定、不依赖扫描结果的 `gwo:root:<会话>`，旧键保留为回退。
- 顺带修掉第二个真实缺陷：指纹集合原本取自 `dashboard` 的返回值，而 `readme` 是 `snapshot()` 之后才补上的，导致「只改入口 README」不会失效。现在 `dashboardCached` 的产物包含 `root`/`readme`，入口改动也会让缓存失效（有专门用例覆盖）。
- 测试：新增 `tests/cache.test.mjs` 8 项（指纹去重与路径判定、命中、版本变化失效、目录版本失效、过期/LRU/`fresh`、并发合并只读一次、`discover` 键与过期、`operations` 层命中与真实改动后重算、`document` 复用缓存且执行强制重读）；新增 `tests/client-cache.test.mjs` 4 项（缓存优先出画面且零查询、复核后写缓存并清标识、损坏/超限/超出条数被忽略或淘汰、`stale` 拦执行但放行规划）；`tests/graph-view.test.mjs` 增 3 项手势（右键在卡片上也能平移且吞掉右键菜单、中键不平移且抑制滚动、左键按卡片不平移/按空白平移）。全套 `node --test tests/*.test.mjs` 共 **73 项**通过。
- 本机实测（40 工单 / 263 个 Markdown 文件，`.agent-tmp` 下生成后已删除）：`planning_tool.py dashboard` 冷读 499 ms、热读 289/332 ms；同一快照的缓存命中走 104 个 `stat` 约 8 ms（首次建立 12 ms）。这是本机单次测量，不是跨机器基准。
- 打包与安装：`local-dsh-game-system-workorders-0.5.0.tgz`，15 files、48,328 bytes，SHA256 `A445769DC04757F5BFEC025556993B6136C3FDAAD883F840B8258B7941BB07DD`；官方 remove + install 归档 `application=applied`，版本 0.5.0，唯一 warning 仍是既有 experimental-inspector `globalThis.fetch` accessor，其他插件启用状态未改。
- 安装后实测：已安装 `dist/client.js` 109,720 字符，含 `!== 2`、`onContextMenu`、`data-panning`、`gwo:root:`、`dsh-game-workorders/snapshot/v1`、`gwo-chip-cached`、`hydrateSnapshot`；`dist/host/cache.js` 6,388 字符且 `operations.js` 含 `dashboardCached`。marker 保护的隔离目录走新缓存：第一次 snapshot `cached:false`，第二次 `cached:true` 且 `readAt` 不变、`servedAt` 更新；随后 cleanup `removed:true`。仓库根技能回归：工单 23 项、API 文档 20 项，退出码均 0。
- 验证边界：仍无浏览器控制。右键拖动与其光标反馈、滚轮缩放、缓存徽标是否可见、刷新后是否真的「秒开」，都需用户在当前 GUI 手测；自动测试只证明事件处理、缓存判定与数据流，不等于视觉与手感通过。

## 0.4.0 三栏工作台与可平移画布（2026-11-07）

- 需求：用户认为 0.3.0 的工作台与依赖图布局不合适，要求照参考图重构成「左侧大面积可移动节点画布 + 右侧列表卡 + 底部整宽详情」的信息密度布局，并明确节点图要能拖动；同时上一轮独立评审留下的 1 个 P1、3 个 P2、5 个 P3 一并修掉。
- 布局：`dialog` 上限 1360×920，纵向 header（auto）+ main（flex）+ inspect（min 300px / 34vh）+ footer。main 为 `minmax(0,1fr) 360px`，右列 `minmax(0,44%) / minmax(0,56%)`。header 放任务名、根路径、任务选择器（目录/包含已完成/重扫/任务过滤）与四个统计胶囊；左卡是可平移依赖画布；右上所选工单详情；右下状态 chips + 搜索的工单列表；底部整宽六页签（工作项/测试/验收/证据/文档/规划）与原文视图。断点 1100/900/620，窄屏降为单列。
- 画布：节点仍是原生 `button`，放在 `translate(pan) scale(zoom)` 的平面上（不是位图 `<canvas>`，保留文字清晰度、命中测试、键盘与读屏）。空白左键或任意处中键拖动平移，`Ctrl/⌘ + 滚轮` 以光标为锚缩放，普通滚轮平移；工具条另给 −、比例、+、适应、1:1、定位当前。`viewState.graphs[任务根] = {open, view:{zoom,pan}}` 按会话与任务根持久化，收起只切显隐，视野不丢。
- 新 `src/client/graph-view.js`：`fitView`/`zoomAt`/`panBy`/`centerNode`/`nearestNeighbor` 纯数学，`createGraphView({React,t,button,lib})` 返回 `MapView`；`lib` 注入 graph 纯函数，避免内联构建与 ESM 测试各自需要不同 import。
- 修复 P1（上限不生效）：`countGraph` 先做 O(n) 计数，不再先整图布局；`buildGraph` 的 `maxNodes/maxEdges` 是硬上限，超限时按 `focusSet` 前后置闭包裁剪并如实返回 `truncated`；「显示全部」用 2000 节点 / 8000 边硬顶并提示截断，可退回局部图。
- 修复 P2（局部图臆造缺失）：缺失前置只按完整快照 `known` 判定，界外前置不再误报成 missing。
- 修复 P2（收起丢视野）：`open` 参与视口初始化，收起改显隐而非卸载视野状态；`open` 重新打开即恢复 `pan/zoom`。
- 修复 P2（提示与回退）：局部图提示与「显示全图」按钮在 `all` 模式下换成「全图提示」与「回到局部图」，边数与节点数两种超限分开表述。
- 修复 P3：循环改用迭代 Tarjan 只标真实环成员，环的后代标为不可达并单列一行（新增 `deadlocked` 固定点，避免把「等一个环」的工单画成根）；自环与环内边不画；`isolated` 需同时无 missing 与无环；「定位当前」用节点中心计算并配合视口尺寸；收起后把焦点移到展开按钮并带 `aria-expanded`/`aria-controls`；节点 roving tabindex（只有选中项进 Tab 序）+ 方向键按空间最近邻移动 + Escape 回画布；节点内只用 `span`（`button` 的合法内容模型）；弱化用状态色 token 而非整体 `opacity`；适应允许到 0.02 而不夹在 0.3。
- 同步：`scripts/client-source.mjs` 内联顺序 graph → graph-view → media → seat → workbench；`src/client/index.js` 补中英 locale（旧的键全保留）；`src/client/workbench.css` 重写为分区布局，只用 `--dsw-alias-*`，无全局选择器。
- 回归：`node scripts/build.mjs` 后 `node --test tests/*.test.mjs` 共 58 项全通过（新增依赖图上限/SCC/自环/known/动态规划 7 项、画布视口数学 5 项、渲染结构 3 项：恢复 pan/zoom、roving tabindex 与 aria、超大快照降级）。`node --check dist/client.js` 通过。
- 打包与安装：`local-dsh-game-system-workorders-0.4.0.tgz`，44,218 bytes，SHA256 3845A523252E507EC93484F1F785C08FD91166CB46313A61063266D5A12EFAFF；官方 remove + install 归档，`application=applied`，版本 0.4.0，唯一 warning 仍是既有的 experimental-inspector `globalThis.fetch` accessor。
- 安装后实测：已安装 `dist/client.js` 106,489 bytes（含 `gwo-viewport`、`deadlocked`、`chooseTicket`）；marker 保护的隔离目录 `game_workorders` snapshot 返回 todo1/blocked1、next LiveBase、`LiveDependent depends_on ["LiveBase"]`、items 1/3、stable=true，字段与画布输入一致；随后 cleanup 返回 `removed:true`。仓库根技能回归：工单 23 项、API 文档 20 项，退出码均 0。
- 验证边界：仍无浏览器控制。平移手感、缩放比例是否合适、连线与节点在壁纸/玻璃、浅深色、窄屏下的可读性、右侧栏与详情带高度分配，都需用户在当前 GUI 手测；Slot active、工具可读与自动测试都不等于视觉通过。

## 0.3.0 工单依赖图（2026-11-07）

- 需求：工作台需要工单依赖的树状/分层图，节点卡片 + 连线，能看出前置关系与进度（用户截图仅作形态参考）。
- 新增 `src/client/graph.js`（纯函数，无 React、无 IO）：`buildGraph(tasks,{maxNodes,maxEdges,ready,next})` 去重、建边、Kahn 拓扑 + 最长路径分层、重心排序 4 轮、逐层居中，返回节点坐标、边、层数、画布尺寸与 `issues`（`duplicate`/`missing`/`cycle`）。循环不抛异常：全部环节点单独放到最下一层并报 `cycle`；只剩环的快照占第一行。另含 `relatedTasks`、`linkedIds`（上下游闭包）、`edgePath`（自上而下的三次贝塞尔）。
- `src/client/workbench.js` 新增 `Graph` 组件与 `chooseTicket`：默认展开，节点显示名称/ID/状态/可领取/下一就绪/工作项进度；箭头由前置指向依赖方；选中时高亮整条上下游并弱化无关节点；若所选节点被状态筛选隐藏则自动清除筛选；图始终基于完整快照，列表过滤不删节点；缩放、适应、1:1、定位当前、收起；展开/缩放/滚动按“任务根”记在会话内存里；节点是原生 `button`，可 Tab 聚焦并用 Enter/Space 选中。
- 规模上限：`>500` 工单或 `>2000` 依赖时默认只画所选工单及其直接前后置，给出提示与「显示全图」按钮；不静默截断，底层工单列表始终保留。
- 降级：空任务、全部无依赖、循环、缺失前置、重复 ID 均有就地提示；图区带 `max-height` 与独立滚动，不会把工作台或弹窗拉宽。
- 测试：新增 `tests/graph.test.mjs`（12 项：链式/菱形/孤立/进度与 ready-next/重复 ID/缺失前置/循环/只有环/确定性/maxNodes/画布内不重叠/上下游闭包）与 `tests/graph-view.test.mjs`（4 项：用最小 React shim + vm 渲染真实 bundle，核对卡片与箭头数量、选节点清筛选并高亮、收起、空快照）。全套 Node 43 项通过。
- 几何不变量：新增用例用 1 根 + 6 中段 + 12 叶 + 1 孤立（19 卡 / 18 边 / 层宽 2-6-12）逐对断言矩形不重叠、全部落在 `width`/`height` 内、每条边都满足 `from.layer < to.layer`；这只能证明布局数学，不能替代真实渲染观感。
- 事故与恢复（教训）：用 Windows PowerShell 5.1 的 `Get-Content`/`Set-Content -Encoding utf8` 改写含中文的 UTF-8 源文件，会把非 ASCII 按 GBK 读入再写回，`▶` 变成 `鈻?` 并吞掉其后的引号，文件语法损坏。恢复方式是从已安装包 `dist/client.js` 中按 `function createWorkbench(` 到 `return { App, Dock };` 之后的 `}` 提取原 0.2.1 源码（该段与 `src/client/workbench.js` 仅差一个 `export`），用 Node 以 UTF-8 写回并重做改动。此后含中文的文件只用 read/edit/write 或 Node 处理。
- 验证边界：仍无浏览器控制。分层、连线、缩放与命中测试只由自动测试覆盖；实际观感（节点是否重叠、连线是否清晰、壁纸/玻璃与浅深色下是否可读、窄屏与长任务滚动）需用户在当前 GUI 手测，Slot active 与测试通过都不等于视觉通过。

## 0.2.0 工单工作台与多媒体证据（2026-11-07）

- 用户反馈从输入区「查看工单」打开时文字、背景与聊天叠加，怀疑壁纸插件。只读核对确认：壁纸插件在 `body[data-we-wallpaper]` 把 `--dsw-alias-bg-base` 设为 `transparent !important`，玻璃子包又把 `bg-layer-1/2/3` 与 `bg-overlay` 改为半透明；原面板使用 `bg-base`，因此不是单纯文字对比度问题。
- 修复限定在本插件：完整界面移入原生 `dialog.showModal()` 的 top-layer，输入区只留按钮与任务名；面板使用局部 `--gwo-surface`（`rgb(from var(--dsw-alias-bg-layer-1) r g b / 1)`，旧引擎用运行时探针兜底）强制不透明，并标记 `data-we-surface-preserve`。未修改壁纸、玻璃插件或共享 composer 结构，未关闭用户任何插件。
- 新增 `src/client/workbench.js`、`workbench.css`、`media.js`：概览双进度、状态过滤、任务列表、工作项/测试/验收/证据/文档 tab、规划输入与执行确认；缩略图池单项 5 MiB、整页 20 MiB、并发 3、Blob URL 释放。
- 新增 Host `evidence(root,taskId)` 与 `resolveEvidence(root,taskId,evidenceId)`：只解析当前工单最新测试报告与验收证据里的标准 Markdown 链接/图片，并向下扫一层 `.md` 报告（≤256 KiB，每工单 ≤40 引用）；由任务白名单、真实路径、`contains` 与符号链接复核把关，resolve 重新校验并使旧 id 失效。不读任意路径、不拼 video-preview 内部 URL、不自动播放或转码。
- 媒体预览走公开能力：原生 `sidebarRight.openResource` + `fileAddressFor`，缺失时降级 better-sidebar 的公开 `openFile`；未引入 GenUI embed 或 image-gen 私有模块。
- 评审复现并修复的缺陷：证据打开请求缺少生命周期取消（关闭/切工单后仍会打开旧文件或重开弹窗）；会话切换复用组件导致搜索/筛选/规划需求串台；后台会话的延迟命令可能在别的座位弹窗。现在证据请求带 signal + root + previewRequest 校验；App/Dock 按 `sessionId` key；Dock 在 `showModal` 前按当前 mounted 会话判定，订阅后立即 reconcile。
- 回归：Node 27 项通过（含证据解析/越界/符号链接/失效、缩略图预算与中止、座位判定、真实 Cordis 依赖访问、会话/文档/扫描竞态）；将 `WORKORDER_SKILLS_ROOT` 指向仓库根后，工单 Python 23 项、API 文档 Python 20 项通过。合计 70 项，均为本轮实际重跑。
- 打包 `local-dsh-game-system-workorders-0.2.0.tgz`（29,975 bytes，SHA256 D3055FB890C6206BCDD2CE59295943E4557A7078CE2374C9BC3EC20A958E7CE5）；官方卸载旧包后安装归档，application=applied，版本读取 0.2.0，其他插件启用状态未改。
- 安装后实测：已安装 `game_workorders` 工具对 marker 保护的隔离目录执行 snapshot，返回 1 todo / 1 blocked、下一就绪 LiveBase、LiveDependent 依赖 LiveBase、工作项 1/3、stable=true；随后清理 fixture并核对无残留。实时 Slots 中 `conversation.composer.dock` 与 `conversation.view` 的本插件 occupant 均为 active，原生 occupant 保留。
- 验证边界：本轮仍无浏览器控制。不能声称已实际查看壁纸/玻璃/浅色深色搭配、缩略图渲染、视频播放或窄屏布局；这些需用户在当前 GUI 手测。Slot active、工具可读与自动测试均不等同视觉通过。

### 0.2.1 收尾（2026-11-07）

- 缩略图判定改为直接使用 Host 返回的 `kind === 'image'`（大小写扩展名已在 Host 统一小写），不再由 Client 用正则重复猜测格式；重建后 Node 27 项通过。
- 打包 `local-dsh-game-system-workorders-0.2.1.tgz`（29,947 bytes，SHA256 3D63BBA826C621B78857A588304BD424DC611A3FCF161EB5788F439B6A283B3B）；官方卸载后安装归档，application=applied，版本读取 0.2.1，其他插件启用状态未改。
- 安装包核验：`dist/client.js` 53,535 bytes，含 `seatOf`、`ctx.get('remote.gameWorkorders')`、证据 resolve 与新的图片判定。升级后再次用隔离目录执行 snapshot（1 todo / 1 blocked、next LiveBase、items 1/3、stable=true）并清理，实时两个 Slot occupant 仍 active。
- 发布注意：Windows PowerShell 5.1 的 `Set-Content` 会写入 UTF-8 BOM，导致 DSH 拒绝安装（`Unexpected token '\ufeff'`）。清单必须用无 BOM 方式写入（本次用 Node），并在打包前解析校验。该次失败已由 DSH 自动回滚，未遗留半装状态。

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
