---
name: game-system-development-planning
description: 专门为游戏功能、游戏系统重构或开发任务编写多文件开发规划，明确目标目录、类职责、接口契约及调用/依赖关系，在规划阶段生成待实现 API 文档，统一路由多系统依赖与 TODO 优先级并推进开发、测试和验收，并在独立 docs Git 仓库中维护规划。仅补录已有系统文档时使用 game-system-development-documentation。
metadata:
  short-description: 分系统规划、接口设计、调用关系与待实现 API
  schema-version: "1"
---
# 游戏系统开发规划

个人级游戏开发技能，跨游戏项目使用；不用于普通办公或通用软件需求。项目约定与用户指令优先；先查现有代码、API、文档与依赖，不推测业务规则。

## UI 协作（需要时）
模块需要 UI 时读取 [UI 规划规范](references/workflows/ui.md)，单独编写模块 ui.md，并链接可直接打开的 HTML 设计稿。按业务逻辑归属选择客户端模块内 View 或模块根目录布局，沿用当前 UI 框架；无 UI 不创建相关产物。

## 游戏配置协作
游戏数值、规则、成长、技能、关卡及展示数据的配置设计使用 [游戏 Excel 配置表](../game-excel-config/SKILL.md)。规划阶段在各配置模块 config.md 明确源表布局、字段字典、稳定 Id/外键、端开关、导出类型/路径/转换与读取接口；开发阶段同步配置与原语言 API，不硬编码来源项目路径或单机规则。没有配置表需求的系统不强行引入 Excel。

## 统一入口与执行闭环
当前开发任务以 docs/规划/<任务>/index.md 为入口，在任务目录内保存详细需求、系统路由、模块规划、TODO 和验收记录；docs/index.md 或分类索引只负责导航到任务，不承载任务细节。多系统依赖、优先级、TODO 和开发/测试/验收遵循 [任务路由](references/workflows/task-routing.md)。规划只设计接口与关系，获得开发授权后持续完成实现、相关测试、验收与文档同步，不止于写规划。

## 按任务加载
- 开始规划：读取 [规划流程](references/workflows/planning.md)。每个模块必须按 [模块图规范](references/workflows/module-diagrams.md) 绘制依赖架构图及关键流程图。
- 确定目录、文件元数据与链接：读取 [文档协议](references/contracts/document-layout.md)。
- 读写 docs 前：读取 [独立 Git 维护](references/contracts/docs-git.md)。
- 模块图采用 [架构模板](assets/templates/architecture.md) 与 [流程模板](assets/templates/flows.md)，每个模块分别填写，不只画总图。
- 任务总规划采用 [任务与 TODO 模板](assets/templates/task.md)；系统文件按需采用 [规划模板](assets/templates/plan.md)，每个文件完成实际内容后再保存。

## 工作边界
1. 新功能和实质性重构：先确定目录、职责、公开接口与调用/依赖关系，规划阶段在 docs/规划/<任务>/api/<端>/<模块>/ 生成原语言 API 声明并由任务/模块规划映射；不展开具体实现或伪代码。
2. 老工程接入且只缺文档：转交 `game-system-development-documentation`，扫描已有实现，不追补虚构的历史规划。若技能不可用，说明并按源码补文档，仍不制造规划。
3. 局部优化：更新对应已有规划中受影响的部分；确有新增设计才建立精简新规划，不强制重做整套设计。
4. 规划完成后允许按用户授权继续实现；未确认的业务决策写为待确认项，只暂停依赖它的部分。
5. 开发阶段使用同一套 API 文档逐步完善，区分 planned/mixed/implemented，按实际实现更新契约注释、源码、版本及 Markdown 映射；完成实现核对后由 `game-system-development-documentation` 将已完成的 API 文件移到 docs/文档/api/<端>/<模块>/，同步全部引用和实际系统说明，规划保留设计意图并标记已实现、变更或取消。规划不能作为现状证据。

## 交付检查
必需 TODO、相关检查、整体验收与 API/文档同步完成后才报告整项完成；无法运行的验证明确留待处理，不能标验收通过。每个系统的目录结构、职责、接口契约、调用关系、开发依赖顺序和验收条件可相互追溯。核对 Markdown 相对链接、meta、源码路径；说明未验证事项和两仓库状态。此技能不授权创建远程仓库、推送或自动提交。

## 临时 Python 脚本
为扫描、生成或验证本次任务临时编写的 .py 可以保留，但不得加入 Git。优先放在仓库外的临时目录；需要保存在代码或 docs 工作树中时，使用各仓库本地 .git/info/exclude 精确忽略临时目录或文件，不使用全局 *.py 规则，以免隐藏正式源码。分别检查所属仓库的 git check-ignore 和暂存差异，确保临时脚本没有进入提交。发现本任务误暂存的临时脚本，仅撤销其暂存并保留文件，不影响用户已有暂存内容。项目正式 Python 源码、可复用工具和技能自带模板不属于临时脚本，不强制删除。
