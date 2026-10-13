# 游戏系统开发技能

个人级 Codex 技能，面向游戏系统开发，支持项目实际使用的编程语言。

| 技能 | 用途 |
| --- | --- |
| game-system-development-planning | 游戏系统开发规划：读取文档，按类填写具体工单、文档索引、验收标准及底部测试/验收记录 |
| game-system-development-documentation | 游戏系统开发文档：扫描现状、增量同步、原语言公开函数 API、独立 docs Git |
| game-excel-config | 游戏 Excel 配置表：字段注释、表关系、端归属、导出与读取契约 |
| log-reading | 日志阅读技能：定位构建/运行日志，关联会话、双端及异常链；含 SCE 可选适配 |

## 安装

将需要的技能文件夹放到个人 Codex skills 目录（通常为 `~/.codex/skills/`）；保留它们的相邻关系，以便相对引用正常跳转。已有同名技能时，先检查本地修改再更新。

## 使用

先调用“游戏系统开发文档”，再调用“游戏系统开发规划”驱动实现；配置需求由“游戏 Excel 配置表”协作处理；日志排查调用“日志阅读技能”。

- 规划查阅 API 时，已有框架能力须先给出准确接口、调用/生命周期细节与差距，再询问复用还是重写；已明确选择沿用。
- 开发任务入口：`docs/规划/<任务>/README.md`，每个类独立任务 MD，只引用文档，不复制设计，docs 由独立 Git 仓库维护。
- API 先分 client/server/shared，再按模块存储原语言公开函数声明，由 Markdown 映射；实现完成后同步到正式文档位置。
- 需要 UI 的模块独立写 `ui.md`，链接可直接打开的 HTML 设计稿。客户端业务逻辑的 UI 放模块 View/view；服务端业务逻辑的客户端 UI 直接放对应模块目录，遵循项目实际 UI 框架。
- 配置字段需要完整注释，说明用途、单位、缺省、范围与引用关系。
- 项目特定框架及 Excel 适配以实际项目为准；技能不授权自动推送项目代码或创建远程仓库。

技能入口为各目录的 `SKILL.md`，详细规范与模板在 `references/`、`assets/` 中。
## 各技能专用工具

| 技能 | 工具 | 命令与范围 |
| --- | --- | --- |
| 开发规划 | scripts/planning_tool.py | init/update/set-item/status/record-test/record-acceptance/complete/check/list：具体工单、测试和验收门槛 |
| 开发文档 | scripts/documentation_tool.py | rules/check：精简 meta、文档依赖、API 和测试分离 |
| Excel 配置 | scripts/config_tool.py | inspect/check：配置读取与字段处理清单 |
| 日志阅读 | scripts/log_tool.py | read：日志标识过滤、行号和上下文 |

每个工具只随对应技能安装，使用说明在该技能 references/tooling.md。规划工具可以在显式任务根内记录任务，其余工具只读；结果为 JSON，结构通过不代表业务/运行验证通过。测试代码不随技能或本仓库分发，分别在隔离目录验证。

更新时间使用便于阅读的 `YYYY-MM-DD HH:mm:ss ±HH:MM`，例如 `2026-10-12 17:19:55 +08:00`；YAML 用带引号字符串。新更新记录与 API 头部按此格式，旧历史不补造时分秒。日志事件的原始时间保持原样。

## 文档先行，规划驱动执行

文档技能继续维护已认可的系统说明、角色、生命周期、调度图及原语言公开函数 API；本次只补独立 `目录架构.md`，用于定位文件夹和脚本。规划不复制这些内容；每类任务引用对应文档，写目标与勾选工作项，底部保存真实测试过程，所有必需测试与前置完成后才设 completed。Python 工具辅助记录，不执行测试，不替代业务验证。

重构前认可版本已保存为 Git 标签 `backup/before-planning-driver-20261013-204919`，对应提交 `a7864d91ba47c776ce94260a1aa8c2859b4570dd`。

规划工单先填写当前情况与改动、具体工作项和验收标准；执行后追加测试过程与验收情况。文档入口 README.md 与目录架构.md 同级且直接相连。[工单功能验证](examples/game-rule-dispatchers/work-order-review.md)。

## 模块文档布局

当前文档目录为 `docs/文档/<模块>/`，模块内部保存 README、同级目录架构、职责、api/client|server|shared 和需要的专题。根目录只汇总模块/类导航及总目录架构；不再有顶层职责/api。设计资料也归模块的设计任务目录，规划工单引用对应模块入口与类说明。[模块布局验证](examples/game-rule-dispatchers/module-layout-review.md)。
