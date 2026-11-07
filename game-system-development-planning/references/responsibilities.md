# 规划工具与共享查询职责

## 模块分工

- `scripts/planning_tool.py`：解析规划 CLI，建立/修订/迁移工单、生成顺序、校验与列摘要；新增 `dashboard --root` 只读入口，不执行代码、测试或领取。命令/函数简表见 [API 速查](api.md)。
- `scripts/task_store.py`：唯一工单格式与查询实现。负责读取 meta/正文、镜像路径、文档索引、TODO 顺序、依赖/完成规则；共享 `owner/candidates/details` 供执行复用，dashboard 在兼容投影上单独扩展，不改变 list/next/show 字段。
- 相邻执行工具：只在用户授权后锁内重新读取工单、领取、记录实际测试/验收和完成；快照不是写入依据，也不能直接修改 dashboard JSON 回写状态。文档技能维护系统正文/API，不维护工单状态或执行证据。

## dashboard 字段契约

外层仍是 `{ok:true,result:{...}}`，schemaVersion 固定为 1。失败时整次返回 `{ok:false,error:...}`，不跳过坏工单、不返回部分成功。

| result 字段 | 类型与含义 |
| --- | --- |
| schemaVersion | 整数 1 |
| root / readme | 已解析的绝对任务根与入口 README 路径 |
| updated | 工单 meta.updated 中最大有效时间的原字符串，按时区比较；无有效时间为 null；不是查询时间或文件 mtime |
| counts | todo/doing/blocked/completed 为实际状态计数，total 为工单总数；不把依赖未满足的 todo 擅自改成 blocked |
| progress | completed/total 为工单数；percent 为 completed/total×100，保留最多两位小数，零工单为 0；itemsChecked/itemsTotal 为全部工单勾选项数/总项数，X/x 都计为勾选 |
| ready | 按 README TODO 顺序筛出 status=todo、无 owner 且直接前置全 completed 的 ID 列表 |
| next | 首个 ready 的扩展 task 对象；无就绪项为 null |
| tasks | 全部扩展 task，严格按 README TODO 顺序，不按文件名或时间重排 |
| consistency | `{stable:true}` 或 `{stable:false,reason:"execution-lock"\|"inputs-changed"}` |

### task 投影

原执行 `details` 字段原样保留：id/file/status/claim/document/references/items/required_tests/acceptance。file/document/references 均为绝对路径；claim 为原领取 JSON 或 null；items 为 `[[mark,text],...]`，mark 保留空格/x/X；acceptance 是“验收标准”原 Markdown（仅去首尾空白），不是实际验收记录。

扩展字段：

| 字段 | 含义 |
| --- | --- |
| class / depends_on / updated | 原 meta 值 |
| tests | 原七列表格历史，依次为 time/id/command/expected/actual/result/report，不删除旧失败或 not-run |
| acceptance_records | 原五列验收历史，依次为 time/id/actual/result/evidence |
| latest_tests | 每个测试 ID 最后追加行：id/time/command/expected/actual/result/report/reportExists |
| latest_acceptance | 每个验收 ID 最后追加行：id/time/actual/result/evidence |
| blocked_by | 直接前置中尚非 completed 的 ID，保留 depends_on 顺序；不是自动推断的阻塞原因文本 |

“最新”仅按表格追加位置，不比较时间字符串；最新数组也按所选行的追加位置排列。没有记录就返回空数组，不伪造 passed 或占位历史。report 保留原记录字符串，reportExists 是当前文件存在检查；历史相对报告路径沿用执行工具的进程工作目录语义，新记录由执行工具写绝对路径。

### 完成门禁与错误

每个 completed 工单都核对现代工单格式、前置 completed、所有工作项已勾选、每个必需测试/验收最后追加记录 passed，以及最新测试报告文件存在。任一 completed 不合法则整次失败；不能用看板计数绕过完成门禁。非 completed 报告缺失仍可展示，reportExists=false。损坏 TODO、未知/循环依赖、重复 ID、镜像错误、缺文档与坏记录均沿用共享读取校验。

零工单要求已有合法空 TODO；dashboard 不自动创建 README/order。updated 的格式仍沿用原解析器；日期虽符合格式但不是有效日历时间时不参与最大值计算，不因此虚造一个更新时间。

## 有限重试与只读边界

每轮在读取前后对任务根全部 Markdown（含各级 README/工单）集合、内容摘要及文件状态签名比较；新增/删除/修改都会触发重试。额外覆盖校验涉及的索引文档/报告文件状态，以及目录架构同级 README 的内容；报告存在性随快照重新计算。

最多尝试三轮，不等待、不写 README、不建 `.execution.lock`。读取前或后发现执行锁，即便遗留锁内容不变也标记更新中；不会删除、续租或抢占。签名变化且重试耗尽，最近一次有效读取以 stable=false 返回；最后一轮解析失败则整次失败，不退回更旧成功快照。reason 在观察到锁时优先为 execution-lock，否则 inputs-changed。

这是乐观的有限一致性检测，不承诺文件系统事务或读取结束之后不再变化；中途变更又完全恢复可能无法观察。消费者必须显示 stable=false 为“更新中”，稍后重取；任何执行写操作仍由原工具在锁内读取和校验最新工单。所有查询只访问明确任务根及其已登记引用，不生成第二份持久状态清单。
