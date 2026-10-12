---
name: log-reading-tool
description: 日志工具的只读专用命令和固定约束。
---
# 日志工具

工具：本技能 scripts/log_tool.py。独立安装即可使用，不依赖其他技能的脚本。

## 调用
m_tool 指上面的脚本路径，其余变量是已确认目标；保留路径空格/中文的正确引用。

~~~powershell
python $m_tool read $m_logFile --match Run=B --match Request=R7 --context 4 --limit 10
python $m_tool read $m_clientLog $m_serverLog --contains Exception --context 6 --limit 5
~~~

## 专用范围
只提供日志读取：按精确 key=value 过滤，避免 R1 匹配 R10；保留前后行与多行异常，limit/context 有界。默认 UTF-8，乱码用实际 --encoding，不静默丢字节。输出原证据，展示前人工遮蔽敏感值；不自动判首因、合并时区、启动/停止程序。

## 输出与限制
仅返回 JSON，不写或自动修复文件。check 返回 0 为结构通过、1 为规则错误、2 为参数/读取错误；inspect/read 返回 0 仅代表读取完成，issues/limits 仍需查看，不能当业务验收通过。缺依赖时报错，不自动安装。

依赖：Python 3.10+；仅 Python 标准库，无 PyYAML/Excel 依赖。工具不会承担业务含义、完整语言解析或 Mermaid 渲染。测试不随技能分发，测试结果另存隔离目录。

## 更新时间
更新产物时使用带秒与时区的可读时间，例如 updated: '2026-10-12 17:19:55 +08:00'；原语言 API 头部 Updated 同格式。YAML 必须为带引号的字符串。历史记录没有时分秒时不补造，实际更新才填写本次真实时间。日志原始时间保留原样，不能用报告更新时间替换事件时间。
