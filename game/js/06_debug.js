"use strict";
/* PROMESST 2 网页版移植  06_debug.js
   移动判定调试报告
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 调试:移动判定报告(覆盖全部颜色,保存最近 5 次) ----------
let noclip = false,
  debugOn = false;
let skipLogoMenu = false;
try {
  const savedDebug = localStorage.getItem("promesst2.debugOn");
  if (savedDebug === "0" || savedDebug === "1") debugOn = savedDebug === "1";
  skipLogoMenu = localStorage.getItem("promesst2.skipLogoMenu") === "1";
} catch (e) {}
let dbgMsg = "移动判定:—"; // 面板显示文本
let dbgLog = []; // 最近 5 次报告
const DBG_LOG_MAX = 5;
let dbgLogCursor = -1;
// 调试蓄力:每次点击增加,随时间衰减,满 100 触发。
const DEBUG_CHARGE_MAX = 100,
  DEBUG_CHARGE_GAIN = 25,
  DEBUG_CHARGE_DECAY_PER_MS = 0.01;
let wandCharge = 0,
  feedCharge = 0;
const chargeUiShown = { wand: -1, feed: -1 };
/**
 * 功能:清空移动判定调试日志和面板文本。
 */
function dbgReset() {
  dbgLog = [];
  dbgLogCursor = -1;
  dbgMsg = "移动判定:—";
  wandCharge = 0;
  feedCharge = 0;
  const wandBtn = byId("dbgWand");
  const feedBtn = byId("dbgFeed");
  if (wandBtn) wandBtn.disabled = false;
  if (feedBtn) feedBtn.disabled = false;
  updateDbgNavUI();
  updateDebugChargeUI();
}
/**
 * 功能:返回指定格瓦片的中文名。
 * @param {*} z
 * @param {*} cx
 * @param {*} cy
 */
function dbgTileName(z, cx, cy) {
  return TILE_CN[world.tile[z][cy][cx]];
}
/**
 * 功能:返回格子的瓦片与物体描述,用于调试报告。
 * @param {*} z
 * @param {*} cx
 * @param {*} cy
 */
function dbgCellDesc(z, cx, cy) {
  let o = world.obj[z][cy][cx],
    extra = "";
  if (o.type === O.projector) extra = "(色=" + CNAMES[o.color] + " 向=" + DIRNAME[o.dir] + ")";
  else if (o.type === O.refl) extra = "(姿态=" + (o.dir ? "\\\\" : "/") + ")";
  return (
    "(" + cx + "," + cy + ") 瓦片=" + dbgTileName(z, cx, cy) + " 物体=" + OBJ_CN[o.type] + extra
  );
}
/**
 * 功能:返回落点被阻挡的原因文本。
 * @param {*} z
 * @param {*} cx
 * @param {*} cy
 * @param {*} ab
 */
function dbgBlockReason(z, cx, cy, ab) {
  const t = world.tile[z][cy][cx],
    o = world.obj[z][cy][cx];
  if (o.type === O.projector) return "投影器不可站(原版 L794)";
  if (o.type === O.refl) return "反射镜不可站(原版 L819)";
  if (t === T.wall) return "墙需要绿光(穿墙)";
  if (t === T.door) return "门需要红光(开门)";
  if (o.type === O.stone) return "石块需要黄光(碎石)";
  return "未知";
}
/**
 * 功能:调试开启时构造一次移动判定报告头;否则返回 null。
 * @param {*} x
 * @param {*} y
 * @param {*} z
 */
function dbgStart(x, y, z) {
  if (!debugOn) return null;
  const dirName = x ? (x > 0 ? "→E 右" : "←W 左") : y > 0 ? "↓S 下" : "↑N 上";
  const ab = [0, 0, 0, 0, 0, 0, 0, 0];
  getAbilities(ab);
  let L = FEATURE_LIGHT ? lightCache[z] : null,
    lightStr = "(无光照数据)";
  if (L) {
    const p = [];
    for (let i = 0; i < 4; i++) {
      const v = L.L[game.py][game.px][i];
      p.push(["E", "N", "W", "S"][i] + "=" + (v >= 0 ? CNAMES[v] : "—"));
    }
    lightStr = p.join(" ");
  }
  return {
    lines: [
      "── 按键 " +
        dirName +
        " | 从 (" +
        game.px +
        "," +
        game.py +
        ") Z" +
        z +
        " 朝向=" +
        DIRNAME[game.pdir],
      "入射光(玩家格四向) " + lightStr,
      "能力计数 红(开门)" +
        ab[0] +
        " 绿(穿墙)" +
        ab[1] +
        " 黄(碎石)" +
        ab[4] +
        " 橙(双步)" +
        ab[3] +
        " 紫(远行)" +
        ab[5] +
        " flag=0x" +
        game.ability_flag.toString(16),
    ],
  };
}
/**
 * 功能:向调试报告追加一行文本。
 * @param {*} D
 * @param {*} s
 */
function dbgAdd(D, s) {
  if (D) D.lines.push(s);
}
/**
 * 功能:结束调试报告,保存最近 5 条日志并输出当前选中的一条。
 * @param {*} D
 * @param {*} desc
 */
function dbgFinish(D, desc) {
  if (!D) return;
  D.lines.push("结果: " + desc);
  const text = D.lines.join("\n");
  dbgLog.push(text);
  if (dbgLog.length > DBG_LOG_MAX) dbgLog.shift();
  dbgLogCursor = dbgLog.length - 1;
  dbgMsg = dbgLog[dbgLogCursor];
  updateDbgNavUI();
  try {
    if (window.console) console.log("[PROMESST2 移动判定]\n" + text);
  } catch (e) {}
}
/**
 * 功能:刷新调试信息翻页控件的索引与按钮状态。
 */
function updateDbgNavUI() {
  const index = byId("dbgIndex");
  const prev = byId("dbgPrev");
  const next = byId("dbgNext");
  const total = dbgLog.length;
  if (index) index.textContent = total ? dbgLogCursor + 1 + "/" + total : "0/0";
  if (prev) prev.disabled = total <= 0 || dbgLogCursor <= 0;
  if (next) next.disabled = total <= 0 || dbgLogCursor >= total - 1;
}
/**
 * 功能:切换当前显示的调试报告。
 * @param {number} delta
 */
function dbgShowLog(delta) {
  if (!dbgLog.length) return;
  dbgLogCursor = Math.max(0, Math.min(dbgLog.length - 1, dbgLogCursor + delta));
  dbgMsg = dbgLog[dbgLogCursor];
  updateDbgNavUI();
}
/**
 * 功能:显示上一条调试报告。
 */
function dbgShowPrev() {
  dbgShowLog(-1);
}
/**
 * 功能:显示下一条调试报告。
 */
function dbgShowNext() {
  dbgShowLog(1);
}
/**
 * 功能:调试:直接获得魔杖和 30 颗宝石。
 */
function cheatWand() {
  game.has_wand = true;
  game.num_gems = 30;
}
/**
 * 功能:更新两个调试蓄力按钮的进度显示。
 */
function updateDebugChargeUI() {
  const wandPct = Math.round(wandCharge);
  const feedPct = Math.round(feedCharge);
  if (wandPct !== chargeUiShown.wand) {
    const wandBtn = byId("dbgWand");
    if (wandBtn) wandBtn.style.setProperty("--charge", wandPct + "%");
    chargeUiShown.wand = wandPct;
  }
  if (feedPct !== chargeUiShown.feed) {
    const feedBtn = byId("dbgFeed");
    if (feedBtn) feedBtn.style.setProperty("--charge", feedPct + "%");
    chargeUiShown.feed = feedPct;
  }
}
/**
 * 功能:点击"获得30宝石"时蓄力;满 100 触发 cheatWand。
 */
function addWandCharge() {
  if (wandCharge >= DEBUG_CHARGE_MAX) return;
  wandCharge = Math.min(DEBUG_CHARGE_MAX, wandCharge + DEBUG_CHARGE_GAIN);
  updateDebugChargeUI();
  if (wandCharge >= DEBUG_CHARGE_MAX) {
    cheatWand();
    const wandBtn = byId("dbgWand");
    if (wandBtn) wandBtn.disabled = true;
  }
}
/**
 * 功能:点击"投喂30宝石"时蓄力;满 100 触发投喂结局。
 */
function addFeedCharge() {
  if (feedCharge >= DEBUG_CHARGE_MAX) return;
  feedCharge = Math.min(DEBUG_CHARGE_MAX, feedCharge + DEBUG_CHARGE_GAIN);
  updateDebugChargeUI();
  if (feedCharge >= DEBUG_CHARGE_MAX) {
    game.gems_stored = MAX_GEMS;
    const feedBtn = byId("dbgFeed");
    if (feedBtn) feedBtn.disabled = true;
  }
}
/**
 * 功能:随时间衰减调试蓄力进度。
 * @param {number} ms
 */
function updateDebugCharges(ms) {
  if (wandCharge <= 0 && feedCharge <= 0) return;
  const decay = DEBUG_CHARGE_DECAY_PER_MS * ms;
  if (wandCharge > 0 && wandCharge < DEBUG_CHARGE_MAX) {
    wandCharge = Math.max(0, wandCharge - decay);
  }
  if (feedCharge > 0 && feedCharge < DEBUG_CHARGE_MAX) {
    feedCharge = Math.max(0, feedCharge - decay);
  }
  updateDebugChargeUI();
}
// 目标格分类(参数为 **列cx, 行cy**,与 world.tile[z][cy][cx] 一致;能力已内联判定)
/**
 * 功能:判定目标格是否可走、需要开门或需要碎石。
 * @param {*} z
 * @param {*} cx
 * @param {*} cy
 * @param {*} abilities
 */
function cellKind(z, cx, cy, abilities) {
  const t = world.tile[z][cy][cx],
    o = world.obj[z][cy][cx];
  if (o.type === O.projector || o.type === O.refl) return "block";
  if (t === T.wall) return abilities[POW_walls] ? "walk" : "block";
  if (t === T.door) return abilities[POW_doors] ? "door" : "block";
  if (o.type === O.stone) return abilities[POW_destroy] ? "stone" : "block";
  return "walk";
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.dbgReset = dbgReset;
globalThis.dbgTileName = dbgTileName;
globalThis.dbgCellDesc = dbgCellDesc;
globalThis.dbgBlockReason = dbgBlockReason;
globalThis.dbgStart = dbgStart;
globalThis.dbgAdd = dbgAdd;
globalThis.dbgFinish = dbgFinish;
globalThis.dbgShowPrev = dbgShowPrev;
globalThis.dbgShowNext = dbgShowNext;
globalThis.cheatWand = cheatWand;
globalThis.addWandCharge = addWandCharge;
globalThis.addFeedCharge = addFeedCharge;
globalThis.updateDebugCharges = updateDebugCharges;
globalThis.cellKind = cellKind;
Object.defineProperty(globalThis, "noclip", {
  configurable: true,
  get() {
    return noclip;
  },
  set(value) {
    noclip = value;
  },
});
Object.defineProperty(globalThis, "debugOn", {
  configurable: true,
  get() {
    return debugOn;
  },
  set(value) {
    debugOn = value;
  },
});
Object.defineProperty(globalThis, "dbgMsg", {
  configurable: true,
  get() {
    return dbgMsg;
  },
  set(value) {
    dbgMsg = value;
  },
});
Object.defineProperty(globalThis, "dbgLog", {
  configurable: true,
  get() {
    return dbgLog;
  },
  set(value) {
    dbgLog = value;
  },
});
Object.defineProperty(globalThis, "skipLogoMenu", {
  configurable: true,
  get() {
    return skipLogoMenu;
  },
  set(value) {
    skipLogoMenu = value;
  },
});
