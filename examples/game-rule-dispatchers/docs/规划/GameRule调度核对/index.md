---
id: plan.rule-review.index
kind: index
system: catalog
title: GameRule 调度核对
status: implemented
updated: '2026-10-13 19:40:40 +08:00'
sources: []
links:
- GameRuleSystem.md
- GameWaveSystem.md
- GameRandomEventSystem.md
code_revision: working-tree
---
# GameRule 调度核对

此规划样例是对已实现结构的逆向整理，用于验证技能，不是新功能或改造方案；不得视为开发授权。

[规则](GameRuleSystem.md) · [波次](GameWaveSystem.md) · [随机事件](GameRandomEventSystem.md)

## 已有框架与复用

本例基于项目已实现的客户端玩法模块（不是声称 SDK 内置这些规则模块），代码基线为 working-tree。当前任务只核对技能与文档，沿用现有实现，不安排生产重写。

| 来源/已有能力 | 接口/文档入口 | 端与使用前提 | 本次复用与缺口 | 决定及范围 |
| --- | --- | --- | --- | --- |
| 项目规则及阶段框架 | [GameRuleSystem](../../文档/systems/GameRuleSystem.md)、[GameRuleStep](../../文档/systems/GameRuleStep.md)；Start/Update/Observe/ObserveBatch | client；开战上下文已准备，有效帧后驱动；阶段由调度器拥有 | 复用实际规则、死亡优先和队列语义；仅补说明与跳转 | 沿用本次技能/文档工作范围，不改生产实现 |
| 项目波次与事件框架 | [GameWaveSystem](GameWaveSystem.md)、[GameRandomEventSystem](GameRandomEventSystem.md)；Start/Update/RequestWave/Observe | client；共享本局有效时间，Rules 持有实例，完成回调入队 | 复用排期、机会及完成机制；补各流水线入口说明 | 沿用现有能力，未提出重写 |

具体调用、生命周期和限制见上述文档；不能把示例的复用决定套用到新的开发需求。后续新任务有相关现成能力时，给真实接口细节，再按已有会话选择复用/适配或明确范围重写。

## 开发前置与运行时通信

本样例是已实现模块的文档核对工序，不重新开发生产代码。先核对共同信号与执行者契约，再分别整理提供能力，之后完善依赖它们的 GameRuleSystem，最后集成查阅、检查与报告。事件回调 Rules 是运行时通信，不让随机事件文档反过来等待规则文档全部写完。

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| GameRuleSystem | dispatcher | 推进规则 | [公开函数](../../文档/api/client/game-rules/GameRuleSystem.api.cs) | [GameRuleSystem](../../文档/systems/GameRuleSystem.md) |
| GameWaveSystem | dispatcher | 调度波次 | [公开函数](../../文档/api/client/waves/GameWaveSystem.api.cs) | [GameWaveSystem](../../文档/systems/GameWaveSystem.md) |
| GameRandomEventSystem | dispatcher | 调度事件 | [公开函数](../../文档/api/client/random-events/GameRandomEventSystem.api.cs) | [GameRandomEventSystem](../../文档/systems/GameRandomEventSystem.md) |
| GameRuleStep | executor | 执行规则 | [公开函数](../../文档/api/client/game-rules/GameRuleStep.api.cs) | [GameRuleStep](../../文档/systems/GameRuleStep.md) |
| GameplayWeightedChoice | tool | 加权选择 | 无公开函数 | [GameplayWeightedChoice](../../文档/systems/GameplayWeightedChoice.md) |
| RuleChainSnapshot | data | 保存规则快照 | 无公开函数 | [RuleChainSnapshot](../../文档/systems/RuleChainSnapshot.md) |

## TODO 与执行顺序

先完成本局信号/阶段契约核对 → 再整理波次、随机事件、执行者与数据的交付说明 → 再完善规则调度与跨模块跳转 → 最后做整体结构/显示检查和独立核对报告。同顺序的条目互不依赖，仅说明可独立开展，不自动启动并行代理。

| 顺序 | ID | 系统/目标 | 优先级及理由 | 前置 ID | 状态 | 接口/规划链接 | 验证与验收条件 | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | T01 | 核对本局信号、阶段接口及数据语义 | P0 后续模块共同前提 | — | verified | [规则](GameRuleSystem.md) | 明确信号接收、完成与有效时间含义，契约核对后才能整理消费方 | [报告](../../../review.md) |
| 2 | T02 | 整理波次提供能力与流水线 | P1 规则调度需要调用 | T01 | verified | [波次](GameWaveSystem.md) | 排期、触发去重、实际出生与释放语义有入口 | [报告](../../../review.md) |
| 2 | T03 | 整理随机事件提供能力与回调 | P1 规则推进依赖事件完成 | T01 | verified | [随机事件](GameRandomEventSystem.md) | 机会、更新与完成入队顺序清晰，不递归推进规则 | [报告](../../../review.md) |
| 2 | T04 | 整理执行者与数据职责 | P1 规则策略和上下文前提 | T01 | verified | [执行者](../../文档/systems/GameRuleStep.md) | 仅执行具体条件，调度权限与数据读写归属明确 | [报告](../../../review.md) |
| 3 | T05 | 完善规则调度与各链跳转 | P0 跨模块主入口 | T02,T03,T04 | verified | [规则](GameRuleSystem.md) | 各提供方契约已核对，再连接 Tick、信号消费和规则推进 | [报告](../../../review.md) |
| 4 | T06 | 集成查阅、工具检查与图显示验证 | P1 本次样例必须检查 | T05 | verified | [现状入口](../../文档/systems/GameRuleSystem.md) | 链接、meta、每链用途及实际图字号检查通过 | [报告](../../../review.md) |
| 5 | T07 | 同步技能与独立核对报告 | P1 交付前保持一致 | T06 | verified | [报告](../../../review.md) | 测试结果与现状文档分离，未运行 SDK 不宣称运行通过 | [报告](../../../review.md) |

## 范围与未验证项

本次为技能/文档静态检查和图渲染，未运行游戏，不安排生产实现或动态 SDK 验收。样例执行顺序演示开发前置的组织方式；真实开发任务按其模块依赖和交付门槛重新编排，不能照抄本表。
