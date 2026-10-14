class ItemStore:
    """实例内保存道具数量；公开接口按文档处理空 ID 和无效数量。"""

    def __init__(self):
        self._counts = {}

    def add(self, item_id: str, amount: int) -> int:
        """累加并返回总数；空 ID 或非正整数（含 bool）抛 ValueError。"""
        # 在修改数量前完成校验，避免失败入库污染既有状态。
        if not item_id:
            raise ValueError('item_id must not be empty')
        if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
            raise ValueError('amount must be a positive integer, excluding bool')
        self._counts[item_id] = self._counts.get(item_id, 0) + amount
        return self._counts[item_id]

    def get(self, item_id: str) -> int:
        """返回数量，未记录时为 0；空 ID 抛 ValueError。"""
        if not item_id:
            raise ValueError('item_id must not be empty')
        return self._counts.get(item_id, 0)

    def add_many(self, items: list[tuple[str, int]]) -> dict[str, int]:
        """整批校验、汇总后累加，返回本批 ID 总量的新字典，空列表返回 {}。

        items 不允许 None，须为二元组列表；ID 为非空字符串，数量为正 int
        且排除 bool。任一输入约束失败抛 ValueError，全部原数量保持不变。
        不提供道具表存在性、并发或持久化保证。
        """
        # 1. 先校验并汇总整批，避免后项非法时前项已污染存储。
        if not isinstance(items, list):
            raise ValueError('items must be a list')
        m_deltas = {}
        for m_item in items:
            if not isinstance(m_item, tuple) or len(m_item) != 2:
                raise ValueError('each item must be a pair tuple')
            m_itemId, m_amount = m_item
            if not isinstance(m_itemId, str) or not m_itemId:
                raise ValueError('item_id must be a nonempty string')
            if isinstance(m_amount, bool) or not isinstance(m_amount, int) or m_amount <= 0:
                raise ValueError('amount must be a positive integer, excluding bool')
            m_deltas[m_itemId] = m_deltas.get(m_itemId, 0) + m_amount

        # 2. 所有输入有效后提交；独立结果字典防止调用方改写内部数量。
        m_totals = {m_itemId: self._counts.get(m_itemId, 0) + m_amount
                    for m_itemId, m_amount in m_deltas.items()}
        self._counts.update(m_totals)
        return m_totals
