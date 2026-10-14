# 测试报告

- 工单：service-batch
- 测试：batch-behavior
- 开始：2026-10-14 09:39:15 +08:00
- 结束：2026-10-14 09:39:15 +08:00
- 代码版本：src\server\inventory\inventory_service.py=0cdba5bb0a905b29bc66eab5a5af2112dd9c3661c939879fa273e15539ff1414; src\shared\inventory\item_store.py=273e24b03469530eea56ebd7b1bdf13429ffb11e4b668cbb09ce573a19c80ef0
- 工作目录：<隔离试验目录>
- 命令参数：`["python", "-m", "unittest", "tests.server.inventory.test_inventory_service_batch.BatchBehavior", "-v"]`
- 预期：5 batch tests including invalid position matrix pass
- 实际：进程退出码 0
- 结果：passed
- 日志 SHA256：7d0d2db170f329b31e61adb6005afb5893974a14d1c703d6fe7510c3d0348481
- [完整日志](service-batch-batch-behavior-959246642426.log)

退出码仅证明该命令成功；覆盖范围和验收条件仍需逐项核对。
