# PROMESST 2 · 大地图复刻(map/)

纯 HTML + JS + 原素材复刻的《PROMESST 2》完整两层大地图,**不含游玩逻辑**,仅渲染地图。

## 文件

| 文件 | 说明 |
|---|---|
| `index.html` | 地图浏览器:单文件应用(所有解析/渲染逻辑内联)。 |
| `map-data.js` | 关卡原文数据,**自动提取**自 `promesst2_source_code/main.c` 的 `rawmap[24][2]`(L233–262),勿手改。 |
| `sprites.png` | 原素材拷贝(来自 `data2/sprites.png`,128×128 精灵表)。 |
| `README.md` | 本说明。 |

## 运行

需要本地静态服务器(Canvas 读取精灵像素 + 文件加载,`file://` 直开可能受限):

```bash
# 项目根目录起服务后访问 /map/
python -m http.server 3000     # → http://localhost:3000/map/
# 或用 VSCode Live Server 打开 map/index.html
```

## 功能

- **层切换**:Z0(地面)/ Z1(下层),两层都是完整 24×24(4×4 房间 × 6×6)。
- **光束(默认开)**:按游戏规则还原——房间“有底座且底座全被宝石占满”才通电(`compute_powered()`);光束受门/物体阻挡、反射镜 `dir^=1/^=3` 折转、世界卷绕(`propagate_light()`)。
- **房间调色**:按 `get_map_color()` 从精灵表取样每房间底色,瓦片用 multiply 调色,与引擎 `glColor` 乘法一致;墙随房间奇偶换 sprite(同 `draw_world`)。
- **房间网格 / 标注 / 放大(1–4×)/ 下载 PNG**。
- 鼠标悬停任意格显示:层、格坐标、房间号、瓦片/物体解析结果。

## 与源码的对应

| 复刻点 | main.c 出处 |
|---|---|
| 关卡解析(含房间间空格跳过) | `init_game()` L299–391 |
| 蛋区铺瓦、rover 初向 | L373–390 |
| 房间供电 | `compute_powered()` L475–491 |
| 光束传播 | `propagate_light()` L496–531 |
| 精灵索引表 | `tile_sprite[]` L142 / `obj_sprite[]` L173 |
| 投影器字母→色/向 | `lights[]`/`lightdata[]` L278–288 |
| 房间底色取样 | `get_map_color()` L91–99 |
| 墙边高光 | `draw_world()` L1921–1931 |
