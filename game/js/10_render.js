"use strict";
/* PROMESST 2 网页版移植  10_render.js
   世界渲染、结局动画与画面输出
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 结局/蜥蜴化/气泡(YOU WIN 等世界内文字用原版内置字体) ----------
/**
 * 功能:绘制 rover 彩虹/气泡、闪白和 YOU WIN 结局文字。
 * @param {*} g
 * @param {*} k
 */
function drawEndingOverlay(g, k) {
  // 实现:先画 rover 彩虹与气泡,再按 egg_timer 阶段绘制结局画面。
  const z = game.pz,
    K = CELL * k;
  let rover = null,
    y,
    x;
  for (y = 0; y < WH && !rover; y++)
    for (x = 0; x < WW; x++)
      if (world.obj[z][y][x].type === O.rover) {
        rover = {x: x, y: y};
        break;
      }

  // 被喂饱的 rover“蜥蜴化”:彩虹光环(近似原版 L2035–2069)
  if (rover && game.egg_timer > 0) {
    const pulse = (Math.sin(animcycle / 120) + 1) / 2;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.3 + 0.35 * pulse;
    g.fillStyle = "hsl(" + ((animcycle / 8) % 360) + ",85%,60%)";
    g.fillRect(rover.x * K - K * 0.3, rover.y * K - K * 0.3, K * 1.6, K * 1.6);
    g.restore();
  }
  // 气泡文字:照原版 L2144–2191(仅当 rover 在 z0 的 (2,3) 房间且已开始喂食)
  if (
    rover &&
    z === 0 &&
    ((rover.x / SX) | 0) === 2 &&
    ((rover.y / SY) | 0) === 3 &&
    game.gems_stored >= 0
  ) {
    let text = null;
    if (game.gems_stored === 0) {
      if (animcycle % 15000 < 2000) text = "?";
    } else if (game.egg_timer >= 8000) text = "WELL NOW";
    else if (animcycle % 45000 < 2000 || feed_timer > 0) {
      const left = MAX_GEMS - game.gems_stored;
      if (game.gems_stored >= 1 && game.gems_stored <= 12) text = "NEED MORE";
      else if (game.gems_stored % 7 === 3) text = left + " TO GO";
      else text = left + " MORE";
    }
    if (text) {
      const size = Math.max(0.9, k * 0.55);
      const w = bmpTextWidth(size, text, 1);
      g.save();
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(
        rover.x * K + K / 2 - w / 2 - 3,
        rover.y * K - size * 10 - 3,
        w + 6,
        size * 9 + 6,
      );
      g.fillStyle = "#ffffff";
      drawBmpText(
        g,
        rover.x * K + K / 2 - w / 2,
        rover.y * K - size * 10,
        size,
        text,
        1,
      );
      g.restore();
    }
  }
  // 结局三阶段(照原版 L2382–2417)
  if (game.egg_timer > 8000) {
    let a = (game.egg_timer - 8000) >> 4; // 原版:比 >>4
    const pv = powers[5]; // COLOR_violet
    let r = pv[0],
      gg = pv[1],
      b = pv[2];
    if (a >= 128) {
      r = Math.min(255, r + a - 128);
      gg = Math.min(255, gg + a - 128);
      b = Math.min(255, b + a - 128);
    }
    if (a > 255) a = 255;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = Math.min(1, a / 255);
    g.fillStyle = "rgb(" + r + "," + gg + "," + b + ")";
    g.fillRect(0, 0, cv.width, cv.height);
    g.restore();

    if (game.egg_timer > 14000) {
      g.save();
      g.fillStyle = "rgba(0,0,0,0.78)";
      g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = "#ffffff";
      const big = Math.max(2, k * 2.2);
      const t1 = "YOU WIN";
      drawBmpText(
        g,
        (cv.width - bmpTextWidth(big, t1, 1)) / 2,
        (cv.height - big * 7) / 2 - 10,
        big,
        t1,
        1,
      );
      if (game.egg_timer > 17000) {
        const a2 = Math.min(1, (game.egg_timer - 17000) / 2000);
        const t2 = "USED " + game.num_zaps + " ZAPS";
        const s2 = Math.max(1.2, k * 1.0);
        g.fillStyle = "rgba(255,190,255," + a2 + ")";
        drawBmpText(
          g,
          (cv.width - bmpTextWidth(s2, t2, 1)) / 2,
          (cv.height + big * 10) / 2,
          s2,
          t2,
          1,
        );
      }
      g.restore();
    }
    if (game.egg_timer > 22000) enterResult();
  }
}

// ---------- 渲染 ----------
const cv = document.getElementById("cv");
// 游戏主画布的 2D 上下文。
const ctx = cv.getContext("2d");
// 手动缩放倍率;autoFit/follow/showGrid 为适配/跟随/网格开关。
let zoomK = 2,
  autoFit = true,
  follow = true,
  showGrid = false;
// 未缩放的单屏逻辑尺寸。
const canvasSize = 384;

/**
 * 功能:返回当前每格像素大小。
 */
function kPx() {
  return CELL * zoomK;
}

/**
 * 功能:绘制当前整幅画面:地图、物体、光束、网格、玩家、结局层和 HUD。
 */
function render() {
  // 实现:依次绘制地图瓦片、物体、光束、网格、玩家、结局层和 HUD。
  if (!world || !img) return;
  const z = game.pz,
    k = zoomK,
    K = kPx();
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;

  let y, x, i;
  for (y = 0; y < WH; y++)
    for (x = 0; x < WW; x++) {
      const t = world.tile[z][y][x];
      const rx = (x / SX) | 0,
        ry = (y / SY) | 0;
      let sp = TILE_SPR[t];
      if (t === T.wall && (rx ^ ry) & 1) sp = [7, 0];
      ctx.drawImage(cellFrom(sp[0], sp[1]), x * K, y * K, K, K);
      if (t >= T.floor) {
        const chk = [
          [x + 1, y, 1, 0],
          [x - 1, y, 3, 0],
          [x, y + 1, 4, 0],
          [x, y - 1, 2, 0],
        ];
        for (i = 0; i < 4; i++) {
          const mx = ((chk[i][0] % WW) + WW) % WW,
            my = ((chk[i][1] % WH) + WH) % WH;
          if (world.tile[z][my][mx] === T.wall)
            ctx.drawImage(cellFrom(chk[i][2], chk[i][3]), x * K, y * K, K, K);
        }
      }
    }
  for (y = 0; y < WH; y++)
    for (x = 0; x < WW; x++) {
      const o = world.obj[z][y][x];
      if (o.type === O.empty) continue;
      let oc = null;
      switch (o.type) {
        case O.projector:
          oc = cellFrom(0 + o.dir, 2);
          break;
        case O.gem:
          oc = cellFrom(0, 4);
          break;
        case O.refl:
          oc = cellFrom(5 + o.dir, 6);
          break;
        case O.rover:
          oc = cellFrom(6, 2 + o.dir);
          break;
        case O.stone:
          oc = cellFrom(2, 1);
          break;
        case O.wand:
          oc = cellFrom(2, 4);
          break;
        default:
          break;
      }
      if (oc) ctx.drawImage(oc, x * K, y * K, K, K);
    }

  // 光束辉光(加法混合;FEATURE_LIGHT 已开)
  // 作用:逐格读取当前层的四向入射光,取平均颜色后用 lighter 叠加到画面上,
  //       表示该格子被光束照亮的视觉辉光。
  if (FEATURE_LIGHT) {
    // 若当前层光照缓存失效,则先根据世界状态重新计算。
    ensureLight();
    // lit = { pw, L, any },其中 L 是 [y][x][d] 四向光照矩阵。
    const lit = lightCache[z];
    if (lit) {
      // x 为列,y 为行,遍历整张地图。
      for (y = 0; y < WH; y++)
        for (x = 0; x < WW; x++) {
          // any[y][x] 表示这一格是否被任意方向的光照到。
          if (!lit.any[y][x]) continue;

          // n:这一格有几个方向有光;rr/gg/bb:这些光的 RGB 累加值。
          let n = 0,
            rr = 0,
            gg = 0,
            bb = 0;

          // d:0=E,1=N,2=W,3=S,一次检查四个入射方向。
          for (let d = 0; d < 4; d++) {
            // cc = lit.L[y][x][d]:当前格从方向 d 射入的光色编号。
            // -1 表示该方向没有光;>=0 时是 powers 数组里的颜色索引。
            const cc = lit.L[y][x][d];
            if (cc >= 0) {
              // powers[cc] 是该颜色的 RGB 分量[red, green, blue]。
              const pc = powers[cc];
              rr += pc[0];
              gg += pc[1];
              bb += pc[2];
              n++;
            }
          }

          // n > 0:至少有一个方向有光,可以计算平均颜色并绘制。
          if (n) {
            // 光方向越多越亮,但 alpha 上限为 0.42,避免过曝。
            ctx.globalAlpha = Math.min(0.42, 0.1 + 0.06 * n);
            // 把各方向颜色平均成一个 RGB 颜色。
            ctx.fillStyle =
              "rgb(" +
              Math.round(rr / n) +
              "," +
              Math.round(gg / n) +
              "," +
              Math.round(bb / n) +
              ")";
            // lighter 是加法混合,让光叠加到底图/canvas 上,产生发光感。
            ctx.globalCompositeOperation = "lighter";
            // K 是当前每格像素尺寸,把格子 (x,y) 映射到画布坐标。
            ctx.fillRect(x * K, y * K, K, K);
            // 恢复正常混合和透明度,避免影响后续玩家/标记等绘制。
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
          }
        }
      // 投影器头部彩色标记:有电时亮色叠加,没电时也保留暗色,便于辨认颜色
      for (y = 0; y < WH; y++)
        for (x = 0; x < WW; x++) {
          const o2 = world.obj[z][y][x];
          if (o2.type !== O.projector) continue;
          const powered = !!lit.pw[(y / SY) | 0][(x / SX) | 0];
          const pc2 = powers[o2.color];
          if (powered) {
            // 灯自身格子的半格辉光:从中心出发,向发射方向铺半格。
            const dx = XD[o2.dir];
            const dy = YD[o2.dir];
            const glowX = x * K + (dx > 0 ? K * 0.5 : 0);
            const glowY = y * K + (dy > 0 ? K * 0.5 : 0);
            const glowW = dx ? K * 0.5 : K;
            const glowH = dy ? K * 0.5 : K;
            // 与单方向光束辉光的 alpha 保持一致。
            ctx.globalAlpha = 0.16;
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle =
              "rgb(" + pc2[0] + "," + pc2[1] + "," + pc2[2] + ")";
            ctx.fillRect(glowX, glowY, glowW, glowH);

            // 通电:原版亮色四角星标记
            ctx.globalAlpha = 0.6;
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(
              tintedCell(5, 2, pc2),
              x * K,
              y * K,
              K,
              K,
            );
          } else {
            // 未通电:保留暗色中心色块
            ctx.globalAlpha = 0.6;
            ctx.globalCompositeOperation = "source-over";
            ctx.drawImage(
              tintedCell(5, 1, pc2),
                x * K + K * 0.38,
                y * K + K * 0.38,
                K * 0.18,
                K * 0.18,
            );
          }
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
        }
    }
  }

  // 房间网格(开关在顶栏)
  if (showGrid) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(1, Math.floor(k * 0.5));
    ctx.beginPath();
    for (x = 0; x <= NX; x++) {
      const gx = x * SX * K;
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, WH * K);
    }
    for (y = 0; y <= NY; y++) {
      const gy = y * SY * K;
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(WW * K, gy + 0.5);
    }
    ctx.stroke();
  }

  // 玩家:照原版 draw_world L2004–2009,只做“最后一格”的滑入
  //   epx = -16*xdir[pdir]*(player_timer/80) → 画在“目标格往回一格”处,随时钟滑入目标格。
  //   这样双步/远行跨多格时不会拉一条长线滑过墙体(原版同样只滑最后一格)。
  let drawX = game.px,
    drawY = game.py;
  if (animMove && game.player_timer > 0) {
    const bigJump =
      Math.abs(animFromX - game.px) > 1 || Math.abs(animFromY - game.py) > 1;
    const behindIsFrom =
      wrapX(game.px - XD[game.pdir]) === animFromX &&
      wrapY(game.py - YD[game.pdir]) === animFromY;
    if (!(bigJump && behindIsFrom)) {
      // 跨世界缝:瞬移,不做滑入
      const slide = game.player_timer / 80; // 80→0,偏移 1 格 → 0 格
      drawX = game.px - XD[game.pdir] * slide;
      drawY = game.py - YD[game.pdir] * slide;
    }
  }
  const dxs = game.pdir;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(cellFrom(dxs, 6), drawX * K, drawY * K, K, K);
  ctx.globalAlpha = 1;
  // 辅助环(便于识别)
  ctx.strokeStyle = "rgba(255,212,121,0.9)";
  ctx.lineWidth = Math.max(2, k * 0.4);
  ctx.strokeRect(drawX * K + 1, drawY * K + 1, K - 2, K - 2);
  drawEndingOverlay(ctx, k);
  refreshHud();
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.drawEndingOverlay = drawEndingOverlay;
globalThis.kPx = kPx;
globalThis.render = render;
globalThis.cv = cv;
globalThis.ctx = ctx;
globalThis.canvasSize = canvasSize;
Object.defineProperty(globalThis, "zoomK", {
  configurable: true,
  get() { return zoomK; },
  set(value) { zoomK = value; },
});
Object.defineProperty(globalThis, "autoFit", {
  configurable: true,
  get() { return autoFit; },
  set(value) { autoFit = value; },
});
Object.defineProperty(globalThis, "follow", {
  configurable: true,
  get() { return follow; },
  set(value) { follow = value; },
});
Object.defineProperty(globalThis, "showGrid", {
  configurable: true,
  get() { return showGrid; },
  set(value) { showGrid = value; },
});
