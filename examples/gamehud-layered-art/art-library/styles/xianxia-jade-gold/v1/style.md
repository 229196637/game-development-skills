# 仙侠青玉鎏金

- 风格 ID：`xianxia-jade-gold`
- 版本：`v1`
- 定位：明亮仙侠入口美术；独立主体与公共底座；UI 美术展示不叠背景。

## 完整文字描述

以具有手绘质感的三维仙侠微缩物件为主。主体采用深青绿玉石或珐琅，暖金色用于屋檐、边框和结构转折，象牙白用于纸张、羽毛和石材。金属高光精细但不过曝，青玉表面有克制的纹理与柔和反光。左上方柔和日光统一照明，轮廓清楚，暗部偏青而非纯黑。正面视角略微看见顶面，保持入口主体便于识别的紧凑轮廓。装饰集中在主体外缘，中心语义明确，不能堆积无关物件。蓝色光效仅用于传送门；灯笼和宝箱可用小面积暖光。PNG 外部是真实透明，保留柔边，不加黑色描边，不烘焙大范围落地投影。

## 色彩、材质与视角

- 青玉：深青绿与少量浅玉绿，避免荧光绿；金边：暖古金与淡金高光，避免全黄塑料质感。
- 纸张/羽毛：象牙白，温和层次；岩石：浅灰白，细节服务轮廓。
- 统一正面略俯视；允许主体固有建筑地板或装饰框，但不带公共浮岛、横向牌匾或其它入口。
- 无文字、数字、书法和可识别字形；卷轴和牌匾空白，邮件封印为几何装饰。

## 分层约束

- 主体：单个用途、独立透明 PNG，禁止公共底座；图标现有 128×128 版本仅适用于小尺寸展示，不放大冒充高分辨率资产。
- 公共底座：浅石浮岛、扁椭圆顶面、无字深青玉牌匾、金属细框。顶面留空供主体搭配。
- 背景：可选的浅蓝云海远山，单独存放、单独查看；默认 UI 素材组合为中性纯色，不引用背景。
- 原图实际尺寸由索引记录；示例不是 FairyGUI 固定 64/128/256 尺寸交付。

## 固定提示词片段

```text
Polished painterly three-dimensional Chinese immortal fantasy. Deep teal jade enamel, antique warm gold bevels, ivory accents. Soft upper-left daylight. Front view with slight top visibility. Crisp readable contour, restrained ornament, no black outline. Genuine transparent alpha for isolated subjects and bases. No lettering, calligraphy, numbers, watermark, unrelated objects or scenic backdrop. Keep the common floating island/plaque separate from each subject.
```

## 避免

霓虹赛博风格、扁平矢量风格、纯黑硬描边、拟真摄影材质、过量光晕、写入标签、棋盘格烘焙、主体自带公共底座。固定提示词是约束，不保证一次生成满足要求，必须实际看图。

## 参考与代表资源

- [新生成的方向效果图](references/concept-v1.png)：用于整体风格与分层观察，场景背景不进入 UI 素材组合。图中商店存在残留字样，正式主体重新生成。
- 代表：`entrance-base@v1`、`shop-pavilion@v1`、`quest-scroll@v1`、`dungeon-portal@v1`、`friends-cranes@v1`、`mail-frame@v1`。
