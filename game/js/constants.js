"use strict";
/* PROMESST 2 网页版移植  constants.js
   规则常量、颜色/字体常量与特性开关
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 常量(与 main.c 一致) ----------
const SX = 6,
  SY = 6,
  NX = 4,
  NY = 4; // 房间 6×6,每层 4×4
// 世界总宽 WW、总高 WH(单位:格)。
const WW = NX * SX,
  WH = NY * SY; // 24×24
// 方向枚举:0=E,1=N,2=W,3=S。
const DIR_E = 0,
  DIR_N = 1,
  DIR_W = 2,
  DIR_S = 3;
// 四个方向对应的 x/y 位移;索引与 DIR_* 一致。
const XD = [1, 0, -1, 0],
  YD = [0, -1, 0, 1];
// 方向显示名,索引与 DIR_* 一致。
const DIRNAME = ["E", "N", "W", "S"];

// 瓦片类型枚举。
const T = {
  wall: 0,
  door: 1,
  opendoor: 2,
  floor: 3,
  recep: 4,
  frag: 5,
  arrow_e: 6,
  arrow_n: 7,
  arrow_w: 8,
  arrow_s: 9,
  stairs: 10,
  egg: 11,
};
// 蛋与结局相关瓦片的起始编号。
const EGG_BASE = 11;
// 物体类型枚举。
const O = {
  empty: 0,
  stone: 1,
  gem: 2,
  projector: 3,
  wand: 4,
  refl: 5,
  rover: 6,
};

// 颜色枚举与能力映射(POWER_* 值=颜色值,与 L707–712 一致)
// 颜色能力位(值=颜色枚举;与 L707–712 宏一致:destroy 是黄=4,勿用蓝)
const POW_doors = 0,
  POW_walls = 1,
  POW_destroy = 4,
  POW_double = 3,
  POW_travel = 5;

// 精灵表索引(与 tile_sprite[]/obj_sprite[] 一致)
const TILE_SPR = [
  [0, 0],
  [6, 0],
  [5, 0],
  [0, 3],
  [1, 4],
  [6, 2],
  [0, 3],
  [0, 3],
  [0, 3],
  [0, 3],
  [1, 3],
  [5, 3],
  [6, 3],
  [7, 3],
  [3, 1],
  [4, 1],
  [5, 1],
  [6, 5],
  [6, 6],
];
// 物体在精灵表中的行列索引。
const OBJ_SPR = [
  [6, 1],
  [2, 1],
  [0, 4],
  [0, 2],
  [2, 4],
  [5, 6],
  [6, 2],
];

// 投影器字母→颜色/方向(与 lights[]/lightdata[] 一致)
const LIGHTS = "rRPwgGHyYLtTVjoOAa";
// 投影器字符对应的颜色和初始朝向。
const LIGHTDATA = [
  {c: 0, d: DIR_E},
  {c: 0, d: DIR_N},
  {c: 0, d: DIR_S},
  {c: 0, d: DIR_W},
  {c: 1, d: DIR_E},
  {c: 1, d: DIR_S},
  {c: 1, d: DIR_W},
  {c: 4, d: DIR_S},
  {c: 4, d: DIR_E},
  {c: 4, d: DIR_W},
  {c: 5, d: DIR_W},
  {c: 5, d: DIR_S},
  {c: 5, d: DIR_N},
  {c: 5, d: DIR_E},
  {c: 3, d: DIR_E},
  {c: 3, d: DIR_W},
  {c: 3, d: DIR_N},
  {c: 3, d: DIR_S},
];
// 颜色显示名,索引与颜色枚举一致。
const CNAMES = ["红", "绿", "蓝", "橙", "黄", "紫", "青", "粉"];
// 颜色十六进制值,索引与颜色枚举一致。
const CCOL = [
  "#ff6b6b",
  "#59e06a",
  "#5aa9ff",
  "#ff9d5c",
  "#ffe66d",
  "#b07cff",
  "#5ee8d8",
  "#ff8cd8",
];
// 调试显示用的中文名
const TILE_CN = [
  "墙",
  "门",
  "开门",
  "地板",
  "底座",
  "碎石",
  "箭E",
  "箭N",
  "箭W",
  "箭S",
  "楼梯",
  "蛋1",
  "蛋2",
  "蛋3",
  "蛋4",
  "蛋5",
  "蛋6",
  "蛋7",
  "蛋8",
];
// 物体调试中文名,索引与 O 一致。
const OBJ_CN = ["空", "石块", "宝石", "投影器", "魔杖", "反射镜", "rover"];

// 原版内置字体(main.c L1685–1689):字符集与字宽,用于 YOU WIN / 气泡等世界内文字
const FONT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789>^<v/ ";
// 内置字体每个字符的宽度。
const FSIZE = [
  4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 3, 4, 5, 5, 5, 5, 4,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 4,
];

// ---------- 里程碑特性开关 ----------
const FEATURE_LIGHT = true; // M3:供电+光束+能力 已启用
const FEATURE_ROVER = true; // M4:Rover 自主移动 + V 宝石拾放 已启用

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.SX = SX;
globalThis.SY = SY;
globalThis.NX = NX;
globalThis.NY = NY;
globalThis.WW = WW;
globalThis.WH = WH;
globalThis.DIR_E = DIR_E;
globalThis.DIR_N = DIR_N;
globalThis.DIR_W = DIR_W;
globalThis.DIR_S = DIR_S;
globalThis.XD = XD;
globalThis.YD = YD;
globalThis.DIRNAME = DIRNAME;
globalThis.T = T;
globalThis.EGG_BASE = EGG_BASE;
globalThis.O = O;
globalThis.POW_doors = POW_doors;
globalThis.POW_walls = POW_walls;
globalThis.POW_destroy = POW_destroy;
globalThis.POW_double = POW_double;
globalThis.POW_travel = POW_travel;
globalThis.TILE_SPR = TILE_SPR;
globalThis.OBJ_SPR = OBJ_SPR;
globalThis.LIGHTS = LIGHTS;
globalThis.LIGHTDATA = LIGHTDATA;
globalThis.CNAMES = CNAMES;
globalThis.CCOL = CCOL;
globalThis.TILE_CN = TILE_CN;
globalThis.OBJ_CN = OBJ_CN;
globalThis.FONT = FONT;
globalThis.FSIZE = FSIZE;
globalThis.FEATURE_LIGHT = FEATURE_LIGHT;
globalThis.FEATURE_ROVER = FEATURE_ROVER;
