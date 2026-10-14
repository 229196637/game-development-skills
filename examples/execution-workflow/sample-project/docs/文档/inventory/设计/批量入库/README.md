---
id: "batch.inventory.设计.批量入库.README.md"
kind: "index"
system: "inventory"
title: "批量入库设计"
status: "ready"
updated: "2026-10-14 09:13:06 +08:00"
sources: ["shared/inventory/item_store.py", "server/inventory/inventory_service.py"]
links: []
code_revision: "working-tree; read-only input SHA256 in verification.json"
---
# 批量入库设计

一次请求携带若干道具 ID 与正整数数量，任一项非法则整批数量不变，有效则累加。

[目录架构](目录架构.md) · [类职责](职责/README.md) · [API](api/README.md)

## 已有框架与复用

ItemStore.add 已完成单项数量校验与累加；不能逐项调用它组成批量事务，因为后续失败会留下前项变更。InventoryService.grant_reward 已直接转发存储。复用这两个类，新增批量入口，单条调用保持现状。

## 契约边界

批量项采用 `(item_id, amount)` 二元组列表；实现采用此接口形状。ID 采用现有注解的非空字符串，不增加道具表存在性或空白裁剪规则。重复 ID 按有效项相加。返回本批涉及 ID 的提交后总量字典。空列表按零项请求返回空字典且不变更。上述形状、空列表与返回值是可调整的技术设计选择，用户确认的业务规则只有全量校验、失败不变和有效累加。

此设计保证输入校验失败的原子性，不扩展并发、持久化、分布式事务、幂等去重或奖励权限。列表外层、二元组形状、非空字符串 ID、正整数且非 bool 的数量均在存储入口校验，非法统一 ValueError；调用方不得在提交期间修改请求。

## 类索引

| 类 | 角色 | 职责 | API | 文档 |
| --- | --- | --- | --- | --- |
| ItemStore | executor | 保存数量并提交整批累加 | [声明](../../api/shared/ItemStore.api.pyi) | [职责](职责/ItemStore.md) |
| InventoryService | executor | 转发服务端批量奖励 | [声明](../../api/server/InventoryService.api.pyi) | [职责](职责/InventoryService.md) |
