---
name: game-system-development-planning
description: 默认只研究需求并生成文档与规划工单，交付后停止；仅用户明确要求执行时才进入代码实现与测试验收；按类维护具体开发工单、文档索引、验收标准、依赖、状态及底部测试/验收记录，用 Python 辅助记录。规划不复制系统文档、架构图或 API。
metadata:
  short-description: 默认只交付文档和规划，明确执行后才开发
  schema-version: "4"
---
# 游戏系统开发规划

直接调用本技能时，默认只做文档与规划。先研究需求、架构及相关已有代码，再调用 [游戏系统开发文档](../game-system-development-documentation/SKILL.md) 增删改文档，随后建立同层级同类名的具体工单与依赖顺序；校验、交付后停止。**调用规划技能、给出开发需求或规划已写完，都不代表授权执行工单。** 不默认编写或修改业务代码、生成生产实现脚本、运行构建/业务测试、启动游戏/编辑器或落实工单。文档用的原语言 API 声明属于文档，不是生产实现。

只有用户明确要求“开始实现”“执行这份规划”等，或本次明确授权同时规划并实现，才进入执行阶段；纯规划指令优先于泛化的开发意图。过去另一项任务的开发授权不沿用到本次规划。默认交付时可说明下一步执行入口，无需询问批准来完成当前文档任务。

## 执行流程

```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}, "flowchart": {"wrappingWidth": 360}}}%%
flowchart TD
  Research["需求研究与文档准备<br/>preparation.md<br/>先研究相关代码、架构与需求"] --> Docs["游戏系统开发文档<br/>SKILL.md<br/>先完成或核对文档"] --> Read["任务路由与执行<br/>task-routing.md<br/>读取类 MD、API、目录架构"]
  Read --> Ready{"文档与接口明确？"}
  Ready -->|否| Docs
  Ready -->|是| Task["逐类任务记录<br/>class-task.md<br/>具体改动、工作项、文档索引"]
  Task --> Order["任务路由与执行<br/>task-routing.md<br/>按依赖确定先后"]
  Order --> Gate{"用户明确要求执行本次工单？"}
  Gate -->|否：默认| Deliver["需求研究与文档准备<br/>preparation.md<br/>交付文档与规划，停止"]
  Gate -->|是| Code["任务路由与执行<br/>task-routing.md<br/>读取对应文档后实现代码"]
  Code --> Test["开发规划工具<br/>tooling.md<br/>执行测试，记录到任务底部"]
  Test --> Accept["开发规划工具<br/>tooling.md<br/>按预定标准记录验收情况"]
  Accept --> Pass{"工作项、测试和验收全部通过？"}
  Pass -->|否| Code
  Pass -->|是| Sync["游戏系统开发文档<br/>SKILL.md<br/>同步真实实现差异"]
  Sync --> Done["开发规划工具<br/>tooling.md<br/>检查前置并设置完成"]
  click Research "references/workflows/preparation.md"
  click Docs "../game-system-development-documentation/SKILL.md"
  click Read "references/workflows/task-routing.md"
  click Task "references/contracts/class-task.md"
  click Order "references/workflows/task-routing.md"
  click Deliver "references/workflows/preparation.md"
  click Code "references/workflows/task-routing.md"
  click Test "references/tooling.md"
  click Accept "references/tooling.md"
  click Sync "../game-system-development-documentation/SKILL.md"
  click Done "references/tooling.md"
```

图中节点对应 [需求研究与文档准备](references/workflows/preparation.md)、[任务路由与执行](references/workflows/task-routing.md)、[逐类任务记录](references/contracts/class-task.md)、[开发规划工具](references/tooling.md)。没有执行条件则记录缺口，不把未运行的测试标成通过。

## 开始实现的门槛（仅明确执行时）

必须先有本次用户明确执行授权。以下步骤不能因规划完成而自动触发。

首次写本次业务代码之前，必须已有内容完整的对应类工单 MD 及任务 README（范围、文档入口、依赖顺序），执行 `check/list` 核对前置与顺序，并将本类状态设为 doing；之后才能实现和测试。不能先实现再补任务并声称规划驱动。已有代码补录任务须如实写明是补录，不编造过去的执行过程。工具不会监控源码写入时间，执行者负责遵守这个顺序。

## 规划产物

任务入口 `docs/规划/<任务>/README.md`，各类工单镜像文档相对 `docs/文档/` 的层级：例如文档 `<模块>/职责/<类名>.md` 对应规划 `<任务>/<模块>/职责/<类名>.md`，每目录都有 README。无类的语言按真实模块/脚本单元命名。入口只说明任务范围、文档入口和依赖执行顺序，链接各类任务；状态只存每类 MD，不维护第二份 TODO 表。

规划是一套开发工单，不是空壳索引。每类工单提前写清：目标、当前已有/缺失的内容与本次改动、文档索引、具体工作项、可观察的验收标准。工作项写明要改哪个真实文件/方法、做什么、关键约束及交付结果，不能仅写“读取文档”“完善模块”“按文档实现”。如果需求不足以写清具体工作，先核对相关文档或询问未决业务，不凭空填充。

文档索引直接链接对应类 MD、文档 README、与它同级的目录架构 MD，以及本工单需要的 API/网络/UI/配置专题。引用设计依据不等于复制整份职责/API/架构：工单应概括本次变更内容，执行者读工单便知道要做什么，再沿索引查完整契约。

底部依次为 `## 测试过程` 和 `## 验收情况`。规划时提前登记必需测试与验收标准，实际记录表可以暂时无结果，必须明确尚未执行；执行后追加真实测试步骤、预期、实际和证据，再逐条记录验收结果。工作项、必需测试、验收和前置全部满足后才设完成。验收不是新增审批：自动/人工方式按项目与用户已确认要求执行，不能把测试通过直接冒充所有验收标准通过。

实现前每次读对应 MD，沿链接查公开函数 API、目录架构与适用项目规范。现有框架已经提供能力时，给出准确接口、调用契约与差距，再确认是否重写；已有选择继续沿用，不重复询问。实现遵守文档规定的脚本位置和实际语言，不猜接口。

默认只使用工具 init/update/relocate/check/list 维护、校验规划，工作项保持待做，测试与验收保持未执行；文档/规划本身的结构与链接校验可以运行。执行命令的 --execute 仅表示调用者已确认本次用户明确执行授权，不会替代人类授权。

按 [开发规划工具](references/tooling.md) 使用 `scripts/planning_tool.py` 创建/补充工单、迁移到镜像路径、勾选工作项、记录测试与验收、排序检查和设置完成。工具只修改显式指定任务根下的任务/README，不实现代码、不运行测试、不修改系统文档；结构通过不等于行为通过。

文档及规划由 docs 独立 Git 维护。测试及验收记录只在规划类任务底部或链接的独立证据中；不进入正式文档。临时 Python 留仓库外或精确本地忽略，不提交；本技能的正式可复用工具可提交。发布或生产改动依用户授权，规划本身不扩大范围。

文档不足时调用文档技能按当前架构增补、修改或清理已失效内容，并修复引用；文档技能也可独立使用。文档入口必须直接列出同级 `目录架构.md`，不能只在深层类说明中出现。

文档先按模块查阅：docs/文档/README.md → docs/文档/<模块>/README.md → 本模块职责/类 MD 和 api/<端>/ 原语言声明。工单索引链接本模块入口及同级目录架构；跨模块通过实际所有者文档跳转，不再指向顶层职责或 api 旧位置。

## 与文档一致的层级及命名

规划只替换根目录，保留对应类 MD 相对文档根的文件夹层级、职责目录和文件名。文档 `docs/文档/GameRule/职责/GameRuleSystem.md` 对应 `docs/规划/<任务>/GameRule/职责/GameRuleSystem.md`；如果职责内真实分 client/server/shared 或命名空间子目录，也原样保留。设计态类文档的相对层级也按原样镜像，不自行扁平化。

工单正文仍为目标、当前情况与改动、文档索引、具体工作项、验收标准、底部测试过程与验收情况，不复制系统职责正文、目录图或 API 文件。只建立本任务涉及的类工单，每级 README 导航，规划索引链接文档模块入口及同级目录架构。已有旧侧/模块布局用工具 relocate 迁移，保留稳定 ID、状态和全部测试/验收历史，修复引用；不借迁移改成已完成。
