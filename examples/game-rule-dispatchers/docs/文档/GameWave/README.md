---
system: catalog
side: [client]
updated: '2026-10-14 10:44:27 +08:00'
code_revision: working-tree
sources: []
dependencies: []
---
# GameWave

本模块文档入口；按类说明查阅持有、生命周期及公开接口。

[目录架构](目录架构.md) · [职责摘要](职责/README.md) · [API 摘要](api/README.md)

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| GameWaveSystem | dispatcher | 调度波次 | [公开函数](api/client/GameWaveSystem.api.cs) | [GameWaveSystem](职责/GameWaveSystem.md) |

[返回总入口](../README.md)

## 职责架构图

展示类的角色、简短职责及已核实的持有、调用或数据产出关系。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  N0["GameWaveSystem<br/>dispatcher：调度波次"]
  click N0 "职责/GameWaveSystem.md"
```

[GameWaveSystem](职责/GameWaveSystem.md)

## 系统依赖图

消费者指向提供者；关系来自类文档依赖与已确认契约，未将开发顺序当作运行依赖。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  D0["GameRuleSystem"]
  D1["GameWaveSystem"]
  D0 -->|调用 GameWaveSystem 完成本局协作| D1
  click D0 "../GameRule/职责/GameRuleSystem.md"
  click D1 "职责/GameWaveSystem.md"
```

[GameRuleSystem](../GameRule/职责/GameRuleSystem.md) · [GameWaveSystem](职责/GameWaveSystem.md)
