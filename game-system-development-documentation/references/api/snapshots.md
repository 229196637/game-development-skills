---
name: api-snapshots
description: 查阅和同步按实际语言编写的公开函数 API、契约注释及代码版本。
metadata:
  kind: skill-reference
  schema-version: "3"
---
# 查阅 API
先查对应系统 Markdown 的 API 文件映射，按 client/server/shared 打开原语言声明。shared 是客户端与服务端真实共享接口。已有 API 足以回答且没有过期或冲突证据时直接使用，不扫描源码；缺失或不一致时只查看相关源码。同步修改时必须根据此次实现差异核对，不能以旧 API 充当最新实现证据。

# 规划与开发共用的 API
规划阶段只在 docs/规划/<任务>/api/<端>/<模块>/ 生成拟定公开函数声明，开发阶段完善该文件；文件头 Status 为 planned、mixed 或 implemented。mixed 文件在每个函数注释分别标明拟定/已实现，已实现函数拟改签名时注明改动尚未实现，不能将提案当当前调用契约。
规划时 Source 标明拟定路径尚未实现；CodeRevision 是设计所参考的代码基线，Verification 注明契约设计未实现验证。参数约束、异常等标为拟定，不宣称已有运行行为。开发阶段根据真实实现逐步补齐签名与注释、来源和版本、Markdown 映射以及关系说明。只有核对实际实现后才转为 implemented，测试结果单独记录。
查阅 API 时检查状态；planned 可用于设计，不能作为当前可调用接口；接口存在且已实现能回答时无需扫描源码。

# 文件与目录
参照项目已有 docs/api 的声明风格：真实 namespace/package/module → 必要类型外壳 → 公开函数注释及签名。C# 只是其中一种语言，不限定项目技术。
已实现并核对的正式文件放 docs/文档/api/client/<模块>/、server/<模块>/ 或 shared/<模块>/；规划期文件先存于 docs/规划/<任务>/api/ 的同样端/模块结构。每个模块内按实际类型或模块分声明文件，不产生额外清单、Markdown、索引或 YAML。由单独系统 Markdown 直接映射查找。保留既有 SDK/API 资料。
扩展名采用 .api.cs、.api.d.ts、.api.pyi 或原语言声明文件扩展名。没有独立声明形式的语言，也用原语言文件与签名表示，注明仅供查阅，可能并非完整可编译代码；不补造可执行实现、不改用 Markdown。

# 仅收录公开函数
- 只收录外部公开可调用的函数/方法，包括静态、实例、异步、泛型、公开接口方法，每个重载分别保留。
- 按语言与项目公开约定判断：C# 方法及其声明类型都须对外可见；TS/JS 按导出及方法访问性；Python 按明确导出或项目公共接口约定，不能只因名称不以下划线开头就当公开 API。接口隐式公开方法遵守语言语义。
- 不收录 private/protected/internal、显式接口私有实现、未导出函数、局部函数。
- 不收录字段、属性/访问器、事件、常量、枚举项、构造器、析构器、运算符等条目；公开工厂函数属于公开函数。
- 类型仅作为归属外壳，不展开其他成员。继承关系可保留，但不复制父类方法；实际公开重写应收录。引用类型沿用真实名称。
- 没有公开函数时不建空 API 文件，在系统 Markdown 说明。

# 签名与契约注释
保留实际名称、访问性、static、参数顺序/类型、默认值、可空性、泛型约束、ref/out/params、返回类型和重载。按端与条件编译核对，不能合并两端差异签名。
使用原生文档注释解释用途、参数可空和输入约束、返回含义与空值、真实异常及调用顺序/生命周期。无参数/返回值不机械补注释；没有校验就不能宣称会校验。
C# 用 XML 注释和分号声明；TS/JS 用 JSDoc 和 .d.ts；Python 用 .pyi 签名、文档字符串及省略号。不保存实现体，不补 throw 或空实现，不用 partial 接入生产源码。

补录/更新 API 时对照方法体的实际检查、任务取消与调用链，而不只复制源码 XML；旧注释遗漏的已释放、前置未就绪、重复调用、取消及返回边界需据实现补齐。仅写有证据的异常，未知 SDK 异常不猜测；声明核对不能冒充运行验证。

# 顶部版本注释与同步
API 文件顶部使用原语言注释，注明 System、Side（client/server/shared）、Language、Namespace/Module、Source（相对代码仓库根）、CodeRevision（真实提交或 working-tree，规划时注明设计基线）、Status（planned/mixed/implemented）、Updated（用户时区时间，格式 YYYY-MM-DD HH:mm:ss ±HH:MM）、Verification（签名/契约的静态核对范围与结果，不复制测试记录），以及“仅供文档查阅，不参与编译或发布”。
有真实发布版本可额外写 Version；没有则不编造。函数独有版本变化有证据时可写入函数注释，不推测首次引入版本。
每次系统修改同步：接口实现状态、公开函数签名、参数/返回/异常/调用约束注释、头部代码版本/日期/验证状态、系统 Markdown 映射与 meta。删除旧函数声明，改文件名时修复链接，更新受影响消费者的用法。只改日期不等于核对过新实现。

# 从规划移交正式文档
逐文件核对全部函数已实现、实际签名与契约、来源及版本；满足后移动到 docs/文档/api/<端>/<模块>/，Status 标 implemented，Verification 写真实检查结果。planned/mixed 文件留在任务目录；可逐个移交已完成文件，不要求整任务一次性搬完。
移动前检查源与目标都在预期独立 docs 工作树内。目标同名文件已存在时按实际实现逐项合并更新，不覆盖不相关成员或用户改动，也不生成重复文件绕过冲突。确认目标声明和引用完整后移除规划来源，保留 Git 的变更追踪，不复制长期保留双份。
同步任务入口、interfaces.md、关系规划、其他调用方的相对链接（规划沿用 meta.links；正式文档按精简协议维护正文 API 映射，系统依赖只在 dependencies），并在系统 Markdown 加入或更新正式 API 映射；任务 TODO 记录移交及验证证据。当前项目已有正式 API 在规划中直接引用，拟议修改另标在任务 API 中，正式声明待实现核对后才更新。

# 隔离与检查
检查语言实际构建、打包、模块发现和类型发布范围，保证文档不进入生产：C# 检查 Compile，TS 检查 tsconfig 和类型发布，Python 检查包与 stub 发布规则。独立命名空间不能替代隔离。必要且已授权时才修改排除配置。
核对仅含公开函数、没有实现体，头部版本与系统说明一致，Markdown 的链接直达声明文件。纯接口查阅无需为验证文档存在而扫描源码。

# 模板
按实际语言使用 [通用格式](../../assets/templates/api/public-functions.md)：
- [C#](../../assets/templates/api/public-functions.api.cs)
- [TypeScript/JavaScript](../../assets/templates/api/public-functions.api.d.ts)
- [Python](../../assets/templates/api/public-functions.api.pyi)
示例仅展示格式，生成时替换为实际模块、签名与契约，不能把示例当现有 API。
