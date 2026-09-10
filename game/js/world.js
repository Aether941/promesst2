"use strict";
/* PROMESST 2 网页版移植  world.js
   关卡解析与初始世界构建
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 关卡解析(移植 init_game,同 ./map) ----------
/**
 * 功能:解析 RAW 地图:构建 tile/obj 双层数组,放置玩家、宝石、投影器、rover、蛋基座,并修正 rover 初向。
 */
function parseWorld() {
  // 实现:先初始化双层 tile/obj,再逐格解析字符,最后处理蛋基座与 rover 初向。
  const tile = [[], []],
    obj = [[], []];
  let player = null,
    egg = null;
  let z, y, x;
  for (z = 0; z < 2; z++) {
    tile[z] = new Array(WH);
    obj[z] = new Array(WH);
    for (y = 0; y < WH; y++) {
      tile[z][y] = new Array(WW).fill(T.floor);
      obj[z][y] = new Array(WW);
      for (x = 0; x < WW; x++) obj[z][y][x] = {type: O.empty, dir: 0, color: 0};
    }
  }
  for (z = 0; z < 2; z++) {
    for (y = 0; y < WH; y++) {
      const s = RAW[y][z];
      for (x = 0; x < WW; x++) {
        const idx = x + Math.floor(x / SX); // 跳房间间空格
        let d = idx < s.length ? s.charAt(idx) : " ";
        let o = obj[z][y][x],
          t = T.floor;
        switch (d) {
          case "p":
            player = {x: x, y: y, z: z};
            break;
          case ">":
            t = T.arrow_e;
            break;
          case "^":
            t = T.arrow_n;
            break;
          case "<":
            t = T.arrow_w;
            break;
          case "v":
            t = T.arrow_s;
            break;
          case "=":
            t = T.recep;
            break;
          case "D":
            t = T.door;
            break;
          case "#":
            t = T.stairs;
            break;
          case "/":
            o.type = O.refl;
            o.dir = 1;
            break;
          case "z":
            egg = {x: x, y: y};
            break;
          case "*":
            o.type = O.stone;
            break;
          case "-":
            o.type = O.wand;
            break;
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
          case "0":
            o.type = O.gem;
            o.dir = 0;
            t = T.recep;
            break;
          case "@":
          case "%":
            o.type = O.gem;
            o.dir = 0;
            break;
          case "&":
            o.type = O.rover;
            o.dir = DIR_E;
            break;
          case "r":
          case "R":
          case "w":
          case "P":
          case "g":
          case "G":
          case "H":
          case "y":
          case "Y":
          case "L":
          case "t":
          case "T":
          case "V":
          case "j":
          case "o":
          case "O":
          case "A":
          case "a":
            const li = LIGHTS.indexOf(d);
            o.type = O.projector;
            o.color = LIGHTDATA[li].c;
            o.dir = LIGHTDATA[li].d;
            break;
          case ".":
          case " ":
            break;
          default:
            t = T.wall;
            break;
        }
        tile[z][y][x] = t;
      }
    }
  }
  if (egg) {
    for (x = 0; x < 3; x++)
      tile[0][egg.y + 1][egg.x - 1 + x] = EGG_BASE + 3 + x;
  }
  // rover 初向(同 C)
  for (z = 0; z < 2; z++)
    for (y = 0; y < WH; y++)
      for (x = 0; x < WW; x++) {
        if (obj[z][y][x].type === O.rover) {
          for (let d = 0; d < 4; d++) {
            const ny = (((y - YD[d]) % WH) + WH) % WH,
              nx = (((x - XD[d]) % WW) + WW) % WW;
            if (tile[z][ny][nx] === T.arrow_e + d) {
              obj[z][y][x].dir = d;
              break;
            }
          }
        }
      }
  if (!player) {
    player = {x: 0, y: 0, z: 0};
  }
  return {tile: tile, obj: obj, player: player, egg: egg};
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.parseWorld = parseWorld;
