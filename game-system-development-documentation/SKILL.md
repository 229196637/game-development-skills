---
name: game-system-development-documentation
description: 专门为游戏系统通过系统 Markdown 映射查阅公开函数 API，扫描已有项目补齐分系统文档，或在实现、修复、优化系统后同步架构、使用编程说明与按实际语言生成仅含公开函数的 API 声明，维护 YAML meta 和独立 docs Git 仓库。仅设计尚未实现的功能时使用 game-system-development-planning。
metadata:
  short-description: 扫描现状并同步系统说明、编程指南和 API
  schema-version: "1"
---
# 游戏系统开发文档
个人级游戏系统开发文档技能，跨游戏项目复用；不用于普通办公或通用软件文档。以实际代码为现状依据，规划仅解释意图。每次修改一个系统，同步该系统文档与受影响的消费系统说明；不以任务大小为由跳过同步。

## UI 文档（需要时）
涉及 UI 时读取 [UI 规划与布局规范](../game-system-development-planning/references/workflows/ui.md)。长期系统主体链接独立 UI 说明及 HTML 设计稿，按实际业务执行端记录模块内 View 或客户端模块根目录布局，同步框架生命周期、资源绑定、交互/网络刷新与验收；无 UI 不补空文件。

## 游戏配置文档
涉及游戏 Excel 配置时读取 [游戏 Excel 配置表](../game-excel-config/SKILL.md)，同步源表、表关系、端归属、导出及配置读取接口的文档；无此需求不强行引入。

## 路由
- 所有任务先读 [产物协议](references/contracts/document-layout.md) 与 [独立 Git 维护](references/contracts/docs-git.md)。
- 老工程接入、文档缺失：读 [扫描补录](references/workflows/baseline.md)，不要求开发规划。
- 开发完成、修复、重构、优化：读 [增量同步](references/workflows/sync.md)。
- 查阅或输出 API：已有声明能回答且未过期时不扫描源码；读 [公开函数声明规范](references/api/snapshots.md)，按实际语言选择其链接的模板，不默认限定 C#。
- 采用 [系统模板](assets/templates/system.md) 和 API 规范中的原语言模板；填完真实内容再保存。

## 不变量
- 每个系统一份主体 Markdown；索引只导航，API 先分 client/server/shared，再按模块建文件夹；shared 是两端共享。API 目录只保留原语言声明文件，由系统 Markdown 直接映射。文档同时说明系统用途、架构职责和如何编程使用。
- 确需扫描时必须覆盖入口、类、公开接口、关键内部协作、依赖、状态/生命周期和验证范围。未知行为明确列出待查证，不推测。
- API 文档只收录公开函数/方法，保留真实命名空间或模块、必要类型外壳、签名和原生契约注释；不收录字段、属性、事件和非公开函数，不包含实现体，不参与构建或发布。
- 规划期 API 仅放 docs/规划/<任务>/api/<端>/<模块>/，planned/mixed 文件留在任务下；文件内函数全部核对实现后，本技能将其移到 docs/文档/api/<端>/<模块>/，更新任务/模块规划及系统 Markdown 引用、状态和版本，不留下重复声明。拟定接口不能作为当前可调用接口。
- 每个模块现状说明必须包含自己的依赖架构图和关键流程图，按需补充时序图/状态图；遵循 [模块图规范](../game-system-development-planning/references/workflows/module-diagrams.md)，开发后按实际实现同步，不能只保留任务总图。
- 每次修改同步 API 签名和契约注释、文件头真实代码版本/日期/来源/验证状态以及 Markdown 映射。接口查阅优先文档；缺失、过期、冲突或需核对实现变更时才查看相关源码。
- 不修改 SDK 下载缓存、自动生成 API 或项目生成源码。项目自己的文档放在独立的 `docs/文档/`。
- 交付说明更新系统、源码基线、验证结果及独立文档仓库状态。未授权提交/推送时完成文件与验证即可。

## 临时 Python 脚本
为扫描、生成或验证本次任务临时编写的 .py 可以保留，但不得加入 Git。优先放在仓库外的临时目录；需要保存在代码或 docs 工作树中时，使用各仓库本地 .git/info/exclude 精确忽略临时目录或文件，不使用全局 *.py 规则，以免隐藏正式源码。分别检查所属仓库的 git check-ignore 和暂存差异，确保临时脚本没有进入提交。发现本任务误暂存的临时脚本，仅撤销其暂存并保留文件，不影响用户已有暂存内容。项目正式 Python 源码、可复用工具和技能自带模板不属于临时脚本，不强制删除。
