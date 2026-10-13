---
name: planning-task-tool
description: 统一任务工具调用文档工具并校验 TODO。
---
# 开发规划工具

本技能 scripts/planning_tool.py 是任务检查入口。check 先调用同级 game-system-development-documentation/scripts/documentation_tool.py，文档生成/结构/schema/角色/API/目录 README 由文档技能负责；本工具只额外校验 TODO ID、顺序、前置、状态及依赖循环，不保留另一套文档规则。

~~~powershell
python $m_planningTool rules
python $m_planningTool check $m_taskDir --mode planning --project-root $m_projectRoot
python $m_planningTool check $m_actualDocumentDir --mode implemented --project-root $m_projectRoot
~~~

planning 检查任务文档及 TODO，implemented 可检查正式产物；完整任务检查仍需对任务目录再用 planning 模式。工具只读，0 为通过、1 为约束问题、2 为参数/工具缺失。文档技能缺失明确报错，不退回旧的独立 schema。显式前置正确不代表模块依赖完整或交付门槛满足，仍人工核对。
