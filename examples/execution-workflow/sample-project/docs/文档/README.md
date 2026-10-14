---
system: catalog
side:
- shared
- server
updated: '2026-10-14 09:40:52 +08:00'
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
