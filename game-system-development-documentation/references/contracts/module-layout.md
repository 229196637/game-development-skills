# 模块文档目录

```text
docs/文档/
  README.md                       # 总入口：模块导航和类索引
  目录架构.md                     # 整体层级、模块及跨模块映射
  <模块>/
    README.md                     # 模块入口：类索引和专题入口
    目录架构.md                   # 与本模块入口同级，脚本及文档层级
    职责/
      README.md
      <实际类>.md
    api/
      README.md
      client|server|shared/
        README.md
        <实际类>.api.<原语言扩展名>
    网络.md                       # 需要时建立，链接真实契约
    UI.md                         # 需要时建立，链接 HTML
    配置.md                       # 需要时建立
    设计/<任务>/                  # 需要未实现资料时，使用设计态模式检查
      README.md
      目录架构.md
      职责/...
      api/client|server|shared/...
```

实际模块名沿用游戏代码的模块归属；跨模块共享类型放真实所有者模块，其端为 shared，不创建无归属的“共享杂物”目录。一个模块同时覆盖 client/server/shared 时也只维护一个模块入口，API 在模块内再按端区分，不重复套同名模块目录。必要的真实子模块可以再分，但不制造空层级。

职责 MD、API 原语言公开函数、调度图、持有关系和精简 meta 的既有内容规范不变。模块间依赖写相对 meta.dependencies.document；架构图/流水线点击和图下链接同步更新。全局 README 可汇总类索引，模块 README 只列本模块类，不复制正文。每个实际目录继续有摘要 README。

总入口及每个模块入口均直接链接同级目录架构.md。不能只在职责子文件内画目录树代替它。设计态沿用设计 meta、planned/mixed API，保存在本模块的设计任务目录；未实现能力不得当成正式实现，移交目标是本模块正式 api/。正式检查跳过保存的设计稿，设计稿单独用 --mode planning 检查。

迁移只针对已授权文档，移动后修复 README、meta 文档依赖、API 映射、图内点击、规划工单引用及外部消费者；保留历史，不改 SDK/API 缓存或生产代码。工具应拒绝顶层职责/api/client/server/shared/设计旧布局，而不只验证文件存在。

含类索引的 README 同时维护职责架构图与系统依赖图，见 [职责架构与系统依赖图](readme-diagrams.md)；索引/角色/依赖及跳转同步更新。
