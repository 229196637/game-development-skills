---
system: catalog
side: [client]
updated: '2026-10-14 10:44:27 +08:00'
code_revision: working-tree
sources: []
dependencies: []
---
# GameRandomEvent

本模块文档入口；按类说明查阅持有、生命周期及公开接口。

[目录架构](目录架构.md) · [职责摘要](职责/README.md) · [API 摘要](api/README.md)

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| GameRandomEventSystem | dispatcher | 调度事件 | [公开函数](api/client/GameRandomEventSystem.api.cs) | [GameRandomEventSystem](职责/GameRandomEventSystem.md) |
| GameplayWeightedChoice | tool | 加权选择 | 无公开函数 | [GameplayWeightedChoice](职责/GameplayWeightedChoice.md) |

[返回总入口](../README.md)

## 职责架构图

展示类的角色、简短职责及已核实的持有、调用或数据产出关系。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  N0["GameRandomEventSystem<br/>dispatcher：调度事件"]
  N1["GameplayWeightedChoice<br/>tool：加权选择"]
  click N0 "职责/GameRandomEventSystem.md"
  click N1 "职责/GameplayWeightedChoice.md"
```

[GameRandomEventSystem](职责/GameRandomEventSystem.md) · [GameplayWeightedChoice](职责/GameplayWeightedChoice.md)

## 系统依赖图

消费者指向提供者；关系来自类文档依赖与已确认契约，未将开发顺序当作运行依赖。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  D0["GameRandomEventSystem"]
  D1["GameRuleSystem"]
  D1 -->|调用 GameRandomEventSystem 完成本局协作| D0
  click D0 "职责/GameRandomEventSystem.md"
  click D1 "../GameRule/职责/GameRuleSystem.md"
```

[GameRandomEventSystem](职责/GameRandomEventSystem.md) · [GameRuleSystem](../GameRule/职责/GameRuleSystem.md)
