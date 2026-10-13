---
system: game-wave
side:
- client
roles:
- dispatcher
dispatcher: GameWaveSystem
design_patterns:
- name: 优先队列调度
  uses: 以到期有效时间和稳定次序排序普通链及信号触发链
updated: '2026-10-13 17:33:09 +08:00'
code_revision: working-tree
sources:
- src/client/Mod/GameWave/GameWaveSystem.cs
dependencies: []
---
# GameWaveSystem

波次调度器，由 GameRuleSystem 持有；普通链和信号链独立排期，共用本局有效时间。不判定规则胜负。

## 架构

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Rule["GameRuleSystem"] -->|Start / RequestWave / Update| Wave["GameWaveSystem"]
  Wave -->|提交出生请求与取消票号| Port["关卡 Spawn 端口"]
  Port -->|实际出生回调| Wave
  click Rule "game-rule.md#tick"
```

[规则 Tick](game-rule.md#tick)

## 调度流水线

### 启动排期

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Start["Start(context)"] --> Guard["检查一次启动"]
  Guard --> Schedule["普通 WaveIds 按累计延迟排期<br/>保留重复模板"]
```

只排期，不立即刷怪。

### 信号触发排期

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Rule["GameRuleSystem"] -->|RequestWave| Validate["校验本局信号与触发行"]
  Validate --> Dedupe["按信号号和触发行去重"]
  Dedupe --> Queue["按信号时刻加延迟入队"]
  click Rule "game-rule.md#信号消费"
```

旧局忽略；配置与来源不匹配报错。触发链不改普通链位置。

[信号消费入口](game-rule.md#信号消费)

### 到期出生

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Rule["GameRuleSystem"] -->|"Update(elapsed)"| Due["校验有效时间不倒退<br/>取到期项"]
  Due --> Spawn["检查场景并提交出生<br/>有队列则等待实际回调"]
  Spawn --> Complete["全部出生后记录出现<br/>普通链才累计完成数"]
  Complete --> Next{"还有到期项？"}
  Next -->|是| Due
  Next -->|否| Return["返回规则 Tick"]
  click Rule "game-rule.md#tick"
```

重复模板有不同出现号；未到期返回。场景失效时停止并抛异常，不能把请求已提交写成实际已出生。

[规则 Tick](game-rule.md#tick)

### 停止

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  Stop["Dispose：重复直接返回"] --> Tickets["取消尚待出生票号"]
  Tickets --> Clear["清排期、去重和待出生记录"]
```

已出生实体由关卡所有者回收，本模块不销毁借用关卡。
