---
id: plan.<task>.<system>.flows
kind: plan
system: <system>
title: <模块关键流程>
status: draft
updated: '<YYYY-MM-DD HH:mm:ss ±HH:MM>'
sources: []
links: []
code_revision: working-tree
metadata:
  schema_version: "1"
  task: <任务>
---
# <模块>关键流程
[返回任务入口](../index.md)

## <关键流程名称>
注明入口 API、参与者、前置条件、拟定/已实现状态、任务 TODO 与验收场景。
以下只演示流程图格式，分支必须替换为已确认的真实或拟定契约。
```mermaid
%%{init: {"themeVariables": {"fontSize": "20px"}}}%%
flowchart TD
    trigger["业务触发与输入"] --> check{"满足调用前提？"}
    check -->|"否"| reject["按契约返回拒绝结果"]
    check -->|"是"| call["责任方调用依赖接口"]
    call --> result{"调用结果"}
    result -->|"成功"| complete["按契约交付结果"]
    result -->|"失败"| fail["按契约处理失败并结束"]
```

## 协作顺序与状态
多端、异步或多模块消息流程在此增加真实 Mermaid 时序图；重要生命周期按需增加状态图。说明等待、状态所有权及确有的取消/释放情况，不写内部实现伪代码。

## 验收映射与未决事项
关联本流程的 verification.md 场景和总任务 TODO，标出未经确认的分支及未验证动态行为。

图表可读性：优先纵向布局，超宽时按端或阶段拆图；节点精简并换行，关系保持完整。按实际文档预览宽度检查，避免整体缩小后文字无法直接阅读。

<!-- 如为调度器：meta 加 dispatcher 与 design_patterns；正文设“## 调度流水线”，以“### <流水线名称>”分图，外部调度器节点 click 到对方 MD/流水线锚点并附普通链接。执行者只列执行职责。不适用时删除本提示，不能生成空流水线。 -->
