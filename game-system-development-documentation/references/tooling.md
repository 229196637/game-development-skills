---
name: game-system-development-documentation-tool
description: 系统文档工具的只读专用命令和固定约束。
---
# 系统文档工具

工具：本技能 scripts/documentation_tool.py。独立安装即可使用，不依赖其他技能的脚本。

## 调用
m_tool 指上面的脚本路径，其余变量是已确认目标；保留路径空格/中文的正确引用。

~~~powershell
python $m_tool rules
python $m_tool check $m_systemMd --project-root $m_projectRoot
python $m_tool check $m_topicMd --topic
~~~

## 专用范围
检查正式文档六项 meta、dependencies 的 document/uses、来源/链接和 API 移交状态；拒绝测试章节和测试报告依赖。UI/配置专题可用 --topic，不额外强制架构图。项目必需扩展键才显式 --allow-meta-field，不能随意豁免。完整 API 语法/可见性、真实 owner 仍需语言工具和源码核对。

## 输出与限制
仅返回 JSON，不写或自动修复文件。check 返回 0 为结构通过、1 为规则错误、2 为参数/读取错误；inspect/read 返回 0 仅代表读取完成，issues/limits 仍需查看，不能当业务验收通过。缺依赖时报错，不自动安装。

依赖：Python 3.10+；PyYAML。工具不会承担业务含义、完整语言解析或 Mermaid 渲染。测试不随技能分发，测试结果另存隔离目录。

## 更新时间
更新产物时使用带秒与时区的可读时间，例如 updated: '2026-10-12 17:19:55 +08:00'；原语言 API 头部 Updated 同格式。YAML 必须为带引号的字符串。历史记录没有时分秒时不补造，实际更新才填写本次真实时间。日志原始时间保留原样，不能用报告更新时间替换事件时间。

## 调度器约束
有 dispatcher/design_patterns 时校验类型名、模式用途、调度流水线下每条 Mermaid flowchart，以及指向其他已标注调度器文档的图节点跳转。实际类型是否遗漏调度职责、流程正确性及未登记依赖不能靠结构推断，仍人工核对；执行者不强制调度结构。

角色仅 dispatcher/executor/tool/data，允许兼任；data 的独立简短说明不强制流水线或架构图。

检查调度器文件名/H1 与类型名一致、每流水线图前用途说明，以及以其他本地流水线标题命名的节点跳转。工具不会从任意标签自动识别隐藏的调用关系，仍需人工核对。

## 正式文档入口
README.md 且 system: catalog 识别为纯导航，检查精简 meta 和链接；含类索引时强制职责架构图与系统依赖图；拒绝 TODO/任务状态和运行时角色 meta。入口模板不放 api/。

入口类索引检查“类/角色/职责/API/文档”列、角色值、非空职责和链接；职责是否简短准确仍人工核对，不能只凭字数判定。

职责目录的类型文档校验“职责”“API”两节；API 必须指向代码声明或明确写无公开函数/待补齐。正式根目录需 README.md，规划入口同名，无双入口。

## 目录摘要覆盖
check 目录时检查每级文档文件夹存在 README.md（Git/隐藏目录跳过；技能根的自检不要求技能内部目录摘要）。API 允许 README 导航摘要，仍拒绝其他 Markdown/manifest；README 使用所属技能 meta，链接正常校验，不能冒充代码 API。

## 单一文档生成检查入口
统一 scripts/documentation_tool.py check <目标> --mode planning|implemented；planning profile 的实现位于本技能 scripts/planning_documents_tool.py，文档规则都在本技能。本工具不解析/排序 TODO，统一任务规划负责该部分。类型文档必须有目录架构与脚本位置，明确代码路径、命名空间和装配归属。

含类索引的所有文档 README（不限 system: catalog）检查两张独立 Mermaid 总览、职责图类型覆盖与职责 MD 点击链接。缺图/缺类/坏链接分别输出 ENTRY_* 错误；业务依赖方向和持有语义仍人工核对。
