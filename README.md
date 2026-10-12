# 游戏系统开发技能

个人级 Codex 技能，面向游戏系统开发，支持项目实际使用的编程语言。

| 技能 | 用途 |
| --- | --- |
| game-system-development-planning | 游戏系统开发规划：任务入口、模块职责与目录、接口关系、流程图、TODO、开发与验收 |
| game-system-development-documentation | 游戏系统开发文档：扫描现状、增量同步、原语言公开函数 API、独立 docs Git |
| game-excel-config | 游戏 Excel 配置表：字段注释、表关系、端归属、导出与读取契约 |
| log-reading | 日志阅读技能：定位构建/运行日志，关联会话、双端及异常链；含 SCE 可选适配 |

## 安装

将需要的技能文件夹放到个人 Codex skills 目录（通常为 `~/.codex/skills/`）；保留它们的相邻关系，以便相对引用正常跳转。已有同名技能时，先检查本地修改再更新。

## 使用

调用“游戏系统开发规划”或“游戏系统开发文档”，配置需求由“游戏 Excel 配置表”协作处理；日志排查调用“日志阅读技能”。

- 规划查阅 API 时，已有框架能力须先给出准确接口、调用/生命周期细节与差距，再询问复用还是重写；已明确选择沿用。
- 开发任务入口：`docs/规划/<任务>/index.md`，每模块单独存储规划，docs 由独立 Git 仓库维护。
- API 先分 client/server/shared，再按模块存储原语言公开函数声明，由 Markdown 映射；实现完成后同步到正式文档位置。
- 需要 UI 的模块独立写 `ui.md`，链接可直接打开的 HTML 设计稿。客户端业务逻辑的 UI 放模块 View/view；服务端业务逻辑的客户端 UI 直接放对应模块目录，遵循项目实际 UI 框架。
- 配置字段需要完整注释，说明用途、单位、缺省、范围与引用关系。
- 项目特定框架及 Excel 适配以实际项目为准；技能不授权自动推送项目代码或创建远程仓库。

技能入口为各目录的 `SKILL.md`，详细规范与模板在 `references/`、`assets/` 中。
## 各技能专用工具

| 技能 | 工具 | 命令与范围 |
| --- | --- | --- |
| 开发规划 | scripts/planning_tool.py | rules/check：规划 meta、跳转和任务配置清单 |
| 开发文档 | scripts/documentation_tool.py | rules/check：精简 meta、文档依赖、API 和测试分离 |
| Excel 配置 | scripts/config_tool.py | inspect/check：配置读取与字段处理清单 |
| 日志阅读 | scripts/log_tool.py | read：日志标识过滤、行号和上下文 |

每个工具只随对应技能安装，使用说明在该技能 references/tooling.md。工具只读、结果为 JSON；结构通过不代表业务/运行验证通过。测试代码不随技能或本仓库分发，分别在隔离目录验证。
