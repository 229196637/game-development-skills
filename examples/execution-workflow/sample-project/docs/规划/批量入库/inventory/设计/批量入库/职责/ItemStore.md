---
task_id: "store-batch"
class: "ItemStore"
document: "../../../../../../文档/inventory/设计/批量入库/职责/ItemStore.md"
status: "completed"
depends_on: []
required_tests: ["batch-behavior", "legacy-regression"]
required_acceptance: ["atomic", "sum", "compat"]
updated: "2026-10-14 09:38:41 +08:00"
---
# ItemStore

## 目标

新增原子批量入库能力

## 当前情况与改动

现有 src/shared/inventory/item_store.py 仅提供 add/get；新增 add_many，整批校验后提交，保留单条方法。

## 文档索引

- [对应类文档](../../../../../../文档/inventory/设计/批量入库/职责/ItemStore.md)
- [文档入口](../../../../../../文档/inventory/设计/批量入库/README.md)
- [目录架构](../../../../../../文档/inventory/设计/批量入库/目录架构.md)
- [公开函数 API](../../../../../../文档/inventory/api/shared/ItemStore.api.pyi)

## 任务内容

- [x] 在 src/shared/inventory/item_store.py 新增 add_many：统一校验列表、二元组、非空字符串 ID 和正 int 数量（排除 bool），非法输入在任何数量修改前抛 ValueError。
- [x] 在 add_many 汇总重复 ID 并提交累加；返回本批涉及 ID 的总量新字典，空列表为无操作；不得逐项调用 add 造成部分提交。
- [x] 规划在 tests/shared/inventory/test_item_store_batch.py 新增行为测试：已有数量累加、重复 ID、空列表、末项非法时全部原数量不变、非法类型/数量与返回字典隔离；回归 add/get。

## 验收标准

| 验收 ID | 通过条件 |
| --- | --- |
| atomic | 任意位置非法项或结构错误均抛 ValueError；对已存在和新增 ID 查询后整批状态不变。 |
| sum | 多 ID 与重复 ID 正确累加到既有数量；返回值仅含本批 ID 总量，空列表无变化。 |
| compat | add/get 原有签名、单项行为保持，返回字典修改不能影响存储。 |

## 测试过程

预登记：batch-behavior 覆盖本工单批量成功、重复项、空请求、非法首/中/末项全量不变；legacy-regression 覆盖现有单条入口。拟用标准库 unittest discover；输入未提供现有测试入口或运行配置，执行阶段需先核对，当前未运行。

规划时尚未执行；后续实际结果以表内最新记录为准。

| 时间 | 测试 ID | 命令/步骤 | 预期 | 实际 | 结果 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-14 09:37:58 +08:00 | batch-behavior | ["C:\\Users\\22919\\AppData\\Local\\Programs\\Python\\Python314\\python.exe", "-m", "unittest", "tests.shared.inventory.test_item_store_batch.BatchBehavior", "-v"] | 5 batch tests including invalid position matrix pass | 进程退出码 0 | passed | docs/测试/批量入库/store-batch-batch-behavior-50aff6cf8aa5.md |
| 2026-10-14 09:37:58 +08:00 | legacy-regression | ["C:\\Users\\22919\\AppData\\Local\\Programs\\Python\\Python314\\python.exe", "-m", "unittest", "tests.shared.inventory.test_item_store_batch.LegacyRegression", "-v"] | legacy public behavior regression passes | 进程退出码 0 | passed | docs/测试/批量入库/store-batch-legacy-regression-974849929b56.md |

## 验收情况

规划时尚未验收；后续实际结果以表内最新记录为准。

| 时间 | 验收 ID | 实际情况 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| 2026-10-14 09:38:41 +08:00 | atomic | 51 invalid-position subcases, 6 invalid outer shapes, duplicate sum, empty request, returned dict isolation and legacy behavior checked in 6 passing unittest methods | passed | docs/测试/批量入库/store-batch-batch-behavior-50aff6cf8aa5.md; docs/测试/批量入库/store-batch-legacy-regression-974849929b56.md |
| 2026-10-14 09:38:41 +08:00 | sum | 51 invalid-position subcases, 6 invalid outer shapes, duplicate sum, empty request, returned dict isolation and legacy behavior checked in 6 passing unittest methods | passed | docs/测试/批量入库/store-batch-batch-behavior-50aff6cf8aa5.md; docs/测试/批量入库/store-batch-legacy-regression-974849929b56.md |
| 2026-10-14 09:38:41 +08:00 | compat | 51 invalid-position subcases, 6 invalid outer shapes, duplicate sum, empty request, returned dict isolation and legacy behavior checked in 6 passing unittest methods | passed | docs/测试/批量入库/store-batch-batch-behavior-50aff6cf8aa5.md; docs/测试/批量入库/store-batch-legacy-regression-974849929b56.md |
