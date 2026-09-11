"use strict";
/* PROMESST 2 网页版移植  14_view.js
   画面适配、缩放与跟随
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 视野:适配(吃满可视区)/ 手动缩放 / 跟随 ----------
const stage = byId("stage");
let cssScale = 1; // 画布 CSS 显示尺寸 / 后备缓冲尺寸(适配模式下可能 <1,避免模糊)
const ZOOM_MIN = 1,
  ZOOM_MAX = 6;

/**
 * 功能:从 localStorage 读取上次保存的缩放模式与倍率。
 */
function loadViewPrefs() {
  try {
    const savedZoom = parseInt(localStorage.getItem("promesst2.zoomK") || "", 10);
    if (savedZoom >= ZOOM_MIN && savedZoom <= ZOOM_MAX) zoomK = savedZoom;
    const savedFit = localStorage.getItem("promesst2.autoFit");
    if (savedFit === "0") autoFit = false;
    else if (savedFit === "1") autoFit = true;
  } catch (e) {}
}

/**
 * 功能:保存当前缩放模式与倍率到 localStorage。
 */
function saveViewPrefs() {
  try {
    localStorage.setItem("promesst2.zoomK", String(zoomK));
    localStorage.setItem("promesst2.autoFit", autoFit ? "1" : "0");
  } catch (e) {}
}

/**
 * 功能:重置为适配模式,让画布自动铺满可视区。
 */
function resetZoom() {
  autoFit = true;
  resizeCanvas();
  saveViewPrefs();
}
/**
 * 功能:根据适配/手动缩放模式调整 canvas 后备缓冲和 CSS 尺寸。
 */
function resizeCanvas() {
  // 实现:根据 autoFit 或手动倍率设置 canvas 尺寸和 CSS 显示尺寸。
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
/**
 * 功能:把视口滚动到玩家所在位置附近。
 */
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
/**
 * 功能:视图变化回调;center 为 true 时重新适配画布。
 * @param {*} center
 */
function onViewChanged(center) {
  if (center) resizeCanvas();
}

loadViewPrefs();

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.resizeCanvas = resizeCanvas;
globalThis.centerPlayer = centerPlayer;
globalThis.onViewChanged = onViewChanged;
globalThis.saveViewPrefs = saveViewPrefs;
globalThis.resetZoom = resetZoom;
globalThis.stage = stage;
Object.defineProperty(globalThis, "cssScale", {
  configurable: true,
  get() { return cssScale; },
  set(value) { cssScale = value; },
});
