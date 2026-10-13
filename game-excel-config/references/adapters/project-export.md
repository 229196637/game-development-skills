# 项目导表适配

统一入口 `scripts/export_config.py` 是 Python 调度器，负责读取项目配置、定位源表/固定产物、调用导出与检查。表格式、目标语言、类型转换、生成模板、命名空间和业务校验属于独立适配器，不写死在通用技能/入口中。当前迁入 legacy-xls-csharp 适配器是一个已实现案例，不是所有项目的默认规范。

## 当前项目流程

```text
common/xlsl/*.xls
  → 读取标签、端侧字段、类型、TIPS、稳定 Id
  → 校验重复类/表名、公式依赖及 Buff 数据
  → 双端配置 .cs + ConfigTableRegistry.g.cs
  → 双端公式生成
  → --check 对照源表与产物
```

项目 `mytool/config-export.json` 固定以下相对路径：

| 用途 | 路径 |
| --- | --- |
| Excel 源 | common/xlsl |
| 客户端配置 | src/generateLl/ConfigSystem/Client |
| 服务端配置 | src/generateLl/ConfigSystem/Server |
| 客户端公式 | src/generateLl/Calculation/Client |
| 服务端公式 | src/generateLl/Calculation/Server |

项目已使用 C#、标签式 .xls、GameEntry.Config、SceId、首 Id=1 等约定，这些仅属于此适配器。端侧开关依实际表，不从旧“全部单机”说明推断。公式和 Buff 校验及中文/引用提示来自项目 mytool 模块，仍随项目维护；适配器通过 python_paths 加载它们。

导出实现维护在技能 `scripts/adapters/legacy_xls_csharp/generate_config_tables.py`，项目同名文件只是兼容转发：保留旧函数导入、dataclass、默认 ROOT 和隔离测试路径参数；正常 CLI 交给通用入口，读取项目固定路径配置。原生成注释中的 mytool 路径指向兼容入口，仍有效。不要把两边维护成两份实现。

格式化器可能改表的端侧策略、样式及提示，所以默认导出不自动格式化。只有本次确实授权修改源表时使用 --format，随后核对表差异。--check 拒绝 --format；正常导出后自动再检查，出错返回非零，不声称校验覆盖所有业务外键或游戏行为。

## 接入新项目/语言

1. 阅读实际表格式、现有导出器、运行时读取器、输出位置和构建步骤；记录实际语言和路径，不直接套用上述 C# 类型/命名空间/Id 规则。
2. 已有导出器优先复用，以 command 适配器记录 argv 和只读检查命令。没有导出器则先按需求设计语言适配器，经当前任务授权实现，不把 Python 调度当成跨语言生成器。
3. 在项目保存一个 profile，paths 为项目相对路径；源目录及固定输出不得越过项目根或相互覆盖。不同项目可声明不同 outputs 键，通用入口不强制 client/server 或 .cs。
4. export_command/check_command 使用 argv 数组，支持 {python}、{project}、{source}、{output_<键>}，不拼 shell 字符串。先查阅所引用命令源码，再执行；检查命令必须真实只读，调度器不能证明任意外部命令的行为。
5. 用 --describe 核对实际路径和命令，先在隔离副本验证导出/检查/失败路径，再按当前授权导出。写配置时仍维护注释、字段字典、稳定标识、端归属和读取关系。

[通用项目配置模板](../../assets/templates/export-profile.command.json) · [当前 legacy 适配模板](../../assets/templates/export-profile.legacy.json)。模板只放技能中供复制；项目只保留采用的一个配置，不增加业务 API manifest。
