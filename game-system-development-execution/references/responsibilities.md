# 执行工具职责与共享快照

## 分工与入口

`scripts/execution_tool.py` 负责已授权工单的领取、工作项、真实测试、报告登记、验收、阻塞/释放/重开/完成；不替用户授权，不生成业务实现，不生成规划。简洁入口与公开函数见 [API 速查](api.md)，参数见 [执行工具](tooling.md)。

相邻规划技能 `scripts/task_store.py` 是唯一共享解析与查询层：工单格式、路径镜像、文档引用、TODO 顺序、依赖与完成校验；`owner/candidates/details` 直接从该模块导入，执行端不保留副本。`details` 保持原字段，因而 next/show/claim 及其他执行返回不因 dashboard 增字段而变大或改变契约。共享报告存在校验用于 complete；不削弱原门禁。

规划 CLI 的 `dashboard --root` 只读完整快照，允许看板一次取得计数/进度、ready/next、工单正文摘要与测试/验收历史，不需要加载执行技能正文。完整 [字段与一致性契约](../../game-system-development-planning/references/responsibilities.md#dashboard-字段契约) 仅在共享层定义；不要在执行工具再实现 dashboard，也不回写该 JSON。

## 只读恢复与看板

- next 保持 `{ready,next,remaining}`，show 保持原 `details` 对象。ready 都复用共享筛选：todo、无领取、前置 completed，按入口 TODO 顺序；show 用于断点恢复持有人与文档索引。
- dashboard 扩展仅用于观察：schemaVersion=1、counts/progress、按 TODO 顺序的 tasks、ready/next、最新追加记录与 reportExists、blocked_by；completed 记录损坏会使整次失败。它不证明真实测试充分，也不授予领取权限。
- consistency.stable=false 表示“更新中”：执行锁存在或读取前后输入变化，最多三轮有限重试；遗留锁不抢。快照不保证之后仍不变化，写操作必须重新进锁读取。

## 写入与门禁

执行写入仍以任务根 `.execution.lock` 排他；已有锁直接拒绝，不自动清理、不扩大工作范围。即便上一步已有 dashboard/next/show，锁内仍重新执行 todo_order，核对已完成工单与依赖，不能用旧快照覆盖并发变更。测试期间持锁；进程退出后的遗留锁需核对后由授权者处理。

claim 只接受首个 ready ID，省略 ID 就领取首项，不能跨越入口同批优先级。owner 使用稳定标识；除原 reopen 规则外，写操作必须是当前持有人且状态 doing。set-item pending、block/release/reopen 都追加 not-run 失效记录，保留原证据。更新规划需先 release，不在执行中偷改验收条件。

run-test 真实运行参数列表并生成独立报告/日志；record-test 只登记已有真实报告，报告须在工单根和正式文档目录之外。record-acceptance 单独登记逐项观察，不拿测试通过替代验收。

complete 要求持有人、doing、前置 completed、全工作项勾选、每项必需测试与验收的最后追加记录 passed、最新测试报告存在，才写 completed 并移除领取；“最新”按追加顺序而非时间。新 dashboard 对已有 completed 同样检查这些完成事实中的格式/依赖/工作项/测试/验收/报告门禁；不从 completed 状态倒推曾经实际执行或具有充分覆盖。

## 文档与证据职责

系统设计/实现职责、目录架构和 Markdown 公开 API 由文档技能维护：API 用原语言签名与必要参数/返回/限制作简洁速查，详细行为/生命周期/协作留在职责并互链；具体目标、工作项、验收标准由规划维护；实际测试/验收及持有人状态由执行维护。完整报告仍位于工单根外独立测试目录，只在记录里引用，不写入系统职责正文或入口 README。读取共享模块不等于进入另一技能职责，正文按本次步骤需要加载，不重复展开所有兄弟技能。
