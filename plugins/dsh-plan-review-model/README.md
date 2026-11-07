# Plan 执行模型

在原计划待审卡片底部增加执行模型选择。默认继承当前会话；只有用户点击同意执行且 `exit_plan_mode` 最终结果成功后才记录会话模型选择。切换持续生效，直到手动再次切换；不改全局默认或 Worker / Verifier 独立配置。

源码从原独立仓库的提交 `0561206d01d6ee30deeafbb83b2fad5a77373cf5` 纳入本仓库，保留完整 Host/Client 实现、语言资源、图标及回归测试；安装说明已调整为本仓库子目录。

## 安装与兼容性

这是 DSH 的本地 Cordis bundle，不是独立 Web 应用。当前版本为 `@local/dsh-plan-review-model@1.0.2`。

此修订补齐 Client 的 `remote` 根服务注入（只有 `remote.commands` 不足以允许访问 `ctx.remote`），修复模型目录命令发出前的 `cannot get property "remote" without inject` 错误；同时修正批准按钮的主题文字色，并将加载异常显示在可展开的错误详情中。静态回归检查不等于浏览器点击验收。

1. 克隆本仓库到准备长期保留的目录：`git clone https://github.com/229196637/game-development-skills.git`。
2. 使用 DSH 的插件管理器安装仓库内的 `plugins/dsh-plan-review-model` 子目录作为本地 bundle，不要安装整个仓库根目录。开发会话中可调用 `plugin_manager`，指定 `action: install_bundle`，`target` 为该插件子目录的绝对路径。
3. 在启用 Plan 模式的会话中提交计划，在待审卡片底部选择执行模型。默认继承当前会话。

本扩展没有额外依赖或安装脚本，无须执行构建。安装为本地链接后，不要随意移动或删除源码目录。当前核验环境为 DSH Desktop `2.0.21-next`、DSH packages `0.2.1-rc.4`；其他版本需重新验证内部模型选择接口。运行测试建议使用 Node.js 22 或更高版本。

## 集成

- Client 只接管带有 `plan-review` intent 和确切调用 ID 的待审 Plan；普通问答、历史只读卡片及工具批准不受影响。不再重复声明原问答插件独占的 `conversation.plan-review.actions` 子槽；查看全文通过原 `sidebarRight.openResource` 与 `dsh-resource://plan/` 文档路由打开原预览面板。首次安装中重复子槽导致加载冲突，原包已移除；修复包使用新的模块 ID `@local/dsh-plan-review-model` 避免已打开页面复用失败的 Client 模块代次，无须重启应用。
- 选择先留在当前审核组件内；批准按钮先等待 `/plan-execution-model` 暂存校验，然后调用原 pending.answer。要求修改调用原 pending.dismiss。
- Host 通过 `user-questions/request` 捕获精确会话和调用，用 `tools/result` 的最终 `{approved:true}` 判定授权。暂存命令本身不能批准计划。
- 不使用 `sessionController.selectModel`，该 API 会保存全局默认。兼容层仅调用已核验的当前运行时 `sessionController.agents.selectForNextRequest`，复用原 `model/selection` 日志、原生选择缓存、请求头与投影。这个内部接口不是稳定的公共 API；兼容检查集中在 core.js，不支持的版本在暂存阶段失败关闭，升级 DSH 后须复测。
- 没有修改 app.asar 或现有 profile 设置，无新增依赖、安装脚本或外部网络资源。

## 测试

运行 `node --test tests/*.test.mjs`，并对 client.js、index.js、core.js 运行 `node --check`。测试覆盖继承、模型和推理等级校验、批准判定、精确会话隔离、取消、过期调用、命令校验、原生模型提交和失败停止执行。

实际 GUI 验收：刷新当前页面后触发 Plan 审核，检查底部选择框；默认批准不换模型，指定模型批准后观察会话模型及首个执行请求；要求修改不换模型。缺少浏览器控制时，不把静态或注册检查说成完整视觉验收。

## 回滚

在插件管理中停用“Plan 执行模型”扩展即可恢复原卡片。原设置和插件启用状态没有被重置。停用不自动撤销用户已经批准的会话模型切换，需使用原模型选择器手动切回。
