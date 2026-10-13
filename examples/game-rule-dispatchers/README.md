# GameRule 调度说明样例

[正式文档入口](docs/文档/README.md) · [正式规则文档](docs/文档/职责/GameRuleSystem.md) · [规划入口](docs/规划/GameRule调度核对/README.md)

三个实际调度器各画独立流水线，并可互相跳转；另有 [执行者](docs/文档/职责/GameRuleStep.md)、[静态工具](docs/文档/职责/GameplayWeightedChoice.md)、[数据](docs/文档/职责/RuleChainSnapshot.md) 的简短说明。

这是技能验证用文档样例，只读提炼当前项目，没有改动生产源码。规划部分为已实现结构的逆向整理，未增加新业务或重构方案。Mermaid 不支持点击时使用图下普通链接。

[核对结果](review.md) · [Tick 图片预览](preview/tick.png) · [信号消费图片预览](preview/signals.png)

[文档目录摘要](docs/README.md) · [预览目录摘要](preview/README.md)

统一入口为游戏系统开发规划：设计与已实现补录/更新均调用文档技能（planning/implemented）；先定目录/脚本位置，生成文档后按依赖补唯一 TODO。

[独立子代理试用摘要](independent-review.md)

当前执行任务采用“先文档后规划”，旧规划中的重复职责已移除，改成各类目标、工作项和底部测试记录。[本次重构验证](planning-driver-review.md)。
