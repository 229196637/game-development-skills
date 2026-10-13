---
system: catalog
side:
- client
updated: '2026-10-13 19:46:44 +08:00'
code_revision: working-tree
sources: []
dependencies: []
---
# 系统文档

本入口覆盖当前客户端规则、波次与随机事件的实际模块说明。shared 表示真实共享，不把客户端类型标成 shared。

## 如何查阅

按用途进入实际类型文档，先看每条调度流水线的用途，再通过图中节点或图下链接进入同一/其他调度器的接收流水线。公开函数完整签名由系统 MD 的 API 映射查阅；本导航不复制声明，也不扩大扫描。

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| GameRuleSystem | dispatcher | 推进规则 | [公开函数](api/client/game-rules/GameRuleSystem.api.cs) | [GameRuleSystem](职责/GameRuleSystem.md) |
| GameWaveSystem | dispatcher | 调度波次 | [公开函数](api/client/waves/GameWaveSystem.api.cs) | [GameWaveSystem](职责/GameWaveSystem.md) |
| GameRandomEventSystem | dispatcher | 调度事件 | [公开函数](api/client/random-events/GameRandomEventSystem.api.cs) | [GameRandomEventSystem](职责/GameRandomEventSystem.md) |
| GameRuleStep | executor | 执行规则 | [公开函数](api/client/game-rules/GameRuleStep.api.cs) | [GameRuleStep](职责/GameRuleStep.md) |
| GameplayWeightedChoice | tool | 加权选择 | 无公开函数 | [GameplayWeightedChoice](职责/GameplayWeightedChoice.md) |
| RuleChainSnapshot | data | 保存规则快照 | 无公开函数 | [RuleChainSnapshot](职责/RuleChainSnapshot.md) |
