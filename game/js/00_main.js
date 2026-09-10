"use strict";
/* PROMESST 2 网页版移植  16_main.js
   主循环、错误处理与启动入口
   拆分自原 game.js;模块加载顺序见 index.html。 */

/* ---------- ES Module 入口依赖:按原全局脚本依赖顺序加载 ---------- */
import "./01_constants.js";
import "./02_assets.js";
import "./03_world.js";
import "./04_state.js";
import "./05_light.js";
import "./06_debug.js";
import "./07_move.js";
import "./08_history.js";
import "./09_rover.js";
import "./10_render.js";
import "./11_hud.js";
import "./12_menu.js";
import "./13_saves.js";
import "./14_view.js";
import "./15_input.js";
// ---------- 主循环(rAF + 16ms 步进;仅游戏模式推进逻辑;渲染可选 30/60/90/120FPS,默认60) ----------
const FPS_OPTIONS = [30, 60, 90, 120];
// 当前帧率对应的渲染间隔(ms)。
let renderInterval = 1000 / 60;
// 上一帧时间戳和 16ms 模拟 accumulator。
let last = performance.now(),
  acc = 0;
// 上一次实际渲染的时间戳,用于限帧。
let lastRender = 0;
// 帧率下拉框 DOM。
const selFps = byId("selFps");
if (selFps) {
  selFps.value = "60";
  selFps.addEventListener("change", function () {
    const fps = parseInt(selFps.value, 10);
    if (FPS_OPTIONS.includes(fps)) {
      renderInterval = 1000 / fps;
      lastRender = 0;
    }
  });
}
/**
 * 功能:rAF 主循环:推进时间/模式/16ms 模拟,并按所选 FPS 限帧渲染。
 * @param {*} now
 */
function loop(now) {
  // 实现:每帧推进时间;按 16ms 补步进更新逻辑;按 FPS 间隔限帧渲染。
  const dt = Math.min(now - last, 250);
  last = now;
  animcycle += dt;
  if (mainMode === "logo") {
    logoTime -= dt;
    if (logoTime <= 0) setMode("menu");
  } else if (mainMode === "game") {
    acc += dt;
    let guard = 0;
    while (acc >= 16 && guard < 8) {
      update(16);
      acc -= 16;
      guard++;
    }
    if (guard >= 8) acc = 0;
  } else {
    acc = 0; // 菜单/结算:暂停模拟(与原版 process_metagame 一致)
  }
  if (now - lastRender >= renderInterval) {
    lastRender = now;
    render();
    if (mainMode === "game" && follow) centerPlayer();
  }
  requestAnimationFrame(loop);
}

// ---------- 错误与启动 ----------
/**
 * 功能:在页面上显示错误信息。
 * @param {*} msg
 */
function err(msg) {
  const e = byId("err");
  e.style.display = "block";
  e.textContent = msg;
}
// 全局异常直接显示在页面上(此前静默失败很难排查)
window.addEventListener("error", function (e) {
  err(
    "运行错误: " +
      (e.message || e.error || "?") +
      "  @ " +
      (e.filename || "") +
      ":" +
      (e.lineno || 0),
  );
});
window.addEventListener("unhandledrejection", function (e) {
  const r = e.reason;
  err("异步错误: " + ((r && (r.message || r)) || "?"));
});
/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.loop = loop;
globalThis.err = err;
globalThis.FPS_OPTIONS = FPS_OPTIONS;
globalThis.selFps = selFps;
Object.defineProperty(globalThis, "renderInterval", {
  configurable: true,
  get() { return renderInterval; },
  set(value) { renderInterval = value; },
});
Object.defineProperty(globalThis, "last", {
  configurable: true,
  get() { return last; },
  set(value) { last = value; },
});
Object.defineProperty(globalThis, "acc", {
  configurable: true,
  get() { return acc; },
  set(value) { acc = value; },
});
Object.defineProperty(globalThis, "lastRender", {
  configurable: true,
  get() { return lastRender; },
  set(value) { lastRender = value; },
});

(function boot() {
  try {
    if (!RAW || RAW.length !== 24) {
      err(
        "00_map_data.js 异常:期望 24 行,实际 " +
          (RAW ? RAW.length : "未定义") +
          "。",
      );
      return;
    }
    img = new Image();
    img.onload = function () {
      try {
        const tmp = document.createElement("canvas");
        tmp.width = ATLAS;
        tmp.height = ATLAS;
        const tc = tmp.getContext("2d");
        tc.drawImage(img, 0, 0);
        imgData = tc.getImageData(0, 0, ATLAS, ATLAS);
        computePowers();
        // 打开 IndexedDB → 读取“当前槽”(兼容 M5 的 main 键) → Logo → 菜单
        const p = openDB()
          .then(function () {
            return loadActiveSlot();
          })
          .catch(function () {
            return null;
          });
        p.then(function (save) {
          if (save && save.g) {
            restoreSave(save);
            gameStarted = true;
          } else {
            reset();
            gameStarted = false;
          }
          resizeCanvas();
          render();
          buildMenu();
          logoTime = 1500;
          setMode("logo");
          requestAnimationFrame(loop);
        });
      } catch (ex) {
        err(
          "初始化失败:\n" +
            ex.message +
            "\n(file:// 打开可能有跨域限制,请用 Live Server 或 python -m http.server)",
        );
      }
    };
    img.onerror = function () {
      err("无法加载 assets/sprites.png —— 请确认文件存在。");
    };
    img.src = "./assets/sprites.png";
  } catch (ex) {
    err("启动失败:" + ex.message);
  }
})();
