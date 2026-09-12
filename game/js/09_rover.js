"use strict";
/* PROMESST 2 网页版移植  09_rover.js
   Rover 自主移动与主计时器步进
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- Rover(移植 move_rovers 体系,L1093–1218;同房同步,单/多只通用) ----------
/**
 * 功能:判断 rover 能否进入指定格;allowGem 控制是否允许吃宝石。
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
  if (o.type === O.gem) return allowGem;
  return o.type === O.empty;
}
// rover 首选方向:反转期(reverse>0)保持直行;否则踩箭头按箭头,被堵尝试掉头
/**
 * 功能:计算 rover 的下一步方向:反转期直行,否则按箭头并在堵住时尝试掉头。
 * @param {*} z
 * @param {*} rover
 * @param {*} cx
 * @param {*} cy
 */
function roverDir(z, rover, cx, cy) {
  let d = rover.dir;
  if (reverse_timer > 0) return d;
  const tt = world.tile[z][cy][cx];
  if (tt >= T.arrow_e && tt < T.arrow_e + 4) d = tt - T.arrow_e;
  if (roverCanEnter(z, cx + XD[d], cy + YD[d], true)) return d;
  const d2 = (d + 2) & 3;
  if (d2 !== d && roverCanEnter(z, cx + XD[d2], cy + YD[d2], true)) return d2;
  return -1;
}
// 驱动玩家所在层的所有房间(每 630ms 一次,同 C 只跑 pz 层)
/**
 * 功能:同步步进玩家所在层所有房间的 rover,处理吃宝石、反转计时和碰撞。
 */
function stepRovers() {
  // 实现:先处理反转结束调头,再按房间收集 rover 并同步计算目标/碰撞/吃宝石。
  const z = game.pz;
  // 反转计时到 0:首只 rover 调头 180° 并恢复箭头逻辑(照 C L1168–1171/L1216–1217)
  if (reverse_timer === 0) {
    outer: for (let ry = 0; ry < NY; ry++)
      for (let rx = 0; rx < NX; rx++)
        for (let yy = 0; yy < SY; yy++)
          for (let xx = 0; xx < SX; xx++) {
            const o0 = world.obj[z][ry * SY + yy][rx * SX + xx];
            if (o0.type === O.rover) {
              o0.dir = (o0.dir + 2) & 3;
              break outer;
            }
          }
    reverse_timer = -1;
  }
  let rx2, ry2;
  for (ry2 = 0; ry2 < NY; ry2++)
    for (rx2 = 0; rx2 < NX; rx2++) {
      let x0 = rx2 * SX,
        y0 = ry2 * SY,
        yy2,
        xx2;
      const list = [];
      for (yy2 = 0; yy2 < SY; yy2++)
        for (xx2 = 0; xx2 < SX; xx2++) {
          const o = world.obj[z][y0 + yy2][x0 + xx2];
          if (o.type === O.rover) list.push({ o: o, x: x0 + xx2, y: y0 + yy2 });
        }
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const d = roverDir(z, r.o, r.x, r.y);
        if (d < 0) continue;
        const nx = r.x + XD[d],
          ny = r.y + YD[d];
        if (!roverCanEnter(z, nx, ny, true)) continue;
        const target = world.obj[z][ny][nx];
        if (target.type === O.rover) continue; // 目标有另一只:本只等待
        let clash = false;
        for (let j = 0; j < i; j++)
          if (list[j].moved && list[j].nx === nx && list[j].ny === ny) clash = true;
        if (clash) continue; // 同房多只同争一格:先到先得
        if (target.type === O.gem) {
          // 吃宝石 → 计数 + 反转计时
          game.gems_stored++;
          feed_timer = FEED_MS;
          reverse_timer = REVERSE_MS;
        }
        world.obj[z][r.y][r.x].type = O.empty;
        world.obj[z][ny][nx].type = O.rover;
        world.obj[z][ny][nx].dir = d;
        r.moved = true;
        r.nx = nx;
        r.ny = ny;
        lightDirty = true; // 吃掉的若在底座上,供电会变
      }
    }
}

// ---------- 计时器步进(移植 timestep,L1237–1325:M3 能力 + M4 rover/宝石) ----------
/**
 * 功能:按毫秒推进喂食/反转/rover/玩家输入和结局计时。
 * @param {*} ms
 */
function update(ms) {
  // 实现:按顺序推进计时器、rover 步进、玩家输入处理与结局计时。
  // 魔杖归一(照 C:has_wand && gems_stored<0 → 0)
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
      // c=反射镜(逻辑保留)——后续里程碑
    }
  }

  // 集满 30 颗后累计 egg_timer,驱动结局动画(照 C L1322–1324;必须与是否有输入无关)
  if (game.gems_stored >= MAX_GEMS) {
    game.egg_timer += ms;
  }
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.roverCanEnter = roverCanEnter;
globalThis.roverDir = roverDir;
globalThis.stepRovers = stepRovers;
globalThis.update = update;
