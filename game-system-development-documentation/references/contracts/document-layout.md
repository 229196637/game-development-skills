---
name: document-layout
description: 系统 Markdown 与分端、分模块 API 声明的映射协议。
metadata:
  kind: skill-reference
  schema-version: "2"
---
# 产物结构
保留现有 SDK 和第三方 API 参考，不覆盖自动生成内容。项目自己的文档默认如下；旧结构先映射，迁移前检查引用。
~~~text
docs/                        独立 Git 仓库
  index.md
  规划/
    index.md
    <任务>/<系统>/...md
  文档/
    index.md
    systems/<模块>.md
    api/
      client/<模块>/<类型或模块>.<语言声明扩展名>
      server/<模块>/<类型或模块>.<语言声明扩展名>
      shared/<模块>/<类型或模块>.<语言声明扩展名>
~~~
client 是客户端，server 是服务端，shared 是两端共享。先按这三个端目录分类，再按模块建文件夹。只有实际共享的接口放 shared，不把两端同名但契约不同的函数合并，也不重复复制共享接口。没有公开函数的端不建空目录。
API 模块文件夹内只放原编程语言的声明文件，不另建 Markdown、清单、索引或 meta。扩展名按语言选择 .api.cs、.api.d.ts、.api.pyi 或原语言声明扩展名；不能用 Markdown 代替语言声明。参见 [API 规范](../api/snapshots.md)。

# UI 说明与设计稿（涉及时）
系统主体链接独立 docs/文档/systems/<模块>/ui.md 及其相对链接 ui-preview.html；已有位置优先复用。UI 说明与业务系统使用同一 system 标识，作为该系统专题，不另建重复业务主体。规划使用 docs/规划/<任务>/<模块>/ui.md 和 ui-preview.html。设计稿按实际实现同步，保留已确认设计与实现差异；HTML 不需要 YAML frontmatter。API 目录仍仅原语言声明。

# 规划 API 与正式 API
未实现声明只保存在 docs/规划/<任务>/api/client|server|shared/<模块>/，由任务及模块规划引用。文档技能核对实现后将已完成文件移动至上图正式 API 对应位置，并同步链接、版本及系统说明；不保留双份当前声明。planned/mixed 文件继续留在任务目录，长期系统说明中的正式 API 不用提案覆盖。

# Markdown meta
仅规划、系统说明和已有文档导航 Markdown 使用 YAML frontmatter。字段：id、kind（index/system/plan）、system、title、status、updated、sources、links、code_revision。system 对应模块标识，索引用 catalog；sources 相对代码仓库根，links 相对本文件；代码未提交则基线写 working-tree 并注明涉及路径。
状态 verified 表示注明范围内已核对，partial 为不完整，stale 为已知过期。扩展字段置于 metadata，如 schema_version、verified_by、scan_scope、code_dirty，保留项目已有字段。SKILL.md 顶层仍遵循技能规范。API 使用原语言文件头注释记录版本与来源，不需要独立 YAML 文件。

# 系统说明与 API 映射
每系统一份主体 Markdown：用途、边界、源码结构、类职责、入口与状态流、使用编程示例、生命周期、错误处理、验证与缺口。在其中维护：
| 端 | 真实命名空间/模块及类型 | API 文件链接 | 用途 |
| --- | --- | --- | --- |
仅填实际条目，分别映射 client/server/shared 的原语言文件。系统主体直接链接对应 API 文件，不需 API 目录的额外导航。系统 meta 的代码基线、日期及验证状态与 API 文件头保持一致。

# 开发任务入口
当前任务入口为 docs/规划/<任务>/index.md，详细需求、模块规划、TODO 和验收均保存在所属任务文件夹内。它链接 docs/文档/systems/<模块>.md 及其 API 映射。总索引仅提供导航，不承载开发任务细节；长期系统文档不复制任务 TODO。

# 查阅和跳转
根/文档分类 → 系统 Markdown → 原语言 API 文件。系统说明还链接规划和相关系统，检查相对链接存在，不依赖私人机器路径。
接口查询优先查 Markdown 映射和对应 API；已有声明能回答且无过期/冲突时，不扫描源码。接口缺失、文档已知过期或契约矛盾时才调查相关源码。修改系统后必须根据本次实现差异同步真实签名和行为，不以旧 API 代替实现核对。
