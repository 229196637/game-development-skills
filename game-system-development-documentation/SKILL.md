---
name: game-system-development-documentation
description: 生成或同步设计态和已实现态游戏文档、目录架构与脚本位置、角色职责、调度流水线、原语言公开函数 API 及各目录 README。文档生成收敛在本技能，不排序任务 TODO。
metadata:
  short-description: 扫描现状并同步系统说明、编程指南和 API
  schema-version: "1"
---
# 游戏系统开发文档

个人级游戏文档生成技能，跨项目、跨语言使用。先完成文档，再由 game-system-development-planning 读取文档驱动执行；本技能也可直接处理设计、已实现补录与修改同步，保持现有文档产物规范。正式文档参照项目 SDK 的系统说明：先讲用途，再按实际使用场景给短调用示例，说明生命周期与限制；不把扫描结果和检查清单堆成正文。图中操作节点可点击对应规范，名称与文件相对应；图下保留同目标 Markdown 链接。

## 系统文档工具（优先执行）

优先使用 [系统文档工具](references/tooling.md) 的 rules/check，固定检查精简 meta、文档依赖、API 布局与测试内容分离；真实实现、持有关系、生命周期及 SDK 式可读性仍人工核对，结构检查通过不能证明正文好读。

## 1. 按任务选择入口

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 360}}}%%
flowchart TD
  Task{"本次做什么？"}
  Task -->|查接口| Api["查阅 API<br/>snapshots.md"]
  Api --> Enough{"现有声明足够且未过期？"}
  Enough -->|是| Answer["查阅 API<br/>snapshots.md<br/>按真实契约回答"]
  Enough -->|否| Check["查阅 API<br/>snapshots.md<br/>只查相关源码后回答"]
  Task -->|补已有系统文档| Baseline["老工程补录<br/>baseline.md"]
  Task -->|开发后修改同步| Sync["增量同步<br/>sync.md"]
  Task -->|设计态文档| Plan["规划文档生成<br/>planning-documents.md"]
  Baseline --> Emit["正式文档边界<br/>document-layout.md<br/>继续第 2 步"]
  Sync --> Emit
  click Api "references/api/snapshots.md"
  click Answer "references/api/snapshots.md"
  click Check "references/api/snapshots.md"
  click Baseline "references/workflows/baseline.md"
  click Sync "references/workflows/sync.md"
  click Plan "references/workflows/planning-documents.md"
  click Emit "references/contracts/document-layout.md"
```

| 场景 | 对应规范 | 操作边界 |
| --- | --- | --- |
| 查阅接口 | [查阅 API](references/api/snapshots.md) | 系统 Markdown → 原语言声明；足够且无冲突不扫描源码，planned 不当已实现 API |
| 老工程缺文档 | [老工程补录](references/workflows/baseline.md) | 专项追踪创建/运行/释放和公开契约，不补造历史规划 |
| 实现/修复/优化后 | [增量同步](references/workflows/sync.md) | 对照此次实现差异，更新系统及受影响消费者，不覆盖其他改动 |
| 设计态 | [规划文档生成](references/workflows/planning-documents.md) | 同一生成器使用规划 meta 与 planned API；TODO 交回统一任务规划 |

## 2. 生成或同步实际系统文档

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 360}}}%%
flowchart TD
  Git["独立文档 Git<br/>docs-git.md"] --> Facts["增量同步<br/>sync.md<br/>核对本次实现事实"]
  Facts --> Placement["目录架构与脚本位置<br/>script-layout.md"]
  Placement --> Index["文档总入口<br/>document-layout.md<br/>维护已实现系统导航，无 TODO"]
  Index --> Style["SDK 式系统说明<br/>document-layout.md<br/>阅读相关 SDK，确定使用场景"]
  Style --> Body["正式文档边界<br/>document-layout.md<br/>用途、架构、调用示例与生命周期"]
  Body --> Dispatch["调度器与执行者<br/>dispatchers.md"]
  Dispatch --> Api["查阅 API<br/>snapshots.md<br/>公开函数与真实契约"]
  Api --> Move{"任务 API 全部函数已实现核对？"}
  Move -->|是| Handoff["从规划移交正式文档<br/>snapshots.md"]
  Move -->|否或无迁移| Keep["文件与目录<br/>snapshots.md<br/>未完成声明保留任务内"]
  Handoff --> Verify["增量同步<br/>sync.md<br/>信息完整性 / 链接 / 架构图检查"]
  Keep --> Verify
  Verify --> Pass{"核对通过？"}
  Pass -->|遗漏或冲突| Facts
  Pass -->|通过| Deliver["增量同步<br/>sync.md<br/>交付范围、证据和已知缺口"]
  click Git "references/contracts/docs-git.md"
  click Facts "references/workflows/sync.md"
  click Placement "references/workflows/script-layout.md"
  click Index "references/contracts/document-layout.md#文档总入口"
  click Style "references/contracts/document-layout.md#sdk-式系统说明"
  click Body "references/contracts/document-layout.md"
  click Dispatch "references/workflows/dispatchers.md"
  click Api "references/api/snapshots.md"
  click Handoff "references/api/snapshots.md#从规划移交正式文档"
  click Keep "references/api/snapshots.md#文件与目录"
  click Verify "references/workflows/sync.md"
  click Deliver "references/workflows/sync.md"
```

补录任务从第 1 图的 [老工程补录](references/workflows/baseline.md) 进入；先按 [SDK 式系统说明](references/contracts/document-layout.md#sdk-式系统说明) 组织阅读路径；[系统模板](assets/templates/system.md) 是可裁剪骨架，标题按实际操作命名，具体规范如下：

| 步骤 | 阅读规范 | 必须得到的结果 |
| --- | --- | --- |
| 检查仓库 | [独立文档 Git](references/contracts/docs-git.md) | docs 是独立仓库，知道本次范围与用户已有改动 |
| 提炼现状 | [正式文档边界](references/contracts/document-layout.md) | 每系统一份使用说明；用途 → 理解架构 → 最短用法 → 必要场景 → 生命周期 → API 入口；持有与限制就近讲清，不强制职责表或固定章节 |
| 维护 meta | [精简 meta](references/contracts/document-layout.md#精简-meta) | 默认 system、side、updated、code_revision、sources、dependencies；依赖其他文档用 document 与 uses，不在正文重复依赖表 |
| 维护 API | [查阅 API](references/api/snapshots.md) | <模块>/api/client|server|shared/ 原语言公开函数声明及直接映射；保留真实参数/返回/异常与版本信息 |
| 检查遗漏 | [精简后的信息完整性](references/contracts/document-layout.md#精简后的信息完整性)、[增量同步](references/workflows/sync.md) | 初始化前置、owner、成功含义、重复调用、取消/失败及清理限制可从主体/API 恢复；核对链接、架构显示与实际验证 |
| 交付 | [增量同步](references/workflows/sync.md) | 在交付说明区分已核对与未验证；测试内容全部放任务测试文件/独立报告，不进入系统主体或 meta |

普通系统保留架构图；调度器额外为每条主要流水线画实际流程图并链接跨调度器通信。技能操作图与业务流水线图分别维护，不复制规划图冒充实现。

## 调度器与执行者

涉及调度职责时读取 [调度器与执行者](references/workflows/dispatchers.md)。类型/模块 meta 用 roles 标记 dispatcher/executor/tool/data（可兼任）；调度器再记录 dispatcher 与 design_patterns（模式/编排机制及用途）；每条主要流水线先写简短用途再画图；文档文件名、类名与图节点名一致，同调度器和跨调度器调用都链接到目标流水线。执行者只简述执行内容，不复制调度结构。

## 3. 必要专题与核心边界

使用 [文档总入口](references/contracts/document-layout.md#文档总入口) 与 [入口模板](assets/templates/README.md) 维护 docs/文档/README.md，正式入口用类/角色/简短职责/API/MD 类索引导航，不放 TODO。

正式系统文档及其 UI/配置/网络专题不设测试、验收或执行记录章节，也不放简短测试总结。测试方案/用例、验收矩阵、命令与结果、截图/日志证据、扫描/实验记录统一保存在任务的 verification.md 或既有独立测试报告；无需复制进正文或 meta.dependencies。文档操作流程仍要核对正确性，核对动作不代表把报告放进产物。


- UI：读取 [有 UI 时的模块规划](references/workflows/ui.md)；正式独立 UI 说明与 HTML 设计稿按实际实现维护，客户端业务放模块 View/view，服务端业务的客户端 UI 直接放模块根目录，不复制规划或强制补流程图。
- Excel：读取 [游戏 Excel 配置表](../game-excel-config/SKILL.md)；同步字段注释、表关系、端归属、导出与读取。网络事件等专题按 [正式文档边界](references/contracts/document-layout.md) 独立说明。无需求不补空文件。
- API 仅公开函数/方法，保留真实模块/命名空间与必要类型壳；不收字段、属性、事件、非公开函数或实现体。核对方法体，不照抄可能不完整的 XML；按真实语言输出，不限定 C#。
- 精简不删关键行为；不能将 owned 集合当成底层完整所有权，或把 Dispose 保留/不重试写成“释放全部资源”。不把 planned/mixed 提前移交，不保留双份正式声明。
- 不改 SDK 缓存、自动生成源码/API。不复制规划 TODO、设计推演、伪代码、验收矩阵或历史流水。提交/推送以用户授权为准，交付说明代码/docs 仓库状态。

## 目录摘要

文档总入口 README.md 与独立目录架构.md 必须放在同一个目录；README 直接提供目录架构链接，设计态也遵循对应文档根的同级放置。

每个本次维护的文档目录（包括 API 根/端/模块）都提供用途与导航摘要 README.md；不复制正文、API 或第二份 TODO。参照 [每个目录的摘要 README](references/contracts/document-layout.md#每个目录的摘要-readme) 与 [目录摘要模板](assets/templates/directory-readme.md)。

## 临时 Python 脚本
为扫描、生成或验证本次任务临时编写的 .py 可以保留，但不得加入 Git。优先放在仓库外的临时目录；需要保存在代码或 docs 工作树中时，使用各仓库本地 .git/info/exclude 精确忽略临时目录或文件，不使用全局 *.py 规则，以免隐藏正式源码。分别检查所属仓库的 git check-ignore 和暂存差异，确保临时脚本没有进入提交。发现本任务误暂存的临时脚本，仅撤销其暂存并保留文件，不影响用户已有暂存内容。项目正式 Python 源码、可复用工具和技能自带模板不属于临时脚本，不强制删除。

## 文档与执行任务的存储边界

为保持已有文档生成格式，本技能的设计态/现状态 schema、类说明、调度图、API 与同步逻辑继续沿用。旧设计规范/模板中 `docs/规划/<任务>/` 的文档位置，新任务统一映射为 `docs/文档/<模块>/设计/<任务>/`；其中的文档内容仍由本技能维护，独立目录架构也放在该文档根。历史设计资料不自动搬迁，按原入口查阅。

`docs/规划/<执行任务>/` 现在只保存规划技能的逐类执行记录，不接收设计文档或 API；旧模板提及的 TODO/测试/验收路由改为链接这些任务，不向文档 README 添加状态或执行内容。先完成文档再创建执行记录，开发后按原同步流程完善文档。

## 调用接口与两种模式

文档任务提供范围、已有决定和模式：planning 生成设计态产物，implemented 补录/同步实际实现。先按 [目录架构与脚本位置](references/workflows/script-layout.md) 确定每个类/模块的代码位置，再完成职责、API、流水线和各级 README。

设计态完整流程与模板见 [规划文档生成](references/workflows/planning-documents.md)、[规划目录与元数据](references/contracts/planning-layout.md)；工具统一 scripts/documentation_tool.py，check --mode planning 或 --mode implemented。返回文档入口、源码路径表、模块依赖/交付门槛、框架决定和未决项，由 [游戏系统开发规划](../game-system-development-planning/SKILL.md) 读取对应文档建立逐类执行任务。生成器不擅自实现业务、不排序任务、不另存第二份 TODO；开发后更新仍由规划技能调用本技能。

独立文件夹层级架构由 [目录架构与脚本位置](references/workflows/script-layout.md#独立目录架构文件) 生成；文档入口直接链接 `目录架构.md`，规划只引用。

## 模块优先的文档目录

正式内容必须按 `docs/文档/<模块>/` 划分，不再把所有系统集中到顶层职责或 API 目录。读取 [模块文档目录](references/contracts/module-layout.md)；全局 README 导航模块与类，模块 README 汇总本模块的类/角色/简短职责/API/MD。每个模块入口与目录架构同级，模块内保存职责、原语言 API 和确有需要的 UI/网络/配置专题。文档技能可独立使用；规划只读取对应模块文档。
