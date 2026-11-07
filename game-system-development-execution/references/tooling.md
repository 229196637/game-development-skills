# 执行工具

## 路径与工作目录（跨宿主）

先从本次加载结果取得本技能的真实安装根，不猜测 Codex、zcode 或其他客户端目录。以下变量须替换为已核实的绝对路径；在项目根运行，不切到技能目录。Python 使用已确认安装依赖的解释器，完整技能组可移动到其他 skills 根。

~~~powershell
$m_skillRoot = '<本次实际加载的技能绝对目录>'
$m_projectRoot = '<当前项目绝对目录>'
$m_tool = Join-Path $m_skillRoot 'scripts/execution_tool.py'
Set-Location -LiteralPath $m_projectRoot
python -B "$m_tool" --help
~~~

POSIX shell 对应写法（仍须先填入真实路径）：

~~~sh
skill_root='<本次实际加载的技能绝对目录>'
project_root='<当前项目绝对目录>'
cd "$project_root" || exit 1
python3 -B "$skill_root/scripts/execution_tool.py" --help
~~~

后续示例的 `$m_tool` 均指此绝对脚本路径。`--root`、目标文档、`--cwd`、`--report-root` 等参数优先用项目根构造的绝对路径；相对参数按进程工作目录解析，而不是脚本目录。缺依赖先报告，不自动安装。工具启动或结构检查通过不等于业务验收通过。

`scripts/execution_tool.py` 依赖相邻规划技能的 task_store.py，读取任务入口 TODO 后操作原类工单，无第二份状态清单。领取记录为工单正文中的短 HTML 注释（领取人/时间），不增加系统文档 meta。任务根 `.execution.lock` 防止两个脚本同时领取或记录；测试期间持锁。遗留锁需先确认进程已退出再清理，不自动抢占。

```powershell
$m_entry = "docs/规划/背包任务/README.md"
python $m_tool next --entry $m_entry
python $m_tool claim --entry $m_entry --owner developer-1
python $m_tool show --entry $m_entry --id store
# 阅读返回的文档索引后，实现实际代码，再勾选已完成工作项
python $m_tool set-item --entry $m_entry --id store --owner developer-1 --number 1 --value done
python $m_tool run-test --entry $m_entry --id store --owner developer-1 --test-id unit --program python --arg=-m --arg=unittest --arg=discover --arg=-s --arg=tests --cwd . --report-root docs/测试/背包任务 --expected "公开行为测试全部通过" --revision "实际提交或本轮源文件摘要"
python $m_tool record-acceptance --entry $m_entry --id store --owner developer-1 --acceptance-id contract --actual "各项契约符合预定条件" --result passed --evidence "真实报告或复现证据"
python $m_tool complete --entry $m_entry --id store --owner developer-1
```

工具不会实现业务代码。run-test 以参数列表 shell=False 执行命令；每个参数用 --arg，开头为 - 的参数用 --arg=-m。默认 timeout 300 秒，可调整；超时或启动失败登记 failed 并退出 1，报告与日志仍保留，不假称通过。测试命令只按任务需要运行，用户执行授权不允许扩展到其他项目或危险命令。

- next/show：只读返回可领队列/具体工单、领取人、类文档及索引；next 没有任务时同时列 remaining，区分完成和阻塞。
- claim：可省略 --id 自动领首项；显式 ID 也必须为首个就绪项，不越过入口优先级。todo 且前置 completed 才能领。
- set-item：从 1 开始；pending 使旧测试/验收结果失效。
- run-test：真实执行并产生报告；record-test 用 --test-id/--command/--expected/--actual/--result/--report 登记外部已执行验证，报告必须存在。
- record-acceptance：按注册的验收 ID 追加结果。不能用测试通过替代所有验收。
- block/release：需要 --reason；改 blocked/todo，解除领取并使旧结果失效。block 后恢复用 reopen。
- reopen：仅 completed/blocked，--reason 使历史通过失效，退 todo；随后重新 claim。
- complete：持有人、doing、前置 completed、工作项全勾选、每个必需测试和验收最新 passed、测试报告文件存在全部满足才完成，自动解除领取。

整体看板用相邻规划工具 `planning_tool.py dashboard --root <任务根>`，不需要进入规划流程：只读快照提供完整状态/进度与历史，字段契约见 [共享职责说明](../../game-system-development-planning/references/responsibilities.md#dashboard-字段契约)。consistency.stable=false 显示“更新中”，遗留锁不抢，不写入口；它不替代 next/show 或锁内校验。执行命令/函数简表见 [API 速查](api.md)，执行与共享层分工见 [职责说明](responsibilities.md)。

写操作必须先领取并传同一 --owner；show 返回当前持有人便于恢复。同任务多执行者冲突/错 ID/未知测试/路径越界都会拒绝。报告位于工单根外且不在任何文档目录；推荐 docs/测试/<任务>。输出 JSON；0 成功、1 约束或实际测试失败、2 参数错误。领取不证明人类授权，执行者必须先确认本次任务已被要求落实。
