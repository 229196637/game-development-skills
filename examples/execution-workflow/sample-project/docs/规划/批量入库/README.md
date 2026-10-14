# 批量入库规划

范围：仅 ItemStore.add_many 与 InventoryService.grant_rewards 及对应行为验证；默认规划交付，不授权实现。

[设计入口](../../文档/inventory/设计/批量入库/README.md) · [目录架构](../../文档/inventory/设计/批量入库/目录架构.md)

顺序：先 ItemStore 存储契约与整批行为，再 InventoryService 服务接入和回归；服务依赖 store-batch。测试/验收在执行时按工单进行。

# 批量入库

本目录保存逐类执行任务。按任务入口的依赖顺序读取；状态以各类 MD 为准。


<!-- planning-tool:begin -->

- [inventory](inventory/README.md)

<!-- planning-tool:end -->


<!-- planning-todo:begin -->

## TODO 与执行顺序

| 顺序 | 任务 ID | 工单 |
| --- | --- | --- |
| 1 | store-batch | [ItemStore](inventory/设计/批量入库/职责/ItemStore.md) |
| 2 | service-batch | [InventoryService](inventory/设计/批量入库/职责/InventoryService.md) |

<!-- planning-todo:end -->
