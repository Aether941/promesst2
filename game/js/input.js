"use strict";
/* PROMESST 2 网页版移植  input.js
   键盘输入与控制面板事件绑定
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 输入(按模式分发:游戏 / 菜单 / 子页面) ----------
const KEYMAP = {
  ArrowUp: "w",
  KeyW: "w",
  ArrowDown: "s",
  KeyS: "s",
  ArrowLeft: "a",
  KeyA: "a",
  ArrowRight: "d",
  KeyD: "d",
};
window.addEventListener("keydown", function (e) {
  // 菜单:上下选择 / 回车确认 / Esc 返回游戏
  if (mainMode === "menu") {
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      moveMenuSel(-1);
      return;
    }
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      moveMenuSel(1);
      return;
    }
    if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") {
      e.preventDefault();
      activateMenu();
      return;
    }
    if (e.code === "Escape" && gameStarted) {
      e.preventDefault();
      setMode("game");
      return;
    }
    return;
  }
  if (mainMode === "credits" || mainMode === "slots") {
    if (e.code === "Escape" || e.code === "Enter") {
      e.preventDefault();
      setMode("menu");
    }
    return;
  }
  if (mainMode !== "game") return; // logo / result:交给按钮
  if (e.code === "Escape") {
    e.preventDefault();
    setMode("menu");
    return;
  }
  const c = KEYMAP[e.code];
  if (c) {
    e.preventDefault();
    q = c;
    const i = held.indexOf(c);
    if (i >= 0) held.splice(i, 1);
    held.push(c);
    return;
  }
  const a = {KeyX: "x", KeyV: "v", KeyZ: "z", KeyC: "c"}[e.code];
  if (a) {
    e.preventDefault();
    q = a;
  }
});
window.addEventListener("keyup", function (e) {
  const c = KEYMAP[e.code];
  if (c) {
    const i = held.indexOf(c);
    if (i >= 0) held.splice(i, 1);
  }
});
window.addEventListener("blur", function () {
  held = [];
  q = null;
});

// 控件
byId("btnFit").addEventListener("click", function () {
  autoFit = true;
  resizeCanvas();
});
byId("btnZo").addEventListener("click", function () {
  autoFit = false;
  zoomK = Math.max(1, zoomK - 1);
  resizeCanvas();
});
byId("btnZi").addEventListener("click", function () {
  autoFit = false;
  zoomK = Math.min(6, zoomK + 1);
  resizeCanvas();
});
byId("btnUndo").addEventListener("click", function () {
  if (mainMode === "game") {
    undo();
  }
});
byId("btnMenu").addEventListener("click", function () {
  setMode("menu");
});
byId("btnCreditsBack").addEventListener("click", function () {
  setMode("menu");
});
byId("btnSlotsBack").addEventListener("click", function () {
  setMode("menu");
});
byId("btnExport").addEventListener("click", exportSave);
byId("fileImport").addEventListener("change", function (e) {
  if (e.target.files && e.target.files[0]) importSave(e.target.files[0]);
  e.target.value = "";
});
byId("btnAgain").addEventListener("click", function () {
  clearedFlag = false;
  reset();
  gameStarted = true;
  setMode("game");
  scheduleSave();
});
byId("btnResultMenu").addEventListener("click", function () {
  setMode("menu");
});
byId("ckFollow").addEventListener("change", function (e) {
  follow = e.target.checked;
  centerPlayer();
});
byId("ckGrid").addEventListener("change", function (e) {
  showGrid = e.target.checked;
});
byId("ckDbg").addEventListener("change", function (e) {
  debugOn = e.target.checked;
  byId("dbgrow").style.display = debugOn ? "block" : "none";
});
byId("dbgWand").addEventListener("click", function () {
  cheatWand();
});
byId("dbgFeed").addEventListener("click", function () {
  game.gems_stored = MAX_GEMS;
}); // 调试:直接触发结局
byId("dbgCopy").addEventListener("click", function () {
  const t = dbgMsg || "(无调试信息)";
  /**
   * 功能:显示复制调试信息操作的结果。
   * @param {*} ok
   */
  function done(ok) {
    const st = byId("dbgCopyState");
    if (!st) return;
    st.textContent = ok ? "已复制到剪贴板" : "请手动选择复制";
    setTimeout(function () {
      st.textContent = "最近 3 次";
    }, 2000);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(
      function () {
        done(true);
      },
      function () {
        done(false);
      },
    );
  } else {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      done(ok);
    } catch (e) {
      done(false);
    }
  }
});
byId("dbgNoclip").addEventListener("click", function () {
  cheatNoclip();
  byId("dbgNoclipState").textContent = "穿墙:" + (noclip ? "开" : "关");
});
window.addEventListener("resize", function () {
  if (autoFit) resizeCanvas();
});

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.KEYMAP = KEYMAP;
