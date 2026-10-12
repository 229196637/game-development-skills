---
name: public-functions-template
description: 各语言公开函数 API 文档的通用生成模板与替换规则。
metadata:
  kind: output-template-guide
  schema-version: "1"
---
# 通用公开函数模板
使用真实源码填入以下结构，并采用项目语言原生声明与注释：
```text
[语言原生文件头注释]
System: [实际模块]
Side: [client/server/shared；shared 是两端共享]
Language: [实际语言]
Namespace/Module: [真实名称]
Source: [代码仓库相对路径]
CodeRevision: [真实提交或 working-tree；规划时注明设计基线]
Status: [planned/mixed/implemented]
Updated: [YYYY-MM-DD HH:mm:ss ±HH:MM]
Verification: [实际核对范围及结果]
[仅供文档查阅，不参与编译或发布]
[真实命名空间 / package / 模块路径]
[必要的导入或类型引用；不展开字段、属性或枚举]

[类型注释和真实类型外壳；模块级函数无需类型外壳]
    [公开函数原生文档注释]
    - 拟定/已实现状态（mixed 文件按函数注明）
    - 用途
    - 各参数含义与允许的空值、默认值
    - 返回值含义与是否可能为空
    - 实际抛出异常和调用约束（存在时才写）
    [真实公开函数签名；保留重载、修饰符和泛型；无实现体]
```
规划期声明文件放在 docs/规划/<任务>/api/client/<模块>/、server/<模块>/、shared/<模块>/；实现核对后由文档技能移动到 docs/文档/api/ 的对应位置并同步全部引用，不留重复声明。shared 是两端共享。按类型或模块分文件，API 文件夹仅保存原语言声明，规划阶段由任务/模块 Markdown 映射，移动到正式文档后由系统 Markdown 直接映射。每次系统修改同步签名、契约注释、文件头版本及 Markdown 链接。该模板是技能内指导，不是产出的业务 API。
语言原生声明模板中的 Example 命名仅用于格式展示，生成时替换成真实模块、类、函数和注释。不因模板含可空参数、异步或默认值而将这些语义添加到真实签名。
