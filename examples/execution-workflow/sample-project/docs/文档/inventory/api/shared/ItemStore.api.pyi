# System: inventory
# Side: shared
# Language: Python
# Module: src.shared.inventory.item_store
# Source: src/shared/inventory/item_store.py
# CodeRevision: working-tree; SHA256 273e24b03469530eea56ebd7b1bdf13429ffb11e4b668cbb09ce573a19c80ef0
# Status: implemented
# Updated: 2026-10-14 09:38:29 +08:00
# Verification: all public signatures and validation contracts checked against actual source
# 仅供文档查阅，不参与编译或发布。

class ItemStore:
    def add(self, item_id: str, amount: int) -> int:
        """已实现。假值 ID 或非正整数数量（含 bool）抛 ValueError；成功返回非空总量。未检查 ID 字符串类型；不可哈希 ID 可能抛 TypeError。"""
        ...
    def get(self, item_id: str) -> int:
        """已实现。假值 ID 抛 ValueError；返回数量，缺失返回 0，永不返回 None；不可哈希 ID 可能抛 TypeError。"""
        ...
    def add_many(self, items: list[tuple[str, int]]) -> dict[str, int]:
        """已实现。items 不允许 None，须为列表且每项须为二元组；ID 为非空字符串，数量为正 int 且排除 bool。
        任一约束失败抛 ValueError，全部原有数量保持不变；成功重复 ID 累加，返回各涉及 ID 提交后总量的新字典。
        空列表返回空字典，永不返回 None。无道具表存在性检查，无并发或持久化保证。
        """
        ...
