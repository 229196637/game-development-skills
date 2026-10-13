---
system: weighted-choice
side:
- client
roles:
- tool
updated: '2026-10-13 20:07:45 +08:00'
code_revision: working-tree
sources:
- src/client/Mod/GameRandomEvent/Contracts.cs
dependencies: []
---
# GameplayWeightedChoice

## 职责

internal static 工具类，Choose 按权重与传入随机源选择索引。总权重不大于零返回 -1；随机源结果非有限或不在 [0,1) 时抛 InvalidOperationException。

会消耗借用随机源一次采样；不拥有事件实例、不调度规则。没有对外公开函数，不生成空 API 文件。

## 目录架构与脚本位置

当前文件位置已存在；本样例只补录路径，不新增或迁移生产脚本。

```text
src/client/Mod/GameRandomEvent/
  Contracts.cs
```

| 类/模块 | 角色 | 代码文件路径 | 命名空间/模块 | 放置理由与装配者 |
| --- | --- | --- | --- | --- |
| GameplayWeightedChoice | tool | src/client/Mod/GameRandomEvent/Contracts.cs | GameEntry.Client.Mod.GameRandomEvent | 沿用现有内部静态工具位置；规则/事件逻辑调用，不新增工具根 |

## API

无公开函数。
