---
system: game-rule
side:
- client
roles:
- dispatcher
dispatcher: GameRuleSystem
design_patterns:
- name: 策略模式
  uses: 以 GameRuleStep 多态接口处理不同规则条件
- name: 队列化事件分派
  uses: 子模块回调入队，再由 _drainSignals 串行消费，避免递归推进
updated: '2026-10-13 17:55:46 +08:00'
code_revision: working-tree
sources:
- src/client/Mod/GameRule/GameRuleSystem.cs
dependencies:
- document: GameWaveSystem.md
  uses: 调用 GameWaveSystem 完成本局协作
- document: GameRandomEventSystem.md
  uses: 调用 GameRandomEventSystem 完成本局协作
---
# GameRuleSystem

本局规则调度器。借用关卡上下文与随机源，拥有当前 GameRuleStep、波次和随机事件子模块；只锁存结果，不在规则回调中释放世界。GameRunSession 在有效帧结束后驱动 Update。以下各条链均来自当前实现。

## 架构

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Session["GameRunSession"] -->|有效帧后 Update| Rule["GameRuleSystem"]
  Rule -->|激活与推进| Step["GameRuleStep"]
  Rule -->|调用| Waves["GameWaveSystem"]
  Rule -->|调用| Events["GameRandomEventSystem"]
  Events -->|完成回调入队| Rule
  click Waves "GameWaveSystem.md"
  click Events "GameRandomEventSystem.md"
  click Step "GameRuleStep.md"
```

[波次调度](GameWaveSystem.md) · [随机事件调度](GameRandomEventSystem.md) · [执行者](GameRuleStep.md)

## 调度流水线

### 启动

用途：在开战时绑定本局上下文，启动子调度器并激活首个规则。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Start["Start(context)"] --> Check["验证场景、玩家及一次启动"]
  Check --> Waves["GameWaveSystem<br/>Start：普通链排期"]
  Waves --> Events["GameRandomEventSystem<br/>Start：绑定上下文"]
  Events --> Enter["激活首个 GameRuleStep<br/>RuleEntered 入队"]
  click Waves "GameWaveSystem.md#启动排期"
  click Events "GameRandomEventSystem.md#启动"
```

Start 不在回调中递归推进规则。首规则可能在 Enter 请求 Boss 出生，但提交出生不等于立即完成。

### Tick

用途：在有效帧结束后统一结算死亡、事件和规则，再推进到期波次。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Tick["Update(timeStep)"] --> Batches["取已提交批次<br/>技术错误则抛异常"]
  Batches --> Death{"同批玩家死亡？"}
  Death -->|是| Lose["锁存失败并返回"]
  Death -->|否| Signals["信号消费<br/>死亡信号与 Tick 入队后消费"]
  Signals --> Events["GameRandomEventSystem<br/>Update 后再消费信号"]
  Events --> Rules["规则推进"]
  Rules --> End{"规则链耗尽？"}
  End -->|是| Win["锁存胜利并返回"]
  End -->|否| Waves["GameWaveSystem<br/>Update(elapsed)"]
  click Events "GameRandomEventSystem.md#活动实例推进"
  click Waves "GameWaveSystem.md#到期出生"
  click Rules "GameRuleSystem.md#规则推进"
  click Signals "GameRuleSystem.md#信号消费"
```

[ 信号消费 ](GameRuleSystem.md#信号消费)

结果已锁存则 Update 返回；有效时钟先加本帧时间再判死亡。即使 Boss 完成消息更早，同帧玩家死亡仍优先。暂停由驱动不推进有效帧，不使用墙钟。

### 信号消费

用途：汇集本局消息，将完成计数和机会信号交给规则执行者、波次及随机事件调度器。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Input["Observe / ObserveBatch"] --> Queue["校验局与世界、信号去重<br/>信号入队，拒绝外部伪造死亡"]
  Batch["ObserveBatch(batch)"] --> BatchQueue["批次按世界与批次号去重入队"]
  BatchQueue --> Convert["Tick<br/>消费批次，玩家死亡优先后转换死亡信号"]
  Convert --> Queue
  Queue --> Drain["有效帧内 _drainSignals"]
  Drain --> Count["事件实例完成去重与计数"]
  Count --> Step["GameRuleStep<br/>Observe(signal)"]
  Step --> Waves["GameWaveSystem<br/>匹配触发后 RequestWave"]
  Waves --> Events["GameRandomEventSystem<br/>Observe(signal)"]
  Events -->|EventStarted / Completed<br/>回调入队，随后消费| Drain
  click Step "GameRuleStep.md"
  click Waves "GameWaveSystem.md#信号触发排期"
  click Events "GameRandomEventSystem.md#机会分派"
  click Convert "GameRuleSystem.md#tick"
```

[ Tick ](GameRuleSystem.md#tick)

这里的循环是队列消费，不是同步递归调用规则推进；实例完成按唯一实例号计数。外部 Observe 不接受伪造死亡；旧局、旧世界和终局信号按实现忽略，非法本局字段报错。

### 规则推进

用途：检查当前规则是否完成，释放完成阶段并按顺序激活下一条，直到未完成或链耗尽。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Step["GameRuleStep<br/>当前阶段 Update(timeStep)"] --> Complete{"Completed？"}
  Complete -->|否| Exit["保留当前阶段并退出"]
  Complete -->|是| Emit["信号消费<br/>RuleCompleted 入队并消费"]
  Emit --> Dispose["Dispose 当前阶段"]
  Dispose --> Next["按位置创建下一策略<br/>Enter，RuleEntered 入队并消费"]
  Next --> Has{"仍有阶段？"}
  Has -->|是| Step
  Has -->|否| Win["Tick<br/>回 Tick 锁存胜利"]
  click Step "GameRuleStep.md"
  click Emit "GameRuleSystem.md#信号消费"
  click Win "GameRuleSystem.md#tick"
```

[ 信号消费 ](GameRuleSystem.md#信号消费) · [ Tick ](GameRuleSystem.md#tick)

链位置只激活一次，循环由有限规则链限制。已满足的全局规则可在同一帧继续推进；波次链耗尽不决定胜负。

### 停止

用途：在本局结束时停止执行者和子调度器，清空等待消费的消息。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Stop["Dispose：重复直接返回"] --> Step["释放当前 GameRuleStep"]
  Step --> Events["GameRandomEventSystem<br/>Dispose"]
  Events --> Waves["GameWaveSystem<br/>Dispose"]
  Waves --> Clear["清空信号与批次队列"]
  click Events "GameRandomEventSystem.md#停止"
  click Waves "GameWaveSystem.md#停止"
```

GameRunSession 先解除批次/帧回调再 Dispose Rules；Rules 不销毁借用关卡或世界。

## 执行者

见 [GameRuleStep](GameRuleStep.md)，只负责具体完成条件；激活顺序、有效时间、累计计数和终局由本调度器控制。
