"use strict";
/* PROMESST 2 网页版移植  render.js
   世界渲染、结局动画与画面输出
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 结局/蜥蜴化/气泡(YOU WIN 等世界内文字用原版内置字体) ----------
function drawEndingOverlay(g, k) {
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
const ctx = cv.getContext("2d");
let zoomK = 2,
  autoFit = true,
  follow = true,
  showGrid = false;
const canvasSize = 384;

function kPx() {
  return CELL * zoomK;
}

function render() {
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
  if (FEATURE_LIGHT) {
    ensureLight();
    const lit = lightCache[z];
    if (lit) {
      for (y = 0; y < WH; y++)
        for (x = 0; x < WW; x++) {
          if (!lit.any[y][x]) continue;
          let n = 0,
            rr = 0,
            gg = 0,
            bb = 0;
          for (let d = 0; d < 4; d++) {
            const cc = lit.L[y][x][d];
            if (cc >= 0) {
              const pc = powers[cc];
              rr += pc[0];
              gg += pc[1];
              bb += pc[2];
              n++;
            }
          }
          if (n) {
            ctx.globalAlpha = Math.min(0.42, 0.1 + 0.06 * n);
            ctx.fillStyle =
              "rgb(" +
              Math.round(rr / n) +
              "," +
              Math.round(gg / n) +
              "," +
              Math.round(bb / n) +
              ")";
            ctx.globalCompositeOperation = "lighter";
            ctx.fillRect(x * K, y * K, K, K);
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
          }
        }
      // 通电投影器头部彩色标记
      for (y = 0; y < WH; y++)
        for (x = 0; x < WW; x++) {
          const o2 = world.obj[z][y][x];
          if (o2.type === O.projector && lit.pw[(y / SY) | 0][(x / SX) | 0]) {
            const pc2 = powers[o2.color];
            ctx.globalAlpha = 0.55;
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgb(" + pc2[0] + "," + pc2[1] + "," + pc2[2] + ")";
            ctx.fillRect(
              x * K + K * 0.28,
              y * K + K * 0.28,
              K * 0.44,
              K * 0.44,
            );
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
          }
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
