---
name: game-excel-config
description: 为游戏系统设计、创建、修改、导出和验证 Excel 策划配置表，规划字段、稳定标识、表关系、客户端/服务端归属及读取接口。适用于游戏配置，不用于普通办公表格。
metadata:
  short-description: 游戏 Excel 配置设计、端侧归属与导出验证
  schema-version: "1"
---
# 游戏 Excel 配置表
个人级游戏开发技能，不限定引擎或编程语言。先查项目表格式、导出器和配置读取 API，复用现有链路；无业务依据不推测数值、表关系或权威端。

## 路由
- 规划与修改：读 [配置流程](references/workflows/config.md)。
- 字段、标识和外键：读 [配置契约](references/contracts/tables.md)。
- 字段整理与导出链路：必须读 [字段与导出规范](references/contracts/fields-and-export.md)，使用 [配置模板](assets/templates/config.md)，逐字段说明类型、填写格式、缺省、端开关和实际输出映射。
- 工作簿显示与跳转：读 [排版](references/contracts/formatting.md)。
- 仅项目已有同类标签式 legacy .xls 导出器时，读 [标签格式适配](references/adapters/legacy-xls.md)；不是所有游戏项目的固定格式。

## 与系统流程协作
游戏系统开发阶段先确定哪些数值/规则/展示数据由表驱动，在模块 config.md 中规划表字段字典、表头布局、主键、外键、端归属、导出类型/路径/转换及读取公开函数和依赖，不写运行时实现。把计划写入该任务的系统接口/关系规划和拟定 API，拟定声明存于 docs/规划/<任务>/api/<端>/<模块>/，由任务规划映射；实现核对后由文档技能移到正式 API 位置并更新系统 Markdown 映射。
开发阶段按实际实现完善同一 API 和文档。文档在独立 docs Git 中维护；Excel 源表与导出产物遵循项目代码/资源仓库约定，不为此强制移动到 docs。

## 字段注释
每字段必须有清楚说明；同步规划 config.md、Excel TIPS/说明列和生成配置原生注释，写明用途、单位、格式、真实约束、默认/特殊值、外键及端侧差异。逐字段核对注释与实际导出行为；没有校验能力不能在注释中声称有。详见字段与导出规范。

## 边界与验证
采用项目实际 .xls/.xlsx 格式，不私自迁移；不手改自动生成代码，不将原项目单机、首条 Id=1 或特定命名空间作为跨项目业务规则。
配置源、导出物和读取 API 相互核对，验证重复 Id、外键、类型、端侧泄漏、中文、公式与生成一致性。正式生成器是可复用工具；临时 .py 可保留但不入 Git，精确本地忽略，不能忽略所有 Python 源码。
纯配置设计不安装工具或执行生成；实际修改后使用项目已有导出与检查命令，不能宣称未运行的检查通过。语言 API 模板引用 [游戏系统开发文档](../game-system-development-documentation/SKILL.md)，游戏整体开发由 [游戏系统开发规划](../game-system-development-planning/SKILL.md) 组织。
