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
## 固定规则工具

四个技能内都有独立 scripts/skill_tool.py。优先让程序处理 meta、链接/图节点、API 布局、配置字段处理清单和日志筛选，输出 JSON 错误定位，再由技能判断业务语义。

- rules：查询固定 meta 结构。
- check：只读检查 Markdown/API；不自动修复，也不验证业务或渲染。
- config：盘点标签式 .xls/.xlsx；--summary 减少输出，不存在则提示先规划。
- logs：按会话/请求标识流式筛选及有界上下文。

依赖 Python 3.10+、PyYAML；可选 xlrd/openpyxl。缺依赖明确报错，不自动安装。

仓库 tools/skill_tool.py 为维护源，四个脚本副本应保持字节一致。测试在 tools/tests/，可运行 python -m unittest discover -s tools/tests；隔离样例不写生产项目，测试报告不进入正式系统文档。
