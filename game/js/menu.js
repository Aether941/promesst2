"use strict";
/* PROMESST 2 网页版移植  menu.js
   模式机、标题/菜单/Credits/结算
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- M6:模式机 / 菜单 / Credits / 存档槽 / 结算 ----------
let mainMode = "logo"; // logo|menu|credits|slots|game|result
let logoTime = 1500; // 原版 MAX_LOGO = 1500ms
// 是否已有可继续进行的游戏。
let gameStarted = false;
// 当前菜单选中项索引。
let menuSel = 0;
// 是否已通关。
let clearedFlag = false;
// 主菜单项配置。
const MENU = [
  {id: "continue", label: "继续游戏", sub: "回到当前进度"},
  {id: "wand", label: "从魔杖恢复", sub: "回到拾到魔杖那一刻的快照"},
  {id: "new", label: "新游戏", sub: "从头开始(清空撤销历史)"},
  {id: "slots", label: "存档管理", sub: "3 个存档槽 / 导出导入"},
  {id: "credits", label: "Credits", sub: "原作者与贡献者"},
  {id: "quit", label: "保存并回到标题", sub: "保存当前进度"},
];
/**
 * 功能:返回菜单各项是否可用。
 */
function menuEnabled() {
  return MENU.map(function (it) {
    if (it.id === "continue") return gameStarted;
    if (it.id === "wand") return !!ckptSnap;
    return true;
  });
}
/**
 * 功能:构建主菜单按钮并绑定点击。
 */
function buildMenu() {
  const host = byId("menuItems");
  if (!host) return;
  host.innerHTML = "";
  MENU.forEach(function (it, i) {
    const b = document.createElement("button");
    b.innerHTML = it.label + "<small>" + it.sub + "</small>";
    b.addEventListener("click", function () {
      if (!b.disabled) {
        menuSel = i;
        activateMenu();
      }
    });
    host.appendChild(b);
  });
  refreshMenu();
}
/**
 * 功能:刷新菜单选中态和禁用态。
 */
function refreshMenu() {
  const host = byId("menuItems");
  if (!host) return;
  const en = menuEnabled(),
    ch = host.children;
  for (let i = 0; i < ch.length; i++) {
    ch[i].disabled = !en[i];
    ch[i].className = i === menuSel ? "sel" : "";
  }
  byId("menuNote").textContent = gameStarted
    ? ""
    : "当前没有存档:请选择“新游戏”开始。";
}
/**
 * 功能:按 dir 上下移动菜单选择,跳过禁用项。
 * @param {*} dir
 */
function moveMenuSel(dir) {
  const en = menuEnabled();
  for (let k = 0; k < MENU.length; k++) {
    menuSel = (menuSel + dir + MENU.length) % MENU.length;
    if (en[menuSel]) break;
  }
  refreshMenu();
}
/**
 * 功能:切换各覆盖层显示状态。
 * @param {*} name
 */
function showScreen(name) {
  ["scrLogo", "scrMenu", "scrCredits", "scrSlots", "scrResult"].forEach(
    function (id) {
      const el = byId(id);
      if (el) el.classList.toggle("on", id === "scr" + name);
    },
  );
}
/**
 * 功能:设置主模式 m,显示对应界面并重置主循环计时。
 * @param {*} m
 */
function setMode(m) {
  mainMode = m;
  const map = {
    logo: "Logo",
    menu: "Menu",
    credits: "Credits",
    slots: "Slots",
    result: "Result",
  };
  showScreen(map[m] || "");
  if (m === "menu") refreshMenu();
  if (m === "game") {
    last = typeof performance !== "undefined" ? performance.now() : 0;
    acc = 0;
  } // 暂停后避免大 dt
}
/**
 * 功能:执行当前选中的菜单项。
 */
function activateMenu() {
  // 实现:根据当前菜单项执行继续/恢复/新游戏/存档/Credits/退出等动作。
  const id = MENU[menuSel].id;
  if (id === "continue") {
    gameStarted = true;
    setMode("game");
  } else if (id === "wand") {
    if (!ckptSnap) return;
    applySnap(ckptSnap);
    HISTORY = [];
    lastSnap = buildSnap();
    lightDirty = true; // 原版:恢复 checkpoint 会清空 undo
    gameStarted = true;
    setMode("game");
    scheduleSave();
  } else if (id === "new") {
    reset();
    gameStarted = true;
    setMode("game");
    scheduleSave();
  } else if (id === "slots") {
    setMode("slots");
    renderSlots();
  } else if (id === "credits") {
    setMode("credits");
  } else if (id === "quit") {
    scheduleSave();
    setMode("menu");
  }
}
/**
 * 功能:进入结算界面并写入通关统计。
 */
function enterResult() {
  if (mainMode === "result") return;
  clearedFlag = true;
  HISTORY = []; // 原版通关不落档;这里只清历史并记录通关标记
  scheduleSave();
  byId("resZaps").textContent = "USED " + game.num_zaps + " ZAPS";
  byId("resFed").textContent = "已喂宝石 " + game.gems_stored + "/" + MAX_GEMS;
  setMode("result");
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.menuEnabled = menuEnabled;
globalThis.buildMenu = buildMenu;
globalThis.refreshMenu = refreshMenu;
globalThis.moveMenuSel = moveMenuSel;
globalThis.showScreen = showScreen;
globalThis.setMode = setMode;
globalThis.activateMenu = activateMenu;
globalThis.enterResult = enterResult;
globalThis.MENU = MENU;
Object.defineProperty(globalThis, "mainMode", {
  configurable: true,
  get() { return mainMode; },
  set(value) { mainMode = value; },
});
Object.defineProperty(globalThis, "logoTime", {
  configurable: true,
  get() { return logoTime; },
  set(value) { logoTime = value; },
});
Object.defineProperty(globalThis, "gameStarted", {
  configurable: true,
  get() { return gameStarted; },
  set(value) { gameStarted = value; },
});
Object.defineProperty(globalThis, "menuSel", {
  configurable: true,
  get() { return menuSel; },
  set(value) { menuSel = value; },
});
Object.defineProperty(globalThis, "clearedFlag", {
  configurable: true,
  get() { return clearedFlag; },
  set(value) { clearedFlag = value; },
});
