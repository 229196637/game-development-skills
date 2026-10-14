---
task_id: "service-batch"
class: "InventoryService"
document: "../../../../../../文档/inventory/设计/批量入库/职责/InventoryService.md"
status: "completed"
depends_on: ["store-batch"]
required_tests: ["batch-behavior", "legacy-regression"]
required_acceptance: ["forward", "failure"]
updated: "2026-10-14 09:41:11 +08:00"
---
# InventoryService

## 目标

接入批量奖励转发

## 当前情况与改动

现有 src/server/inventory/inventory_service.py 仅提供 grant_reward；新增 grant_rewards，复用注入存储 add_many，保持旧入口。

## 文档索引

- [对应类文档](../../../../../../文档/inventory/设计/批量入库/职责/InventoryService.md)
- [文档入口](../../../../../../文档/inventory/设计/批量入库/README.md)
- [目录架构](../../../../../../文档/inventory/设计/批量入库/目录架构.md)
- [公开函数 API](../../../../../../文档/inventory/api/server/InventoryService.api.pyi)

## 任务内容

- [x] 在 src/server/inventory/inventory_service.py 新增 grant_rewards，单次向 self._store.add_many 转发整批请求并原样返回结果，不逐项 grant_reward，不捕获吞掉 ValueError。
- [x] 规划在 tests/server/inventory/test_inventory_service_batch.py 使用真实 ItemStore 验证服务有效请求、重复 ID 与非法末项的完整状态；补转发检查和 grant_reward 回归。

## 验收标准

| 验收 ID | 通过条件 |
| --- | --- |
| forward | 服务与同一真实 ItemStore 共享状态；批量结果为提交后总量且批量入口只转发一次。 |
| failure | 非法末项通过服务抛 ValueError，所有原数量保持不变；旧 grant_reward 行为保留。 |

## 测试过程

预登记：batch-behavior 覆盖本工单批量成功、重复项、空请求、非法首/中/末项全量不变；legacy-regression 覆盖现有单条入口。拟用标准库 unittest discover；输入未提供现有测试入口或运行配置，执行阶段需先核对，当前未运行。

规划时尚未执行；后续实际结果以表内最新记录为准。

| 时间 | 测试 ID | 命令/步骤 | 预期 | 实际 | 结果 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-14 09:39:15 +08:00 | batch-behavior | ["C:\\Users\\22919\\AppData\\Local\\Programs\\Python\\Python314\\python.exe", "-m", "unittest", "tests.server.inventory.test_inventory_service_batch.BatchBehavior", "-v"] | 5 batch tests including invalid position matrix pass | 进程退出码 0 | passed | docs/测试/批量入库/service-batch-batch-behavior-959246642426.md |
| 2026-10-14 09:39:15 +08:00 | legacy-regression | ["C:\\Users\\22919\\AppData\\Local\\Programs\\Python\\Python314\\python.exe", "-m", "unittest", "tests.server.inventory.test_inventory_service_batch.LegacyRegression", "-v"] | legacy public behavior regression passes | 进程退出码 0 | passed | docs/测试/批量入库/service-batch-legacy-regression-4694e0d874b5.md |

## 验收情况

规划时尚未验收；后续实际结果以表内最新记录为准。

| 时间 | 验收 ID | 实际情况 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| 2026-10-14 09:41:11 +08:00 | forward | 6 passing test methods confirm real shared store sums, empty requests, invalid first/middle/last item atomicity, once-only forwarding, request/result identity, original ValueError identity and grant_reward regression | passed | docs/测试/批量入库/service-batch-batch-behavior-959246642426.md; docs/测试/批量入库/service-batch-legacy-regression-4694e0d874b5.md |
| 2026-10-14 09:41:11 +08:00 | failure | 6 passing test methods confirm real shared store sums, empty requests, invalid first/middle/last item atomicity, once-only forwarding, request/result identity, original ValueError identity and grant_reward regression | passed | docs/测试/批量入库/service-batch-batch-behavior-959246642426.md; docs/测试/批量入库/service-batch-legacy-regression-4694e0d874b5.md |
