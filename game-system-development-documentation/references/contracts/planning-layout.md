---
name: planning-document-layout
description: 设计态文档使用同一职责/API结构，保存拟定目录与接口，不维护 TODO。
---
# 规划目录与元数据

文档技能可独立生成，规划在文档就绪后读取。设计态放对应模块的设计任务目录下，结构与现状态对应；不把未实现能力放进正式文档，也不复制出多套相同职责/接口/流程说明。

~~~text
docs/文档/<模块>/设计/<任务>/
  README.md                  需求、框架、类索引；执行工单另在 docs/规划
  职责/
    README.md
    <Class>.md               职责、目录/脚本位置、架构/流水线、API 链接
  api/
    README.md
    client|server|shared/
      README.md
      <Class>.<原语言声明扩展名>
~~~

多模块任务分别写在各实际模块的设计目录，并相互链接，每级有 README；API 在模块内按端组织，职责 MD 链接唯一声明，不复制签名。UI/配置/网络等必要专题保存在所属模块并由 README/职责说明导航，不创建空专题。

## 设计态 meta

沿用规划 meta：id、kind（index/plan/system）、system、title、status（draft/ready/implemented/superseded/cancelled）、updated（带秒与 UTC 偏移）、sources、links、code_revision。具体类型加 roles，调度器加 dispatcher 与 design_patterns，见 [调度器与执行者](../workflows/dispatchers.md)。sources 只列真实源证据，拟定文件路径放“目录架构与脚本位置”表/API Source 并标未实现。README 类索引只放简短职责。

## 生成与交接

先按 [目录架构与脚本位置](../workflows/script-layout.md) 决定代码路径和装配归属，再定职责和接口，随后画真实或明确拟定的流水线与跨调度跳转。已有能力足够就复用，未确认重写不提前替代。

模板由文档技能维护：[任务 README](../../assets/templates/planning-task.md)、[类说明](../../assets/templates/planning-class.md)、[目录摘要](../../assets/templates/planning-directory-readme.md)、[UI](../../assets/templates/planning-ui.md)；API 用本技能原语言模板。设计态 API 头标 planned/mixed，实现核对后经同一能力移交正式位置，不留双份。

文档就绪后，规划按模块依赖生成逐类执行工单；文档技能不写或排序 TODO，不覆盖既有工作项。已实现补录或更新也可独立调用文档技能。
