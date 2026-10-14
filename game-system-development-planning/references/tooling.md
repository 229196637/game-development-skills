# 开发规划工具

默认只运行 init/update/relocate/check/list，生成并校验文档引用与工单后停止；不执行业务开发、构建、业务测试或验收。status doing、set-item done、record-test、record-acceptance、complete 必须先有本次用户明确执行授权，并加 --execute；否则工具拒绝。--execute 只是执行模式标识，不能自动产生用户授权。状态退回 todo/blocked、工作项退回 pending 可用于规划修订，不触发实现。

以下示例中的开发记录命令仅用于用户已明确要求执行的阶段，不是默认规划的一部分。

`scripts/planning_tool.py` 管理开发工单；文档生成与格式检查仍由文档技能负责。工具不会替你构思业务内容，创建时必须传具体改动、工作项与验收标准，不默认生成空任务。

```powershell
python $m_tool init --root $m_taskRoot --file inventory/职责/ItemStore.md --id store --class ItemStore --document $m_classDocument --goal "实现道具数量存储" --brief "当前尚无数量存储脚本；按文档目录新增 item_store.py，提供 add/get；校验失败不得改变已有数量。" --item "在 src/shared/inventory/item_store.py 实现 add：校验 ID 和正整数数量，拒绝 bool，成功累加并返回总数，失败保持存储不变。" --item "在同文件实现 get：空存储或无记录返回 0，按文档处理非法 ID。" --required-test unit --acceptance "contract::累加入库、查询及无效输入行为符合 ItemStore 文档，失败后数量不变。"
python $m_tool check --root $m_taskRoot
python $m_tool list --root $m_taskRoot
python $m_tool status --root $m_taskRoot --file inventory/职责/ItemStore.md --value doing --execute
python $m_tool set-item --root $m_taskRoot --file inventory/职责/ItemStore.md --number 1 --value done --execute
python $m_tool record-test --root $m_taskRoot --file inventory/职责/ItemStore.md --execute --test-id unit --command "真实测试命令" --expected "约定测试通过" --actual "真实执行结果" --result passed --evidence "实际报告及当前代码版本"
python $m_tool record-acceptance --root $m_taskRoot --file inventory/职责/ItemStore.md --execute --acceptance-id contract --actual "按既定条件逐项核对的实际情况" --result passed --evidence "实际验收证据"
python $m_tool complete --execute --root $m_taskRoot --file inventory/职责/ItemStore.md
```

init/update 的 `--brief` 或 `--brief-file` 必选一项，后者支持多段改动说明；`--item`、`--acceptance ID::条件`、`--reference 名称::实际文件路径` 可重复。init 的 `--required-test`、`--depends-on` 可重复。默认从对应类文档向上查找与 README 同级的目录架构.md，也可显式传 --architecture。缺少目录架构就报错，先补文档，不生成假链接。索引自动包含类文档、文档入口与目录架构，额外 API/专题由 reference 传入。

update 用相同 file/root，加完整 brief/item/acceptance（goal 可选）补充或修订工单；支持旧版迁移。保留测试和验收历史，退回 todo、取消旧通过记录的本轮资格并重置工作项。已有验收 ID 保留以维护历史映射，修改其通过条件即可；不得删掉失败条件来绕过完成门槛。

set-item 以从 1 开始的序号勾选或退回工作项；退回 pending 会使旧测试/验收失效。record-test 和 record-acceptance 只追加真实记录，不执行命令或替你验收；拒绝未知 ID。完整工单在实现前创建，测试/验收结果在实际执行后追加。完成后要更新记录先重开，重开自动使旧通过记录失效。complete 必须同时满足前置、工作项、测试和验收，不能用 status 直接设置完成。

README 只导航，自动生成的区域不覆盖手写范围、顺序和文档说明。所有写入只在显式任务根内；拒绝覆盖已有任务或越界文件，对应文档只读且在工单根之外。check/list 只读，list 给出依赖顺序。输出 JSON，0 成功、1 约束错误、2 参数错误。结构通过不能证明工单内容业务准确、测试真实执行或验收充分。

工单文件镜像对应类文档相对 docs/文档 的路径，文件名与类名一致；check/list/记录/完成都会核对，init 拒绝另造 client/模块 布局。旧八字段工单可执行 `relocate --root <任务根> --file <旧相对路径>`，保留历史、状态并修复文档/README链接，拒绝覆盖已有目标；旧七字段先用 update 补齐再 relocate。旧空目录摘要不自动删除，确认外部引用后由维护者整理。
