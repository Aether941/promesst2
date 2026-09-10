"use strict";
/* PROMESST 2 网页版移植  state.js
   游戏状态、玩家/rover 计时器与复位
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 游戏状态 ----------
let world = null;
const game = {
  px: 0,
  py: 0,
  pz: 0,
  pdir: DIR_S,
  player_timer: 0, // 剩余“可输入”时间(80→0)
  ability_flag: 0,
  num_gems: 0,
  gems_stored: -1,
  has_wand: false,
  num_zaps: 0,
  egg_timer: 0,
  steps: 0,
};
// 移动动画:原版只做“最后一格”的滑入(draw_world L2004–2009),
// 这里只记录本次移动的起点,供“跨世界缝瞬移”判定;动画由 player_timer 驱动
let animFromX = 0,
  animFromY = 0,
  animMove = false;
let animcycle = 0; // 原版 animcycle(ms),用于闪烁/彩虹等动画
let q = null; // 排队按键(单槽,同 C queued_key)
let held = []; // 按住中的移动键(最近优先)
let checkpoint = null;

// M4:Rover / 喂食计时(常量与 C 一致)
const MAX_GEMS = 30,
  ROVER_MS = 630,
  FEED_MS = 1200,
  REVERSE_MS = 1100;
let rover_timer = 0,
  feed_timer = 0,
  reverse_timer = -1;

function copyWorld() {
  const c = {tile: [], obj: []};
  for (let z = 0; z < 2; z++) {
    c.tile[z] = [];
    c.obj[z] = [];
    for (let y = 0; y < WH; y++) {
      c.tile[z][y] = world.tile[z][y].slice();
      c.obj[z][y] = [];
      for (let x = 0; x < WW; x++)
        c.obj[z][y][x] = {
          type: world.obj[z][y][x].type,
          dir: world.obj[z][y][x].dir,
          color: world.obj[z][y][x].color,
        };
    }
  }
  return c;
}

function reset() {
  world = parseWorld();
  const p = world.player;
  game.px = p.x;
  game.py = p.y;
  game.pz = p.z;
  game.pdir = DIR_S;
  game.player_timer = 0;
  animMove = false;
  game.ability_flag = 0;
  game.num_gems = 0;
  game.gems_stored = -1;
  game.has_wand = false;
  game.num_zaps = 0;
  game.egg_timer = 0;
  game.steps = 0;
  q = null;
  held = [];
  checkpoint = null;
  rover_timer = 0;
  feed_timer = 0;
  reverse_timer = -1;
  HISTORY = [];
  ckptSnap = null;
  if (typeof dbgReset === "function") dbgReset(); // 清空调试报告
  lightCache = [null, null];
  lightDirty = true;
  lastSnap = buildSnap();
  onViewChanged(true);
}

// 记录本次移动起点(仅用于跨世界缝判定)
function startAnim(fx, fy) {
  animFromX = fx;
  animFromY = fy;
  animMove = true;
}
// 开门/碎石这类“不位移但要占用一拍”的动作:停顿一拍,但不要做滑入动画
function pauseInput() {
  game.player_timer = 80;
  animMove = false;
}
