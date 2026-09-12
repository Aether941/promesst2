"use strict";
/* PROMESST 2 网页版移植  11_hud.js
   HUD 状态面板和能力灯刷新
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- HUD ----------
const hud = {
  z: "",
  xy: "",
  room: "",
  face: "",
  steps: "",
  carry: "",
  wand: "",
  gems: "",
  undo: "",
  move: "",
};
// 能力名:未使用过显示颜色名,使用过显示能力名(照原版 HUD L2294-2305)。
const ABILITY_COLOR_NAMES = { 0: "红", 1: "绿", 3: "橙", 4: "黄", 5: "紫" };
const ABILITY_ACTION_NAMES = { 0: "开门", 1: "穿透", 3: "双格", 4: "粉碎", 5: "端点" };
// 状态栏朝向:0=E/右,1=N/上,2=W/左,3=S/下。
const FACE_CN = ["右", "上", "左", "下"];
/**
 * 功能:刷新 HUD 状态和能力灯;通过 hud 缓存避免重复写 DOM。
 */
function refreshHud() {
  // 实现:用 hud 缓存比较各字段,只在实际变化时更新 DOM;能力灯每帧根据光照更新。
  const z = game.pz,
    x = game.px,
    y = game.py;
  const rx = (x / SX) | 0,
    ry = (y / SY) | 0;
  const zs = `Z${z}`,
    xys = `(${x},${y})`,
    rs = `(${rx},${ry})`,
    fs = FACE_CN[game.pdir],
    st = String(game.steps),
    cs = `${game.num_gems}/${MAX_GEMS}`;
  if (hud.z !== zs) {
    hud.z = zs;
    byId("bz").textContent = zs;
  }
  if (hud.xy !== xys) {
    hud.xy = xys;
    byId("bxy").textContent = xys;
  }
  if (hud.room !== rs) {
    hud.room = rs;
    byId("broom").textContent = rs;
  }
  if (hud.face !== fs) {
    hud.face = fs;
    byId("bfacing").textContent = fs;
  }
  if (hud.steps !== st) {
    hud.steps = st;
    byId("bsteps").textContent = st;
  }
  if (hud.carry !== cs) {
    hud.carry = cs;
    byId("bcarry").textContent = cs;
  }
  const ws = game.has_wand ? "有" : "无";
  if (hud.wand !== ws) {
    hud.wand = ws;
    byId("bwand").textContent = ws;
  }
  const gs = `${game.gems_stored >= 0 ? game.gems_stored : 0}/${MAX_GEMS}`;
  if (hud.gems !== gs) {
    hud.gems = gs;
    byId("bgems").textContent = gs;
  }
  const u = String(HISTORY.length);
  if (hud.undo !== u) {
    hud.undo = u;
    byId("bund").textContent = u;
  }
  // 能力灯:照到=亮,用过=暗;两者都没有时原版不显示,这里用 known 控制可见性。
  if (FEATURE_LIGHT) {
    const ab = [0, 0, 0, 0, 0, 0, 0, 0];
    getAbilities(ab);
    const lamps = byId("lamps");
    if (lamps) {
      const kids = lamps.children;
      for (let li = 0; li < kids.length; li++) {
        const c = parseInt(kids[li].getAttribute("data-c"), 10);
        const on = ab[c] > 0,
          used = (game.ability_flag & (1 << c)) !== 0,
          known = on || used;
        kids[li].classList.toggle("on", on);
        kids[li].classList.toggle("used", !on && used);
        kids[li].classList.toggle("known", known);
        const name = used ? ABILITY_ACTION_NAMES[c] : ABILITY_COLOR_NAMES[c];
        if (kids[li].textContent !== name) kids[li].textContent = name;
      }
    }
    if (debugOn && hud.move !== dbgMsg) {
      hud.move = dbgMsg;
      byId("dbgMove").textContent = dbgMsg;
    }
  }
}
/**
 * 功能:document.getElementById 的快捷封装。
 * @param {*} id
 */
function byId(id) {
  return document.getElementById(id);
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.refreshHud = refreshHud;
globalThis.byId = byId;
globalThis.hud = hud;
