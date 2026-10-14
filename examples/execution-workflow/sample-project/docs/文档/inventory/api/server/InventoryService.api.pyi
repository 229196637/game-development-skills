# System: inventory
# Side: server
# Language: Python
# Module: src.server.inventory.inventory_service
# Source: src/server/inventory/inventory_service.py
# CodeRevision: working-tree; SHA256 0cdba5bb0a905b29bc66eab5a5af2112dd9c3661c939879fa273e15539ff1414
# Status: implemented
# Updated: 2026-10-14 09:39:15 +08:00
# Verification: all public signatures and validation contracts checked against actual source
# 仅供文档查阅，不参与编译或发布。

class InventoryService:
    def grant_reward(self, item_id: str, amount: int) -> int:
        """已实现。直接透传 ItemStore.add 的参数、总量及异常，不新增校验；依赖有效存储引用。"""
        ...
    def grant_rewards(self, items: list[tuple[str, int]]) -> dict[str, int]:
        """已实现。依赖有效存储引用；items 输入约束与异常遵循 ItemStore.add_many，不另行校验。
        返回存储的提交后总量字典（空请求为 {}），永不返回 None；非法项透传 ValueError 且整批不变。
        """
        ...
