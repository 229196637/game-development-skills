// 仅供文档查阅，不参与编译或发布。
// System: game-rules
// Side: client
// Language: C#
// Namespace/Module: GameEntry.Client.Mod.GameRule.GameRuleStep
// Source: src/client/Mod/GameRule/GameRuleStep.cs
// CodeRevision: working-tree
// Status: implemented
// Updated: 2026-10-12 23:23:46 +08:00
// Verification: 当前源码按CLIENT+DEBUG、SERVER+DEBUG解析；对外可见类型、普通方法签名与直接检查核对。
// Condition: CLIENT
using GameEntry.Client.Mod.GameplayConfig;
using GameEntry.Client.Mod.GameRandomEvent;
using GameEntry.Client.Mod.Level;
using Entity = GameEntry.Client.Mod.ECS.Entity;

namespace GameEntry.Client.Mod.GameRule;

public abstract class GameRuleStep: IDisposable
{

    /// <summary>绑定一次阶段上下文。</summary><param name="context">非null当前阶段。</param>
    public abstract void Enter(RuleContext context);

    /// <summary>处理宿主校验过的本局信号。</summary><param name="signal">非null本局信号。</param>
    public abstract void Observe(GameplaySignal signal);

    /// <summary>在实际有效帧结束后判断完成，不使用墙钟。</summary><param name="timeStep">有限非负有效秒数。</param>
    public abstract void Update(float timeStep);

    /// <summary>终止本阶段；目标实体归关卡回收。</summary>
    public abstract void Dispose();
}
