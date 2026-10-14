---
system: inventory
side:
- server
updated: '2026-10-14 09:40:52 +08:00'
code_revision: working-tree; source hashes in ../../copy-after.json
sources:
- src/server/inventory/inventory_service.py
dependencies:
- document: ItemStore.md
  uses: add/add_many 保存奖励数量
roles:
- executor
---
# InventoryService

## 职责

服务持有构造参数传入的有效 ItemStore 引用。grant_rewards 向该存储单次转发整批请求，并原样返回结果和透传异常，不逐条奖励或额外校验。

## 架构

```mermaid
flowchart LR
  Caller[调用方] --> Service[InventoryService]
  Service --> Store[ItemStore]
  Store --> Counts[实例内数量]
```

## 发放奖励

调用方先创建存储，再注入服务：

```python
from src.shared.inventory.item_store import ItemStore
from src.server.inventory.inventory_service import InventoryService
store = ItemStore()
service = InventoryService(store)
totals = service.grant_rewards([('coin', 2), ('coin', 3)])
# totals == {'coin': 5}; store.get('coin') == 5
```

空请求返回 {}。非法输入由存储抛 ValueError 且整批不变；旧 grant_reward 继续调用 add。

## 生命周期与脚本位置

类位于 src/server/inventory/inventory_service.py。调用方创建服务，注入并管理存储寿命；构造函数不检查 store 非空。服务不释放借用存储，没有网络、线程、取消或持久化能力。具体装配入口未提供。

## 目录架构与脚本位置

```text
src/server/inventory/inventory_service.py
```

| 类/模块 | 角色 | 代码文件路径 | 命名空间/模块 | 放置理由与装配者 |
| --- | --- | --- | --- | --- |
| InventoryService | executor | src/server/inventory/inventory_service.py | src.server.inventory.inventory_service | 沿用原位置；外部调用方创建，具体入口未提供 |

## API

[服务端声明](../api/server/InventoryService.api.pyi)
