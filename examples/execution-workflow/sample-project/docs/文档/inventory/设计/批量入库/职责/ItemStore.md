---
id: "batch.inventory.设计.批量入库.职责.ItemStore.md"
kind: "plan"
system: "inventory"
title: "ItemStore"
status: "ready"
updated: "2026-10-14 09:38:29 +08:00"
sources: ["shared/inventory/item_store.py", "server/inventory/inventory_service.py"]
links: []
code_revision: "working-tree; SHA256 273e24b03469530eea56ebd7b1bdf13429ffb11e4b668cbb09ce573a19c80ef0"
roles: ["executor"]
---
# ItemStore

## 职责

使用同一实例保存单条与批量数量。当前 add/get 只拒绝假值 ID；非空非字符串可能被接受，不应把注解写成现存类型校验。数量已排除 bool 和非正整数。add_many，在任何存储变更前核对所有项，成功后批量累计；不得通过逐条调用 add 形成部分提交。重复 ID 合计，返回独立结果字典，不暴露内部数量表。原 add/get 行为与签名保持现状。

## 目录架构与脚本位置

```text
src/shared/inventory/item_store.py
```

| 类/模块 | 角色 | 代码文件路径 | 命名空间/模块 | 放置理由与装配者 |
| --- | --- | --- | --- | --- |
| ItemStore | executor | src/shared/inventory/item_store.py | src.shared.inventory.item_store | 沿用已有脚本；外部调用方创建/注入，具体入口未提供 |

## 架构

```mermaid
flowchart LR
  Caller[调用方] --> Service[InventoryService]
  Service --> Store[ItemStore]
  Store --> Counts[实例内数量]
```

## API

[原语言声明](../../../api/shared/ItemStore.api.pyi)；全部方法已核对实现。
