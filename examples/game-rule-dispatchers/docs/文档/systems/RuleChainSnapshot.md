---
system: rule-data
side:
- client
roles:
- data
updated: '2026-10-13 17:55:46 +08:00'
code_revision: working-tree
sources:
- src/client/Mod/GameRule/GameRuleSystem.cs
- src/client/Mod/GameRule/GameRuleStep.cs
dependencies: []
---
# RuleChainSnapshot

roles 为 data；这些类型承载规则数据，不负责 Tick 或阶段切换。

|类型|数据含义与归属|
|---|---|
|RuleContext|调度器在激活阶段时创建，执行者借用；含关卡/规则定义、位置、进入有效时间及计数/时钟读取委托|
|RuleChainSnapshot|GetSnapshot 创建，包含当前位置、总数、有效时间、Boss 目标及子模块快照，供读者观察；不交出执行者实例|
|GameRunResult|调度器锁存不可变胜负结果、原因和有效耗时；取消/技术错误不伪装胜负|

只读 record 不等于所有嵌套引用都深复制：RuleContext 借用关卡和委托；快照中的 Waves/Events 由对应子模块提供。不能通过说明宣称任意嵌套对象都不可变。数据类型没有自己的公开业务函数，不生成空 API 文件，也不将字段塞进函数声明。[规则调度器](GameRuleSystem.md)。
