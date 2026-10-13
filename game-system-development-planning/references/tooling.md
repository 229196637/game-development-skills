---
name: game-system-development-planning-tool
description: 开发规划工具的只读专用命令和固定约束。
---
# 开发规划工具

工具：本技能 scripts/planning_tool.py。独立安装即可使用，不依赖其他技能的脚本。

## 调用
m_tool 指上面的脚本路径，其余变量是已确认目标；保留路径空格/中文的正确引用。

~~~powershell
python $m_tool rules
python $m_tool check $m_taskDir --project-root $m_projectRoot
~~~

## 专用范围
检查规划必填字段、日期/来源、Markdown 和 Mermaid 跳转名称、API 端/模块目录、配置字段字典与处理清单。模板不当作已完成产物，输出跳过数量。只检查结构，接口语义、依赖顺序和业务优先级仍人工核对。

## 输出与限制
仅返回 JSON，不写或自动修复文件。check 返回 0 为结构通过、1 为规则错误、2 为参数/读取错误；inspect/read 返回 0 仅代表读取完成，issues/limits 仍需查看，不能当业务验收通过。缺依赖时报错，不自动安装。

依赖：Python 3.10+；PyYAML。工具不会承担业务含义、完整语言解析或 Mermaid 渲染。测试不随技能分发，测试结果另存隔离目录。

## 更新时间
更新产物时使用带秒与时区的可读时间，例如 updated: '2026-10-12 17:19:55 +08:00'；原语言 API 头部 Updated 同格式。YAML 必须为带引号的字符串。历史记录没有时分秒时不补造，实际更新才填写本次真实时间。日志原始时间保留原样，不能用报告更新时间替换事件时间。

## 调度器约束
有 dispatcher/design_patterns 时校验类型名、模式用途、调度流水线下每条 Mermaid flowchart，以及指向其他已标注调度器文档的图节点跳转。实际类型是否遗漏调度职责、流程正确性及未登记依赖不能靠结构推断，仍人工核对；执行者不强制调度结构。

角色仅 dispatcher/executor/tool/data，允许兼任；data 的独立简短说明不强制流水线或架构图。
