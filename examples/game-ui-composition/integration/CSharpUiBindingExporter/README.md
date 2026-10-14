# C# UI Binding Exporter

此插件在 FairyGUI 发布结束时生成星火/WasiCore 可编译的 C# 绑定。一个 FairyGUI 包对应一个客户端 UI 模块，包内可包含多个界面、弹窗、虚拟列表项和复用组件。

## 安装和输出

插件位于项目根目录的 `FGUIProject/plugins/CSharpUiBindingExporter`。在 FairyGUI 编辑器的插件窗口启用它后，正常执行发布即可。

输出目录由 `settings/Publish.json` 的 `sceCodeGeneration.codePath` 决定。路径相对 `FGUIProject/` 解析，本项目当前为：

```text
../src/client/Mod/FGUI/Generated
```

在 FairyGUI 中启用插件并执行发布。内置 `codeGeneration.allowGenCode` 必须保持关闭，防止 FairyGUI 重写依赖 Unity Runtime 的 `UI_*.cs`；本插件读取 `sceCodeGeneration.enabled` 和包级 `publish.genCode`。生成器只管理 `.csharp-ui-binding-manifest.json` 中记录的文件，不会删除同目录的手写业务 C# 文件。

`Publish.json.path` 同样使用相对 `FGUIProject/` 的路径 `../ui/AppBundle/user_files/fgui`。不要写机器绝对路径，也不要在包级 `package.xml` 中保留旧项目的 `codePath`；包级只负责 `genCode` 开关，输出目录由全局 `sceCodeGeneration.codePath` 唯一决定。

## 生成结构

包 `Login` 中有 `loginView`、`loginListItem` 时，会生成：

```text
generated/
├── GUiConfig.cs
└── Login.cs
```

- 每个 FairyGUI 包对应根目录下一个同名 C# 文件，例如 `GameHub.cs`。
- `GameHub.cs` 使用 `GameEntry.Fgui.Generated.GameHub` 命名空间；包入口为静态类，而每个 `UI_组件名` 都是可实例化的 `FguiView`，包含稳定 URL、资源 ID 和强类型命名节点属性，不依赖 Unity 的 `FairyGUI.*` 类型。
- 包入口的 `Definition.Dependencies` 会导出组件 XML 中 `pkg="..."` 声明的跨包资源依赖，记录被引用包的稳定名称和包 ID。运行时会校验并优先按该契约加载依赖包。
- `UI_GameHub.Bind(parsedPackage)` 会校验包 ID、组件 ID 和全部生成的命名节点；二进制与生成代码不同步时会给出明确错误。
- `GUiConfig.cs` 仅记录本次发布的星火绑定入口。资源加载、解析和渲染由项目的 `FatFrame.Fgui.Runtime` 与星火适配层统一维护。

## 业务层使用

生成文件只是不可修改的“资源契约”；业务逻辑应放在同包目录的独立模块文件（例如
`GameHudModule.cs`），由星火适配层完成读取、绑定和绘制：

```csharp
FguiPackageDefinition package = FguiPackageReader.Read(
    File.ReadAllBytes("user_files/fgui/GameHub_fui.bytes"));
FguiGeneratedPackageBinding binding = UI_GameHub.Bind(package);
UI_GameHud hud = UI_GameHud.Create(binding);
FguiComponentChild title = hud.Title;
```

`Bind` 会校验包 ID、组件 ID 与全部命名直接子节点。若资源已重新发布而 C# 未重导出，
会在初始化时以缺失项名称抛出 `InvalidDataException`，而不是出现空引用或错误界面。
业务层可使用 `hud.Layout.Width`、`hud.Layout.Height`、`hud.Title` 等强类型节点属性和图集切片数据，将界面渲染到
星火 Canvas；不要引用 Unity/Godot 的 `FairyGUI.*`、`GComponent`、`CUICtrl` 或
`UIPackage` 类型。

控制器与 transition 不是组件直接子节点；当前星火运行时不会把它们混入子节点校验。
若业务需要播放动画，应在适配层显式实现对应状态/时间线，而非依赖 Unity/Godot 的
FairyGUI 播放器。

## 字体发布

字体同样属于 FGUI 发布产物，不允许由窗口代码硬编码路径或手动复制。`settings/Publish.json` 的 `sceFontExport`
声明字体源文件、运行时相对路径和默认字体；发布插件会复制字体并在 FGUI 输出目录写入
`FguiFontManifest.json`。星火运行时读取该清单并通过 `Canvas.CreateFont` 注册 TTF/OTF。

生成的 C#、FUI、图集、字体清单、文字清单和 Button 动画清单都只由 FairyGUI 发布覆盖更新。Button 动画清单会导出
Button 控制器引用的缩放 Transition，供 Canvas 适配层在一次点击内还原按下与回弹反馈。请修改 `FGUIProject` 的源资源、发布设置或本插件；
手动编辑输出目录中的文件无效，并会在下次发布时被覆盖。

## 图集同步

FairyGUI 的 `*_fui.bytes` 保持发布到 `ui/AppBundle/user_files/fgui/`，供运行时读取包描述；发布完成后，本插件会将每个包的 `*_atlas*.png` 同步到项目根目录下的 `ui/image/fgui/`。星火 Canvas 通过 `image/fgui/<Package>_atlas0.png` 加载图集，因此不可只保留 `user_files` 中的 PNG。

同步目录中的 `.fgui-atlas-export-manifest.json` 仅记录本插件曾复制的图集；下次发布时，已不再导出的受记录图集会被清理，其他项目图片不会受影响。

## 验证

运行生成器的离线测试：

```powershell
node .\unitTest\generator.test.js
```

该测试覆盖包模块拆分、稳定 URL、命名节点描述、星火运行时绑定和不依赖 Unity/Godot API 的生成结果。

离线重新生成绑定：python mytool/generate_fgui_bindings.py；加 --check 检查生成文件。此命令按发布插件契约仅生成 exported 组件，不重新发布 FUI 或图集。

## 自动实例与懒加载目录

生成 View 保留旧布局属性，并增加强类型 `*Object` 属性。普通业务窗口继承 `WindowBase<TView>`，在 `OnRefresh` 更新文字、进度、位置和状态，由运行库统一绘制 Graph/文字/图片；不实现 `Render` 或设置默认颜色。

正式发布结束生成 `FguiPackageManifest.json`：从真实 FUI 核对包名/ID并计算摘要，覆盖未生成组件绑定的资源包。运行时登记不读FUI，首次准备时用项目已有纯托管SHA256核对摘要。旧目录缺索引时保持兼容；索引损坏时明确失败。

桥接单包发布后可用 `python mytool/generate_fgui_bindings.py --publish-manifests` 同步正式清单与包目录，不拼造FUI。`UIManager.Preload`仅准备CPU包数据，不代表GPU预热。
