---
id: plan.<task>.<system>.ui
kind: plan
system: <system>
title: <模块 UI 规划>
status: draft
updated: '<YYYY-MM-DD HH:mm:ss ±HH:MM>'
sources: []
links:
- ../index.md
- ui-preview.html
code_revision: working-tree
metadata:
  schema_version: "1"
  task: <任务标识>
---
# <模块 UI 规划>
[任务入口](../index.md) · [HTML 设计稿](ui-preview.html)

仅涉及 UI 的模块使用此模板。HTML 为本模块可直接打开的设计稿，完成内容后保留真实链接。

## 业务归属与代码目录
明确逻辑执行端/状态 owner。客户端业务在模块 View（或现有 view）内集中 UI；服务端业务的客户端 UI 直接位于对应模块目录。填写实际语言、目录、命名空间/模块及框架依据。

## 设计稿与页面状态
说明界面用途、布局/尺寸、控件、状态与已确认交互；HTML 用模拟数据呈现真实需求，标清待确认及实现程度。

## 类职责与接口映射
窗口、组件、网络适配及业务调用方分别负责什么；链接原语言公开函数 API，记录打开/关闭、输入/领域事件/响应刷新顺序和状态来源。

## UI 依赖与交互流程图
绘制本模块 UI 的依赖架构和关键交互流程，或链接本模块现有图及对应节点；标明端归属和必要成功/失败分支。

## 框架、资源与生命周期
列实际 UIManager/窗口登记、统一适配/输入、资源发布/生成绑定及清理契约，区分生成文件和手写文件，不写实现伪代码。

## 开发与验收映射
关联任务入口 TODO ID 及业务/网络前置。填写 HTML 打开和交互检查、正式 UI 生命周期/适配/错误状态的可观察验收；不在此复制任务完成状态。
