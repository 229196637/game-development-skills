# 壁纸引擎浮层可读性补丁

这是第三方 `dsh-plugin-wallpaper-engine-glass@1.4.2` 的本地兼容补丁，不是原插件源码镜像，也不是需要新增启用开关的插件。上游和精确 bundle 指纹见 [provenance.json](provenance.json)。维护的是 [CSS 源码](popovers.css)、[注入器](patch.cjs)、安装器及测试，不提交完整 bundle 或用户配置。

## 已确认的问题与边界

专家发现菜单 `.aag-menu.aag-discovery` 直接读取 `--dsw-alias-bg-layer-2`，但既有玻璃包的浮层豁免没有覆盖这个无 ARIA 的稳定类。原生 Token 用量统计面板带 `role=dialog`，读取 `--dsw-specific-menu`；既有实底规则虽覆盖该 role，底色仍依赖可自定义的 `--we-readability-base`。此外，说明文字直接读取字体集 tertiary/caption，可能与浅青背景几乎融为一体。

这些证据证明浮层缺乏独立、成对的可读性保护；没有读取到用户当前窗口的计算样式，不能把截图中的亮青色准确归因于某次设置操作、缓存或某条运行时声明。磁盘与当前 host settings 路由返回的全局玻璃色已经是灰色，不能继续以“全局仍配置青色”解释问题。

## 修复策略

仅在玻璃页和“第三方弹窗不透明底”两道既有门控同时开启时，为专家菜单、上下文提示，以及语义化 menu/listbox/dialog/alertdialog/tooltip 浮层配置局部背景、正文、次级说明、输入底色和悬停底色。深色浮层使用 `#202630` 系列，浅色浮层使用 `#f3f6f8` 系列；Tooltip 保持深底浅字，兼容宿主固定白字。普通菜单/提示不再使用全局任意染色作为实底。

不改用户配置文件或字体集，不重置启用状态，不修改全局壁纸、玻璃透明度、语义状态色、布局、圆角或层级。宿主设置窗的 `data-we-host-dialog` 与已认领的 `data-we-surface-runtime` 载体保持豁免。没有稳定类或 ARIA 的其他第三方浮层不承诺自动覆盖；不要继续扩展任意 class 子串匹配。

## 构建与安装（PowerShell）

先退出任何并行更新该插件的操作。输入必须是未打此补丁的已核实 bundle；升级版或其他本地修改会拒绝，不覆盖。

```powershell
node patch.cjs '<profile>/node_modules/dsh-plugin-wallpaper-engine-glass/lib/client.glass.js' '<new-output-directory>'
node --check '<new-output-directory>/client.glass.js'
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -ProfileDirectory '<profile>' -ArtifactsDirectory '<new-output-directory>' -BackupDirectory '<new-private-backup-directory>' -CheckOnly
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -ProfileDirectory '<profile>' -ArtifactsDirectory '<new-output-directory>' -BackupDirectory '<new-private-backup-directory>'
```

构建目录自动写入忽略所有文件的 `.gitignore`。安装器校验原始/输出 SHA256，先备份原 bundle、当前 profile composition 文件及当前用户的壁纸配置/默认字体集，再以独占目标锁、唯一且不可覆盖的暂存文件、原子目录项替换提交，避免原地改写共享包缓存硬链接。替换前内容另存恢复文件。CheckOnly 不写文件。不同目标可独立操作；同目标安装/回滚拒绝并发。崩溃遗留的 `.popover-fix.lock` 必须人工检查，不能盲删。

**安装只更新磁盘模块，不会停止进程、重启应用或触碰插件开关。Host 可能缓存客户端模块，需要方便时重新启动 DSH 才能可靠加载。不能仅凭写入成功声称当前窗口已生效，也不保证单次刷新足够。**

回滚复用同一命令和原备份目录，添加 `-Rollback`。只恢复 bundle，不回写配置，避免覆盖用户安装后的设置变更。安装/回滚要求没有其他非本安装器的编辑器或包管理器同时改动目标；哈希复核不能为外部任意写入提供系统级 CAS。

## 验证

```powershell
npm test
npm install --ignore-scripts
$env:DSH_PATCH_PROFILE = '<unpatched-profile-or-fixture>'
$env:DSH_PATCH_APP_ASAR = '<DSH NEXT resources/app.asar>'
# 若真实 profile 已安装补丁，用原始备份作为只读 fixture：
$env:DSH_PATCH_GLASS_CLIENT = '<private-backup-directory>/client.glass.original.js'
$env:DSH_PATCH_BROWSER_CHANNEL = 'msedge'
$env:DSH_PATCH_SCREENSHOTS = '<workspace>/.agent-tmp/<task>/previews'
$env:DSH_PATCH_TEST_DIR = '<workspace>/.agent-tmp/<task>'
npm run test:browser
npm run test:installer
```

浏览器验证读取真实生产 CSS，在隔离的 Edge 页面组合真实统计面板样式及专家菜单样式。覆盖深浅主题、旧青色/当前灰色 tint、黑白背景、说明与计数文字、悬停、关闭门控、宿主载体豁免及浮层外自定义字体保留。它不是当前登录 GUI 的 E2E。安装器测试在显式临时目录内复制原 bundle，测试 dry-run、安装、重复执行、同目标锁竞争、外部编辑拒绝回滚、恢复原文件及配置保持；不修改真实 profile。

升级插件会覆盖补丁，需要先检查上游修复与新版兼容，不得跳过指纹。缺少外部原始 fixtures、浏览器或依赖时测试应明确失败，不虚报通过。
