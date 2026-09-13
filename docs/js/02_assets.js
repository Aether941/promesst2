"use strict";
/* PROMESST 2 网页版移植  02_assets.js
   地图数据、精灵表采样与内置字体绘制工具
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 数据与采样 ----------
const RAW = globalThis.PROMESST_MAP_RAW;
// ATLAS/CELL 为精灵表总尺寸与单元格尺寸;img/imgData 为图片对象和像素缓存。
let ATLAS = 128,
  CELL = 16,
  img = null,
  imgData = null;
let powers = null; // 8 种能力色(取样自精灵表,供 M3 光束)
// 精灵单元格裁剪 canvas 缓存。
const tileCache = {};
const tintCache = {};

/**
 * 功能:从精灵表像素数据中读取指定像素的 RGBA 值。
 * @param {*} x
 * @param {*} y
 */
function sample(x, y) {
  const i = (y * ATLAS + x) * 4;
  return [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2], imgData.data[i + 3]];
}
/**
 * 功能:从精灵表固定像素采样 8 种能力色,写入全局 powers。
 */
function computePowers() {
  powers = [];
  for (let i = 0; i < 8; i++) powers.push(sample(112 + i, 96));
}
/**
 * 功能:从精灵表裁出 1616 单元格并缓存为 canvas。
 * @param {*} s
 * @param {*} t
 */
function cellFrom(s, t) {
  let key = `c_${s}_${t}`,
    c = tileCache[key];
  if (!c) {
    c = document.createElement("canvas");
    c.width = CELL;
    c.height = CELL;
    c.getContext("2d").drawImage(img, s * CELL, t * CELL, CELL, CELL, 0, 0, CELL, CELL);
    tileCache[key] = c;
  }
  return c;
}
/**
 * 功能:返回按指定颜色着色的精灵单元格 canvas,用于投影器中心星形标记。
 * @param {*} s
 * @param {*} t
 * @param {*} color
 */
function tintedCell(s, t, color) {
  const key = `${s}_${t}_${color[0]}_${color[1]}_${color[2]}`;
  let c = tintCache[key];
  if (!c) {
    c = document.createElement("canvas");
    c.width = CELL;
    c.height = CELL;
    const g = c.getContext("2d");
    g.drawImage(cellFrom(s, t), 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    g.fillRect(0, 0, CELL, CELL);
    tintCache[key] = c;
  }
  return c;
}

// 用精灵表内置字体写文本(移植 draw_text L1691–1705)
// 彩色精灵缓存。动态彩虹色会产生大量颜色键，限制容量避免长期运行持续增长。
const tintedSubCache = new Map();
const TINTED_SUB_CACHE_MAX = 512;

/**
 * 功能:按指定颜色给精灵表中的矩形区域着色,带容量上限缓存。
 * @param {*} sx 源图 x
 * @param {*} sy 源图 y
 * @param {*} sw 源图宽
 * @param {*} sh 源图高
 * @param {*} color [r,g,b] 0-255
 */
function tintedSubimage(sx, sy, sw, sh, color) {
  const key = `${sx},${sy},${sw},${sh},${color[0]},${color[1]},${color[2]}`;
  let c = tintedSubCache.get(key);
  if (c) return c;
  if (tintedSubCache.size >= TINTED_SUB_CACHE_MAX) tintedSubCache.clear();
  c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const g = c.getContext("2d");
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  g.fillRect(0, 0, sw, sh);
  tintedSubCache.set(key, c);
  return c;
}

/**
 * 功能:用原版内置位图字体在 canvas 上绘制文本,返回绘制结束后的 x 坐标。
 * @param {*} g
 * @param {*} x
 * @param {*} y
 * @param {*} size
 * @param {*} text
 * @param {*} spacing
 * @param {*} [color] 可选 [r,g,b];传入时按原版 glColor 方式给字形着色
 */
function drawBmpText(g, x, y, size, text, spacing, color) {
  spacing = spacing || 0;
  for (let i = 0; i < text.length; i++) {
    const idx = FONT.indexOf(text.charAt(i));
    if (idx < 0) continue;
    const sx = 1 + (idx % 21) * 6,
      sy = 113 + Math.floor(idx / 21) * 8;
    if (color) g.drawImage(tintedSubimage(sx, sy, 5, 7, color), x, y, size * 5, size * 7);
    else g.drawImage(img, sx, sy, 5, 7, x, y, size * 5, size * 7);
    x += size * (FSIZE[idx] + 1 + spacing);
  }
  return x;
}
/**
 * 功能:计算内置位图字体文本的像素宽度。
 * @param {*} size
 * @param {*} text
 * @param {*} spacing
 */
function bmpTextWidth(size, text, spacing) {
  spacing = spacing || 0;
  let x = 0;
  for (let i = 0; i < text.length; i++) {
    const idx = FONT.indexOf(text.charAt(i));
    if (idx >= 0) x += size * (FSIZE[idx] + 1 + spacing);
  }
  return x;
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.sample = sample;
globalThis.computePowers = computePowers;
globalThis.cellFrom = cellFrom;
globalThis.tintedCell = tintedCell;
globalThis.tintedSubimage = tintedSubimage;
globalThis.drawBmpText = drawBmpText;
globalThis.bmpTextWidth = bmpTextWidth;
globalThis.RAW = RAW;
globalThis.tileCache = tileCache;
Object.defineProperty(globalThis, "ATLAS", {
  configurable: true,
  get() {
    return ATLAS;
  },
  set(value) {
    ATLAS = value;
  },
});
Object.defineProperty(globalThis, "CELL", {
  configurable: true,
  get() {
    return CELL;
  },
  set(value) {
    CELL = value;
  },
});
Object.defineProperty(globalThis, "img", {
  configurable: true,
  get() {
    return img;
  },
  set(value) {
    img = value;
  },
});
Object.defineProperty(globalThis, "imgData", {
  configurable: true,
  get() {
    return imgData;
  },
  set(value) {
    imgData = value;
  },
});
Object.defineProperty(globalThis, "powers", {
  configurable: true,
  get() {
    return powers;
  },
  set(value) {
    powers = value;
  },
});
