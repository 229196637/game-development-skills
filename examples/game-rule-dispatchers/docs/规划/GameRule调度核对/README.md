# GameRule 调度核对

本例仅演示现有文档的逐类静态核对任务，不安排生产实现、不声称游戏运行验证通过。真实开发时用同样的逐类格式记录代码目标与测试。

先读 [文档入口](../../文档/README.md) 和 [目录架构](../../文档/目录架构.md)，再按类读取任务中的对应文档。

## 执行顺序

先核对 GameRuleStep、RuleChainSnapshot 和 GameplayWeightedChoice，再核对 GameWaveSystem、GameRandomEventSystem，最后核对消费它们的 GameRuleSystem。这里只表达静态文档检查的前置关系，跨系统回调不是开发循环。状态只在各类 MD 保存；使用 planning_tool list 查看。

[返回规划目录](../README.md)


<!-- planning-tool:begin -->

- [client](client/README.md)

<!-- planning-tool:end -->
