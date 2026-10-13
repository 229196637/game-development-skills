---
task_id: "GameRuleSystem"
class: "GameRuleSystem"
document: "../../../../文档/GameRule/职责/GameRuleSystem.md"
status: "todo"
depends_on: ["GameRuleStep", "RuleChainSnapshot", "GameWaveSystem", "GameRandomEventSystem"]
required_tests: ["document-structure"]
required_acceptance: ["contract", "navigation"]
updated: "2026-10-13 21:36:12 +08:00"
---
# GameRuleSystem

## 目标

核对 GameRuleSystem 文档导航

## 当前情况与改动

当前 GameRuleSystem 已有实际系统说明与脚本路径；旧工单只有笼统导航核对，没有列出检查内容和验收标准。本次补全本工单并核对下述文档行为，范围只限技能样例的静态文档核对，不修改生产代码、不宣称游戏动态验证。

## 文档索引

- [对应类文档](../../../../文档/GameRule/职责/GameRuleSystem.md)
- [文档入口](../../../../文档/GameRule/README.md)
- [目录架构](../../../../文档/GameRule/目录架构.md)
- [公开函数 API](../../../../文档/GameRule/api/client/GameRuleSystem.api.cs)

## 任务内容

- [ ] 读取 docs/文档/GameRule/职责/GameRuleSystem.md：核对 Start 装配波次/事件与首阶段、Update 的死亡优先与排队信号消费、规则推进及结果锁存；确认跨调度器跳转不声称递归推进。
- [ ] 比对 docs/文档/GameRule/目录架构.md 中 GameRuleSystem 的脚本与类 MD 映射，并检查本文档索引能直达类说明、文档入口、目录架构及适用 API。

## 验收标准

| 验收 ID | 通过条件 |
| --- | --- |
| contract | 上述静态核对点可从对应类 MD 恢复，公开函数映射或无公开函数说明准确；不把静态核对当成运行验收。 |
| navigation | 类 MD、文档入口、同级目录架构及适用 API 的链接均存在，目录架构路径与现有类说明一致。 |

## 测试过程

| 时间 | 测试 ID | 命令/步骤 | 预期 | 实际 | 结果 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-13 20:58:28 +08:00 | document-structure | documentation_tool.py check docs/文档 --mode implemented --project-root <代码仓库> | 结构、目录摘要与链接通过 | 退出码 0，未做游戏运行测试 | passed | 技能重构当前文档检查；仅静态检查 |
| 2026-10-13 21:36:12 +08:00 | document-structure | 工单内容更新，重新执行与验收 | 重新验证当前工作 | 旧通过记录不适用于本轮 | not-run | 工单内容更新，重新执行与验收 |

## 验收情况

| 时间 | 验收 ID | 实际情况 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| 2026-10-13 21:36:12 +08:00 | contract | 本轮尚未验收 | not-run | 工单内容更新，重新执行与验收 |
| 2026-10-13 21:36:12 +08:00 | navigation | 本轮尚未验收 | not-run | 工单内容更新，重新执行与验收 |
