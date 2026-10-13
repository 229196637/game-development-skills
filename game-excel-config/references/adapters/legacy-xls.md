---
name: legacy-xls-adapter
description: 从现有项目提取的标签式 .xls 配置格式适配，只有匹配该链路时使用。
metadata:
  kind: skill-reference
  schema-version: "1"
---
# 使用前提
本适配从 projectb 的 game-config-tables 规范及真实导出脚本提取。仅用于已经采用类似标签式 legacy .xls 导出器的项目；其他项目采用其既有格式。不依赖来源项目存在于本机，不将其单机设置推广为所有游戏规则。

# 标签格式
每个非空 Sheet 一张表；第一列为标签，字段从第二列开始。标签包括 OUT_CLIENT（兼容 OUT_CLICENT/OUT_CLICNET）、OUT_SERVER、IS_CLIENT、IS_SERVER、KEY、TYPE、VALUE；字段说明 TIPS 按实际导出器支持使用。
Sheet 名必须满足目标生成语言要求；来源 C# 导出器将其生成 ConfigTableId 成员，OUT 名称生成 Cfg{Name}Client/Server，NO 为禁用端导出。字段端开关控制真正导出范围。
TYPE 支持范围以当前导出器为准，不能因旧技能只写基础类型就忽略已扩展类型。一维数组 VALUE 使用 JSON。缺少 VALUE 标签的行不作为数据。
来源导出器要求实际导出表启用 int Id、正整数且唯一，首条 VALUE Id 为 1；这属于该适配的工具约束，不是通用游戏 Id 规则。

# 已核对的来源项目参考
源表 common/xlsl/*.xls；生成器 mytool/generate_config_tables.py 支持 --source、--client-output、--server-output、--check。2026-10-11 核对默认输出为 src/generateLl/ConfigSystem/Client 与 Server。旧技能中的 src/client/mod/config 路径已过时，不能照抄。
读取入口为 GameEntry.Config.ConfigSystem.Instance；公开查询实际存在 GetAll、TryGet、TryGetByCode 等，应查询当前接口文档，不沿用旧 ConfigMgr/Upsert/Remove 示例。
格式化器 mytool/config_xls_formatting.py 依赖 xlrd 和 xlwt，冻结八行和第一列，并通过 REFERENCE_TIPS 配置跳转；生成器还依赖项目 calculation_compiler 和 buff_config_validator。不要只复制一个脚本称它可独立运行，也不无条件安装其 requirements（其中不一定包含全部格式化依赖）。
当前执行顺序：通过个人配置技能统一入口读取项目 profile → 生成 → 自动 --check。mytool/generate_config_tables.py 保留兼容入口与旧路径参数，实际实现归技能适配器；具体使用见[项目导表适配](project-export.md)。格式化仅在需要改源表时显式 --format，默认不运行；执行前核对当前项目脚本、依赖与配置。来源项目原有客户端单机导出、元素配色等仅在项目仍明确要求时保留，服务器或双端项目自行按确认规则选择。

# 字段到结果的具体映射（该适配）
| Excel 输入 | 实际作用/导出结果 |
| --- | --- |
| OUT_CLIENT / OUT_SERVER | 非空且非 NO 才生成该端整表；名称基名首字母大写，生成 Cfg{Name}Client / Cfg{Name}Server |
| IS_CLIENT / IS_SERVER | 该端启用的列才成为字段；表开关关闭时即使字段启用也不输出整表 |
| KEY | 导出结构体的公开字段名；已启用列必须非空、合法且不重复 |
| TYPE | 导出器实际支持的标量或一维数组类型，按 SCALAR_TYPES 映射；未知类型报错 |
| TIPS | 生成字段说明 XML 注释，转义 XML；它是字段含义说明，不变成运行时配置值 |
| VALUE | TYPE 行之后带 VALUE 标签的数据行，转换成生成结构体列表项；其他说明行不作为记录 |
| Sheet 名 | 首字母大写作为 ConfigTableId 成员；不是自动等同于 OUT 类型名 |
| 工作簿文件名 | 默认同名 .cs 输出；每 Sheet 可生成对应端配置类型，整簿多个表可在同一文件 |

格式示例只演示标签，不是未经确认的业务表：
| 标签列 | 字段列 B | 字段列 C |
| --- | --- | --- |
| OUT_CLIENT | Example | |
| OUT_SERVER | NO | |
| IS_CLIENT | YES | YES |
| IS_SERVER | NO | NO |
| TIPS | 稳定标识 | 显示文本 |
| KEY | Id | Name |
| TYPE | int | string |
| VALUE | 1 | 示例文本 |
实际工作簿标签/行高/冻结以现有格式为准，不能按该 Markdown 强行改变模板行号。

空值转换已对照来源导出器：string 空单元格 → string.Empty；数组空单元格 → 空数组；其他类型空单元格 → C# default。数值范围与整数性会检查，bool 非空内容按解析器接受值处理，一维数组非空内容必须是 JSON 数组文本，SceId 非空值必须是字符串标识。
特殊业务 Sheet 可能有专门规则，例如来源 Attribute 的空 MaxValue 导出为 2147483647、空 MinValue 为 0；显式填写 0 保留。此为来源项目特例，其他项目不能照搬。
生成字段可以是公开字段，API 文档仍只收录公开函数；配置数据结构在 config.md/系统说明中记录，不为了列字段破坏 API 范围。
