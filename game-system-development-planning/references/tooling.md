# 开发规划工具

`scripts/planning_tool.py` 用标准库管理逐类任务，不再调用文档检查器验证规划。文档 schema/图/API 只属于文档技能；先用文档工具检查文档，再使用本工具管理执行记录。

```powershell
python $m_tool rules
python $m_tool init --root $m_taskRoot --file client/规则/GameRuleSystem.md --id rules --class GameRuleSystem --document $m_classDocument --goal "推进规则" --item "按文档实现规则推进" --required-test build
python $m_tool check --root $m_taskRoot
python $m_tool list --root $m_taskRoot
python $m_tool status --root $m_taskRoot --file client/规则/GameRuleSystem.md --value doing
python $m_tool record-test --root $m_taskRoot --file client/规则/GameRuleSystem.md --test-id build --command "实际构建命令" --expected "构建通过" --actual "真实结果" --result passed --evidence "真实输出位置及代码版本"
python $m_tool complete --root $m_taskRoot --file client/规则/GameRuleSystem.md
```

init 的 `--item`、`--required-test`、`--depends-on` 可重复；document 是已存在对应文档的实际路径。init 拒绝覆盖文件，创建必要目录 README，README 只导航，不复制状态。check/list 只读，list 输出依赖顺序。status 只允许 todo/doing/blocked；doing 与 complete 检查前置完成。完成后修改工作项/必需测试前先退回 doing，再记录对应当前代码的测试；重开已完成任务自动追加 not-run，使旧通过记录不能直接完成新一轮。

record-test 只追加证据，不运行命令；拒绝未登记的测试 ID、空白内容及向已完成任务追加测试（先退回 doing）。complete 不勾选工作项，不创建通过记录；只有已勾选、必需测试最近全部 passed 且前置 completed 才完成。不能绕过此门槛用 status 设完成。

所有写入限制在显式 `--root` 内，`--file` 必须是相对 .md 路径，不允许 README、..、绝对路径或越界链接；对应文档只读，必须在任务根之外。工具不碰生产源码、不执行构建、不提交 Git。每次输出 JSON，退出码 0 成功、1 约束/状态问题、2 参数问题。工具只校验记录可恢复与门槛，真实测试、正确依赖和文档充分性仍由执行者核对。
