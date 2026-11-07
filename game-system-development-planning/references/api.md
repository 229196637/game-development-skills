# 规划与共享查询 API 速查

只查签名与返回时读本页；字段语义、并发边界和模块分工见 [职责说明](responsibilities.md)。脚本路径从本次技能安装根取得；参数路径按进程工作目录解析。

## CLI

| 命令 | 用途 | 返回 result |
| --- | --- | --- |
| `planning_tool.py dashboard --root <任务根>` | 只读完整快照，不写入口、不创建锁 | schemaVersion/root/readme/updated/counts/progress/ready/next/tasks/consistency |
| `planning_tool.py list --root <任务根>` | 按入口 TODO 顺序列摘要 | tasks：id/class/status/file/depends_on |
| `planning_tool.py check --root <任务根>` | 校验工单、完成状态和目录 README | 同 list；拒绝零工单 |
| `planning_tool.py order --root <任务根> [--id <ID> ...]` | 写入完整依赖顺序 | order |
| `planning_tool.py init/update/relocate --root ...` | 建立、修订或迁移规划工单 | 见 [参数说明](tooling.md) |

统一输出 `{ok:true,result:...}`；约束/文件错误为 `{ok:false,error:...}`，退出码 1；参数错误退出码 2。dashboard 允许合法空 TODO，其他命令契约不变。`ready` 是所有「todo、无领取人、前置全 completed」的工单 id，可能同时有多项，表示可并行领取而不是「只该做一个」；`next` 只是入口顺序上的第一个。证据仍为原字符串，可含多个标准 Markdown 图片/视频/报告链接；路径与记录约定见 [多媒体验收证据](../../game-system-development-execution/references/workflows/verification.md#多媒体验收证据)，不扩展返回 schema。

## 共享 Python API

模块：`scripts/task_store.py`。

```python
owner(task)                         # dict | None：原领取注释
candidates(tasks, order)            # list[str]：todo、无领取、前置 completed，按入口顺序
details(task)                      # dict：执行 next/show 的兼容字段，不含 dashboard 扩展
latest_rows(rows)                  # list[list[str]]：各 ID 最后追加行，按追加位置排序
completed_reports(task)            # None：检查各必需测试的最新报告存在，失败抛 ValueError
dashboard_task(task, tasks)         # dict：原 details + 历史/最新结果/依赖等扩展
dashboard_inputs(root)             # list[tuple]：本轮输入签名，仅供快照一致性比较
dashboard(root, attempts=3)         # dict：schemaVersion=1 的 result，不含外层 ok
```

传入已 resolve 的 `Path` 任务根；dashboard 不修复规划、不抢锁、不返回领取授权。`consistency.stable=false` 必须显示“更新中”，不能当成稳定事实；刷新重试即可。读取快照不需要加载执行技能正文。
