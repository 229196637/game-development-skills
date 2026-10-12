---
name: game-system-development-planning
description: 专门为游戏功能、游戏系统重构或开发任务编写多文件开发规划，明确目标目录、类职责、接口契约及调用/依赖关系，在规划阶段生成待实现 API 文档，统一路由多系统依赖与 TODO 优先级并推进开发、测试和验收，并在独立 docs Git 仓库中维护规划。仅补录已有系统文档时使用 game-system-development-documentation。
metadata:
  short-description: 分系统规划、接口设计、调用关系与待实现 API
  schema-version: "1"
---
# 游戏系统开发规划

个人级游戏开发技能，跨项目、跨语言使用。先沿用项目指令和已有接口，不推测业务规则。图中操作节点可点击打开对应规范；节点名称与文件相对应，图下也保留 Markdown 链接，便于不支持 Mermaid 点击的阅读器使用。

## 1. 进入任务并完成规划

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 360}}}%%
flowchart TD
  Git["独立文档 Git<br/>docs-git.md"] --> Scope{"仅补录已有实现？"}
  Scope -->|是| Docs["游戏系统开发文档<br/>SKILL.md"]
  Scope -->|否| Plan["规划流程<br/>planning.md"]
  Plan --> Layout["目录与元数据协议<br/>document-layout.md"]
  Layout --> Task["统一入口与路由<br/>task-routing.md"]
  Task --> Graph["每个模块必须有图<br/>module-diagrams.md"]
  Graph --> Api["查阅 API<br/>snapshots.md"]
  Api --> Framework["已有框架能力与重写选择<br/>framework-reuse.md"]
  Framework --> Existing{"已有相关能力？"}
  Existing -->|没有| Extensions
  Existing -->|有| Details["已有框架能力与重写选择<br/>framework-reuse.md<br/>给调用细节 / 差距并询问"]
  Details --> Chosen{"选择已明确？"}
  Chosen -->|待回复| Pending["已有框架能力与重写选择<br/>framework-reuse.md<br/>暂停替代设计，继续独立项"]
  Chosen -->|复用或明确重写范围| Extensions
  Extensions["规划流程<br/>planning.md<br/>按需补 UI / 配置 / 网络"]
  Extensions --> Ready["统一入口与路由<br/>task-routing.md<br/>核对任务入口与验收"]
  click Git "references/contracts/docs-git.md"
  click Docs "../game-system-development-documentation/SKILL.md"
  click Plan "references/workflows/planning.md"
  click Layout "references/contracts/document-layout.md"
  click Task "references/workflows/task-routing.md"
  click Graph "references/workflows/module-diagrams.md"
  click Api "../game-system-development-documentation/references/api/snapshots.md"
  click Framework "references/workflows/framework-reuse.md"
  click Details "references/workflows/framework-reuse.md"
  click Pending "references/workflows/framework-reuse.md"
  click Extensions "references/workflows/planning.md"
  click Ready "references/workflows/task-routing.md"
```

| 顺序 | 阅读规范 | 操作与产物 |
| --- | --- | --- |
| 进入 | [独立文档 Git](references/contracts/docs-git.md) | 确认 docs 独立仓库与已有改动；仅补文档转文档技能 |
| 调查 | [规划流程](references/workflows/planning.md) | 先读系统 Markdown / API；缺失、过期、冲突或需核对实现时才查相关源码 |
| 路由 | [目录与元数据协议](references/contracts/document-layout.md)、[统一入口与路由](references/workflows/task-routing.md) | docs/规划/<任务>/index.md 保存需求、模块关系、唯一 TODO、优先级/前置与验收；优化优先更新已有规划 |
| 分模块 | [每个模块必须有图](references/workflows/module-diagrams.md) | 每模块规划目录、职责、接口/关系、架构图和关键流程；不写具体实现、算法或伪代码 |
| 框架选择 | [已有框架能力与重写选择](references/workflows/framework-reuse.md) | 有现成能力先给准确接口、用法、生命周期/持有及差距，再询问复用或重写；已有选择不重复问，未确定不规划替代实现 |
| 定接口 | [查阅 API](../game-system-development-documentation/references/api/snapshots.md) | 本任务 api/client|server|shared/<模块>/ 生成原语言公开函数声明，标 planned/mixed；不冒充已实现接口 |
| 检查 | [统一入口与路由](references/workflows/task-routing.md) | 确认依赖可开展、链接/meta/接口一致、TODO 可验证；未知业务只阻塞依赖它的部分 |

采用 [任务模板](assets/templates/task.md)、[模块模板](assets/templates/plan.md)、[架构模板](assets/templates/architecture.md) 与 [流程模板](assets/templates/flows.md)，不保留未填写的空章节。

## 2. 按需扩展模块

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 360}}}%%
flowchart TD
  Need{"需要哪类专题？<br/>可同时选择"}
  Need -->|UI| UI["有 UI 时的模块规划<br/>ui.md"]
  Need -->|Excel| Excel["游戏 Excel 配置表<br/>SKILL.md"]
  Need -->|跨端消息| Network["规划流程<br/>planning.md<br/>接口关系与端间通信"]
  UI --> Done["统一入口与路由<br/>task-routing.md<br/>返回模块与 TODO"]
  Excel --> Done
  Network --> Done
  Need -->|都不需要| Done
  click UI "references/workflows/ui.md"
  click Excel "../game-excel-config/SKILL.md"
  click Network "references/workflows/planning.md"
  click Done "references/workflows/task-routing.md"
```

- [UI](references/workflows/ui.md)：独立模块 ui.md 链接可直接打开的 HTML 设计稿；客户端业务在模块 View/view 集中 UI，服务端业务的客户端 UI 直接放模块根目录，沿用实际框架。使用 [UI 模板](assets/templates/ui.md)。
- [Excel](../game-excel-config/SKILL.md)：config.md 写字段注释、表关系、稳定 Id/外键、端开关、源表布局、导出类型/路径与读取接口，不只列字段名。
- [网络关系](references/workflows/planning.md)：涉及时独立网络专题 MD，说明真实协议、收发事件、请求/响应关联、权威端、取消/失败与接口关系，不假装已有网络接线。

无对应需求不创建空 UI、配置或网络产物。专题只维护一次，由任务入口和模块引用。

## 3. 按授权推进开发、测试与文档移交

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 360}}}%%
flowchart TD
  Scope{"本次范围包含开发？"}
  Scope -->|仅规划| Deliver["规划流程<br/>planning.md<br/>交付规划与待确认项"]
  Scope -->|已授权开发| Work["统一入口与路由<br/>task-routing.md<br/>按依赖与优先级实现"]
  Work --> Test["统一入口与路由<br/>task-routing.md<br/>模块测试与集成验收"]
  Test --> Pass{"必需检查与验收满足？"}
  Pass -->|失败| Work
  Pass -->|环境无法验证| Pending["统一入口与路由<br/>task-routing.md<br/>记录未验证及证据"]
  Pass -->|通过| Docs["游戏系统开发文档<br/>SKILL.md<br/>核对实现、同步并移交 API"]
  Docs --> Done["统一入口与路由<br/>task-routing.md<br/>核对全部必需 TODO 后交付"]
  click Deliver "references/workflows/planning.md"
  click Work "references/workflows/task-routing.md"
  click Test "references/workflows/task-routing.md"
  click Pending "references/workflows/task-routing.md"
  click Docs "../game-system-development-documentation/SKILL.md"
  click Done "references/workflows/task-routing.md"
```

根据已有授权判断范围，不为流程图重复索取确认。每次实现同步同一套 API、契约注释、版本及 Markdown；全部函数核对后由文档技能移交正式位置，planned/mixed 文件留在任务内。规划保留设计意图，不作为实现证据。只有必需 TODO、相关验证与文档/API 同步均完成才报告整项完成；未运行不能标验证通过。

## 工作约束

不改 SDK 缓存或生成投影；不强制重做局部优化的整套规划。提交/推送须有用户授权，技能本身不授权创建远程或推送。交付说明未完成项、验证范围和代码/docs 两仓库状态。

## 临时 Python 脚本
为扫描、生成或验证本次任务临时编写的 .py 可以保留，但不得加入 Git。优先放在仓库外的临时目录；需要保存在代码或 docs 工作树中时，使用各仓库本地 .git/info/exclude 精确忽略临时目录或文件，不使用全局 *.py 规则，以免隐藏正式源码。分别检查所属仓库的 git check-ignore 和暂存差异，确保临时脚本没有进入提交。发现本任务误暂存的临时脚本，仅撤销其暂存并保留文件，不影响用户已有暂存内容。项目正式 Python 源码、可复用工具和技能自带模板不属于临时脚本，不强制删除。
