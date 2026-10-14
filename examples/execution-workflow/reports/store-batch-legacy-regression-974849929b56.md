# 测试报告

- 工单：store-batch
- 测试：legacy-regression
- 开始：2026-10-14 09:37:58 +08:00
- 结束：2026-10-14 09:37:58 +08:00
- 代码版本：src\server\inventory\inventory_service.py=e3ad74ff4185744c6a3d1ff580a1dd133e229e6ec141ce5465a8dac2ab2793bb; src\shared\inventory\item_store.py=273e24b03469530eea56ebd7b1bdf13429ffb11e4b668cbb09ce573a19c80ef0
- 工作目录：<隔离试验目录>
- 命令参数：`["python", "-m", "unittest", "tests.shared.inventory.test_item_store_batch.LegacyRegression", "-v"]`
- 预期：legacy public behavior regression passes
- 实际：进程退出码 0
- 结果：passed
- 日志 SHA256：18809203ec58868e09f2deac35920695d221c42a3803c2ba50a746d87f77d00d
- [完整日志](store-batch-legacy-regression-974849929b56.log)

退出码仅证明该命令成功；覆盖范围和验收条件仍需逐项核对。
