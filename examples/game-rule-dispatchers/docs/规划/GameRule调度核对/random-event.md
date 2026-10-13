---
id: plan.rule-review.random-event
kind: plan
system: random-event
title: GameRandomEventSystem
status: implemented
updated: '2026-10-13 17:33:09 +08:00'
sources:
- src/client/Mod/GameRandomEvent/GameRandomEventSystem.cs
links: []
code_revision: working-tree
roles:
- dispatcher
dispatcher: GameRandomEventSystem
design_patterns:
- name: 工厂注册与策略实例
  uses: 注册表提供事件实例，宿主调用统一行为接口
- name: 完成请求延迟提交
  uses: 实例完成请求进入集合，在 Update 中释放并发出完成信号
---
# GameRandomEventSystem

随机事件实例调度器，借用注册表、随机源及回调，拥有活动事件实例。开始和完成消息交回 GameRuleSystem 的队列；不直接推进规则或销毁世界。

## 架构

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Rule["GameRuleSystem"] -->|Observe / Update| Events["GameRandomEventSystem"]
  Events -->|工厂创建与行为调用| Instance["GameRandomEvent 实例"]
  Instance -->|完成请求| Events
  Events -->|回调入队| Rule
  click Rule "game-rule.md#信号消费"
```

[规则信号消费](game-rule.md#信号消费)

## 调度流水线

### 启动

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Start["Start(context)"] --> Guard["检查非空、未释放及未启动"]
  Guard --> Bind["绑定本局上下文"]
```

只绑定一次上下文，不立即创建活动事件。

### 机会分派

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Observe["Observe(signal)"] --> Guard["本局世界校验和机会去重"]
  Guard --> Notify["先通知已活动实例"]
  Notify --> Candidates["工厂创建并检查资格<br/>排除同配置活动实例"]
  Candidates --> Select{"存在合格加权选择？"}
  Select -->|否| Exit["释放候选并返回"]
  Select -->|是| Begin["选中实例 Begin<br/>释放未选候选"]
  Begin --> Rule["GameRuleSystem<br/>EventStarted 回调入队"]
  click Rule "game-rule.md#信号消费"
```

新实例不回溯消费触发它的机会。Begin 失败移除并释放实例，再抛出；Start 只绑定一次上下文。

[开始信号接收方](game-rule.md#信号消费)

### 活动实例推进

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Update["Update(timeStep)"] --> Instances["推进活动实例"]
  Instances --> Pending["读取待完成集合"]
  Pending --> Release["移除并释放仍活动的实例<br/>完成计数加一"]
  Release --> Rule["GameRuleSystem<br/>EventCompleted 回调入队"]
  click Rule "game-rule.md#信号消费"
```

实例完成回调只登记请求，Update 才提交完成消息。暂停时调用方不推进。

[完成信号接收方](game-rule.md#信号消费)

### 手动完成输入

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Input["CompleteManual(instanceId)"] --> Valid{"仍活动且为 ManualObjectiveEvent？"}
  Valid -->|否| Reject["返回 false"]
  Valid -->|是| Complete["实例 Complete<br/>登记待完成"]
  Complete --> Wait["返回 true，等待 Update 提交"]
```

这个输入不直接推进时间或规则，也不将接受输入当成完成消息已提交。

### 停止

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Stop["Dispose：重复直接返回"] --> Active["释放全部活动事件实例"]
  Active --> Clear["清活动、待完成与机会记录"]
```

停止不发送完成信号；借用注册表与随机源不由本模块释放。
