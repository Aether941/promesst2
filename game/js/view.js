"use strict";
/* PROMESST 2 网页版移植  view.js
   画面适配、缩放与跟随
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 视野:适配(吃满可视区)/ 手动缩放 / 跟随 ----------
const stage = byId("stage");
let cssScale = 1; // 画布 CSS 显示尺寸 / 后备缓冲尺寸(适配模式下可能 <1,避免模糊)
function resizeCanvas() {
  if (autoFit) {
    // 用 min(可视宽, 可视高) 的正方形尽量占满;后备缓冲取“接近显示倍率”的整数倍再交给 CSS 缩放
    const availW = Math.max(160, stage.clientWidth - 16);
    const availH = Math.max(160, stage.clientHeight - 16);
    const disp = Math.max(160, Math.min(availW, availH));
    const kBack = Math.max(1, Math.min(6, Math.round(disp / canvasSize)));
    zoomK = kBack;
    cv.width = canvasSize * kBack;
    cv.height = canvasSize * kBack;
    cv.style.width = disp + "px";
    cv.style.height = disp + "px";
    cssScale = disp / (canvasSize * kBack);
  } else {
    cv.width = canvasSize * zoomK;
    cv.height = canvasSize * zoomK;
    cv.style.width = cv.width + "px";
    cv.style.height = cv.height + "px";
    cssScale = 1;
  }
  centerPlayer();
}
function centerPlayer() {
  if (!follow) return;
  const k = zoomK;
  // 滚动坐标是 CSS 像素,需要乘上 CSS 缩放系数
  const cx = (game.px * CELL + 8) * k * cssScale,
    cy = (game.py * CELL + 8) * k * cssScale;
  const sx = stage.clientWidth,
    sy = stage.clientHeight;
  const maxL = Math.max(0, stage.scrollWidth - sx),
    maxT = Math.max(0, stage.scrollHeight - sy);
  stage.scrollLeft = Math.max(0, Math.min(maxL, cx - sx / 2));
  stage.scrollTop = Math.max(0, Math.min(maxT, cy - sy / 2));
}
function onViewChanged(center) {
  if (center) resizeCanvas();
}
