// 仅供文档查阅，不参与编译或发布。
// System: game-rules
// Side: client
// Language: C#
// Namespace/Module: GameEntry.Client.Mod.GameRule.GameRuleSystem
// Source: src/client/Mod/GameRule/GameRuleSystem.cs
// CodeRevision: working-tree
// Status: implemented
// Updated: 2026-10-12 23:23:46 +08:00
// Verification: 当前源码按CLIENT+DEBUG、SERVER+DEBUG解析；对外可见类型、普通方法签名与直接检查核对。
// Condition: CLIENT
using GameEntry.Client.Mod.GameplayConfig;
using GameEntry.Client.Mod.GameRandomEvent;
using GameEntry.Client.Mod.GameWave;
using GameEntry.Client.Mod.Level;
using GameEntry.Client.Mod.Battle.Damage;
using Entity = GameEntry.Client.Mod.ECS.Entity;

namespace GameEntry.Client.Mod.GameRule;

public sealed partial class GameRuleSystem: IDisposable
{

    /// <summary>只在BattleStart启动一次，激活首规则。</summary><param name="context">非null、场景就绪、玩家已登记的上下文。</param><exception cref="ArgumentNullException">context为null。</exception><exception cref="InvalidOperationException">重入、场景或玩家无效。</exception>
    public void Start(LevelContext context);

    /// <summary>
    /// 有效帧结算：1.消费完整死亡批次，玩家死亡优先；2.推进事件/信号；3.顺序推进规则；4.生成到期波次。
    /// 这里只锁存结果，世界释放须等驱动返回由Flower执行。
    /// </summary><param name="timeStep">有限非负世界实际秒数。</param><exception cref="ArgumentOutOfRangeException">时间无效。</exception><exception cref="InvalidOperationException">未开战、场景失效或伤害批次技术错误。</exception>
    public void Update(float timeStep);

    /// <summary>收集外部机会信号，不在调用栈中刷怪或推进阶段。</summary><param name="signal">非null本局信号，EntityDied必须走ObserveBatch。</param><exception cref="ArgumentNullException">signal为null。</exception><exception cref="ArgumentException">同局信号缺字段或伪造死亡。</exception>
    public void Observe(GameplaySignal signal);

    /// <summary>只接收本世界已提交批次，重放无副作用；在Update时统一判定。</summary><param name="batch">非null完整批次。</param><exception cref="ArgumentNullException">batch为null。</exception><exception cref="InvalidOperationException">未开战。</exception>
    public void ObserveBatch(DamageBatchResult batch);

    /// <summary>取得独立快照。</summary><returns>非null；未开始时位置0。</returns>
    public RuleChainSnapshot GetSnapshot();

    /// <summary>查询唯一终局结果。</summary><returns>尚未终局为null，否则不可变胜负结果。</returns>
    public GameRunResult? GetResult();

    /// <summary>显式提交外部目标完成，不跳过有效帧。</summary><param name="instanceId">当前活动实例。</param><returns>实例接受完成请求为true。</returns>
    public bool CompleteManualEvent(long instanceId);

    /// <summary>停止所有本局子模块；不销毁借用关卡或世界。</summary>
    public void Dispose();
}
