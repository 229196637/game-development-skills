# 开发规划工具

`scripts/planning_tool.py` 只编写/校验工单，脚本格式与约束由 scripts/task_store.py 共享；执行操作已移至游戏系统开发执行技能。没有 --execute，也不接受执行命令。

```powershell
python $m_tool init --root $m_taskRoot --file inventory/职责/ItemStore.md --id store --class ItemStore --document $m_classDocument --goal "实现道具数量存储" --brief "当前尚无数量存储脚本；按文档目录新增 item_store.py，提供 add/get；校验失败不得改变已有数量。" --item "在 src/shared/inventory/item_store.py 实现 add：校验 ID 和正整数数量，拒绝 bool，成功累加并返回总数，失败保持存储不变。" --item "在同文件实现 get：空存储或无记录返回 0，按文档处理非法 ID。" --required-test unit --acceptance "contract::累加入库、查询及无效输入行为符合 ItemStore 文档，失败后数量不变。"
python $m_tool check --root $m_taskRoot
python $m_tool list --root $m_taskRoot
python $m_tool order --root $m_taskRoot
# 可显式指定同级优先级，必须列全且不越过依赖
python $m_tool order --root $m_taskRoot --id store --id service
```

init/update 要求具体 brief 或 brief-file、重复 item、acceptance ID::条件；init 还要求 goal、id、class、document、required-test，可重复 depends-on。reference 名称::实际路径补充 API/专题。工具自动索引对应类 MD、文档入口和同级目录架构，拒绝缺失或未链接的架构文档。

init 默认将依赖排序写入任务 README 的 planning-todo 区域；order 可显式调整完整顺序，未知/重复/循环/越过前置均拒绝，其他手写内容保留。TODO 只存顺序/ID/工单链接，不存状态。新增或迁移任务后核对优先级；check/list 校验完整工单和镜像路径，list 读取入口 TODO，旧任务先 order。

update 重建具体内容，保留测试/验收历史并追加 not-run 失效记录，退 todo、重置勾选；不得删除历史验收 ID。doing 拒绝修订，先由执行者 release。relocate 镜像对应类文档的相对路径，保留 ID/状态/记录并修复链接，拒绝覆盖目标；旧七字段先 update。

每级 README 导航自动区保留手写部分。操作仅在显式任务根内，类文档只读，JSON 输出，0 成功/1 约束错误/2 参数错误；格式通过不证明业务合理或测试已执行。
