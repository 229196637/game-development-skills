---
name: log-sources
description: 确定真实日志目录、日志类型和当前会话。
---
# 日志来源定位

先记录用户问题、复现动作/时间、项目与端，读取项目指令、已有日志说明、启动配置和最近命令输出。优先用户给定路径，其次已核对的项目/工具配置，再查实际启动进程或服务日志入口；同名文件不能证明是同一次运行。

区分构建/编译、编辑器宿主、客户端、服务端、测试和部署日志。端或时间不明确时先读取能区分的头部/启动标识；只剩业务不明确时询问，不猜进程。远程/容器日志使用当前环境真实可用的只读工具，先查工具契约，不套用某机器命令。

先枚举明确日志根的文件名、长度、更新时间和子目录；以实际日志内容的项目/运行标识确定目标。文件更新时间只用来选候选，大日志后写入不代表事件最新。考虑重启后新文件、滚动分片及跨午夜；多候选可能包含同一会话的上下段。

PowerShell 示例中变量由已确认来源赋值，不复制占位路径：
~~~powershell
Get-ChildItem -LiteralPath $m_logRoot -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 20 FullName,Length,LastWriteTime
Get-Content -LiteralPath $m_logFile -Encoding UTF8 -TotalCount 40
Get-Content -LiteralPath $m_logFile -Encoding UTF8 -Tail 120
~~~
子目录按已知端逐个查阅，不无界递归扫整个磁盘。验证编码与格式后再过滤。

记录路径、日志类别/端、会话/PID或可用身份、首尾时间、时区以及复现窗口。缺少会话标识时结合启动记录和项目名，标明匹配可信度；不能声称文件属于本局而没有证据。缺日志时给最小获取方式；不自动开启 debug、日志开关或重启服务。
