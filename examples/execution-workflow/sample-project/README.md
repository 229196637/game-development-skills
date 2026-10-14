# 隔离测试项目：批量奖励实现

这里是执行技能独立试用中的真实业务实现副本，不属于生产项目。正式测试程序与临时辅助 Python 留在隔离目录，不随仓库分发。

| 类 | 具体代码落实 | 工单 |
| --- | --- | --- |
| [ItemStore](src/shared/inventory/item_store.py) | add_many 整批校验后汇总提交；重复 ID 累加，任意非法项不改变原数量 | [已完成存储工单](docs/规划/批量入库/inventory/设计/批量入库/职责/ItemStore.md) |
| [InventoryService](src/server/inventory/inventory_service.py) | grant_rewards 单次调用存储，原样返回并透传异常 | [已完成服务工单](docs/规划/批量入库/inventory/设计/批量入库/职责/InventoryService.md) |

- [文档入口](docs/文档/README.md)
- [工单 TODO 入口](docs/规划/批量入库/README.md)
- [样例源码复测](../sample-source-review.md)

实际试用的 docs 已初始化独立本地 Git；此处仅归档文档内容供 GitHub 阅读，不复制 .git。工单历史保持原来的完成时间与真实结果，报告中的原隔离路径已以占位文字显示。
