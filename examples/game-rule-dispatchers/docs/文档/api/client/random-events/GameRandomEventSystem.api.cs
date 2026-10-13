// 仅供文档查阅，不参与编译或发布。
// System: random-events
// Side: client
// Language: C#
// Namespace/Module: GameEntry.Client.Mod.GameRandomEvent.GameRandomEventSystem
// Source: src/client/Mod/GameRandomEvent/GameRandomEventSystem.cs
// CodeRevision: working-tree
// Status: implemented
// Updated: 2026-10-12 23:23:46 +08:00
// Verification: 当前源码按CLIENT+DEBUG、SERVER+DEBUG解析；对外可见类型、普通方法签名与直接检查核对。
// Condition: CLIENT
using GameEntry.Client.Mod.GameplayConfig;
using GameEntry.Client.Mod.Level;

namespace GameEntry.Client.Mod.GameRandomEvent;

public sealed class GameRandomEventSystem: IDisposable
{

    /// <summary>绑定一次本局上下文，不立即生成事件。</summary><param name="context">非null本局。</param><exception cref="ArgumentNullException">context为null。</exception><exception cref="InvalidOperationException">已Start。</exception><exception cref="ObjectDisposedException">已释放。</exception>
    public void Start(LevelContext context);

    /// <summary>一个有效机会最多抽取一个合格实例；重放/旧局机会忽略。</summary><param name="signal">非null、来自当前局的机会。</param><exception cref="ArgumentNullException">signal为null。</exception><exception cref="InvalidOperationException">未启动或随机源/工厂违约。</exception>
    public void Observe(GameplaySignal signal);

    /// <summary>推进活动实例，再提交唯一完成信号；暂停时调用方不调用本方法。</summary><param name="timeStep">有限非负有效秒数。</param><exception cref="ArgumentOutOfRangeException">时间无效。</exception><exception cref="InvalidOperationException">未启动。</exception>
    public void Update(float timeStep);

    /// <summary>显式测试/玩法输入完成一个外部目标事件；不直接推进时间和规则。</summary><param name="instanceId">当前活动实例号。</param><returns>对应外部目标实例接受输入为true，否则false。</returns>
    public bool CompleteManual(long instanceId);

    /// <summary>查询独立只读实例列表。</summary><returns>非null，不交出事件对象。</returns>
    public RandomEventSnapshot GetSnapshot();

    /// <summary>取消所有活动实例，不产生完成信号，重复调用无副作用。</summary>
    public void Dispose();
}
