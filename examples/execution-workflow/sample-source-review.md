# 发布样例源码复测

复测记录：2026-10-14 10:02:38 +08:00

复制独立子代理实际实现的两个业务文件，逐文件核对文本内容一致；仅按仓库约定保存 LF 换行，没有改变业务逻辑。

从 sample-project 运行原隔离目录的 unittest discover，实际载入此样例的 ItemStore 与 InventoryService（inspect.getfile 核对）。12 个不同测试方法全部通过；测试程序没有加入 Git。

源码 SHA256：

```
src/shared/inventory/item_store.py=6f45dd20f2a4ad7bfcc4181fc743b552d36ea8b642cb346704c08817c3b7e4f6; src/server/inventory/inventory_service.py=caf368ed5e0d52eac7e2976783d42fbcf4a109fcde251627b16207be825447a2
```

实际测试输出：

```text
test_empty_real_store (server.inventory.test_inventory_service_batch.BatchBehavior.test_empty_real_store) ... ok
test_exception_is_not_swallowed (server.inventory.test_inventory_service_batch.BatchBehavior.test_exception_is_not_swallowed) ... ok
test_invalid_positions_real_store_atomic (server.inventory.test_inventory_service_batch.BatchBehavior.test_invalid_positions_real_store_atomic) ... ok
test_real_store_shared_sum (server.inventory.test_inventory_service_batch.BatchBehavior.test_real_store_shared_sum) ... ok
test_single_forward_and_result_identity (server.inventory.test_inventory_service_batch.BatchBehavior.test_single_forward_and_result_identity) ... ok
test_grant_reward_real_store (server.inventory.test_inventory_service_batch.LegacyRegression.test_grant_reward_real_store) ... ok
test_empty_is_noop_and_new_result (shared.inventory.test_item_store_batch.BatchBehavior.test_empty_is_noop_and_new_result) ... ok
test_every_invalid_item_at_every_position_is_atomic (shared.inventory.test_item_store_batch.BatchBehavior.test_every_invalid_item_at_every_position_is_atomic) ... ok
test_invalid_outer_shape (shared.inventory.test_item_store_batch.BatchBehavior.test_invalid_outer_shape) ... ok
test_sum_and_result_isolation (shared.inventory.test_item_store_batch.BatchBehavior.test_sum_and_result_isolation) ... ok
test_whitespace_is_not_trimmed (shared.inventory.test_item_store_batch.BatchBehavior.test_whitespace_is_not_trimmed) ... ok
test_add_get_legacy_contract (shared.inventory.test_item_store_batch.LegacyRegression.test_add_get_legacy_contract) ... ok

----------------------------------------------------------------------
Ran 12 tests in 0.002s

OK
```

样例中的 .py 是业务实现，用于核对执行成果；不是临时生成脚本。没有复制 implement_*/execute_records/finalize_docs 或测试 Python。生产项目未写入。
