"use strict";
/* PROMESST 2 网页版移植  light.js
   供电、光束传播、能力判定与射击
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 供电与光束(移植,FEATURE_LIGHT 打开后启用) ----------
/**
 * 功能:计算每个房间是否供电:底座有宝石且未被非空物体占据。
 * @param {*} z
 * @param {*} world
 */
function computePowered(z, world) {
  // 实现:先标记有宝石的底座房间,再清除被物体占住的底座供电。
  const pw = [];
  let ry, rx, y, x;
  for (ry = 0; ry < NY; ry++) pw[ry] = new Array(NX).fill(0);
  for (y = 0; y < WH; y++)
    for (x = 0; x < WW; x++)
      if (world.tile[z][y][x] === T.recep) pw[(y / SY) | 0][(x / SX) | 0] = 1;
  for (y = 0; y < WH; y++)
    for (x = 0; x < WW; x++)
      if (world.tile[z][y][x] === T.recep && world.obj[z][y][x].type !== O.gem)
        pw[(y / SY) | 0][(x / SX) | 0] = 0;
  return pw;
}
/**
 * 功能:从所有通电投影器发射光束,处理反射镜和门,返回四向光照矩阵与 any 标记。
 * @param {*} z
 * @param {*} world
 * @param {*} pw
 */
function propagate(z, world, pw) {
  // 实现:遍历通电投影器,沿方向逐格前进;遇门停止,遇反射镜转向,遇非空物体停止。
  let L = [],
    any = [],
    y,
    x;
  for (y = 0; y < WH; y++) {
    L[y] = [];
    any[y] = new Array(WW).fill(0);
    for (x = 0; x < WW; x++) L[y].push([-1, -1, -1, -1]);
  }
  /**
   * 功能:把列坐标环绕到 0..WW-1。
   * @param {*} a
   */
  function wrapX(a) {
    return ((a % WW) + WW) % WW;
  }
  /**
   * 功能:把行坐标环绕到 0..WH-1。
   * @param {*} a
   */
  function wrapY(a) {
    return ((a % WH) + WH) % WH;
  }
  for (y = 0; y < WH; y++)
    for (x = 0; x < WW; x++) {
      const o = world.obj[z][y][x];
      if (o.type !== O.projector) continue;
      if (!pw[(y / SY) | 0][(x / SX) | 0]) continue;
      let dir = o.dir,
        ax = x,
        dx = XD[o.dir],
        ay = y,
        dy = YD[o.dir];
      for (;;) {
        ax = wrapX(ax + dx);
        ay = wrapY(ay + dy);
        if (world.tile[z][ay][ax] === T.door) break;
        if (world.obj[z][ay][ax].type === O.refl) {
          if (world.obj[z][ay][ax].dir === 0) dir ^= 1;
          else dir ^= 3;
          dx = XD[dir];
          dy = YD[dir];
        } else {
          if (world.obj[z][ay][ax].type !== O.empty) break;
        }
        L[ay][ax][dir] = o.color;
        any[ay][ax] = 1;
      }
    }
  return {L: L, any: any};
}


// ---------- 光照缓存 / 能力判定 / 射击(移植 compute_powered+propagate 应用层) ----------
let lightCache = [null, null]; // lightCache[z]={pw,L,any}
// 光照缓存失效标记;世界变化后置 true。
let lightDirty = true;

/**
 * 功能:把列坐标环绕到 0..WW-1。
 * @param {*} a
 */
function wrapX(a) {
  return ((a % WW) + WW) % WW;
}
/**
 * 功能:把行坐标环绕到 0..WH-1。
 * @param {*} a
 */
function wrapY(a) {
  return ((a % WH) + WH) % WH;
}

// 紫光远行滑行:严格照 main.c L753–770
//   1) 起点必须有紫光(按键方向 proposed 或其反向 proposed^2);
//   2) 沿按键方向逐格走,只看“该格是否仍在紫光上”,**不判墙/物体**——因为光束本身穿墙(§7-B);
//   3) 走到第一格不在紫光上时退回一格,即“最后一格仍在紫光上”的格子;
//   4) 若退回后仍在原地,则原版把 travel 清零(退化为普通移动)。
// 落点的墙/门/石块判定由 move() 后续 L787–801 统一处理(墙无绿光则整个动作失败,人不动)。
/**
 * 功能:计算紫光远行落点;只沿连续紫光格前进并退回最后一格。
 * @param {*} z
 * @param {*} px
 * @param {*} py
 * @param {*} pdir
 * @param {*} L
 */
function glideTarget(z, px, py, pdir, L) {
  if (!L) return null;
  const x = XD[pdir],
    y = YD[pdir];
  /**
   * 功能:判断指定行列在按键方向或反方向是否有紫光。
   * @param {*} r
   * @param {*} c
   */
  function lit(r, c) {
    return L.L[r][c][pdir] === POW_travel || L.L[r][c][pdir ^ 2] === POW_travel;
  }
  if (!lit(py, px)) return null;
  let gx = wrapX(px + x),
    gy = wrapY(py + y);
  while (lit(gy, gx)) {
    gx = wrapX(gx + x);
    gy = wrapY(gy + y);
  }
  gx = wrapX(gx - x);
  gy = wrapY(gy - y);
  if (gx === px && gy === py) return null; // 原版:退化为普通移动
  return {x: gx, y: gy};
}

/**
 * 功能:按需计算并缓存玩家所在层的光照数据。
 */
function ensureLight() {
  // 实现:缓存缺失或 world 变化时重新计算当前层供电和光束。
  if (!FEATURE_LIGHT) return;
  const z = game.pz;
  if (!lightCache[z] || lightDirty) {
    const pw = computePowered(z, world);
    lightCache[z] = propagate(z, world, pw);
    lightCache[z].pw = pw;
    lightDirty = false;
  }
}

// 能力判定(移植 get_abilities,L714–721):站在玩家格,统计四向入射光颜色
/**
 * 功能:统计玩家格四向入射光颜色,写入 out 并返回。
 * @param {*} out
 */
function getAbilities(out) {
  // 实现:读取玩家格四向入射光颜色,并累加到能力数组。
  for (let i = 0; i < 8; i++) out[i] = 0;
  if (!FEATURE_LIGHT) return out;
  ensureLight();
  const L = lightCache[game.pz].L;
  for (let d = 0; d < 4; d++) {
    const c = L[game.py][game.px][d];
    if (c >= 0) out[c] += 1;
  }
  return out;
}

// 找出所有照到玩家格的有电投影器(移植 find_lights_on_player,L538–577)
/**
 * 功能:返回所有通电且光束照到玩家格的投影器坐标。
 */
function findLightsOnPlayer() {
  // 实现:反向模拟每台投影器的光束路径,判断是否照到玩家。
  const out = [];
  if (!FEATURE_LIGHT) return out;
  ensureLight();
  const pw = lightCache[game.pz].pw,
    z = game.pz;
  let y, x;
  for (y = 0; y < WH; y++)
    for (x = 0; x < WW; x++) {
      const o = world.obj[z][y][x];
      if (o.type !== O.projector) continue;
      if (!pw[(y / SY) | 0][(x / SX) | 0]) continue; // 未通电不发光
      let dir = o.dir,
        ax = x,
        dx = XD[o.dir],
        ay = y,
        dy = YD[o.dir];
      for (;;) {
        ax = wrapX(ax + dx);
        ay = wrapY(ay + dy);
        if (ax === game.px && ay === game.py) out.push({x: x, y: y});
        if (world.tile[z][ay][ax] === T.door) break;
        if (world.obj[z][ay][ax].type === O.refl) {
          if (world.obj[z][ay][ax].dir === 0) dir ^= 1;
          else dir ^= 3;
          dx = XD[dir];
          dy = YD[dir];
        } else {
          if (world.obj[z][ay][ax].type !== O.empty) break;
        }
      }
    }
  return out;
}

// X 键:射击 —— 把照到玩家的投影器重定向到玩家朝向(移植 shoot,L1026–1051)
/**
 * 功能:X 键射击:把照到玩家的投影器转向玩家当前朝向。
 */
function shoot() {
  // 实现:找到照到玩家的投影器,并把它们的朝向改为玩家朝向。
  if (!game.has_wand) return false;
  let z = game.pz,
    any = false;
  const hits = findLightsOnPlayer();
  for (let i = 0; i < hits.length; i++) {
    const o = world.obj[z][hits[i].y][hits[i].x];
    if (o.type === O.projector && o.dir !== game.pdir) {
      o.dir = game.pdir;
      any = true;
    }
  }
  if (any) {
    game.num_zaps++;
    lightDirty = true;
    return true;
  }
  return false;
}
