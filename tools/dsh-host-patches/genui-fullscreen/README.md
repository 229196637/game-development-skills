# GenUI 内容块：展开查看卡片

在现有 `@changfenhuang/dsh-genui@0.15.0` 内容块右上角增加「展开查看」。用户已明确纠正：要参考「游戏工单」的**居中弹出卡片**，不是铺满窗口的全屏模式。本目录及内部 class/补丁边界沿用最初命名以便精确升级和回滚，界面不再出现「全屏查看」。不另建插件，不改用户配置或插件启用状态。

## 用户体验

- 点击「展开查看」，居中弹出有圆角、边框和背景遮罩的阅读卡片，四周仍能看到原页面；桌面最大宽 1360px，左右至少留 32px、上下至少留 40px；窄屏四周至少留 16px。
- 短内容按内容高度收缩，长内容在卡片内滚动，顶部标题及「关闭」按钮保持可见。表格长文本/链接自动换行；具有固有尺寸的内容保留自身滚动。
- 点击「关闭」、按 Esc 或点击卡片外遮罩返回。保留排序、筛选、展开项和未提交输入；不复制内容、不移动 DOM、不重新挂载原内容树、不发送交互消息。
- native dialog top layer 避开聊天列祖先的 overflow/transform 限制，背景不可交互；支持深浅色、窄屏和图库内嵌 dialog。

## 补丁范围和安全边界

`fullscreen.cjs` 为可维护 React 包装组件，`fullscreen.css` 只作用于包装层。`patch.cjs` 在原 `ExportableGenuiBlock` 函数之后插入包装，保留原函数全文及其他 bundle 字节。

原始 bundle SHA-256：

`a95daf319acba1bda03cfc5a1740e0076004270b371783666fcc6ee482daa44e`

另外只允许从已知首版全屏补丁指纹升级到卡片：

`19bd8e0d47313fb4ea0b55cc9c3dea7b47d20e933db71da9cde738a1f4dc4d84`

未知版本、字节变化、锚点不唯一、不完整/被改动的补丁均拒绝写入；当前版本幂等。安装前检查 UTF-8 和生成代码语法，原子替换单个已构建客户端 bundle。**不要重新构建整个已安装插件**：该 profile 可能已有字体、Mermaid 等其他热补丁。

本目录的 React/esbuild/Playwright 仅用于开发回归，不注入宿主，也不启动替代应用服务器。安装组件使用宿主 bundle 现有 React namespace。

## 安装和回滚

从本目录执行，按实际环境替换 profile 和备份根路径：

```powershell
node patch.cjs --profile 'C:\Users\22919\.dsh\profiles\desktop' --backup-root 'C:\Users\22919\.dsh\backups'
```

安装前创建独立时间戳备份，包含升级前客户端、收据和存在的关键配置文件。配置仅备份及 hash 比对，不写回。重复安装幂等返回。

回滚使用安装命令返回的完整备份路径。本机卡片版升级的回滚命令（恢复升级前全屏版，仅用于维护）：

```powershell
node patch.cjs --restore 'C:\Users\22919\.dsh\backups\genui-fullscreen-2026-11-07T10-19-48-829Z-24144'
```

回滚同样核对当前及备份 bundle，**只恢复客户端，不把备份配置覆盖用户的新设置**。最早未加包装的原始客户端另保存在备份 `genui-fullscreen-2026-11-07T10-04-25-890Z-26072`。插件更新可能覆盖补丁；遇到新指纹需重新审查，不强行套用。

## 回归验证

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm test
node live.test.cjs
```

- `patch.test.cjs`：原始指纹、精确锚点、语法、非法 UTF-8、篡改拒绝、幂等、隔离 profile 安装/备份/配置保留/回滚；有已核对 legacy fixture 时验证已部署首版→卡片升级与升级回滚。fixture 只放 `.agent-tmp`，不入 Git。
- `browser.test.cjs`：系统 Edge 无头浏览器执行真实客户端 bundle 的原始 GenUI 渲染器，只用测试适配器替代插件宿主和无关代码块组件；验证非模态内联可输入、居中卡片越过窄聊天容器、900×650 / 390×844 / 1720×1021 的留边与最大宽度、短内容自适应高度、内部滚动与固定关闭栏、深浅色、长链接换行、节点身份不变、排序筛选及草稿保留、背景 inert、Esc/按钮/遮罩关闭、焦点恢复、内嵌图库、嵌套锁与整棵卸载。
- `live.test.cjs`：读取当前 GUI 插件 graph 和真实 combo URL，确认新 revision、与磁盘 bundle 一致、确有「展开查看」和有界卡片 CSS；排除原始版和全屏版 revision。无需凭据，不读个人配置。

环境变量：`DSH_GENUI_CLIENT`（实际客户端）、`DSH_TEST_WORKSPACE`（安装器测试工作区）、`DSH_TEST_OUTPUT`（截图/报告目录）、`DSH_PATCH_BROWSER_CHANNEL`（默认 msedge）、`DSH_GUI_URL`（默认 http://127.0.0.1:61638/）。截图、报告、隔离 profile 都写工作区 `.agent-tmp/20261107-genui-fullscreen/`，卡片截图放 `reports-card-v2/`，不作为正式交付。

## 本机部署核对（2026-11-07，卡片修订）

- bundle SHA-256：`32dad9a229de0c00b7fa33ae9dfe5cde66b2ee86390352a12ca3afe273ed9c5f`。
- GUI graph revision：`0e3d185a8990`；前一全屏版 `ba3ffb770e9a`，未加补丁版 `3c1a3069479d`。真实插件响应 200、字节匹配、卡片文案与尺寸均已核对。
- 安装器/实际 renderer 浏览器回归通过，配置 hash 未改变；已检查宽屏和短内容截图。测试曾发现 fixed + inset:0 + height:auto 会撑高，已修正为 height:fit-content；短内容保持原渲染器间距，测试确认不会铺满屏幕。
- 没有可附加用户当前已认证标签页的 CDP endpoint，不冒充已在用户那个标签页完成点击验收。请刷新原界面查看新按钮；无须重启或另起服务器。缓存仍旧可 Ctrl+Shift+R。
