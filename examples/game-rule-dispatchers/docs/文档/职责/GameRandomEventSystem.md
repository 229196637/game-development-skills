---
system: random-event
side:
- client
roles:
- dispatcher
dispatcher: GameRandomEventSystem
design_patterns:
- name: 工厂注册与策略实例
  uses: 注册表提供事件实例，宿主调用统一行为接口
- name: 完成请求延迟提交
  uses: 实例完成请求进入集合，在 Update 中释放并发出完成信号
updated: '2026-10-13 20:07:45 +08:00'
code_revision: working-tree
sources:
- src/client/Mod/GameRandomEvent/GameRandomEventSystem.cs
dependencies: []
---
# GameRandomEventSystem

## 职责

随机事件实例调度器，借用注册表、随机源及回调，拥有活动事件实例。开始和完成消息交回 GameRuleSystem 的队列；不直接推进规则或销毁世界。

## 目录架构与脚本位置

当前文件位置已存在；本样例只补录路径，不新增或迁移生产脚本。

```text
src/client/Mod/GameRandomEvent/
  GameRandomEventSystem.cs
```

| 类/模块 | 角色 | 代码文件路径 | 命名空间/模块 | 放置理由与装配者 |
| --- | --- | --- | --- | --- |
| GameRandomEventSystem | dispatcher | src/client/Mod/GameRandomEvent/GameRandomEventSystem.cs | GameEntry.Client.Mod.GameRandomEvent | 事件模块实例调度；GameRuleSystem 创建/持有，借用注册表和随机源 |

## 架构

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Rule["GameRuleSystem"] -->|Observe / Update| Events["GameRandomEventSystem"]
  Events -->|工厂创建与行为调用| Instance["GameRandomEvent 实例"]
  Instance -->|完成请求| Events
  Events -->|回调入队| Rule
  click Rule "GameRuleSystem.md#信号消费"
```

[规则信号消费](GameRuleSystem.md#信号消费)

## 调度流水线

### 启动

用途：启动时绑定一次本局上下文，为后续机会选择和实例推进准备依赖。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Start["Start(context)"] --> Guard["检查非空、未释放及未启动"]
  Guard --> Bind["绑定本局上下文"]
```

只绑定一次上下文，不立即创建活动事件。

### 机会分派

用途：接收规则信号，通知现有事件并从合格候选中选择一个新事件启动。

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
  click Rule "GameRuleSystem.md#信号消费"
```

新实例不回溯消费触发它的机会。Begin 失败移除并释放实例，再抛出；Start 只绑定一次上下文。

[开始信号接收方](GameRuleSystem.md#信号消费)

### 活动实例推进

用途：逐帧推进活动事件，并提交已登记的完成请求给规则调度器。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Update["Update(timeStep)"] --> Instances["推进活动实例"]
  Instances --> Pending["读取待完成集合"]
  Pending --> Release["移除并释放仍活动的实例<br/>完成计数加一"]
  Release --> Rule["GameRuleSystem<br/>EventCompleted 回调入队"]
  click Rule "GameRuleSystem.md#信号消费"
```

实例完成回调只登记请求，Update 才提交完成消息。暂停时调用方不推进。

[完成信号接收方](GameRuleSystem.md#信号消费)

### 手动完成输入

用途：将外部完成输入交给匹配的手动事件，等待有效帧统一提交结果。

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

用途：结束所有活动实例并清空完成请求，不发出完成消息。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Stop["Dispose：重复直接返回"] --> Active["释放全部活动事件实例"]
  Active --> Clear["清活动、待完成与机会记录"]
```

停止不发送完成信号；借用注册表与随机源不由本模块释放。

## API

[公开函数声明](../api/client/random-events/GameRandomEventSystem.api.cs)。
