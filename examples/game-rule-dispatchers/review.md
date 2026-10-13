# 隔离样例核对

样例只读参考当前 GameRuleSystem、GameRuleStep、GameWaveSystem、GameRandomEventSystem、GameRunSession 和 GameplayWeightedChoice；未改生产代码、配置、运行状态或生产 docs。

## 检查结果

- 两技能 frontmatter 与引用检查通过。
- 正式文档 6 份、规划 4 份结构检查通过：角色、设计模式用途、各流水线 flowchart、跨调度器节点与标题/锚点对应。
- 对两工具分别构造非法角色、空模式、缺流水线、流水线缺图和跨调度器缺跳转，10 个反例都被对应规则拒绝。
- 角色兼任允许多个 roles；静态工具无公开函数时不生成空 API。独立执行者与工具说明无需套调度器图。
- 最终 22 张图实际渲染通过，实际字体约 20px，合计 60 个跳转节点。图中角色、通信方向、回调入队及后续有效帧消费分别表达。[Tick 预览](preview/tick.png) · [信号消费预览](preview/signals.png)。

## 静态语义核对

GameRuleSystem：同批玩家死亡优先于 Boss 完成；ObserveBatch 与 Observe 分别入队，由有效帧转换/消费；随机事件回调不递归推进规则；RuleCompleted 消费后释放旧阶段并 Enter 下一阶段；规则链而非波次耗尽锁存胜利；不释放世界。

GameWaveSystem：普通链和触发链分别排期、共享有效时间；触发去重；提交出生与实际出生区分；全部出生后才登记一次出现；停止取消待出生票号，已出生实体归关卡。

GameRandomEventSystem：先通知原活动实例再选择新实例；释放未选候选；Begin 失败释放；完成请求登记与 Update 提交区分；停止不发送完成消息。

数据例说明 RuleContext、RuleChainSnapshot 和 GameRunResult 的来源、读写归属及浅只读边界；未虚构数据执行权限。

这是文档/工具静态验证，没有运行 SDK 游戏，也没有新增测试代码到技能。工具只约束已标注角色的结构，不能自动推断遗漏的调度职责或证明业务流程正确。规划样例是已实现结构逆向整理，供阅读，不代表新的设计已获授权。

移除的旧角色值也已构造反例，工具按 ROLES 拒绝。最终只保留 dispatcher/executor/tool/data，正式说明的测试结果均独立保存在本报告。
