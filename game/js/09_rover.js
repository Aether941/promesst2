"use strict";
/* PROMESST 2 网页版移植  09_rover.js
   Rover 自主移动与主计时器步进
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- Rover(移植 move_rovers 体系,L1093-1218;同房同步,单/多只通用) ----------
/**
 * 功能:判断 rover 能否进入指定格;allowGem 控制是否允许吃宝石。
 * 说明:这是保留给调试/外部探针的旧接口(只限制世界边界);
 *      实际 AI 使用下方 roveAllowed(),它额外限制在同一 6x6 房间内,与原版一致。
 * @param {*} z
 * @param {*} cx
 * @param {*} cy
 * @param {*} allowGem
 */
function roverCanEnter(z, cx, cy, allowGem) {
  if (cx < 0 || cx >= WW || cy < 0 || cy >= WH) return false;
  const t = world.tile[z][cy][cx];
  if (t === T.wall || t === T.door) return false;
  const o = world.obj[z][cy][cx];
  if (o.type === O.gem) return !!allowGem;
  return o.type === O.empty;
}

/**
 * 功能:原版 rove_allowed():目标必须在同一 6x6 房间内,非墙非门,
 *      且为空格或宝石(rover 可吃宝石)。
 * @param {*} z
 * @param {*} cx 目标列
 * @param {*} cy 目标行
 * @param {*} rx 房间左上角列
 * @param {*} ry 房间左上角行
 */
function roveAllowed(z, cx, cy, rx, ry) {
  if (cx < rx || cx >= rx + SX || cy < ry || cy >= ry + SY) return false;
  return roverCanEnter(z, cx, cy, true);
}

// rover 首选方向:照原版 preferred_rove_direction()(L1118-1135)。
// 注意反转特例:reverse_timer === 0 时直接返回当前朝向,不检查箭头/阻挡;
// move_rovers 随后会把第一只 rover 掉头 180 度,下一拍才使用新方向。
/**
 * 功能:计算 rover 的首选方向。
 * @param {*} z 层
 * @param {*} x 房间内列
 * @param {*} y 房间内行
 * @param {*} rx 房间左上角列
 * @param {*} ry 房间左上角行
 * @param {*} occupied 6x6 冲突计数表
 * @param {*} dirOverride 可选:显式朝向(外部 roverDir 探针用);默认读 world.obj
 */
function preferredRoveDirection(z, x, y, rx, ry, occupied, dirOverride) {
  const cx = rx + x,
    cy = ry + y;
  let d =
    typeof dirOverride === "number"
      ? dirOverride
      : world.obj[z][cy][cx].dir;

  // 原版:反转到 0 的那一拍强制沿用当前朝向,由 move_rovers 负责掉头。
  if (reverse_timer === 0) return d;

  const tt = world.tile[z][cy][cx];
  if (tt >= T.arrow_e && tt < T.arrow_e + 4) d = tt - T.arrow_e;

  if (!roveAllowed(z, cx + XD[d], cy + YD[d], rx, ry) || occupied[y][x] > 1)
    d = (d + 2) & 3;
  if (!roveAllowed(z, cx + XD[d], cy + YD[d], rx, ry) || occupied[y][x] > 1)
    return -1;

  return d;
}

/**
 * 功能:兼容旧接口的方向探针;内部创建空冲突表,调用 preferredRoveDirection()。
 * @param {*} z
 * @param {*} rover
 * @param {*} cx
 * @param {*} cy
 * @param {*} roomX 可选房间左上角列
 * @param {*} roomY 可选房间左上角行
 */
function roverDir(z, rover, cx, cy, roomX, roomY) {
  if (typeof roomX !== "number") roomX = Math.floor(cx / SX) * SX;
  if (typeof roomY !== "number") roomY = Math.floor(cy / SY) * SY;
  const occupied = [];
  for (let y = 0; y < SY; y++) occupied.push(new Array(SX).fill(0));
  const lx = cx - roomX,
    ly = cy - roomY;
  if (lx < 0 || lx >= SX || ly < 0 || ly >= SY) return -1;
  return preferredRoveDirection(
    z,
    lx,
    ly,
    roomX,
    roomY,
    occupied,
    rover ? rover.dir : undefined,
  );
}

/**
 * 功能:原版 move_rovers():同一房间内 rover 同步移动,按 occupied 冲突表迭代到不动点。
 * @param {*} roomX 房间列(0..NX-1)
 * @param {*} roomY 房间行(0..NY-1)
 */
function moveRovers(roomX, roomY) {
  const z = game.pz;
  const rx = roomX * SX,
    ry = roomY * SY;

  // 1) 让每只 rover 先声明想去哪,并记录到冲突表 occupied。
  const occupied = [];
  for (let y = 0; y < SY; y++) occupied.push(new Array(SX).fill(0));
  const rovers = [];
  for (let y = 0; y < SY; y++)
    for (let x = 0; x < SX; x++) {
      const o = world.obj[z][ry + y][rx + x];
      if (o.type >= O.rover) {
        const d = preferredRoveDirection(z, x, y, rx, ry, occupied);
        if (d < 0) occupied[y][x]++;
        else {
          const oy = y + YD[d],
            ox = x + XD[d];
          // reverse_timer === 0 can point outside the 6x6 room. C writes
          // its local occupied table out of bounds there; guard to avoid a
          // JS TypeError. The move loop still uses global objmap coords.
          if (oy >= 0 && oy < SY && ox >= 0 && ox < SX) occupied[oy][ox]++;
        }
        rovers.push({ s: x, t: y });
      }
    }

  // 2) 反转到 0:第一只 rover 掉头,随后在本次移动循环中立刻使用新方向。
  if (reverse_timer === 0 && rovers.length) {
    const first = rovers[0];
    const o0 = world.obj[z][ry + first.t][rx + first.s];
    o0.dir = (o0.dir + 2) & 3;
  }

  // 3) 迭代到不动点,避免互相穿模 / 被正在离开的 rover 堵住。
  let anyChange = true;
  while (anyChange) {
    anyChange = false;
    for (let i = 0; i < rovers.length; i++) {
      const r = rovers[i];
      if (r.s < 0) continue;

      const d = preferredRoveDirection(z, r.s, r.t, rx, ry, occupied);
      if (d < 0) {
        world.obj[z][ry + r.t][rx + r.s].type = O.rover;
      } else {
        const tx = rx + r.s + XD[d],
          ty = ry + r.t + YD[d];
        // 正常路径由 roveAllowed 保证不越界;这里只防 reverse_timer===0 的反转特例。
        if (tx < 0 || tx >= WW || ty < 0 || ty >= WH) {
          r.s = -1;
          anyChange = true;
          continue;
        }
        const target = world.obj[z][ty][tx];
        // 原版只检查目标是否是 rover;若另一只 rover 正在离开,本轮先等待。
        if (target.type >= O.rover) continue;

        if (target.type === O.gem) {
          game.gems_stored++;
          feed_timer = FEED_MS;
          reverse_timer = REVERSE_MS;
        }

        world.obj[z][ry + r.t][rx + r.s].type = O.empty;
        target.type = O.rover;
        target.dir = d;
        lightDirty = true;
      }

      r.s = -1;
      anyChange = true;
    }
  }

  if (reverse_timer === 0 && rovers.length) reverse_timer = -1;
}

/**
 * 功能:驱动玩家所在层的所有房间(每 630ms 一次,同 C 只跑 pz 层);
 *      每个房间独立调用 moveRovers(),因此 rover 不会跨房间。
 */
function stepRovers() {
  for (let ry = 0; ry < NY; ry++)
    for (let rx = 0; rx < NX; rx++) moveRovers(rx, ry);
}

// ---------- 计时器步进(移植 timestep,L1237-1325:M3 能力 + M4 rover/宝石) ----------
/**
 * 功能:按毫秒推进喂食/反转/rover/玩家输入和结局计时。
 * @param {*} ms
 */
function update(ms) {
  // 实现:按顺序推进计时器、rover 步进、玩家输入处理与结局计时。
  // 魔杖归一(照 C:has_wand && gems_stored < 0 -> 0)
  if (game.has_wand && game.gems_stored < 0) game.gems_stored = 0;

  if (feed_timer > 0) {
    feed_timer -= ms;
    if (feed_timer < 0) feed_timer = 0;
  }
  if (reverse_timer > 0) {
    reverse_timer -= ms;
    if (reverse_timer < 0) reverse_timer = 0;
  }

  // Rover 自主步进(玩家所在层;宝石未集满或仍在反转期才继续)
  if (FEATURE_ROVER && (game.gems_stored < MAX_GEMS || reverse_timer > 0)) {
    rover_timer -= ms;
    let guard = 0;
    while (rover_timer < 0 && guard < 4 && (game.gems_stored < MAX_GEMS || reverse_timer > 0)) {
      rover_timer += ROVER_MS;
      stepRovers();
      guard++;
    }
  }

  if (game.player_timer > 0) {
    game.player_timer -= ms;
    if (game.player_timer < 0) game.player_timer = 0;
  }
  if (game.player_timer <= 0) {
    let ch = null;
    if (q) {
      ch = q;
      q = null;
    } else if (held.length) {
      ch = held[held.length - 1];
    }
    if (ch) {
      let dx = 0,
        dy = 0;
      if (ch === "a") dx = -1;
      else if (ch === "d") dx = 1;
      else if (ch === "w") dy = -1;
      else if (ch === "s") dy = 1;
      if (dx || dy) {
        tryMove(dx, dy);
        commitHistory();
      } else if (ch === "x") {
        shoot();
        commitHistory();
      } else if (ch === "v") {
        drop();
        commitHistory();
      } else if (ch === "z") {
        undo();
      }
      // c=反射镜(逻辑保留) - 后续里程碑
    }
  }

  // 集满 30 颗后累计 egg_timer,驱动结局动画(照 C L1322-1324;必须与是否有输入无关)
  if (game.gems_stored >= MAX_GEMS) {
    game.egg_timer += ms;
  }
  updateDebugCharges(ms);
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.roverCanEnter = roverCanEnter;
globalThis.roveAllowed = roveAllowed;
globalThis.preferredRoveDirection = preferredRoveDirection;
globalThis.roverDir = roverDir;
globalThis.moveRovers = moveRovers;
globalThis.stepRovers = stepRovers;
globalThis.update = update;
