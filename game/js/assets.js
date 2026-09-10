"use strict";
/* PROMESST 2 网页版移植  assets.js
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

/**
 * 功能:从精灵表像素数据中读取指定像素的 RGBA 值。
 * @param {*} x
 * @param {*} y
 */
function sample(x, y) {
  const i = (y * ATLAS + x) * 4;
  return [
    imgData.data[i],
    imgData.data[i + 1],
    imgData.data[i + 2],
    imgData.data[i + 3],
  ];
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
  let key = "c_" + s + "_" + t,
    c = tileCache[key];
  if (!c) {
    c = document.createElement("canvas");
    c.width = CELL;
    c.height = CELL;
    c.getContext("2d").drawImage(
      img,
      s * CELL,
      t * CELL,
      CELL,
      CELL,
      0,
      0,
      CELL,
      CELL,
    );
    tileCache[key] = c;
  }
  return c;
}
// 用精灵表内置字体写文本(移植 draw_text L1691–1705)
/**
 * 功能:用原版内置位图字体在 canvas 上绘制文本,返回绘制结束后的 x 坐标。
 * @param {*} g
 * @param {*} x
 * @param {*} y
 * @param {*} size
 * @param {*} text
 * @param {*} spacing
 */
function drawBmpText(g, x, y, size, text, spacing) {
  spacing = spacing || 0;
  for (let i = 0; i < text.length; i++) {
    const idx = FONT.indexOf(text.charAt(i));
    if (idx < 0) continue;
    const sx = 1 + (idx % 21) * 6,
      sy = 113 + Math.floor(idx / 21) * 8;
    g.drawImage(img, sx, sy, 5, 7, x, y, size * 5, size * 7);
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
globalThis.drawBmpText = drawBmpText;
globalThis.bmpTextWidth = bmpTextWidth;
globalThis.RAW = RAW;
globalThis.tileCache = tileCache;
Object.defineProperty(globalThis, "ATLAS", {
  configurable: true,
  get() { return ATLAS; },
  set(value) { ATLAS = value; },
});
Object.defineProperty(globalThis, "CELL", {
  configurable: true,
  get() { return CELL; },
  set(value) { CELL = value; },
});
Object.defineProperty(globalThis, "img", {
  configurable: true,
  get() { return img; },
  set(value) { img = value; },
});
Object.defineProperty(globalThis, "imgData", {
  configurable: true,
  get() { return imgData; },
  set(value) { imgData = value; },
});
Object.defineProperty(globalThis, "powers", {
  configurable: true,
  get() { return powers; },
  set(value) { powers = value; },
});
