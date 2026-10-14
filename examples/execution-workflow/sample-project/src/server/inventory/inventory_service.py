from src.shared.inventory.item_store import ItemStore


class InventoryService:
    """将奖励直接交给传入的共享存储，不添加业务规则。"""

    def __init__(self, store: ItemStore):
        self._store = store

    def grant_reward(self, item_id: str, amount: int) -> int:
        """返回 add 的总量；保持存储的 ValueError 异常契约。"""
        return self._store.add(item_id, amount)

    def grant_rewards(self, items: list[tuple[str, int]]) -> dict[str, int]:
        """向注入存储单次转发整批奖励并原样返回其总量字典，不返回 None。

        依赖有效存储引用；本方法不另行校验。items 的列表、二元组、ID 和
        数量约束遵循 ItemStore.add_many；非法输入透传 ValueError 且整批不变。
        """
        return self._store.add_many(items)
