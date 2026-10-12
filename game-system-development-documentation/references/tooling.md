---
name: fixed-skill-tools
description: 用只读程序执行固定规则检查，减少反复阅读和人工枚举。
metadata:
  kind: skill-reference
  schema-version: "1"
---
# 固定规则工具

每个技能内的 scripts/skill_tool.py 是可直接执行的正式工具，不是临时 Python。四个技能分别携带相同的独立副本，单独安装也能使用。仓库 tools/skill_tool.py 是维护源，修改后必须同步副本。不要为执行工具读取整份脚本；先看 --help 或本页，再按 JSON 错误局部处理。

## 先程序，后人工
1. 确认目标/操作范围及已允许读取的文件。规则不确定先调用 rules，不在上下文重复展开 schema。
2. 运行 check/config/logs；这些命令全部只读，不生成配置、修复文档、启动程序或运行导出。
3. 读取 JSON 的 issues 和 limits，按 file/line/rule 修正已授权的产物。只复查受影响部分。
4. 再人工核对业务语义、真实 API/owner、生命周期、字段含义及日志因果。ok 只代表覆盖范围内结构通过，不代表业务、测试或图渲染通过。

## 调用
以下 m_tool 指当前技能目录下的 scripts/skill_tool.py；m_target、m_projectRoot、m_workbook、m_logFile 均为已确认目标，正确引用带空格/中文的路径。使用可用 Python 3.10+；需要 PyYAML，读 .xls 需要 xlrd，读 .xlsx 需要 openpyxl。环境缺依赖时工具明确报错，不自动安装。

~~~powershell
python $m_tool rules --kind documentation
python $m_tool check $m_target --kind documentation --project-root $m_projectRoot
python $m_tool check $m_target --kind planning --project-root $m_projectRoot
python $m_tool config $m_workbook --sheet Level --summary
python $m_tool config $m_workbook --sheet Level --limit 5
python $m_tool logs $m_logFile --match Run=B --match Request=R7 --context 4 --limit 10
~~~
首次盘点建议 --summary，仅列数量、端开关和注释缺口，需要数据才去掉它，减少上下文占用。

配置规划使用 planning；正式 UI/配置专题可在 documentation 检查中加 --topic，不强制单独架构图。若项目有明确必需额外 meta 键，用 --allow-meta-field <键>，不能为了通过随意豁免。模板草稿会跳过并报告数量，生成真实文件后再检查。

check 返回 0 表示机械检查通过，1 表示规则错误，2 表示读取/参数/依赖错误。config/logs 返回 0 只代表完成读取；config 的 issues 非空意味着源说明缺口，不能称完整合规。缺少配置时 exists=false、next=先规划，工具不写文件。

## 可固定约束
- YAML 重复键、必填/类型/日期、正式文档六项 meta，源路径及文档依赖 document/uses，禁止测试报告充当依赖。
- Markdown 相对链接/标题锚点、Mermaid 操作节点的链接与文档标题对齐；不解析或渲染完整 Mermaid。
- 正式系统文档不放测试章节；只读检查无法识别所有混入正文的测试叙述，人工仍须确认。
- 配置规划字段字典、非空注释与处理清单；标签式 .xls/.xlsx 只读盘点表/字段/端开关、原始值与缺少 TIPS，未知格式报错，不猜解析。
- API 端/模块布局、文件头、正式声明 implemented、禁止额外清单；简单 C# 字段/函数体反例。TS/Python/C# 真实公开范围、签名及语法仍用语言工具/源码核对。
- 日志精确 key=value 标识筛选、行号及有界上下文，保留多行异常片段。不会识别唯一会话、归一化时区或自动判首因；发送 JSON 原文前人工遮蔽敏感信息。

关键输出没有覆盖的项会列在 limits。未知/缺失业务信息仍留待确认，不用工具结果绕过已有框架复用/重写选择。测试代码和运行报告放工具测试目录或独立实验目录，不复制进正式系统说明。
