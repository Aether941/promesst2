"use strict";
/* PROMESST 2 网页版移植  assets.js
   地图数据、精灵表采样与内置字体绘制工具
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 数据与采样 ----------
const RAW = globalThis.PROMESST_MAP_RAW;
let ATLAS = 128,
  CELL = 16,
  img = null,
  imgData = null;
let powers = null; // 8 种能力色(取样自精灵表,供 M3 光束)
const tileCache = {};

function sample(x, y) {
  const i = (y * ATLAS + x) * 4;
  return [
    imgData.data[i],
    imgData.data[i + 1],
    imgData.data[i + 2],
    imgData.data[i + 3],
  ];
}
function computePowers() {
  powers = [];
  for (let i = 0; i < 8; i++) powers.push(sample(112 + i, 96));
}
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
function bmpTextWidth(size, text, spacing) {
  spacing = spacing || 0;
  let x = 0;
  for (let i = 0; i < text.length; i++) {
    const idx = FONT.indexOf(text.charAt(i));
    if (idx >= 0) x += size * (FSIZE[idx] + 1 + spacing);
  }
  return x;
}
