---
name: public-functions-template
description: 以 API 专用 YAML 和原语言签名围栏创建精简 Markdown 接口文档。
metadata:
  kind: output-template-guide
  schema-version: "2"
---
# 公开函数 API Markdown 模板
文件名 `<真实类型>.<cs|ts|py>.api.md`；分别选用同目录的 cs/ts/py Markdown 模板。填真实 System、Side、Language、Namespace/Module、Source、CodeRevision、Status、Updated、Verification、Responsibility；Updated 带秒与偏移并加引号，Responsibility 直达职责 MD 中已存在的契约章节。

API 只保留简明用途、公开签名、必要参数返回和关键提醒。流程、操作示例、架构、生命周期、持有/释放及内部协作全部归职责文档，不删细节、不给实现体；API 链接相关章节而非复制。无公开函数不建空文件。

保留签名的实际修饰符、默认值、可空性、泛型约束、重载和必要类型壳；不收字段/属性/事件/构造器或非公开函数。C# 分号声明，TS 声明签名，Python docstring 和 `...`，不补 pass、throw 或空实现。mixed 按函数标状态，planned/mixed 留设计目录，核对实现后才移交正式 api/。README 仅导航。

仅供文档查阅，不参与编译发布；不创建独立 .api.cs/.api.d.ts/.api.pyi 文档声明，不改 SDK 和生产源码。旧格式只经显式安全迁移处理，先 dry-run，冲突不覆盖。该指南是技能资源，不是业务 API 产物。
