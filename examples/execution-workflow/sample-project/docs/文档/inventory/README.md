---
system: catalog
side:
- shared
- server
updated: '2026-10-14 10:44:27 +08:00'
code_revision: working-tree; source hashes in ../../copy-after.json
sources: []
dependencies: []
---
# 背包模块

共享存储保存实例内数量；服务端奖励入口复用同一存储。

[目录架构](目录架构.md) · [上级](../README.md)

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| ItemStore | executor | 保存并批量累加数量 | [声明](api/shared/ItemStore.api.pyi) | [职责](职责/ItemStore.md) |
| InventoryService | executor | 转发批量奖励 | [声明](api/server/InventoryService.api.pyi) | [职责](职责/InventoryService.md) |

## 职责架构图

展示类的角色、简短职责及已核实的持有、调用或数据产出关系。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  N0["InventoryService<br/>executor：转发批量奖励"]
  N1["ItemStore<br/>executor：保存并批量累加数量"]
  N0 -->|借用注入引用并转发| N1
  click N0 "职责/InventoryService.md"
  click N1 "职责/ItemStore.md"
```

[InventoryService](职责/InventoryService.md) · [ItemStore](职责/ItemStore.md)

## 系统依赖图

消费者指向提供者；关系来自类文档依赖与已确认契约，未将开发顺序当作运行依赖。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  D0["InventoryService"]
  D1["ItemStore"]
  D0 -->|add/add_many 保存奖励数量| D1
  click D0 "职责/InventoryService.md"
  click D1 "职责/ItemStore.md"
```

[InventoryService](职责/InventoryService.md) · [ItemStore](职责/ItemStore.md)
