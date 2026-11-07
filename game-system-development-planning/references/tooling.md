# 开发规划工具

## 路径与工作目录（跨宿主）

先从本次加载结果取得本技能的真实安装根，不猜测 Codex、zcode 或其他客户端目录。以下变量须替换为已核实的绝对路径；在项目根运行，不切到技能目录。Python 使用已确认安装依赖的解释器，完整技能组可移动到其他 skills 根。

~~~powershell
$m_skillRoot = '<本次实际加载的技能绝对目录>'
$m_projectRoot = '<当前项目绝对目录>'
$m_tool = Join-Path $m_skillRoot 'scripts/planning_tool.py'
Set-Location -LiteralPath $m_projectRoot
python -B "$m_tool" --help
~~~

POSIX shell 对应写法（仍须先填入真实路径）：

~~~sh
skill_root='<本次实际加载的技能绝对目录>'
project_root='<当前项目绝对目录>'
cd "$project_root" || exit 1
python3 -B "$skill_root/scripts/planning_tool.py" --help
~~~

后续示例的 `$m_tool` 均指此绝对脚本路径。`--root`、目标文档、`--cwd`、`--report-root` 等参数优先用项目根构造的绝对路径；相对参数按进程工作目录解析，而不是脚本目录。缺依赖先报告，不自动安装。工具启动或结构检查通过不等于业务验收通过。

`scripts/planning_tool.py` 只编写/校验工单，脚本格式与约束由 scripts/task_store.py 共享；执行操作已移至游戏系统开发执行技能。没有 --execute，也不接受执行命令。

```powershell
python $m_tool init --root $m_taskRoot --file inventory/职责/ItemStore.md --id store --class ItemStore --document $m_classDocument --goal "实现道具数量存储" --brief "当前尚无数量存储脚本；按文档目录新增 item_store.py，提供 add/get；校验失败不得改变已有数量。" --item "在 src/shared/inventory/item_store.py 实现 add：校验 ID 和正整数数量，拒绝 bool，成功累加并返回总数，失败保持存储不变。" --item "在同文件实现 get：空存储或无记录返回 0，按文档处理非法 ID。" --required-test unit --acceptance "contract::累加入库、查询及无效输入行为符合 ItemStore 文档，失败后数量不变。"
python $m_tool check --root $m_taskRoot
python $m_tool list --root $m_taskRoot
python $m_tool dashboard --root $m_taskRoot
python $m_tool order --root $m_taskRoot
# 可显式指定同级优先级，必须列全且不越过依赖
python $m_tool order --root $m_taskRoot --id store --id service
```

init/update 要求具体 brief 或 brief-file、重复 item、acceptance ID::条件；init 还要求 goal、id、class、document、required-test，可重复 depends-on。reference 名称::实际路径补充 API/专题。工具自动索引对应类 MD、文档入口和同级目录架构，拒绝缺失或未链接的架构文档。

init 默认将依赖排序写入任务 README 的 planning-todo 区域；order 可显式调整完整顺序，未知/重复/循环/越过前置均拒绝，其他手写内容保留。TODO 只存顺序/ID/工单链接，不存状态。新增或迁移任务后核对优先级；check/list 校验完整工单和镜像路径，list 读取入口 TODO，旧任务先 order。

update 重建具体内容，保留测试/验收历史并追加 not-run 失效记录，退 todo、重置勾选；不得删除历史验收 ID。doing 拒绝修订，先由执行者 release。relocate 镜像对应类文档的相对路径，保留 ID/状态/记录并修复链接，拒绝覆盖目标；旧七字段先 update。

dashboard 只读输出 schemaVersion=1 的完整 JSON 快照：任务/工作项进度、状态计数、按 TODO 顺序的工单、ready/next、最新测试/验收及历史、报告存在性和依赖。consistency.stable=false 为“更新中”（锁存在或输入变化），最多三轮有限重试；不创建/抢占锁、不写 README，坏 completed 整次失败。简洁调用/函数签名见 [API 速查](api.md)，完整字段与一致性边界见 [职责说明](responsibilities.md)。list/check 返回契约不变。

规划验收条件时按验证对象选择证据，不预填实际通过结果；截图、视频、数值/日志与存放/链接规则见执行侧 [多媒体验收证据](../../game-system-development-execution/references/workflows/verification.md#多媒体验收证据)。dashboard 仅只读展示已有证据，不走模型，预览不证明验收通过。

每级 README 导航自动区保留手写部分。操作仅在显式任务根内，类文档只读，JSON 输出，0 成功/1 约束错误/2 参数错误；格式通过不证明业务合理或测试已执行。
