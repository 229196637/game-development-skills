---
name: document-layout
description: 规划产物的目录、YAML meta 和引用约定。
metadata:
  kind: skill-reference
  schema-version: "1"
---
# 目录与元数据协议
默认目录名使用用户指定的 `docs/规划/` 与 `docs/文档/`。已有同义目录先映射复用，确需迁移时列出引用影响，不私自搬迁。保留 `docs/sdk/`、`docs/api/` 等第三方参考资料，不覆盖自动生成内容。

```text
docs/                         独立 Git 工作树
  index.md                    可选总导航，仅链接任务和现状文档
  规划/
    index.md
    <任务标识>/
      index.md                当前任务入口与详细需求、路由、TODO、验收
      api/
        client/<模块>/<类型或模块>.<语言声明扩展名>
        server/<模块>/<类型或模块>.<语言声明扩展名>
        shared/<模块>/<类型或模块>.<语言声明扩展名>
      <系统标识>/
        architecture.md
        responsibilities.md
        interfaces.md
        relationships.md
        flows.md              本模块流程/必要时序与状态图
        config.md             涉及 Excel 时的字段字典与导出/读取映射
        ui.md                 涉及 UI 时独立说明
        ui-preview.html       UI 设计稿，由 ui.md 映射
        verification.md
  文档/
    index.md
    systems/<系统标识>.md
    api/
      client/<模块>/<类型或模块>.<语言声明扩展名>
      server/<模块>/<类型或模块>.<语言声明扩展名>
      shared/<模块>/<类型或模块>.<语言声明扩展名>
```

API 先分 client/server/shared，再按模块建文件夹；shared 是两端共享接口。模块内仅放原语言公开函数声明，由系统 Markdown 直接映射，不另建清单、索引或 meta。查询优先读 Markdown 和 API，能回答且无过期或冲突时不扫描源码。文件头用原语言注释注明源码、真实代码版本、更新日期、验证状态；每次修改同步声明、注释及 Markdown 映射。详见 game-system-development-documentation。

规划阶段 API 只在 docs/规划/<任务>/api/ 生成，由任务及模块规划引用；开发阶段完善同一文件，按函数区分拟定与已实现。实现核对完成后，由文档技能移动到 docs/文档/api/ 对应端和模块，并同步所有链接；规划位置不保留重复声明。未完成文件继续留在任务下。规划只处理接口和关系，不展开具体实现。

## Markdown meta
使用 YAML frontmatter。这是扩展文档协议；不要把这些顶级键写进 SKILL.md。技能入口保持标准 `name`、`description`，扩展信息只能置于其 `metadata` 中。
产物必填：
- `id`：稳定唯一标识，例如 `plan.<task>.inventory.architecture`。
- `kind`：`index` / `plan` / `system`。
- `system`：单一系统标识；索引用 `catalog`。
- `title`、`status`、`updated`（YYYY-MM-DD HH:mm:ss ±HH:MM，按用户时区，YAML 使用引号）。
- `sources`：相对代码仓库根目录的路径列表；纯设计可为空。
- `links`：相对本文件的相关文档路径列表。
- `code_revision`：验证过的代码提交；尚未提交时写 `working-tree` 并在正文说明涉及路径。
可选 `metadata`：`schema_version`、`task`、`supersedes`、`verified_by`、`code_dirty` 等。现有协议不同则建立字段映射，不破坏旧工具。

规划状态为 `draft`、`ready`、`implemented`、`superseded`、`cancelled`。跨多文件用相同任务标识，文件 ID 不同。只有实际实现核对后才标 implemented。

每个当前任务只有一个执行入口：docs/规划/<任务>/index.md。它详细保存需求、目标、范围、约束、模块路由和验收；模块文件全部归在所属任务下。不同任务建立独立任务目录。总索引只导航。TODO 默认维护在任务入口，过长才拆到同任务 todo.md 并链接，不复制多份状态。

## 导航
根索引 → 分类索引 → 任务索引 → 单系统规划；正文提供返回上级、同系统相关规划及现状文档链接。meta.links 也写实际相对路径。源代码路径是证据字段，不伪造为 docs 仓库内部文件链接；跨仓库可用已验证的固定版本远程链接。不要硬编码当前机器路径。

## 可读更新时间
updated 与 API Updated 使用 YYYY-MM-DD HH:mm:ss ±HH:MM，例如 '2026-10-12 17:19:55 +08:00'。使用用户时区并注明 UTC 偏移，YAML 使用带引号字符串。修改文件时取本次真实更新时间；历史仅有日期不填猜测时分秒，也不统一补成 00:00:00。历史记录不自动迁移，日期缺少时间的当前产物会由工具指出，实际更新再补真实时间。

## 调度器扩展
涉及调度器时按 [调度器与执行者](../workflows/dispatchers.md) 用 roles 标记调度器/执行者/工具/数据；调度器增加 dispatcher、design_patterns，并独立说明各条主要流水线及跨调度器跳转。执行者仅说明执行内容，不套调度器模板。

## 入口类索引
本技能 index 必须有“## 类索引”，列为“类、角色、职责、API、文档”。职责用一个简短功能短语，例如“控制技能”“限制技能”，不要把参数、顺序、持有、生命周期或限制塞进索引。角色沿用 dispatcher/executor/tool/data；文档直达实际类型 MD，API 直达原语言公开函数声明。规划索引可链接正式已有 API 或任务 planned/mixed API，明确状态；正式索引仅映射已实现能力。无公开函数写“无公开函数”，缺失资料写“待补齐”，两者不能混用。索引只登记本次覆盖/维护的类型，不要求为了表格无差别扫描全工程；类/API/文件变化同步入口。
