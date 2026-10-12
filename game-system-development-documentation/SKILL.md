---
name: game-system-development-documentation
description: 专门为游戏系统通过系统 Markdown 映射查阅公开函数 API，扫描已有项目补齐分系统文档，或在实现、修复、优化系统后同步架构、使用编程说明与按实际语言生成仅含公开函数的 API 声明，维护 YAML meta 和独立 docs Git 仓库。仅设计尚未实现的功能时使用 game-system-development-planning。
metadata:
  short-description: 扫描现状并同步系统说明、编程指南和 API
  schema-version: "1"
---
# 游戏系统开发文档

个人级游戏系统文档技能，跨项目、跨语言使用。正式文档按实际实现提炼，不复制规划正文或文件套件。图中操作节点可点击对应规范，名称与文件相对应；图下保留同目标 Markdown 链接。

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
  Task -->|尚未实现的设计| Plan["游戏系统开发规划<br/>SKILL.md"]
  Baseline --> Emit["正式文档边界<br/>document-layout.md<br/>继续第 2 步"]
  Sync --> Emit
  click Api "references/api/snapshots.md"
  click Answer "references/api/snapshots.md"
  click Check "references/api/snapshots.md"
  click Baseline "references/workflows/baseline.md"
  click Sync "references/workflows/sync.md"
  click Plan "../game-system-development-planning/SKILL.md"
  click Emit "references/contracts/document-layout.md"
```

| 场景 | 对应规范 | 操作边界 |
| --- | --- | --- |
| 查阅接口 | [查阅 API](references/api/snapshots.md) | 系统 Markdown → 原语言声明；足够且无冲突不扫描源码，planned 不当已实现 API |
| 老工程缺文档 | [老工程补录](references/workflows/baseline.md) | 专项追踪创建/运行/释放和公开契约，不补造历史规划 |
| 实现/修复/优化后 | [增量同步](references/workflows/sync.md) | 对照此次实现差异，更新系统及受影响消费者，不覆盖其他改动 |
| 仅设计 | [游戏系统开发规划](../game-system-development-planning/SKILL.md) | 保持规划与正式现状分开，不将未实现设计写入正式说明 |

## 2. 生成或同步实际系统文档

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 360}}}%%
flowchart TD
  Git["独立文档 Git<br/>docs-git.md"] --> Facts["增量同步<br/>sync.md<br/>核对本次实现事实"]
  Facts --> Body["正式文档边界<br/>document-layout.md<br/>架构、生命周期与持有关系"]
  Body --> Api["查阅 API<br/>snapshots.md<br/>公开函数与真实契约"]
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
  click Body "references/contracts/document-layout.md"
  click Api "references/api/snapshots.md"
  click Handoff "references/api/snapshots.md#从规划移交正式文档"
  click Keep "references/api/snapshots.md#文件与目录"
  click Verify "references/workflows/sync.md"
  click Deliver "references/workflows/sync.md"
```

补录任务从第 1 图的 [老工程补录](references/workflows/baseline.md) 进入；统一采用 [系统模板](assets/templates/system.md)，具体规范如下：

| 步骤 | 阅读规范 | 必须得到的结果 |
| --- | --- | --- |
| 检查仓库 | [独立文档 Git](references/contracts/docs-git.md) | docs 是独立仓库，知道本次范围与用户已有改动 |
| 提炼现状 | [正式文档边界](references/contracts/document-layout.md) | 每系统一份主体；实际架构图、职责、生命周期、创建/持有/借用/释放关系、必要使用约束 |
| 维护 meta | [精简 meta](references/contracts/document-layout.md#精简-meta) | 默认 system、side、updated、code_revision、sources、dependencies；依赖其他文档用 document 与 uses，不在正文重复依赖表 |
| 维护 API | [查阅 API](references/api/snapshots.md) | api/client|server|shared/<模块>/ 原语言公开函数声明及直接映射；保留真实参数/返回/异常与版本信息 |
| 检查遗漏 | [精简后的信息完整性](references/contracts/document-layout.md#精简后的信息完整性)、[增量同步](references/workflows/sync.md) | 初始化前置、owner、成功含义、重复调用、取消/失败及清理限制可从主体/API 恢复；核对链接、架构显示与实际验证 |
| 交付 | [增量同步](references/workflows/sync.md) | 清楚区分已核对与未验证；任务 TODO/详细证据仍留在任务入口/报告 |

正式系统文档默认只要求架构图；这里的流程图说明“如何使用技能”，不要求系统文档复制流程、时序、状态图。

## 3. 必要专题与核心边界

- UI：读取 [有 UI 时的模块规划](../game-system-development-planning/references/workflows/ui.md)；正式独立 UI 说明与 HTML 设计稿按实际实现维护，客户端业务放模块 View/view，服务端业务的客户端 UI 直接放模块根目录，不复制规划或强制补流程图。
- Excel：读取 [游戏 Excel 配置表](../game-excel-config/SKILL.md)；同步字段注释、表关系、端归属、导出与读取。网络事件等专题按 [正式文档边界](references/contracts/document-layout.md) 独立说明。无需求不补空文件。
- API 仅公开函数/方法，保留真实模块/命名空间与必要类型壳；不收字段、属性、事件、非公开函数或实现体。核对方法体，不照抄可能不完整的 XML；按真实语言输出，不限定 C#。
- 精简不删关键行为；不能将 owned 集合当成底层完整所有权，或把 Dispose 保留/不重试写成“释放全部资源”。不把 planned/mixed 提前移交，不保留双份正式声明。
- 不改 SDK 缓存、自动生成源码/API。不复制规划 TODO、设计推演、伪代码、验收矩阵或历史流水。提交/推送以用户授权为准，交付说明代码/docs 仓库状态。

## 临时 Python 脚本
为扫描、生成或验证本次任务临时编写的 .py 可以保留，但不得加入 Git。优先放在仓库外的临时目录；需要保存在代码或 docs 工作树中时，使用各仓库本地 .git/info/exclude 精确忽略临时目录或文件，不使用全局 *.py 规则，以免隐藏正式源码。分别检查所属仓库的 git check-ignore 和暂存差异，确保临时脚本没有进入提交。发现本任务误暂存的临时脚本，仅撤销其暂存并保留文件，不影响用户已有暂存内容。项目正式 Python 源码、可复用工具和技能自带模板不属于临时脚本，不强制删除。
