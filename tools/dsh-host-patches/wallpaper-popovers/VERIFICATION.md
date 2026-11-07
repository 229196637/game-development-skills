# 验证记录（2026-11-07）

- Node 测试：5/5 通过（3 个源码/门控测试、1 个真实 Edge 样式回归、1 个隔离安装器回归）。
- 浏览器组合：浅/深主题 × 旧青色/当前灰色 tint × 黑/白背景；每组合检查专家菜单、Token 用量 dialog、Tooltip、menu 共 32 个浮层读数。正文及次级说明对实际计算背景的对比度均 ≥4.5:1；额外断言专家行 hover 对比度 ≥4.5:1。
- 真实样式输入：原玻璃 bundle、当前官方 ui-theme 和 ui-chat/stat-dialog CSS、实际 @michengai/dsh-agency-agents 菜单 CSS。测试使用隔离 Edge 页，不启动服务器、不访问登录态、不操作用户会话。
- 豁免：原生设置窗标记与已有表面载体的背景保持；浮层外青色字体保持；关闭 solid-base 或 glass-page 门控时所有新增规则退出。
- 安装器：复制到显式临时目录的 fixture 上完成 CheckOnly 不写入、安装、幂等、同目标锁阻止 install/install 与 install/rollback 竞争、外部编辑拒绝回滚、回滚恢复原字节和配置保持。修复了 Windows PowerShell 对 File.Replace 空备份参数的兼容问题；现在保存唯一恢复文件，不传空路径。
- bundle 注入前后的 JavaScript 语法检查通过。
- 实际部署：仅更新本机 glass 客户端文件，保存了原文件与当前配置/组合快照；部署前后 6 个配置文件 SHA256 完全一致。没有切换插件开关、重启 DSH、改写官方 app.asar 或其他插件。
- 原 bundle SHA256：`d80bcad7d4b02a47dd421c94124e502eb223bdcd15156aec39175de3b3b77fc0`。
- 修复 bundle SHA256：`405e01b7acddf2fe8bc973d78b4cd14de70f408ab3bb10dbceb35c715eefb0db`。

独立只读审查指出安装器初稿缺少同目标互斥；交付版加入贯穿哈希读取到替换后验证的独占锁、唯一不可覆盖暂存文件，并用竞争回归验证。实际 GUI 尚未重启或取得运行时 DOM，因此不声称截图中的具体亮青色来源已经完全归因，也不声称当前窗口已加载或完成真实 E2E。需用户方便时重新打开 DSH，确认专家与 Token 浮层实际效果；无 ARIA/稳定类的其他第三方浮层仍需单独登记。
