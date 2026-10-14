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
# 背包模块

共享存储保存实例内数量；服务端奖励入口复用同一存储。

[目录架构](目录架构.md) · [上级](../README.md)

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| ItemStore | executor | 保存并批量累加数量 | [声明](api/shared/ItemStore.api.pyi) | [职责](职责/ItemStore.md) |
| InventoryService | executor | 转发批量奖励 | [声明](api/server/InventoryService.api.pyi) | [职责](职责/InventoryService.md) |
