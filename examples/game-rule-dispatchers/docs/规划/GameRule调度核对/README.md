# GameRule 调度核对

本例仅演示现有文档的逐类静态核对任务，不安排生产实现、不声称游戏运行验证通过。真实开发时用同样的逐类格式记录代码目标与测试。

先读 [文档入口](../../文档/README.md) 和 [目录架构](../../文档/目录架构.md)，再按类读取任务中的对应文档。

## 执行顺序

先核对 GameRuleStep、RuleChainSnapshot 和 GameplayWeightedChoice，再核对 GameWaveSystem、GameRandomEventSystem，最后核对消费它们的 GameRuleSystem。这里只表达静态文档检查的前置关系，跨系统回调不是开发循环。状态只在各类 MD 保存；使用 planning_tool list 查看。

[返回规划目录](../README.md)


<!-- planning-tool:begin -->

- [GameRandomEvent](GameRandomEvent/README.md)
- [GameRule](GameRule/README.md)
- [GameWave](GameWave/README.md)

<!-- planning-tool:end -->

类工单的相对层级与文档一致，例如 [GameRuleSystem](GameRule/职责/GameRuleSystem.md) 对应文档 [GameRuleSystem](../../文档/GameRule/职责/GameRuleSystem.md)。测试与验收保留在工单底部，不复制类职责正文。


<!-- planning-todo:begin -->

## TODO 与执行顺序

| 顺序 | 任务 ID | 工单 |
| --- | --- | --- |
| 1 | GameplayWeightedChoice | [GameplayWeightedChoice](GameRandomEvent/职责/GameplayWeightedChoice.md) |
| 2 | GameRuleStep | [GameRuleStep](GameRule/职责/GameRuleStep.md) |
| 3 | RuleChainSnapshot | [RuleChainSnapshot](GameRule/职责/RuleChainSnapshot.md) |
| 4 | GameRandomEventSystem | [GameRandomEventSystem](GameRandomEvent/职责/GameRandomEventSystem.md) |
| 5 | GameWaveSystem | [GameWaveSystem](GameWave/职责/GameWaveSystem.md) |
| 6 | GameRuleSystem | [GameRuleSystem](GameRule/职责/GameRuleSystem.md) |

<!-- planning-todo:end -->
