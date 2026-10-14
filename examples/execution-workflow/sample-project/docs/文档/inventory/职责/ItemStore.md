---
system: inventory
side:
- shared
updated: '2026-10-14 09:40:52 +08:00'
code_revision: working-tree; source hashes in ../../copy-after.json
sources:
- src/shared/inventory/item_store.py
dependencies: []
roles:
- executor
---
# ItemStore

## 职责

使用同一实例保存单条与批量数量，批量先验证所有项再提交，返回涉及 ID 的总量新字典。

## 架构

```mermaid
flowchart LR
  Caller[调用方] --> Service[InventoryService]
  Service --> Store[ItemStore]
  Store --> Counts[实例内数量]
```

## 批量入库

调用方先创建存储；如下示例使用已创建的实例：

```python
from src.shared.inventory.item_store import ItemStore
store = ItemStore()
store.add('coin', 10)
totals = store.add_many([('coin', 2), ('coin', 3), ('gem', 1)])
# totals == {'coin': 15, 'gem': 1}
```

列表中每项必须为二元组，ID 为非空字符串，数量为正 int 且排除 bool。非法输入统一抛 ValueError，任何数量均不变。空列表返回 {}；不裁剪空白 ID，不检查道具表。修改结果字典不影响存储。

单条 add/get 保持原行为：仅拒绝假值 ID，不强制字符串，不可哈希 ID 可抛 TypeError。

## 生命周期与脚本位置

调用方创建并持有 src/shared/inventory/item_store.py 的 ItemStore；实例创建后可调用，数量由其方法修改。重复调用继续累加，没有幂等去重、释放、并发或持久化能力。具体装配入口未提供。

## 目录架构与脚本位置

```text
src/shared/inventory/item_store.py
```

| 类/模块 | 角色 | 代码文件路径 | 命名空间/模块 | 放置理由与装配者 |
| --- | --- | --- | --- | --- |
| ItemStore | executor | src/shared/inventory/item_store.py | src.shared.inventory.item_store | 沿用原位置；外部调用方创建，具体入口未提供 |

## API

[共享声明](../api/shared/ItemStore.api.pyi)
