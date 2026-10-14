# 验证记录

验证日期：2026-10-14。只验证技能、资源工具、美术文件与展示；没有修改或构建游戏运行代码。

## 资源与风格

| 资源 | 原始尺寸 | 来源 | 视觉结果 |
| --- | --- | --- | --- |
| entrance-base@v1 | 1254×1254 | 内置生图 | 空顶面、无字牌匾、完整浮岛，独立透明层 |
| shop-pavilion@v1 | 1254×1254 | 内置生图 | 无字商店主体、建筑地板属于主体，无公共浮岛 |
| quest-scroll@v1 | 128×128 | 当前工程复用 | 空白卷轴，透明主体 |
| dungeon-portal@v1 | 128×128 | 当前工程复用 | 蓝色传送门，透明主体 |
| friends-cranes@v1 | 128×128 | 当前工程复用 | 双鹤与装饰盘，透明主体 |
| mail-frame@v1 | 1254×1254 | 内置生图 | 几何封印，无字，无公共浮岛 |
| cloudscape@v1 | 1920×1080 | 当前工程复用 | 干净场景，独立展示，不参与 UI 素材组合 |

实际查看了所有资源、方向效果图和最终组合截图。主体材质、金边与视角总体匹配文字风格；三个已有小图与新图细节精度不同，限制在小尺寸搭配使用。方向效果图为 1672×941 且商店残留字符，仅作分析参考，不作为无字正式素材。

生图提示请求 1024×1024，但工具实际输出 1254×1254；原图未裁切、缩放或改像素。示例按实测值登记，没有宣称满足 FairyGUI 固定图标尺寸。低 alpha 细微像素可到达画布边缘，较实 alpha 的主体边界在画布内部，查看完整轮廓未见截断。六个透明层均有透明与可见像素；文件 SHA256 可复核。

## 资源工具验证

```powershell
python -X utf8 game-layered-art/scripts/art_tool.py check --root examples/gamehud-layered-art/art-library
python -X utf8 game-layered-art/scripts/art_tool.py find --root examples/gamehud-layered-art/art-library --style xianxia-jade-gold --tag entrance
python -X utf8 game-layered-art/scripts/art_tool.py get --root examples/gamehud-layered-art/art-library --id entrance-base --version v1
```

索引检查通过：1 套风格、7 个资源、5 个组合，无错误。对隔离复制库完成 9 组验证：移动库后相对引用有效；精确风格/标签与版本检索；重复登记和初始化不覆盖；拒绝越界路径；拒绝无透明或全透明图；拒绝缺失风格；检测缺失提示词和组合引用；新增有效素材登记后字节一致且检查通过。无效输入检查索引和原图未变。测试脚本与临时辅助代码不随仓库分发。

## 文档与渲染

- 六个技能的 SKILL.md 均有流程图；检查范围中的 14 张 Mermaid 图实际渲染成功。
- 新技能通过 skill-creator 的格式验证。Windows 默认编码会误读中文，验证使用 `python -X utf8`。
- 新增及相关入口的相对文件链接已核对。
- Edge 无界面渲染预览：18 张图片全部成功加载，无页面错误；390px 宽预览无横向溢出。
- 组合使用同一底座文件，背景只在独立区域；查看截图确认五个主体与底座分离且可搭配。

[中性底色组合截图](art-library/productions/gamehud-v1/previews/combinations.png) · [素材总览截图](art-library/productions/gamehud-v1/previews/assets-overview.png) · [预览首屏截图](art-library/productions/gamehud-v1/previews/art-overview.png)
