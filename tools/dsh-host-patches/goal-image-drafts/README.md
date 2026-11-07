# 目标动作与图片草稿修复

## 功能和边界

这是官方 `@deepseek-ai/dsh-client-ui-goal` 和 `@deepseek-ai/dsh-client-ui-conversation` 的可重复补丁，不是独立 DSH 插件或 skill。上游源码来自 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，官方包声明 MIT 许可；目标模块、版本、输入/输出指纹保存在 [provenance.json](provenance.json)。本仓只维护补丁逻辑，不分发完整官方源码或打包应用。

- [goal.cjs](goal.cjs)：目标动作 RPC 抛出时展示错误并在 `finally` 释放 pending，允许重试；为 blocked 目标显示恢复入口。恢复仍调用原生 resume，不附加第二条“继续”消息。原版已存在 resume → goal/changed → round driver → 同会话 followup 链路，最初不续聊现场的唯一原因未完全证实。
- [conversation.cjs](conversation.cjs)：ConversationController 持有按会话隔离的草稿附件，输入框销毁不再释放仍属于草稿的 File；IndexedDB 持久化实际 File/Blob 字节和顺序，刷新时恢复。异步上传回写所属会话，冷启动文件重新上传以取得有效宿主回执；读写失败展示通知并保留内存草稿。
- [prepare.cjs](prepare.cjs)：仅从精确匹配的原始 ASAR 提取必要 fixtures，应用唯一锚点变换，核对补丁字节指纹，可选生成新包；绝不写回输入应用、修改设置、启动或关闭宿主。

## 构建

需要 Node.js >= 24.9。工作目录是本目录。原始应用由使用者自己提供，不纳入仓库；若应用已经安装补丁，需使用安装前的原始备份，不要把已修复的包当作基线。

```powershell
node prepare.cjs --archive 'C:\path\to\original\app.asar' --build-archive
```

默认输出到被 Git 忽略的 `.artifacts`，自定义输出目录也会生成忽略全部内容的 `.gitignore`，避免原始模块和含本机路径的 manifest 被默认提交。输出目录已存在时拒绝覆盖；需要重建时用 `--output-dir <新的目录>`，并在测试时通过 `DSH_PATCH_FIXTURES` 指向该目录。归档、模块、转换后模块及最终补丁包都进行 SHA256 核对；版本不匹配时停止，不能静默套用到不同构建。修改补丁算法必须重新审查、测试并显式更新 `provenance.json` 的预期指纹，而不是让工具自动“认可”新的输出。

## 回归

维护工具和合成 ASAR 测试无需提供真实宿主：

```powershell
npm run test:tooling
```

准备 fixtures 后执行全部非浏览器测试：

```powershell
npm test
```

浏览器回归使用真实 Chromium IndexedDB，需安装测试依赖和浏览器：

```powershell
npm install --ignore-scripts
npx playwright install chromium
npm run test:browser
```

已装 Edge 的 Windows 也可使用 `$env:DSH_PATCH_BROWSER_CHANNEL='msedge'` 后执行浏览器测试；默认不指定浏览器渠道。非默认工作目录使用 `$env:DSH_PATCH_FIXTURES='C:\path\to\new-artifacts'`。缺 fixtures、指纹错误、缺浏览器或依赖都会明确失败，不把未执行伪装成通过。

测试执行从官方模块提取的生产 Controller、InputHub、恢复方法和目标轮次驱动；Session/编辑器边界是隔离适配器，不等同于正在使用的完整 DSH GUI E2E。具体运行证据和缺口见 [VERIFICATION.md](VERIFICATION.md)。

## 安装与回滚

先保存当前草稿、等其他会话工作完成，再由用户完全退出 DSH NEXT（包括托盘）。旧版已经丢失的图片无法由补丁找回。准备新包不会自动安装。

```powershell
# 仅校验，不写入；应用运行时也可执行。
.\apply-fix.ps1 -InstallDirectory 'C:\path\to\DSH NEXT' -CheckOnly
# 完全退出后安装；成功后重新打开应用。
.\apply-fix.ps1 -InstallDirectory 'C:\path\to\DSH NEXT'
# 完全退出后回滚。
.\apply-fix.ps1 -InstallDirectory 'C:\path\to\DSH NEXT' -Rollback
```

非默认输出另传 `-WorkDirectory 'C:\path\to\new-artifacts'`。脚本拒绝运行中的应用、不同版本和已有的临时替换文件；备份原始 ASAR，核对路径及哈希后执行原子替换，再次核对结果。不会强杀进程，不修改 profile、插件开关、凭据、会话或 `app.asar.unpacked`。回滚依赖工作目录的 `backup/app.original.asar`，须保留整个工作目录，不能只拷贝入口脚本。

## 安装后验收和限制

1. 会话 A 粘贴两张图，不发送；切到 B 再回 A，确认原图和顺序。
2. 等保存后刷新，确认图片可恢复；删除后刷新确认不复活；发送后确认历史图可打开。
3. 恢复暂停目标，不另发“继续”，确认当前会话开始执行；未开始时保留目标栏错误和复现时间进一步归因。

IndexedDB 按浏览器 origin 隔离，端口/域名变更或清除站点数据不保证恢复；事务提交前突然退出不保证落盘。存储错误后内存导航仍可保留，但不能宣称磁盘已保存。不增加存储配额或自动垃圾回收策略。“发送后立刻切会话”的真实 admission 集成、当前完整 GUI 以及退出后的安装/回滚仍需要实际验收，不能以模拟测试替代。宿主升级可能覆盖补丁；长期修复应合入上游正式版本。
