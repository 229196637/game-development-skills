// 仅供文档查阅，不参与编译或发布。
// System: waves
// Side: client
// Language: C#
// Namespace/Module: GameEntry.Client.Mod.GameWave.GameWaveSystem
// Source: src/client/Mod/GameWave/GameWaveSystem.cs
// CodeRevision: working-tree
// Status: implemented
// Version: 1.0.1
// Updated: 2026-10-13 02:25:59 +08:00
// Verification: 当前源码按CLIENT+DEBUG、SERVER+DEBUG解析；对外可见类型、普通方法签名与直接检查核对。
// Condition: CLIENT
using GameEntry.Client.Mod.GameplayConfig;
using GameEntry.Client.Mod.GameRandomEvent;
using GameEntry.Client.Mod.Level;
using Entity = GameEntry.Client.Mod.ECS.Entity;

namespace GameEntry.Client.Mod.GameWave;

public sealed class GameWaveSystem: IDisposable
{

    /// <summary>独立排好普通链，不立即刷怪，保留重复模板。</summary><param name="context">非null已准备关卡。</param><exception cref="ArgumentNullException">context为null。</exception><exception cref="InvalidOperationException">重复启动。</exception><exception cref="ObjectDisposedException">已释放。</exception>
    public void Start(LevelContext context);

    /// <summary>按计划时刻提交到期出生请求，全部实际出生后计完成；触发链不改变普通链位置。</summary><param name="elapsedSeconds">有限非负、不倒退的本局有效秒数。</param><exception cref="ArgumentOutOfRangeException">时间无效或倒退。</exception><exception cref="InvalidOperationException">未启动或借用场景失效。</exception>
    public void Update(double elapsedSeconds);

    /// <summary>接受一个合法触发配置；旧局/重放不会生成重复出现。</summary><param name="waveId">触发配置指定的波次。</param><param name="triggerRuleId">本关触发行Id。</param><param name="origin">非null唯一来源信号。</param><exception cref="ArgumentNullException">origin为null。</exception><exception cref="InvalidOperationException">未启动。</exception><exception cref="ArgumentException">来源或配置不匹配。</exception>
    public void RequestWave(int waveId, int triggerRuleId, GameplaySignal origin);

    /// <summary>取得已出现的独立快照。</summary><returns>非null；没有生成时出现列表为空。</returns>
    public WaveSnapshot GetSnapshot();

    /// <summary>取消未到期出现及本模块待出生票号；已出生实体由关卡回收，重复安全。</summary>
    public void Dispose();
}
