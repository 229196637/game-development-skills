# dsh-changes-filter

本轮改动卡片（`conversation.chat.turnTail`）的展示层过滤器：按**文件夹前缀**和**文件后缀**隐藏噪音文件，其余文件按顶层目录**分组**；默认只看过滤后的结果，随时可切回「全部」。

- 只改展示。宿主的 `workspace/changes` 快照、diff、审阅侧栏、`present` 交付卡、模型读文件的能力全部不动。
- 过滤命中不会丢数据：切到「全部」可以看到完整列表，命中行带「已过滤」标记，点开照样能审阅。
- 规则保存在 profile 目录，不依赖浏览器 localStorage（DSH Web 端口每次会变）。

## 安装与验证边界

这是独立的 DSH 插件，不是 Codex skill；源码在本仓库 `tools/dsh-changes-filter` 内维护，不走 npm 发布。运行环境要求 Node.js >= 22.13.0、宿主提供 React 18，以及原生会话与交付文件插件。

在 DSH 插件管理器中从本地目录安装，目标为当前克隆仓库下 `tools/dsh-changes-filter` 的绝对路径。安装或更新前先备份当前 profile 的插件配置和过滤规则，保留原有启用状态；不要把其他机器的 profile 或个人过滤规则提交到本仓库。安装后重载窗口加载新的客户端模块；合并代码本身不会自动修改已安装插件的链接或用户设置。

过滤卡使用与原生卡相同的槽位 `id`、不同优先级 `priority: -1`，原生卡保持默认 `0`，最低优先级生效。原生插件和其子槽声明仍保留，过滤插件卸载后由原生卡接替。没有修改 DSH 发行代码。

注册、卸载回退与图标行为已做离线契约测试；**这不等于 Cordis Loader、React DOM 或 Desktop/Web 的端到端启动验证，也不宣称已解释历史启动故障的完整原因**。

## 文件类型图标

文件行与交付文件行前显示内置 16px SVG 图标，不增加依赖或外部网络请求。C#、JavaScript（含 `.mjs` / `.cjs`）、TypeScript、JSX / TSX、Lua、Python、JSON、Markdown、样式、Shader、Unity 资源和常见图片等按后缀区分；`package.json`、包管理锁文件、Git 配置、Dockerfile 按文件名识别。路径识别兼容 Windows 分隔符及大写后缀，未知类型回退为通用文件图标。

图标不改变过滤、分组、隐藏标签、行点击审阅或交付文件预览行为；小图标不参与键盘焦点和屏幕阅读器重复朗读。客户端是直接加载的浏览器模块，无编译步骤；已打开页面需要刷新以加载更新，未承诺自动热更新。

验证：`node --test test/*.test.mjs`（包含图标及超限文件回归）；这是模块/组件契约测试，不是实际 GUI 的浏览器端到端验收。

## 大文件与历史差异

当原生 summary 标记 `oversized: true` 时，文件行显示「差异不可用」及原因，不再作为历史差异按钮。存在文件预览能力时，单独提供「查看当前文件」，明确它不是本轮修改前后的对比；没有预览能力时只显示说明，不提供无效按钮。普通文件仍按 summary 原始索引打开原生审阅，过滤和分组不会重排审阅索引。

宿主 `workspace-changes` 默认 `maxFileBytes` 为 2 MiB。需要提高后续采集上限时，可在当前 profile 的 `cordis.patch.yml` 中覆盖现有行（不要重复插入新插件，也不要改其开关）：

```yaml
- id: workspace-changes
  config:
    maxFileBytes: 8388608 # 8 MiB
```

修改前备份 profile；如已有该行配置，要保留并合并其他键，因为 Loader patch 会整体替换该行的 `config`。重启宿主后对新采集生效；重启会清除宿主内存中的旧差异记录。这个配置是用户级选择，安装本过滤插件不会自动更改宿主上限。

对工作区外等通过文件工具采集的超限文件，宿主可能只保留拒绝标记，没有保存完整历史版本；调高上限或刷新不能补回未采集的内容。Git 快照则可能保留完整 blob，但在请求 diff 时才超限，summary 不一定有 `oversized` 标记，此时原生审阅仍可能显示其超限提示；本插件不伪造历史内容，也不预取每个文件的完整 diff。提高上限也不保证绕过二进制、diff 超时等其他边界。

## 配置

卡片右上角 ⚙ 打开规则面板，两个文本域，每行一条：

| 字段 | 语义 | 示例 |
| --- | --- | --- |
| 文件夹 | 路径前缀，按**目录段**匹配（`docs` 命中 `docs/a.md`，不命中 `docs2/a.md`） | `docs`、`res/Atlas` |
| 后缀 | 文件名结尾匹配 | `.meta`、`.png` |

保存后立即生效，无需刷新。规则存储位置：

```
%DSH_PROFILE_DIR%/changes-filter.json           # 设置了 DSH_PROFILE_DIR 时
~/.dsh/profiles/<DSH_PROFILE 或 desktop>/changes-filter.json
```

格式与可直接手改：

```json
{ "dirs": ["docs", "res/atlas"], "exts": [".meta"] }
```

规范化在两端各做一次（`lib/rules.js` 与 `client.js`）：去前言 `./`、反斜杠转 `/`、转小写、去重、排序，文件夹上限 200 条、每条 200 字符。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | 宿主半：`webServer` 上提供 `GET/HEAD/PUT /dsh-changes-filter/rules.json`；先调用 `connection.requestRejection(request)` 检查 Host、Origin 和浏览器鉴权，再读写规则；原子写盘，body 上限 16 KiB |
| `lib/rules.js` | 纯函数：`normalizeRules` / `relPath` / `isExternal` / `isHidden` / `groupFiles` |
| `client.js` | 浏览器半：以原生同 id、不同优先级注册卡片、抓 `api/changes.summary`、分组渲染、内联规则面板 |
| `cordis.patch.yml` | Loader 行 `changes-filter`（行 id 与包名不同，避免插件卡重复显示） |
| `locale/*.json` | 插件显示元数据（`meta.title` / `meta.description`，供插件管理与设置页读取）；运行时文案字典内联在 `client.js`，注册到 `dsh-changes-filter` 命名空间 |
| `test/filter.test.mjs`、`test/client.test.mjs` | 原有规则与客户端纯函数测试；不代表插件启动测试 |
| `test/icons.test.mjs` | 图标映射、路径大小写与分隔符、SVG 属性、文件行与交付行的图标及点击行为 |
| `test/oversized.test.mjs` | 超限说明、独立当前文件预览、普通文件审阅索引、分组/过滤/全部视图和缺失预览能力 |
| `test/startup.test.mjs` | 执行真实客户端 `apply(ctx)`，在严格的 Service 契约测试桩中验证注册顺序、延迟声明、覆盖、卸载回退与重新声明；移除优先级的负对照必须复现冲突 |
| `test/host.test.mjs` | 执行真实宿主 `apply(ctx)` 和路由 handler，在临时 profile 中验证鉴权委托、拒绝早于请求体读取、合法规则保存和路由清理 |

## 测试

```
node --test test/*.test.mjs
```

当前离线运行结果：47 项测试通过，0 失败（包含宿主父测试及其子测试）。测试桩依据已安装版本的槽位契约建模，**不是 Cordis Loader、React 渲染或 Desktop/Web 启动的端到端测试**。宿主测试控制 Connection 返回的鉴权结论，只验证本插件正确委托和处理结论，不替代 Connection 自身的凭据校验测试。

如果受限沙箱下测试运行器 spawn 子进程报 `EPERM`，可逐文件执行 `node test/<文件名>.test.mjs`（`node:test` 会就地执行）。

## 已知边界

- 卡片依赖原生插件贡献的 turn 数据（`deliverables.changes` / `presented`）。原生插件被禁用时本卡不渲染任何内容。
- 分组的「文件夹」取路径首段；工作区外的绝对路径归入「外部路径」，根目录文件归入「根目录」。
- 规则只作用于这张卡片，不影响 `present` 交付区、审阅侧栏和 diff 视图。
- 原生卡片受「开发者工具」开关（`configForms.developerTools`）控制；本卡不读该开关，装了就一直显示改动列表。这是有意的：过滤展示是本插件的唯一目的。
- 交付文件区是简化版（文件名 + 预览），本卡未复刻原生文件打开控制器及「在文件夹中显示」等 per-file 动作，也没有渲染原生 `deliverables.file.actions` 子槽。保留原生插件和子槽声明不等于本卡具备原生卡片的全部交互；这些差异尚未做浏览器验收。
