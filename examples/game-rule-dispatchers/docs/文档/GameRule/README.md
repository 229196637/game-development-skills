---
system: catalog
side: [client]
updated: '2026-10-13 22:51:05 +08:00'
code_revision: working-tree
sources: []
dependencies: []
---
# GameRule

本模块文档入口；按类说明查阅持有、生命周期及公开接口。

[目录架构](目录架构.md) · [职责摘要](职责/README.md) · [API 摘要](api/README.md)

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| GameRuleSystem | dispatcher | 推进规则 | [公开函数](api/client/GameRuleSystem.api.cs) | [GameRuleSystem](职责/GameRuleSystem.md) |
| GameRuleStep | executor | 执行规则 | [公开函数](api/client/GameRuleStep.api.cs) | [GameRuleStep](职责/GameRuleStep.md) |
| RuleChainSnapshot | data | 保存规则快照 | 无公开函数 | [RuleChainSnapshot](职责/RuleChainSnapshot.md) |

[返回总入口](../README.md)
