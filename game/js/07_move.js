"use strict";
/* PROMESST 2 网页版移植  07_move.js
   玩家移动、双步、远行与拾取规则
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 移动(移植 move(),L742–853;双步按逐格判定,门/石中途拦截) ----------
/**
 * 功能:玩家移动主入口,处理穿墙、紫光远行、橙光双步、开门/碎石、楼梯、拾取魔杖与历史提交。
 * @param {*} x
 * @param {*} y
 */
function tryMove(x, y) {
  // 实现:先判定能力和路径,再处理终点门/石/楼梯/拾取,最后更新位置并提交历史。
  const z = game.pz;
  if (FEATURE_LIGHT) ensureLight();
  const abilities = [0, 0, 0, 0, 0, 0, 0, 0];
  getAbilities(abilities);
  const proposed_pdir = x ? (x < 0 ? DIR_W : DIR_E) : y < 0 ? DIR_N : DIR_S;
  let used = game.ability_flag;
  let usedWall = false;
  /**
   * 功能:把能力位 b 标记为本次已使用。
   * @param {*} b
   */
  function setUsed(b) {
    used |= 1 << b;
  }

  const D = dbgStart(x, y, z); // 调试报告(未开调试时为 null)
  /**
   * 功能:结束一次移动:写调试报告并返回结果。
   * @param {*} res
   * @param {*} desc
   */
  function ret(res, desc) {
    dbgFinish(D, desc);
    return res;
  }

  // 调试穿墙:无视一切直接走一格
  if (noclip) {
    let fx0 = game.px,
      fy0 = game.py;
    game.px = wrapX(game.px + x);
    game.py = wrapY(game.py + y);
    game.pdir = proposed_pdir;
    game.player_timer = 80;
    game.steps++;
    startAnim(fx0, fy0);
    if (D) D.landing = dbgCellDesc(game.pz, game.px, game.py);
    return ret("move", "调试穿墙:移动成功");
  }

  // 站在墙内:无绿光禁止任何移动(只能撤销),否则绿光穿墙后可能“卡”在墙里还能走出来
  if (world.tile[z][game.py][game.px] === T.wall) {
    if (!abilities[POW_walls]) return ret(false, "被挡:站在墙内且无绿光(原版 L787–792,只能撤销)");
    setUsed(POW_walls);
    usedWall = true;
  }

  const L = FEATURE_LIGHT ? lightCache[z] : null;
  /**
   * 功能:判断指定行列在 proposed_pdir 方向或反方向是否有紫光远行能力。
   * @param {*} r
   * @param {*} c
   */
  function litViolet(r, c) {
    // (行,列),与 L[r][c] 一致;带边界防护
    return !!(
      L &&
      L.L[r] &&
      L.L[r][c] &&
      (L.L[r][c][proposed_pdir] === POW_travel || L.L[r][c][proposed_pdir ^ 2] === POW_travel)
    );
  }

  // ---- 紫光远行:严格照原版 main.c L753–770(途中只看紫光、不判墙) ----
  let travel = false,
    gx = game.px,
    gy = game.py;
  const tt = glideTarget(z, game.px, game.py, proposed_pdir, L);
  if (tt) {
    gx = tt.x;
    gy = tt.y;
    setUsed(POW_travel);
    travel = true;
  }
  let stepN = 1;
  if (!travel) {
    // 橙光双步:终点按原版判定;但路径中途若遇门(红光)/石块(黄光)则停下开门/砸碎
    if (abilities[POW_double]) {
      stepN = 1 << abilities[POW_double];
      setUsed(POW_double);
    }
    let k;
    for (k = 1; k <= stepN; k++) {
      const cx = wrapX(game.px + x * k),
        cy = wrapY(game.py + y * k);
      const isMid = k < stepN;
      if (isMid) {
        // 橙光双步只判定终点;中途格直接越过
        continue;
      }
      const kind = cellKind(z, cx, cy, abilities); // 终点判定(照原版;cellKind 参数为 列,行)
      if (kind === "block") return ret(false, `被挡: ${dbgBlockReason(z, cx, cy, abilities)}`);
      if (kind === "door") {
        setUsed(POW_doors);
        game.ability_flag = used;
        world.tile[z][cy][cx] = T.opendoor;
        game.pdir = proposed_pdir;
        lightDirty = true;
        pauseInput();
        if (D) D.landing = dbgCellDesc(z, cx, cy);
        return ret("open", "开门 open_door,人不动");
      }
      if (kind === "stone") {
        setUsed(POW_destroy);
        game.ability_flag = used;
        world.obj[z][cy][cx].type = O.empty;
        game.pdir = proposed_pdir;
        lightDirty = true;
        pauseInput();
        if (D) D.landing = dbgCellDesc(z, cx, cy);
        return ret("destroy", "碎石 清空,人不动");
      }
      if (world.tile[z][cy][cx] === T.wall) {
        setUsed(POW_walls);
        usedWall = true;
      }
      gx = cx;
      gy = cy;
    }
  } else {
    const kindT = cellKind(z, gx, gy, abilities); // cellKind(列,行):gx=列,gy=行
    if (kindT === "block") return ret(false, `被挡: ${dbgBlockReason(z, gx, gy, abilities)}`);
    if (kindT === "door") {
      setUsed(POW_doors);
      game.ability_flag = used;
      world.tile[z][gy][gx] = T.opendoor;
      game.pdir = proposed_pdir;
      lightDirty = true;
      pauseInput();
      if (D) D.landing = dbgCellDesc(z, gx, gy);
      return ret("open", "开门 open_door,人不动");
    }
    if (kindT === "stone") {
      setUsed(POW_destroy);
      game.ability_flag = used;
      world.obj[z][gy][gx].type = O.empty;
      game.pdir = proposed_pdir;
      lightDirty = true;
      pauseInput();
      if (D) D.landing = dbgCellDesc(z, gx, gy);
      return ret("destroy", "碎石 清空,人不动");
    }
    if (world.tile[z][gy][gx] === T.wall) {
      setUsed(POW_walls);
      usedWall = true;
    }
  }

  // ---- 落地(共用) ----
  const tgtObj = world.obj[z][gy][gx];
  let got_wand = false;
  if (tgtObj.type === O.wand) {
    game.has_wand = true;
    tgtObj.type = O.empty;
    got_wand = true;
  }

  let fx0 = game.px,
    fy0 = game.py;
  game.ability_flag = used;
  let nz = z;
  if (world.tile[z][gy][gx] === T.stairs) nz = (z + 1) % 2;

  game.px = gx;
  game.py = gy;
  game.pz = nz;
  game.pdir = proposed_pdir;
  game.player_timer = 80;
  startAnim(fx0, fy0);
  game.steps++;
  if (nz !== z) lightDirty = true;
  if (got_wand) {
    ckptSnap = buildSnap();
  } // 魔杖快照(菜单恢复用)
  if (D) D.landing = dbgCellDesc(nz, game.px, game.py);
  return ret(
    "move",
    `移动成功${travel ? " [紫光远行]" : stepN > 1 ? ` [橙光双步×${stepN}]` : ""}${usedWall ? " [绿光穿墙]" : ""}${nz !== z ? " [楼梯切层]" : ""}${got_wand ? " [拾取魔杖]" : ""}`,
  );
}

/**
 * 功能:返回玩家状态快照,供调试/存档逻辑使用。
 */
function snapshotState() {
  return {
    px: game.px,
    py: game.py,
    pz: game.pz,
    pdir: game.pdir,
    steps: game.steps,
    ability_flag: game.ability_flag,
    num_gems: game.num_gems,
    gems_stored: game.gems_stored,
    has_wand: game.has_wand,
    num_zaps: game.num_zaps,
    egg_timer: game.egg_timer,
  };
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.tryMove = tryMove;
globalThis.snapshotState = snapshotState;
