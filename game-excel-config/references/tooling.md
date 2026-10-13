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

## 更新时间
更新产物时使用带秒与时区的可读时间，例如 updated: '2026-10-12 17:19:55 +08:00'；原语言 API 头部 Updated 同格式。YAML 必须为带引号的字符串。历史记录没有时分秒时不补造，实际更新才填写本次真实时间。日志原始时间保留原样，不能用报告更新时间替换事件时间。

## 一键导出与只读检查

配置盘点/字段检查工具仍只读；实际导出由 scripts/export_config.py 负责。读取 [项目导表适配](adapters/project-export.md)，参数 --project-root 必填，--profile 可选，--describe 显示路由，--check 只读检查，--format 显式允许项目格式化器改源表。默认导出后自动检查；工具返回实际子进程失败码。依赖按 requirements.txt 安装，不自动联网安装。
