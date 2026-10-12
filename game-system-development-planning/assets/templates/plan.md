---
id: plan.<task>.<system>.<topic>
kind: plan
system: <system>
title: <标题>
status: draft
updated: '<YYYY-MM-DD HH:mm:ss ±HH:MM>'
sources: []
links: []
code_revision: working-tree
metadata:
  schema_version: "1"
  task: <任务标识>
---
# <单一系统：当前文件主题>
[返回任务索引](../index.md)

## 已确认现状与证据
实际源码路径、当前接口与约束。

## 本文件设计
按 architecture / responsibilities / interfaces / relationships / flows / verification 主题填写具体内容；删除此提示。

只描述接口契约、职责和调用/依赖关系，不写实现伪代码。接口签名直接链接原语言 API 文件，注明 planned/mixed/implemented，开发时更新同一套 API；规划期文件在所属任务 api/<端>/<模块>/，实现核对后由文档技能移动到正式文档目录，更新本文件的引用。

architecture.md 必须包含模块依赖架构图，flows.md 必须包含关键流程图；按实际需要添加时序图/状态图，图的接口与端归属必须和 API 一致。使用专用架构/流程模板，不以任务总图替代模块图。

## 对应任务与验收
关联总规划的 TODO ID、前置接口与可观察验收条件；进度和证据统一维护在任务总规划，不复制第二份 TODO。

## 待确认事项
仅列未解决的真实业务或接口问题，已确定时写“无”。

## 相关文件与实现对照
写可跳转的相关规划和当前系统文档链接，以及实现后的差异。
