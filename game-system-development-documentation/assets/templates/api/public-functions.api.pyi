# API 文档模板，仅供查阅，不参与编译或发布；替换为真实签名与契约。
# System: <实际模块>
# Side: <client/server/shared；shared 是两端共享>
# Language: Python
# Namespace/Module: <真实名称>
# Source: <代码仓库相对路径>
# CodeRevision: <真实提交或 working-tree；规划时注明设计基线>
# Status: <planned/mixed/implemented>
# Updated: <YYYY-MM-DD HH:mm:ss ±HH:MM>
# Verification: <实际核对范围及结果>
# 原模块示例：example.public_api

class LookupService:
    """示例公开服务类型；生成文档时替换为真实类型。"""

    def find(self, key: str) -> str | None:
        """示例查询方法；生成文档时替换为真实用途。

        Args:
            key: 示例查询键；实际输入约束以实现为准。
        Returns:
            示例查询结果；实际 None 含义以实现为准。
        """
        ...
