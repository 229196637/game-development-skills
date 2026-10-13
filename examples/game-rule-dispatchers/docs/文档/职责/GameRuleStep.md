---
system: game-rule-step
side:
- client
roles:
- executor
updated: '2026-10-13 19:46:44 +08:00'
code_revision: working-tree
sources:
- src/client/Mod/GameRule/GameRuleStep.cs
dependencies: []
---
# GameRuleStep

## 职责

规则执行者统一提供 Enter、Observe、Update、Dispose，由 GameRuleSystem 激活与释放。

|执行者|执行什么|
|---|---|
|CompleteRandomEventRule|按阶段或本局累计事件完成次数判断条件|
|SurviveSecondsRule|按阶段或本局有效时钟判断坚持时间|
|DefeatBossRule|请求 Boss 出生并绑定实际目标，依据已提交死亡批次确认完成|

目标实体由关卡回收；Boss 阶段释放取消未出生票号，不伪造死亡。执行者不控制下一规则或终局。[调度入口](GameRuleSystem.md#规则推进)。

## API

[公开函数声明](../api/client/game-rules/GameRuleStep.api.cs)。
