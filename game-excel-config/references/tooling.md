---
name: game-excel-config-tool
description: 配置工具的只读专用命令和固定约束。
---
# 配置工具

工具：本技能 scripts/config_tool.py。独立安装即可使用，不依赖其他技能的脚本。

## 调用
m_tool 指上面的脚本路径，其余变量是已确认目标；保留路径空格/中文的正确引用。

~~~powershell
python $m_tool inspect $m_workbook --sheet Level --summary
python $m_tool inspect $m_workbook --sheet Level --limit 5
python $m_tool check $m_configMd --project-root $m_projectRoot
~~~

## 专用范围
inspect 支持已有标签式 .xls/.xlsx，核对表级/字段级 client/server 开关，列原始字段/数据与 TIPS 缺口。缺文件或 Sheet 返回 exists=false 和先规划提示，不生成表。未知格式报错，不猜解析。check 使用规划 meta 和 config.md 字段字典/非空注释/处理清单规则，不承担文档技能的正式系统/API 检查。

## 输出与限制
仅返回 JSON，不写或自动修复文件。check 返回 0 为结构通过、1 为规则错误、2 为参数/读取错误；inspect/read 返回 0 仅代表读取完成，issues/limits 仍需查看，不能当业务验收通过。缺依赖时报错，不自动安装。

依赖：Python 3.10+；check 需要 PyYAML；inspect 读 .xls 需要 xlrd，读 .xlsx 需要 openpyxl。工具不会承担业务含义、完整语言解析或 Mermaid 渲染。测试不随技能分发，测试结果另存隔离目录。
