# GameRule 调度说明样例

[正式规则文档](docs/文档/systems/GameRuleSystem.md) · [规划入口](docs/规划/GameRule调度核对/index.md)

三个实际调度器各画独立流水线，并可互相跳转；另有 [执行者](docs/文档/systems/GameRuleStep.md)、[静态工具](docs/文档/systems/GameplayWeightedChoice.md)、[数据](docs/文档/systems/RuleChainSnapshot.md) 的简短说明。

这是技能验证用文档样例，只读提炼当前项目，没有改动生产源码。规划部分为已实现结构的逆向整理，未增加新业务或重构方案。Mermaid 不支持点击时使用图下普通链接。

[核对结果](review.md) · [Tick 图片预览](preview/tick.png) · [信号消费图片预览](preview/signals.png)
