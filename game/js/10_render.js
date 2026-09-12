"use strict";
/* PROMESST 2 网页版移植  10_render.js
   世界渲染、结局动画与画面输出
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 结局/蜥蜴化/气泡(YOU WIN 等世界内文字用原版内置字体) ----------
/**
 * 功能:绘制 rover 彩虹/气泡、闪白和 YOU WIN 结局文字。
 * @param {*} g
 * @param {*} k
 * @param {number} [camX=0] 房间视角相机在世界中的格偏移 X
 * @param {number} [camY=0] 房间视角相机在世界中的格偏移 Y
 */
function drawEndingOverlay(g, k, camX, camY) {
  // 实现:先画 rover 龙化与气泡,再按 egg_timer 阶段绘制结局画面。
  // 世界内叠层按相机偏移绘制;全屏闪白/结局文字仍使用屏幕坐标。
  camX = camX || 0;
  camY = camY || 0;
  const z = game.pz,
    K = CELL * k;
  let rover = null,
    y,
    x;
  for (y = 0; y < WH && !rover; y++)
    for (x = 0; x < WW; x++)
      if (world.obj[z][y][x].type === O.rover) {
        rover = { x: x, y: y };
        break;
      }
  // rover 在当前视角画布中的左上角坐标;供龙化/气泡等世界内叠层使用。
  const rx = rover ? (rover.x - camX) * K : 0,
    ry = rover ? (rover.y - camY) * K : 0;

  // Fed rover lizard/dragon transformation (original L2035-2069).
  // First 3s: small cell (6,5). After that: flash between small (6,5)
  // stretched to 32px and the 2x2 dragon region (4,3)-(5,4).
  if (rover && game.egg_timer > 0) {
    const ox = rx + K / 4;
    const oy = ry + K / 4;
    if (game.egg_timer <= 3000) {
      g.drawImage(cellFrom(6, 5), ox, oy, K, K);
    } else {
      const scale = Math.min(1, (game.egg_timer - 3000) / 3000) / 2 + 0.5;
      const size = 2 * K * scale;
      if (
        game.egg_timer % 200 < (game.egg_timer - 3000) / 20 ||
        game.egg_timer > 6000
      ) {
        g.drawImage(img, 64, 48, 32, 32, ox, oy, size, size);
      } else {
        g.drawImage(cellFrom(6, 5), ox, oy, size, size);
      }
    }
  }
  // Bubble text (original L2144-2191). At gems_stored===0 the original
  // draws the FEED ME cells (5,6)(6,6): sprite rect (80,96)-(112,112).
  if (
    rover &&
    z === 0 &&
    ((rover.x / SX) | 0) === 2 &&
    ((rover.y / SY) | 0) === 3 &&
    game.gems_stored >= 0
  ) {
    if (game.gems_stored === 0) {
      if (animcycle % 15000 < 2000) {
        g.drawImage(img, 80, 96, 32, 16, rx + K / 2, ry + K / 8, 2 * K, K);
      }
    } else {
      let text = null;
      if (game.egg_timer >= 8000) text = "WELL NOW";
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
        g.fillRect(rx + K / 2 - w / 2 - 3, ry - size * 10 - 3, w + 6, size * 9 + 6);
        g.fillStyle = "#ffffff";
        drawBmpText(g, rx + K / 2 - w / 2, ry - size * 10, size, text, 1);
        g.restore();
      }
    }
  }
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
// 网格默认开启;用户选择持久化到 localStorage。
let showGrid = true;
try {
  const savedGrid = localStorage.getItem("promesst2.showGrid");
  if (savedGrid === "0" || savedGrid === "1") showGrid = savedGrid === "1";
} catch (e) {}
// 视角模式:"map" 为整幅大地图,"room" 为当前房间。
let viewMode = "map";
// 调试开关:关闭后 getLightFlicker() 固定返回 1,光束不再闪烁。
let lightFlickerEnabled = true;
try {
  lightFlickerEnabled = localStorage.getItem("promesst2.lightFlicker") !== "0";
} catch (e) {}
// 整幅地图的逻辑尺寸:WW * CELL(24 * 16 = 384 px)。
const canvasSize = WW * CELL;

/**
 * 功能:返回当前每格像素大小(按当前视角可见格数由画布后备缓冲尺寸反推)。
 */
function kPx() {
  return cv.width / (viewMode === "room" ? SX : WW);
}

/**
 * 功能:按原版 draw_world 的算法计算光束微弱闪烁系数。
 *
 * 原版 main.c 在游戏模式下 animcycle 每逻辑帧会加两次:
 *   L2439: animcycle += 16;
 *   L2448: animcycle += eff_time(16);
 * 等价于每 16ms 真实逻辑帧增加 32ms 动画时钟。
 *
 * 网页版早期直接使用 requestAnimationFrame 的真实 dt 累加 animcycle:
 *   1) 速度约为原版游戏的一半;
 *   2) rAF/限帧波动会让 sin 与取模突变采样不稳定,表现为时快时慢。
 *
 * 因此这里先把 animcycle 量化成原版游戏时钟:
 *   cycle = floor(animcycle / 16) * 32
 * 再用 cycle 完全照抄 main.c L1860-1869 的公式。
 *
 * @returns {number} 0.2 ~ 1.0 之间的亮度系数
 */
function getLightFlicker() {
  if (!lightFlickerEnabled) return 1;
  const cycle = Math.floor(animcycle / 16) * 32;
  let flicker = Math.abs(Math.sin(cycle / 100)) * 0.5 + 0.5;
  const a = Math.floor(cycle / 10);
  if (a % 130 === 0 || a % 217 === 0 || a % 252 === 0) flicker += 0.5;
  if (a % 103 === 0 || a % 117 === 0 || a % 501 === 0) flicker *= 0.7;
  if (a % 88 === 0 || a % 281 === 0) flicker *= 0.5;
  if (flicker > 1) flicker = 1;
  if (flicker < 0.2) flicker = 0.2;
  return flicker;
}

/**
 * 功能:绘制当前整幅画面:地图、物体、光束、网格、玩家、结局层和 HUD。
 */
function render() {
  // 实现:依次绘制地图瓦片、物体、光束、网格、玩家、结局层和 HUD。
  if (!world || !img) return;
  // 玩家动画位置:只做最后一格滑入。提前计算,既供绘制使用,也供房间视角选择相机。
  let drawX = game.px,
    drawY = game.py;
  if (animMove && game.player_timer > 0) {
    const bigJump = Math.abs(animFromX - game.px) > 1 || Math.abs(animFromY - game.py) > 1;
    const behindIsFrom =
      wrapX(game.px - XD[game.pdir]) === animFromX && wrapY(game.py - YD[game.pdir]) === animFromY;
    if (!(bigJump && behindIsFrom)) {
      // 跨世界缝:瞬移,不做滑入
      const slide = game.player_timer / 80; // 80 -> 0,偏移 1 格 -> 0 格
      drawX = game.px - XD[game.pdir] * slide;
      drawY = game.py - YD[game.pdir] * slide;
    }
  }
  // 房间视角按实际绘制位置所在房间取景;世界接缝外时回退到逻辑坐标。
  let viewPx = drawX,
    viewPy = drawY;
  if (viewPx < 0 || viewPx >= WW) viewPx = game.px;
  if (viewPy < 0 || viewPy >= WH) viewPy = game.py;
  const z = game.pz,
    K = kPx(),
    k = K / CELL,
    roomView = viewMode === "room",
    camX = roomView ? ((viewPx / SX) | 0) * SX : 0,
    camY = roomView ? ((viewPy / SY) | 0) * SY : 0;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(-camX * K, -camY * K);

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
          // Fed rover is drawn by drawEndingOverlay as the lizard/dragon.
          if (game.egg_timer > 0) continue;
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

  // 光束辉光:直接使用原版精灵表贴图,不再用 fillRect 手画。
  //   半格贴图:(0,5)右 / (1,5)上 / (2,5)左 / (3,5)下
  //   满格贴图:(4,5) 和 (5,5),原版按方向的奇偶选择 4+(d&1)
  if (FEATURE_LIGHT) {
    ensureLight();
    const lit = lightCache[z];
    if (lit) {
      const flicker = getLightFlicker();
      // 1) 满格光束:每个有光的入射方向画一个满格贴图。
      for (y = 0; y < WH; y++)
        for (x = 0; x < WW; x++) {
          if (!lit.any[y][x]) continue;
          let n = 0;
          for (let d = 0; d < 4; d++) if (lit.L[y][x][d] >= 0) n++;
          if (!n) continue;
          const alpha = Math.min(0.42, 0.14 + 0.14 * n) / n;
          for (let d = 0; d < 4; d++) {
            const cc = lit.L[y][x][d];
            if (cc < 0) continue;
            ctx.globalAlpha = alpha * flicker;
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(tintedCell(4 + (d & 1), 5, powers[cc]), x * K, y * K, K, K);
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
          }
        }

      // 2) 光束末端半格:只处理被反向朝向自己的灯挡住的情况。
      if (lit.end) {
        for (let i = 0; i < lit.end.length; i++) {
          const e = lit.end[i];
          ctx.globalAlpha = 0.16 * flicker;
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(tintedCell(e.side, 5, powers[e.color]), e.x * K, e.y * K, K, K);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
        }
      }

      // 3) 投影器自身:通电时画方向半格 + 四角星;未通电时画暗色中心块。
      for (y = 0; y < WH; y++)
        for (x = 0; x < WW; x++) {
          const o2 = world.obj[z][y][x];
          if (o2.type !== O.projector) continue;
          const powered = !!lit.pw[(y / SY) | 0][(x / SX) | 0];
          const pc2 = powers[o2.color];
          if (powered) {
            // 自己格子的半格贴图:o2.dir 正好对应 (0,5)~(3,5)。
            ctx.globalAlpha = 0.16 * flicker;
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(tintedCell(o2.dir, 5, pc2), x * K, y * K, K, K);
            // 亮色四角星。
            ctx.globalAlpha = 0.6 * flicker;
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(tintedCell(5, 2, pc2), x * K, y * K, K, K);
          } else {
            // 未点亮中心色块。
            ctx.globalAlpha = 0.6;
            ctx.globalCompositeOperation = "source-over";
            ctx.drawImage(tintedCell(4, 2, pc2), x * K, y * K, K, K);
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
  const dxs = game.pdir;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(cellFrom(dxs, 6), drawX * K, drawY * K, K, K);
  ctx.globalAlpha = 1;
  // 辅助环(便于识别)
  ctx.strokeStyle = "rgba(255,212,121,0.9)";
  ctx.lineWidth = Math.max(2, k * 0.4);
  ctx.strokeRect(drawX * K + 1, drawY * K + 1, K - 2, K - 2);
  ctx.restore();
  drawEndingOverlay(ctx, k, camX, camY);
  refreshHud();
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.drawEndingOverlay = drawEndingOverlay;
globalThis.kPx = kPx;
globalThis.render = render;
globalThis.cv = cv;
globalThis.ctx = ctx;
globalThis.canvasSize = canvasSize;

Object.defineProperty(globalThis, "viewMode", {
  configurable: true,
  get() {
    return viewMode;
  },
  set(value) {
    viewMode = value;
  },
});
Object.defineProperty(globalThis, "showGrid", {
  configurable: true,
  get() {
    return showGrid;
  },
  set(value) {
    showGrid = value;
  },
});
Object.defineProperty(globalThis, "lightFlickerEnabled", {
  configurable: true,
  get() {
    return lightFlickerEnabled;
  },
  set(value) {
    lightFlickerEnabled = value;
  },
});
