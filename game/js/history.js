"use strict";
/* PROMESST 2 网页版移植  history.js
   差分撤销、快照与 IndexedDB 持久化
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- M5:差分撤销(一次性,无上限)+ IndexedDB 跨会话持久化 ----------
let HISTORY = []; // 条目 {diffs:[{k,i,old,new}], pre:{player,t}}
let lastSnap = null; // 最近一次提交后的完整状态(用于差分)
let ckptSnap = null; // 魔杖快照(菜单“从 wand 恢复”用,M6)
// IndexedDB 数据库连接;saveTimer 为自动保存防抖计时器。
let DB = null,
  saveTimer = null;

/**
 * 功能:导出玩家相关状态,供快照和历史记录使用。
 */
function pState() {
  return {
    px: game.px,
    py: game.py,
    pz: game.pz,
    pdir: game.pdir,
    flag: game.ability_flag,
    gems: game.num_gems,
    fed: game.gems_stored,
    wand: game.has_wand,
    zaps: game.num_zaps,
    egg: game.egg_timer,
  };
}
/**
 * 功能:导出 rover 相关计时器状态。
 */
function tState() {
  return {feed: feed_timer, rev: reverse_timer, rt: rover_timer};
}
/**
 * 功能:把玩家状态快照应用到 game。
 * @param {*} p
 */
function applyP(p) {
  game.px = p.px;
  game.py = p.py;
  game.pz = p.pz;
  game.pdir = p.pdir;
  game.ability_flag = p.flag;
  game.num_gems = p.gems;
  game.gems_stored = p.fed;
  game.has_wand = p.wand;
  game.num_zaps = p.zaps;
  game.egg_timer = p.egg;
}
/**
 * 功能:把 rover 计时器状态应用到全局计时器。
 * @param {*} t
 */
function applyT(t) {
  feed_timer = t.feed;
  reverse_timer = t.rev;
  rover_timer = t.rt;
}

/**
 * 功能:构建当前世界的完整快照(tile/object/player/timers)。
 */
function buildSnap() {
  // 实现:逐格复制 tile 与物体属性,再附加玩家和计时器状态。
  const S = {tile: [], type: [], dir: [], col: []};
  for (let z = 0; z < 2; z++) {
    S.tile[z] = [];
    S.type[z] = [];
    S.dir[z] = [];
    S.col[z] = [];
    for (let y = 0; y < WH; y++) {
      const rt = [],
        a = [],
        b = [],
        c = [];
      for (let x = 0; x < WW; x++) {
        rt.push(world.tile[z][y][x]);
        const o = world.obj[z][y][x];
        a.push(o.type);
        b.push(o.dir);
        c.push(o.color);
      }
      S.tile[z].push(rt);
      S.type[z].push(a);
      S.dir[z].push(b);
      S.col[z].push(c);
    }
  }
  S.player = pState();
  S.t = tState();
  return S;
}
/**
 * 功能:把 z/y/x 坐标转换成差分数组使用的线性索引。
 * @param {*} z
 * @param {*} y
 * @param {*} x
 */
function cellIdx(z, y, x) {
  return (z * WH + y) * WW + x;
}
// 差分只记“玩家可影响”的格子;rover 所在/移入的格子一律忽略(rover 状态不入历史)
/**
 * 功能:比较两个快照,生成玩家可影响格子的差异列表。
 * @param {*} A
 * @param {*} B
 */
function diffSnap(A, B) {
  // 实现:逐格比较两个快照,跳过 rover 所在格,生成差异列表。
  const diffs = [];
  for (let z = 0; z < 2; z++)
    for (let y = 0; y < WH; y++)
      for (let x = 0; x < WW; x++) {
        if (A.type[z][y][x] === O.rover || B.type[z][y][x] === O.rover)
          continue;
        if (A.tile[z][y][x] !== B.tile[z][y][x])
          diffs.push({
            k: 0,
            i: cellIdx(z, y, x),
            old: A.tile[z][y][x],
            new: B.tile[z][y][x],
          });
        if (A.type[z][y][x] !== B.type[z][y][x])
          diffs.push({
            k: 1,
            i: cellIdx(z, y, x),
            old: A.type[z][y][x],
            new: B.type[z][y][x],
          });
        if (A.dir[z][y][x] !== B.dir[z][y][x])
          diffs.push({
            k: 2,
            i: cellIdx(z, y, x),
            old: A.dir[z][y][x],
            new: B.dir[z][y][x],
          });
        if (A.col[z][y][x] !== B.col[z][y][x])
          diffs.push({
            k: 3,
            i: cellIdx(z, y, x),
            old: A.col[z][y][x],
            new: B.col[z][y][x],
          });
      }
  return diffs;
}
/**
 * 功能:把线性索引还原成 z/y/x 坐标。
 * @param {*} i
 */
function idxToC(i) {
  const z = (i / (WH * WW)) | 0;
  const r = i % (WH * WW);
  return {z: z, y: (r / WW) | 0, x: r % WW};
}
/**
 * 功能:按差异条目更新世界格子;useOld 为 true 时回滚旧值。
 * @param {*} d
 * @param {*} useOld
 */
function applyDiffWorld(d, useOld) {
  const v = useOld ? d.old : d.new,
    p = idxToC(d.i),
    o = world.obj[p.z][p.y][p.x];
  if (d.k === 0) {
    world.tile[p.z][p.y][p.x] = v;
  } else if (d.k === 1) o.type = v;
  else if (d.k === 2) o.dir = v;
  else o.color = v;
}
/**
 * 功能:比较玩家状态是否相同,用于判断历史是否有变化。
 * @param {*} a
 * @param {*} b
 */
function sameP(a, b) {
  return (
    a.px === b.px &&
    a.py === b.py &&
    a.pz === b.pz &&
    a.pdir === b.pdir &&
    a.flag === b.flag &&
    a.gems === b.gems &&
    a.wand === b.wand &&
    a.zaps === b.zaps
  );
}
// 注:fed(rover 吃宝石)/egg 不计入历史,撤销不回滚;rover 状态完全独立于撤销
/**
 * 功能:rover 计时器永远返回 false,表示不参与撤销历史。
 * @param {*} a
 * @param {*} b
 */
function sameT(a, b) {
  return false;
} // rover 计时器永不触发“有变化”入栈
/**
 * 功能:把最近一次变化提交到撤销历史,并按需触发自动保存。
 */
function commitHistory() {
  // 实现:比较最近快照,若有变化则压入历史并触发自动保存。
  if (!lastSnap) return;
  const cur = buildSnap();
  const diffs = diffSnap(lastSnap, cur);
  const metaChanged = !sameP(lastSnap.player, cur.player);
  if (!diffs.length && !metaChanged) {
    lastSnap = cur;
    return;
  } // 真正 no-op
  HISTORY.push({diffs: diffs, pre: {player: lastSnap.player, t: lastSnap.t}});
  lastSnap = cur;
  scheduleSave();
}
// Z 键撤销:回滚“玩家可影响”的改动;rover 完全独立(不入历史、不重置、持续自主移动)
/**
 * 功能:撤销上一次玩家可影响的变化,rover 状态不回滚。
 */
function undo() {
  // 实现:弹出最近历史,用差分回滚世界格和玩家状态,但保留喂食/结局计时。
  if (!HISTORY.length) return;
  const e = HISTORY.pop();
  const keepFed = game.gems_stored,
    keepEgg = game.egg_timer;
  for (let i = 0; i < e.diffs.length; i++) applyDiffWorld(e.diffs[i], true);
  applyP(e.pre.player);
  game.gems_stored = keepFed;
  game.egg_timer = keepEgg; // rover 计数不回滚
  game.player_timer = 0;
  animMove = false;
  lightDirty = true;
  lastSnap = buildSnap();
  scheduleSave();
  onViewChanged(false);
}

// ---------- IndexedDB(状态+整局历史) ----------
/**
 * 功能:打开/创建 IndexedDB 存档库,返回 Promise。
 */
function openDB() {
  return new Promise(function (res, rej) {
    if (!window.indexedDB) {
      rej(new Error("no indexedDB"));
      return;
    }
    const rq = indexedDB.open("promesst2_save", 1);
    rq.onupgradeneeded = function () {
      const db = rq.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    rq.onsuccess = function () {
      DB = rq.result;
      res();
    };
    rq.onerror = function () {
      rej(rq.error || new Error("idb open failed"));
    };
  });
}
/**
 * 功能:从 IndexedDB 读取指定键。
 * @param {*} key
 */
function idbGet(key) {
  return new Promise(function (res, rej) {
    const rq = DB.transaction("kv", "readonly").objectStore("kv").get(key);
    rq.onsuccess = function () {
      res(rq.result || null);
    };
    rq.onerror = function () {
      rej(rq.error);
    };
  });
}
/**
 * 功能:向 IndexedDB 写入指定键值。
 * @param {*} key
 * @param {*} val
 */
function idbPut(key, val) {
  return new Promise(function (res, rej) {
    const rq = DB.transaction("kv", "readwrite")
      .objectStore("kv")
      .put(val, key);
    rq.onsuccess = function () {
      res();
    };
    rq.onerror = function () {
      rej(rq.error);
    };
  });
}
/**
 * 功能:打包当前快照、历史、魔杖快照和元信息为存档对象。
 */
function packSave() {
  return {
    v: 1,
    g: lastSnap,
    ck: ckptSnap,
    h: HISTORY,
    meta: {
      savedAt: Date.now(),
      steps: game.steps,
      gems: game.gems_stored,
      wand: game.has_wand,
      cleared: !!clearedFlag,
      slot: activeSlot,
    },
  };
}
/**
 * 功能:把当前存档写入当前槽。
 */
function saveToDB() {
  if (!DB || !lastSnap) return Promise.resolve();
  return idbPut(slotKey(activeSlot), packSave());
}
/**
 * 功能:延时 800ms 自动保存,避免频繁写库。
 */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    saveTimer = null;
    saveToDB();
  }, 800);
}
// 读档(返回存档对象或 null)
/**
 * 功能:读取当前槽存档。
 */
function loadFromDB() {
  return loadActiveSlot();
}
// 把快照(存档 gamestate 或 ckptSnap)应用到当前世界
/**
 * 功能:把存档快照应用到当前世界和游戏状态。
 * @param {*} g
 */
function applySnap(g) {
  for (let z = 0; z < 2; z++)
    for (let y = 0; y < WH; y++)
      for (let x = 0; x < WW; x++) {
        world.tile[z][y][x] = g.tile[z][y][x];
        const o = world.obj[z][y][x];
        o.type = g.type[z][y][x];
        o.dir = g.dir[z][y][x];
        o.color = g.col[z][y][x];
      }
  applyP(g.player);
  applyT(g.t);
  game.player_timer = 0;
  animMove = false;
  lightDirty = true;
}
/**
 * 功能:恢复存档:先 reset 干净世界,再应用快照、历史和通关标记。
 * @param {*} d
 */
function restoreSave(d) {
  // 实现:先 reset 到干净世界,再应用存档快照、历史和通关标记。
  reset(); // 先建一份干净的底层(解析+默认)
  applySnap(d.g);
  HISTORY = (d.h || []).slice();
  ckptSnap = d.ck || null;
  clearedFlag = !!(d.meta && d.meta.cleared);
  lastSnap = buildSnap();
}
window.addEventListener("pagehide", function () {
  if (DB && lastSnap) saveToDB();
});

// V 键:宝石拾取 / 放置(移植 drop(),L855–874:捡宝石或放回底座)
/**
 * 功能:V 键动作:站在宝石上拾取,或站在空底座上放置宝石。
 */
function drop() {
  // 实现:根据脚下物体类型执行宝石拾取或底座放置。
  const z = game.pz,
    x = game.px,
    y = game.py;
  const o = world.obj[z][y][x];
  if (o.type === O.gem) {
    // 站在宝石上 → 拾起
    o.type = O.empty;
    game.num_gems++;
  } else if (
    game.num_gems > 0 &&
    o.type === O.empty &&
    world.tile[z][y][x] === T.recep
  ) {
    // 携带宝石且脚下是空底座 → 放入
    game.num_gems--;
    o.type = O.gem;
    o.dir = 1; // dir=1:变色动画宝石
  } else return false;
  lightDirty = true; // 供电/光束随之变化
  return true;
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.pState = pState;
globalThis.tState = tState;
globalThis.applyP = applyP;
globalThis.applyT = applyT;
globalThis.buildSnap = buildSnap;
globalThis.cellIdx = cellIdx;
globalThis.diffSnap = diffSnap;
globalThis.idxToC = idxToC;
globalThis.applyDiffWorld = applyDiffWorld;
globalThis.sameP = sameP;
globalThis.sameT = sameT;
globalThis.commitHistory = commitHistory;
globalThis.undo = undo;
globalThis.openDB = openDB;
globalThis.idbGet = idbGet;
globalThis.idbPut = idbPut;
globalThis.packSave = packSave;
globalThis.saveToDB = saveToDB;
globalThis.scheduleSave = scheduleSave;
globalThis.loadFromDB = loadFromDB;
globalThis.applySnap = applySnap;
globalThis.restoreSave = restoreSave;
globalThis.drop = drop;
Object.defineProperty(globalThis, "HISTORY", {
  configurable: true,
  get() { return HISTORY; },
  set(value) { HISTORY = value; },
});
Object.defineProperty(globalThis, "lastSnap", {
  configurable: true,
  get() { return lastSnap; },
  set(value) { lastSnap = value; },
});
Object.defineProperty(globalThis, "ckptSnap", {
  configurable: true,
  get() { return ckptSnap; },
  set(value) { ckptSnap = value; },
});
Object.defineProperty(globalThis, "DB", {
  configurable: true,
  get() { return DB; },
  set(value) { DB = value; },
});
Object.defineProperty(globalThis, "saveTimer", {
  configurable: true,
  get() { return saveTimer; },
  set(value) { saveTimer = value; },
});
