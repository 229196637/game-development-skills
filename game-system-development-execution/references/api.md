# 执行 API 速查

只查入口与返回时读本页；读写职责、锁内校验和完成门禁见 [职责说明](responsibilities.md)。详细命令参数见 [执行工具](tooling.md)。

| 入口 | 职责 | 返回 result |
| --- | --- | --- |
| `execution_tool.py next --entry <README>` | 只读首批就绪工单 | ready/next/remaining |
| `execution_tool.py show --entry <README> --id <ID>` | 只读具体工单 | id/file/status/claim/document/references/items/required_tests/acceptance |
| `execution_tool.py claim --entry <README> --owner <人> [--id <ID>]` | 锁内只领取首个就绪工单 | 同 show |
| `set-item/record-test/record-acceptance/block/release/reopen/complete` | 锁内核对 owner，追加执行证据或更新状态 | 同 show |
| `run-test --entry ... --id ... --owner ...` | 锁内真实运行测试并产出报告和日志 | report/log/result/exit_code |
| 相邻 `planning_tool.py dashboard --root <任务根>` | 只读完整看板快照，无执行授权 | [schemaVersion=1 契约](../../game-system-development-planning/references/responsibilities.md#dashboard-字段契约) |

统一输出 `{ok:true,result:...}`；错误 `{ok:false,error:...}`。退出码 0 成功、1 约束/实际测试失败、2 参数错误；run-test 测试失败仍返回其真实 result 和报告。

## scripts/execution_tool.py

```python
set_owner(task, value)             # 更新内存中的领取注释，调用 save 才落盘
lock(root)                        # context manager：已有 .execution.lock 则拒绝，不抢锁
report_target(root, folder)       # Path：核对报告目录不能在工单根/正式文档/.git 内
run_test(args, root, task)         # dict：真实运行、报告/日志、追加测试行
main()                            # dict：CLI result
```

`owner(task)`、`candidates(tasks, order)`、`details(task)`、`completed_reports(task)` 从相邻规划技能 `task_store.py` 导入，签名见 [共享 API](../../game-system-development-planning/references/api.md#共享-python-api)。不复制共享实现；调用模块不等于进入规划职责，也不要求重复加载规划技能正文。
