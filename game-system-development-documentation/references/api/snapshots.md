---
name: api-snapshots
description: 查阅和同步语言围栏 API Markdown、职责契约及代码版本。
metadata:
  kind: skill-reference
  schema-version: "4"
---
# 查阅 API
先从系统职责 MD 的 API 映射打开对应 `<类型>.<语言>.api.md`。client/server/shared 仍按真实归属区分，shared 只表示两端真实共享。已有 API 足以回答且无过期或冲突证据时直接使用，不扫描源码；缺失或不一致时只查相关实现。同步本次修改必须依据真实实现，不能以旧声明冒充最新证据。

# 文件与目录
正式 API 在 `docs/文档/<模块>/api/<端>/`；设计态在 `docs/文档/<模块>/设计/<任务>/api/<端>/`。C# 为 `<类型>.cs.api.md` 配 `csharp` fence，TS/JS 为 `<类型>.ts.api.md` 配 `typescript`，Python 为 `<类型>.py.api.md` 配 `python`。新增语言需先扩展共享规则与测试，不重新引入可编译文档文件。

每份 API 仅保存简明用途、公开函数签名、必要参数/返回值说明、关键提醒和职责章节链接；具体操作示例、前置和成功语义、流程、架构、生命周期、资源所有权、内部协作及完整失败/取消细节归职责 MD 的相应章节。关键限制可在 API 一句提醒并链接，不复制整套说明，也不能删掉重要行为。README 只导航，不复制签名；API 目录除目录摘要和具体 API Markdown 外不创建其他清单/manifest。

仅收外部公开函数/方法，保留真实命名空间/模块与必要类型壳，包含各重载、异步、静态、泛型与真实修饰符。C# 声明类型及方法必须可见，TS/JS 按导出/访问性，Python 按明确公共约定，不能只以无下划线判断公开。不收字段、属性、事件、常量、枚举项、构造器、析构器、运算符、非公开函数、未导出函数、局部函数及实现体。不复制父类方法；实际公开重写可收录。没有公开函数不建空 API，在职责 MD 据实说明。

签名保留参数顺序/类型、默认值、可空性、泛型约束、ref/out/params、返回类型和重载，端与条件编译的差异不合并。C# 使用分号声明；TS 使用声明签名；Python 只允许 docstring 和 `...` 占位，不写 pass/return/throw 或空实现。必要注释可原生 XML/JSDoc/docstring，也可围栏外简短描述。详细契约由职责 MD 承担，不能只复印过时 XML 或推测未知 SDK 异常。

# API 专用 YAML
API Markdown 进入专用检查分支，不套系统六项 meta、架构图或普通职责文档模板。顶部字段（字符串）如下：

~~~yaml
---
System: <模块>
Side: client
Language: C#
Namespace/Module: <真实名称>
Source: <相对代码仓库根；设计态拟定路径注明未实现>
CodeRevision: working-tree
Status: implemented
Updated: '2026-11-07 11:34:19 +08:00'
Verification: <签名和契约的实际静态核对范围，不放测试记录>
Responsibility: ../../职责/<类型>.md#<真实章节锚点>
---
~~~

`Namespace/Module` 在适用时保留；有真实版本可额外保留 Version，不编造首次引入日期。文件仅供文档查阅，不参与生产编译或发布；不能改生产 SDK 或自动生成源码来满足格式。Markdown 扩展名避免文档误入语言构建，但仍需检查项目自定义文档打包规则。

# 从规划移交正式文档
Status 为 planned/mixed/implemented。planned 只能作为设计，不能当成当前可调用能力；mixed 每函数注明拟定/已实现，拟改签名明确尚未实现；Source 指出拟定路径，CodeRevision 是设计参考基线，Verification 不宣称已运行。完整设计操作、协作与生命周期仍保存在设计职责 MD，不能被移交成正式能力。

每次实现改变同步状态、签名、必要参数/返回/关键提醒、版本/日期、职责章节和所有映射引用。参数检查、owner、重复调用、取消/失败及释放边界须据真实方法体和调用链核对；静态核对不是运行验证，测试结果单独存任务报告。

逐文件核对所有函数已实现且签名、契约、来源和版本准确后，才移动到模块正式 api/，标 implemented。planned/mixed 文件继续保留设计目录；可移交已完成文件，不要求整任务一起迁移。目标同名时按实际实现人工合并，不覆盖无关成员或用户改动，不造重复文件绕过冲突。确认目标和全部引用完整后删除原设计声明，保留 Git 变更追踪。

同步 README、职责 API 映射、meta.links/dependencies、图内点击、工单 interfaces 及其他消费者的相对链接；API 的 Responsibility 要重新计算。正式系统依赖只在 dependencies，不复制测试记录或执行 TODO。

# 旧独立文档声明迁移
使用 [工具说明](../tooling.md#旧文档-api-的显式安全迁移) 中独立 `migrate_api_documents.py`：默认 dry-run，显式 `--apply` 才执行。只迁移授权文档树中的 `.api.cs` / `.api.d.ts` / `.api.pyi`；不迁移 SDK、生产源码或历史资料。事务内先保真迁移长注释到唯一链接的职责契约章节，创建新 Markdown，修复根内 Markdown/YAML/Mermaid 引用，确认无遗留旧文件名后删除旧声明；冲突、语法不确定、职责歧义或校验失败不写入，写入异常回滚。已迁移再次运行无变化。

自动迁移保留原注释全文而非猜测哪些细节可删，需人工整理为自然职责说明；不解析完整语言语义。跨所选根的消费者不自动改写，调用者必须另行同步。进程内回滚不等于崩溃/断电恢复。只读 rules/check 仅检查，不虚构生成命令。

# 模板
按真实类型替换 [通用格式](../../assets/templates/api/public-functions.md)：
- [C# Markdown](../../assets/templates/api/public-functions.cs.api.md)
- [TypeScript/JavaScript Markdown](../../assets/templates/api/public-functions.ts.api.md)
- [Python Markdown](../../assets/templates/api/public-functions.py.api.md)

示例只展示格式，不代表项目现有接口；不能因模板有可空或默认值就给真实签名增加语义。
