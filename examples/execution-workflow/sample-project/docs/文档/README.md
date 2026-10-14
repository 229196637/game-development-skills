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
# 文档入口

背包数量存储和奖励服务的已实现用法。先读职责说明，再查询原语言 API。

[目录架构](目录架构.md) · [背包模块](inventory/README.md)

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| ItemStore | executor | 保存并批量累加数量 | [声明](inventory/api/shared/ItemStore.api.pyi) | [职责](inventory/职责/ItemStore.md) |
| InventoryService | executor | 转发批量奖励 | [声明](inventory/api/server/InventoryService.api.pyi) | [职责](inventory/职责/InventoryService.md) |

## 职责架构图

展示类的角色、简短职责及已核实的持有、调用或数据产出关系。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  N0["InventoryService<br/>executor：转发批量奖励"]
  N1["ItemStore<br/>executor：保存并批量累加数量"]
  N0 -->|借用注入引用并转发| N1
  click N0 "inventory/职责/InventoryService.md"
  click N1 "inventory/职责/ItemStore.md"
```

[InventoryService](inventory/职责/InventoryService.md) · [ItemStore](inventory/职责/ItemStore.md)

## 系统依赖图

消费者指向提供者；关系来自类文档依赖与已确认契约，未将开发顺序当作运行依赖。

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 300}}}%%
flowchart TD
  D0["InventoryService"]
  D1["ItemStore"]
  D0 -->|add/add_many 保存奖励数量| D1
  click D0 "inventory/职责/InventoryService.md"
  click D1 "inventory/职责/ItemStore.md"
```

[InventoryService](inventory/职责/InventoryService.md) · [ItemStore](inventory/职责/ItemStore.md)
