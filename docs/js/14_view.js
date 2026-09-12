"use strict";
/* PROMESST 2 网页版移植  14_view.js
   画面适配
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 视野:整幅地图固定等比适配可视区 ----------
const stage = byId("stage");

/**
 * 功能:把整幅地图等比缩放到 stage 可视区,后备缓冲取接近显示倍率的整数倍。
 */
function resizeCanvas() {
  const availW = Math.max(160, stage.clientWidth - 16);
  const availH = Math.max(160, stage.clientHeight - 16);
  const disp = Math.max(160, Math.min(availW, availH));
  const kBack = Math.max(1, Math.min(6, Math.round(disp / canvasSize)));
  cv.width = canvasSize * kBack;
  cv.height = canvasSize * kBack;
  cv.style.width = `${disp}px`;
  cv.style.height = `${disp}px`;
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.resizeCanvas = resizeCanvas;
globalThis.stage = stage;
