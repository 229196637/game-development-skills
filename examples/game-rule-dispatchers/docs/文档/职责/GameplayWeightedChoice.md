---
system: weighted-choice
side:
- client
roles:
- tool
updated: '2026-10-13 19:46:44 +08:00'
code_revision: working-tree
sources:
- src/client/Mod/GameRandomEvent/Contracts.cs
dependencies: []
---
# GameplayWeightedChoice

## 职责

internal static 工具类，Choose 按权重与传入随机源选择索引。总权重不大于零返回 -1；随机源结果非有限或不在 [0,1) 时抛 InvalidOperationException。

会消耗借用随机源一次采样；不拥有事件实例、不调度规则。没有对外公开函数，不生成空 API 文件。

## API

无公开函数。
