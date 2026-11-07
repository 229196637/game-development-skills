---
System: '<实际模块>'
Side: '<client/server/shared>'
Language: 'Python'
Namespace/Module: '<真实名称>'
Source: '<相对代码仓库根路径；设计态注明未实现>'
CodeRevision: '<真实提交或 working-tree；设计态注明基线>'
Status: '<planned/mixed/implemented>'
Updated: '<YYYY-MM-DD HH:mm:ss ±HH:MM>'
Verification: '<实际静态核对范围，不放测试记录>'
Responsibility: '../../职责/<实际类型>.md#<真实契约章节>'
---
# <实际类型> API

<简明用途。仅供文档查阅，不参与编译或发布。>

```python
class LookupService:
    def find(self, key: str) -> str | None: ...
```

<仅必要参数/返回值和关键提醒；mixed 按函数注明状态。>

[操作与生命周期](../../职责/<实际类型>.md#<真实契约章节>)

<!-- 使用真实签名替换 Example；流程、架构、内部协作、长契约全部放职责 MD，保真维护。生成后删除占位提示。 -->
