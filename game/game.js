"use strict";
/* ============================================================
   PROMESST 2 网页版移植 — game.js
   当前里程碑:M4(宝石拾放 V / Rover 自主移动 / 供电随放置刷新)
   设计源:docs-map-port/README.md v4;规则基准 main.c(2014)
   FEATURE_LIGHT / FEATURE_ROVER 均已启用。
   ============================================================ */

// ---------- 常量(与 main.c 一致) ----------
const SX=6, SY=6, NX=4, NY=4;          // 房间 6×6,每层 4×4
const WW=NX*SX, WH=NY*SY;              // 24×24
const DIR_E=0, DIR_N=1, DIR_W=2, DIR_S=3;
const XD=[1,0,-1,0], YD=[0,-1,0,1];
const DIRNAME=["E","N","W","S"];

const T={ wall:0, door:1, opendoor:2, floor:3, recep:4, frag:5,
        arrow_e:6, arrow_n:7, arrow_w:8, arrow_s:9, stairs:10, egg:11 };
const EGG_BASE=11;
const O={ empty:0, stone:1, gem:2, projector:3, wand:4, refl:5, rover:6 };

// 颜色枚举与能力映射(POWER_* 值=颜色值,与 L707–712 一致)
// 颜色能力位(值=颜色枚举;与 L707–712 宏一致:destroy 是黄=4,勿用蓝)
const POW_doors=0, POW_walls=1, POW_destroy=4, POW_double=3, POW_travel=5;

// 精灵表索引(与 tile_sprite[]/obj_sprite[] 一致)
const TILE_SPR=[
  [0,0],[6,0],[5,0],[0,3],[1,4],[6,2],
  [0,3],[0,3],[0,3],[0,3],
  [1,3],
  [5,3],[6,3],[7,3],[3,1],[4,1],[5,1],[6,5],[6,6]
];
const OBJ_SPR=[
  [6,1],[2,1],[0,4],[0,2],[2,4],[5,6],[6,2]
];

// 投影器字母→颜色/方向(与 lights[]/lightdata[] 一致)
const LIGHTS="rRPwgGHyYLtTVjoOAa";
const LIGHTDATA=[
  {c:0,d:DIR_E},{c:0,d:DIR_N},{c:0,d:DIR_S},{c:0,d:DIR_W},
  {c:1,d:DIR_E},{c:1,d:DIR_S},{c:1,d:DIR_W},
  {c:4,d:DIR_S},{c:4,d:DIR_E},{c:4,d:DIR_W},
  {c:5,d:DIR_W},{c:5,d:DIR_S},{c:5,d:DIR_N},{c:5,d:DIR_E},
  {c:3,d:DIR_E},{c:3,d:DIR_W},{c:3,d:DIR_N},{c:3,d:DIR_S}
];
const CNAMES=["红","绿","蓝","橙","黄","紫","青","粉"];
const CCOL =["#ff6b6b","#59e06a","#5aa9ff","#ff9d5c","#ffe66d","#b07cff","#5ee8d8","#ff8cd8"];
// 调试显示用的中文名
const TILE_CN=["墙","门","开门","地板","底座","碎石","箭E","箭N","箭W","箭S","楼梯","蛋1","蛋2","蛋3","蛋4","蛋5","蛋6","蛋7","蛋8"];
const OBJ_CN=["空","石块","宝石","投影器","魔杖","反射镜","rover"];

// 原版内置字体(main.c L1685–1689):字符集与字宽,用于 YOU WIN / 气泡等世界内文字
const FONT="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789>^<v/ ";
const FSIZE=[4,4,4,4,4,4,4,4,3,4,4,4,5,4,4,4,4,4,4,3,4,5,5,5,5,4,4,4,4,4,4,4,4,4,4,4,5,5,5,5,5,4];

// ---------- 里程碑特性开关 ----------
const FEATURE_LIGHT=true;    // M3:供电+光束+能力 已启用
const FEATURE_ROVER=true;    // M4:Rover 自主移动 + V 宝石拾放 已启用

// ---------- 数据与采样 ----------
const RAW=globalThis.PROMESST_MAP_RAW;
let ATLAS=128, CELL=16, img=null, imgData=null;
let powers=null;           // 8 种能力色(取样自精灵表,供 M3 光束)
const tileCache={};

function sample(x,y){
  const i=(y*ATLAS+x)*4;
  return [imgData.data[i],imgData.data[i+1],imgData.data[i+2],imgData.data[i+3]];
}
function computePowers(){
  powers=[];
  for(let i=0;i<8;i++) powers.push(sample(112+i,96));
}
function cellFrom(s,t){
  let key="c_"+s+"_"+t, c=tileCache[key];
  if(!c){ c=document.createElement("canvas"); c.width=CELL; c.height=CELL;
          c.getContext("2d").drawImage(img, s*CELL,t*CELL,CELL,CELL, 0,0,CELL,CELL);
          tileCache[key]=c; }
  return c;
}
// 用精灵表内置字体写文本(移植 draw_text L1691–1705)
function drawBmpText(g,x,y,size,text,spacing){
  spacing=spacing||0;
  for(let i=0;i<text.length;i++){
    const idx=FONT.indexOf(text.charAt(i));
    if(idx<0) continue;
    const sx=1+(idx%21)*6, sy=113+Math.floor(idx/21)*8;
    g.drawImage(img, sx,sy,5,7, x,y, size*5, size*7);
    x += size*(FSIZE[idx]+1+spacing);
  }
  return x;
}
function bmpTextWidth(size,text,spacing){
  spacing=spacing||0; let x=0;
  for(let i=0;i<text.length;i++){
    const idx=FONT.indexOf(text.charAt(i));
    if(idx>=0) x += size*(FSIZE[idx]+1+spacing);
  }
  return x;
}

// ---------- 关卡解析(移植 init_game,同 ./map) ----------
function parseWorld(){
  const tile=[[],[]], obj=[[],[]];
  let player=null, egg=null;
  let z,y,x;
  for(z=0;z<2;z++){
    tile[z]=new Array(WH); obj[z]=new Array(WH);
    for(y=0;y<WH;y++){
      tile[z][y]=new Array(WW).fill(T.floor);
      obj[z][y]=new Array(WW);
      for(x=0;x<WW;x++) obj[z][y][x]={type:O.empty,dir:0,color:0};
    }
  }
  for(z=0;z<2;z++){
    for(y=0;y<WH;y++){
      const s=RAW[y][z];
      for(x=0;x<WW;x++){
        const idx=x+Math.floor(x/SX);               // 跳房间间空格
        let d=idx<s.length ? s.charAt(idx) : " ";
        let o=obj[z][y][x], t=T.floor;
        switch(d){
          case "p": player={x:x,y:y,z:z}; break;
          case ">": t=T.arrow_e; break;
          case "^": t=T.arrow_n; break;
          case "<": t=T.arrow_w; break;
          case "v": t=T.arrow_s; break;
          case "=": t=T.recep; break;
          case "D": t=T.door; break;
          case "#": t=T.stairs; break;
          case "/": o.type=O.refl; o.dir=1; break;
          case "z": egg={x:x,y:y}; break;
          case "*": o.type=O.stone; break;
          case "-": o.type=O.wand; break;
          case "1": case "2": case "3": case "4": case "5":
          case "6": case "7": case "8": case "9": case "0":
            o.type=O.gem; o.dir=0; t=T.recep; break;
          case "@": case "%":
            o.type=O.gem; o.dir=0; break;
          case "&": o.type=O.rover; o.dir=DIR_E; break;
          case "r": case "R": case "w": case "P":
          case "g": case "G": case "H":
          case "y": case "Y": case "L":
          case "t": case "T": case "V": case "j":
          case "o": case "O": case "A": case "a":
            const li=LIGHTS.indexOf(d);
            o.type=O.projector; o.color=LIGHTDATA[li].c; o.dir=LIGHTDATA[li].d;
            break;
          case ".": case " ": break;
          default: t=T.wall; break;
        }
        tile[z][y][x]=t;
      }
    }
  }
  if(egg){ for(x=0;x<3;x++) tile[0][egg.y+1][egg.x-1+x]=EGG_BASE+3+x; }
  // rover 初向(同 C)
  for(z=0;z<2;z++) for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    if(obj[z][y][x].type===O.rover){
      for(let d=0;d<4;d++){
        const ny=((y-YD[d])%WH+WH)%WH, nx=((x-XD[d])%WW+WW)%WW;
        if(tile[z][ny][nx]===T.arrow_e+d){ obj[z][y][x].dir=d; break; }
      }
    }
  }
  if(!player){ player={x:0,y:0,z:0}; }
  return {tile:tile, obj:obj, player:player, egg:egg};
}

// ---------- 供电与光束(移植,FEATURE_LIGHT 打开后启用) ----------
function computePowered(z,world){
  const pw=[]; let ry,rx,y,x;
  for(ry=0;ry<NY;ry++) pw[ry]=new Array(NX).fill(0);
  for(y=0;y<WH;y++) for(x=0;x<WW;x++)
    if(world.tile[z][y][x]===T.recep) pw[(y/SY)|0][(x/SX)|0]=1;
  for(y=0;y<WH;y++) for(x=0;x<WW;x++)
    if(world.tile[z][y][x]===T.recep && world.obj[z][y][x].type!==O.gem)
      pw[(y/SY)|0][(x/SX)|0]=0;
  return pw;
}
function propagate(z,world,pw){
  let L=[], any=[], y,x;
  for(y=0;y<WH;y++){ L[y]=[]; any[y]=new Array(WW).fill(0);
    for(x=0;x<WW;x++) L[y].push([-1,-1,-1,-1]); }
  function wrapX(a){ return ((a%WW)+WW)%WW; }
  function wrapY(a){ return ((a%WH)+WH)%WH; }
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    const o=world.obj[z][y][x];
    if(o.type!==O.projector) continue;
    if(!pw[(y/SY)|0][(x/SX)|0]) continue;
    let dir=o.dir, ax=x, dx=XD[o.dir], ay=y, dy=YD[o.dir];
    for(;;){
      ax=wrapX(ax+dx); ay=wrapY(ay+dy);
      if(world.tile[z][ay][ax]===T.door) break;
      if(world.obj[z][ay][ax].type===O.refl){
        if(world.obj[z][ay][ax].dir===0) dir^=1; else dir^=3;
        dx=XD[dir]; dy=YD[dir];
      } else {
        if(world.obj[z][ay][ax].type!==O.empty) break;
      }
      L[ay][ax][dir]=o.color; any[ay][ax]=1;
    }
  }
  return {L:L, any:any};
}

// ---------- 游戏状态 ----------
let world=null;
const game={
  px:0, py:0, pz:0, pdir:DIR_S,
  player_timer:0,            // 剩余“可输入”时间(80→0)
  ability_flag:0,
  num_gems:0, gems_stored:-1,
  has_wand:false, num_zaps:0, egg_timer:0,
  steps:0
};
// 移动动画:原版只做“最后一格”的滑入(draw_world L2004–2009),
// 这里只记录本次移动的起点,供“跨世界缝瞬移”判定;动画由 player_timer 驱动
let animFromX=0, animFromY=0, animMove=false;
let animcycle=0;               // 原版 animcycle(ms),用于闪烁/彩虹等动画
let q=null;                   // 排队按键(单槽,同 C queued_key)
let held=[];                  // 按住中的移动键(最近优先)
let checkpoint=null;

// M4:Rover / 喂食计时(常量与 C 一致)
const MAX_GEMS=30, ROVER_MS=630, FEED_MS=1200, REVERSE_MS=1100;
let rover_timer=0, feed_timer=0, reverse_timer=-1;

function copyWorld(){
  const c={tile:[], obj:[]};
  for(let z=0;z<2;z++){
    c.tile[z]=[]; c.obj[z]=[];
    for(let y=0;y<WH;y++){
      c.tile[z][y]=world.tile[z][y].slice();
      c.obj[z][y]=[];
      for(let x=0;x<WW;x++) c.obj[z][y][x]={type:world.obj[z][y][x].type,
        dir:world.obj[z][y][x].dir, color:world.obj[z][y][x].color};
    }
  }
  return c;
}

function reset(){
  world=parseWorld();
  const p=world.player;
  game.px=p.x; game.py=p.y; game.pz=p.z; game.pdir=DIR_S;
  game.player_timer=0; animMove=false;
  game.ability_flag=0; game.num_gems=0; game.gems_stored=-1;
  game.has_wand=false; game.num_zaps=0; game.egg_timer=0; game.steps=0;
  q=null; held=[]; checkpoint=null;
  rover_timer=0; feed_timer=0; reverse_timer=-1;
  HISTORY=[]; ckptSnap=null;
  if(typeof dbgReset==="function") dbgReset();   // 清空调试报告
  lightCache=[null,null]; lightDirty=true;
  lastSnap=buildSnap();
  onViewChanged(true);
}

// 记录本次移动起点(仅用于跨世界缝判定)
function startAnim(fx,fy){
  animFromX=fx; animFromY=fy; animMove=true;
}
// 开门/碎石这类“不位移但要占用一拍”的动作:停顿一拍,但不要做滑入动画
function pauseInput(){
  game.player_timer=80; animMove=false;
}

// ---------- 光照缓存 / 能力判定 / 射击(移植 compute_powered+propagate 应用层) ----------
let lightCache=[null,null];   // lightCache[z]={pw,L,any}
let lightDirty=true;

function wrapX(a){ return ((a%WW)+WW)%WW; }
function wrapY(a){ return ((a%WH)+WH)%WH; }

// 紫光远行滑行:严格照 main.c L753–770
//   1) 起点必须有紫光(按键方向 proposed 或其反向 proposed^2);
//   2) 沿按键方向逐格走,只看“该格是否仍在紫光上”,**不判墙/物体**——因为光束本身穿墙(§7-B);
//   3) 走到第一格不在紫光上时退回一格,即“最后一格仍在紫光上”的格子;
//   4) 若退回后仍在原地,则原版把 travel 清零(退化为普通移动)。
// 落点的墙/门/石块判定由 move() 后续 L787–801 统一处理(墙无绿光则整个动作失败,人不动)。
function glideTarget(z,px,py,pdir,L){
  if(!L) return null;
  const x=XD[pdir], y=YD[pdir];
  function lit(r,c){
    return L.L[r][c][pdir]===POW_travel || L.L[r][c][pdir^2]===POW_travel;
  }
  if(!lit(py,px)) return null;
  let gx=wrapX(px+x), gy=wrapY(py+y);
  while(lit(gy,gx)){ gx=wrapX(gx+x); gy=wrapY(gy+y); }
  gx=wrapX(gx-x); gy=wrapY(gy-y);
  if(gx===px && gy===py) return null;      // 原版:退化为普通移动
  return {x:gx,y:gy};
}

function ensureLight(){
  if(!FEATURE_LIGHT) return;
  const z=game.pz;
  if(!lightCache[z]||lightDirty){
    const pw=computePowered(z,world);
    lightCache[z]=propagate(z,world,pw);
    lightCache[z].pw=pw;
    lightDirty=false;
  }
}

// 能力判定(移植 get_abilities,L714–721):站在玩家格,统计四向入射光颜色
function getAbilities(out){
  for(let i=0;i<8;i++) out[i]=0;
  if(!FEATURE_LIGHT) return out;
  ensureLight();
  const L=lightCache[game.pz].L;
  for(let d=0;d<4;d++){
    const c=L[game.py][game.px][d];
    if(c>=0) out[c]+=1;
  }
  return out;
}

// 找出所有照到玩家格的有电投影器(移植 find_lights_on_player,L538–577)
function findLightsOnPlayer(){
  const out=[];
  if(!FEATURE_LIGHT) return out;
  ensureLight();
  const pw=lightCache[game.pz].pw, z=game.pz;
  let y,x;
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    const o=world.obj[z][y][x];
    if(o.type!==O.projector) continue;
    if(!pw[(y/SY)|0][(x/SX)|0]) continue;      // 未通电不发光
    let dir=o.dir, ax=x, dx=XD[o.dir], ay=y, dy=YD[o.dir];
    for(;;){
      ax=wrapX(ax+dx); ay=wrapY(ay+dy);
      if(ax===game.px && ay===game.py) out.push({x:x,y:y});
      if(world.tile[z][ay][ax]===T.door) break;
      if(world.obj[z][ay][ax].type===O.refl){
        if(world.obj[z][ay][ax].dir===0) dir^=1; else dir^=3;
        dx=XD[dir]; dy=YD[dir];
      } else {
        if(world.obj[z][ay][ax].type!==O.empty) break;
      }
    }
  }
  return out;
}

// X 键:射击 —— 把照到玩家的投影器重定向到玩家朝向(移植 shoot,L1026–1051)
function shoot(){
  if(!game.has_wand) return false;
  let z=game.pz, any=false;
  const hits=findLightsOnPlayer();
  for(let i=0;i<hits.length;i++){
    const o=world.obj[z][hits[i].y][hits[i].x];
    if(o.type===O.projector && o.dir!==game.pdir){
      o.dir=game.pdir; any=true;
    }
  }
  if(any){ game.num_zaps++; lightDirty=true; return true; }
  return false;
}

// ---------- 调试:移动判定报告(覆盖全部颜色,最近 3 次) ----------
let noclip=false, debugOn=false;
let dbgMsg="移动判定:—";     // 面板显示文本
let dbgLog=[];               // 最近 3 次报告
function dbgReset(){ dbgLog=[]; dbgMsg="移动判定:—"; }
function dbgTileName(z,cx,cy){ return TILE_CN[world.tile[z][cy][cx]]; }
function dbgCellDesc(z,cx,cy){
  let o=world.obj[z][cy][cx], extra="";
  if(o.type===O.projector) extra="(色="+CNAMES[o.color]+" 向="+DIRNAME[o.dir]+")";
  else if(o.type===O.refl) extra="(姿态="+(o.dir?"\\\\":"/")+")";
  return "("+cx+","+cy+") 瓦片="+dbgTileName(z,cx,cy)+" 物体="+OBJ_CN[o.type]+extra;
}
function dbgBlockReason(z,cx,cy,ab){
  const t=world.tile[z][cy][cx], o=world.obj[z][cy][cx];
  if(o.type===O.projector) return "投影器不可站(原版 L794)";
  if(o.type===O.refl)      return "反射镜不可站(原版 L819)";
  if(t===T.wall)  return "墙需要绿光(穿墙)";
  if(t===T.door)  return "门需要红光(开门)";
  if(o.type===O.stone) return "石块需要黄光(碎石)";
  return "未知";
}
function dbgStart(x,y,z){
  if(!debugOn) return null;
  const dirName = x ? (x>0?"→E 右":"←W 左") : (y>0?"↓S 下":"↑N 上");
  const ab=[0,0,0,0,0,0,0,0];
  getAbilities(ab);
  let L=FEATURE_LIGHT?lightCache[z]:null, lightStr="(无光照数据)";
  if(L){
    const p=[];
    for(let i=0;i<4;i++){
      const v=L.L[game.py][game.px][i];
      p.push(["E","N","W","S"][i]+"="+(v>=0?CNAMES[v]:"—"));
    }
    lightStr=p.join(" ");
  }
  return { lines:[
    "── 按键 "+dirName+" | 从 ("+game.px+","+game.py+") Z"+z+" 朝向="+DIRNAME[game.pdir],
    "入射光(玩家格四向) "+lightStr,
    "能力计数 红(开门)"+ab[0]+" 绿(穿墙)"+ab[1]+" 黄(碎石)"+ab[4]+
      " 橙(双步)"+ab[3]+" 紫(远行)"+ab[5]+" flag=0x"+game.ability_flag.toString(16)
  ]};
}
function dbgAdd(D,s){ if(D) D.lines.push(s); }
function dbgFinish(D,desc){
  if(!D) return;
  D.lines.push("结果: "+desc);
  const text=D.lines.join("\n");
  dbgLog.unshift(text);
  if(dbgLog.length>3) dbgLog.length=3;
  dbgMsg=dbgLog.join("\n· · · · ·\n");
  try{ if(window.console) console.log("[PROMESST2 移动判定]\n"+text); }catch(e){}
}
function cheatWand(){ game.has_wand=true; game.num_gems=30; }
function cheatNoclip(){ noclip=!noclip; }

// 目标格分类(参数为 **列cx, 行cy**,与 world.tile[z][cy][cx] 一致;能力已内联判定)
function cellKind(z,cx,cy,abilities){
  const t=world.tile[z][cy][cx], o=world.obj[z][cy][cx];
  if(o.type===O.projector || o.type===O.refl) return "block";
  if(t===T.wall)  return abilities[POW_walls] ? "walk" : "block";
  if(t===T.door)  return abilities[POW_doors] ? "door" : "block";
  if(o.type===O.stone) return abilities[POW_destroy] ? "stone" : "block";
  return "walk";
}

// ---------- 移动(移植 move(),L742–853;双步按逐格判定,门/石中途拦截) ----------
function tryMove(x,y){
  const z=game.pz;
  if(FEATURE_LIGHT) ensureLight();
  const abilities=[0,0,0,0,0,0,0,0];
  getAbilities(abilities);
  const proposed_pdir = x ? (x<0?DIR_W:DIR_E) : (y<0?DIR_N:DIR_S);
  let used=game.ability_flag;
  function setUsed(b){ used |= (1<<b); }

  const D=dbgStart(x,y,z);                     // 调试报告(未开调试时为 null)
  function ret(res,desc){ dbgFinish(D,desc); return res; }

  // 调试穿墙:无视一切直接走一格
  if(noclip){
    let fx0=game.px, fy0=game.py;
    game.px=wrapX(game.px+x); game.py=wrapY(game.py+y);
    game.pdir=proposed_pdir; game.player_timer=80; game.steps++;
    startAnim(fx0,fy0);
    onViewChanged(false);
    return ret("move","调试穿墙:直接移动到 ("+game.px+","+game.py+")");
  }

  dbgAdd(D,"当前格 "+dbgCellDesc(z,game.px,game.py));

  // 站在墙内:无绿光禁止任何移动(只能撤销),否则绿光穿墙后可能“卡”在墙里还能走出来
  if(world.tile[z][game.py][game.px]===T.wall){
    if(!abilities[POW_walls])
      return ret(false,"被挡:站在墙内且无绿光(原版 L787–792,只能撤销)");
    setUsed(POW_walls);
    dbgAdd(D,"站在墙内:有绿光 → 允许移动(消耗绿光)");
  }

  const L=FEATURE_LIGHT ? lightCache[z] : null;
  function litViolet(r,c){                  // (行,列),与 L[r][c] 一致;带边界防护
    return !!(L && L.L[r] && L.L[r][c] &&
      (L.L[r][c][proposed_pdir]===POW_travel || L.L[r][c][proposed_pdir^2]===POW_travel));
  }

  // ---- 紫光远行:严格照原版 main.c L753–770(途中只看紫光、不判墙) ----
  let travel=false, gx=game.px, gy=game.py;
  const tt=glideTarget(z, game.px, game.py, proposed_pdir, L);
  if(tt){ gx=tt.x; gy=tt.y; setUsed(POW_travel); travel=true; }
  if(D && L){
    const startV=litViolet(game.py,game.px);
    let cnt=0, walls=0, cxa=wrapX(game.px+x), cya=wrapY(game.py+y);   // 必须环绕(否则边缘会越界)
    while(cnt<WW*WH && litViolet(cya,cxa)){
      if(world.tile[z][cya][cxa]===T.wall) walls++;
      cnt++; cxa=wrapX(cxa+x); cya=wrapY(cya+y);
    }
    dbgAdd(D,"远行判定(紫) 起点紫="+(startV?"是":"否")+" 前方连续紫="+cnt+"(墙格"+walls+") 落点="+
      (tt?("("+tt.x+","+tt.y+")"):"无(按原版退化为普通移动)"));
  }

  let stepN=1;
  if(!travel){
    // 橙光双步:终点按原版判定;但路径中途若遇门(红光)/石块(黄光)则停下开门/砸碎
    if(abilities[POW_double]){ stepN=1<<abilities[POW_double]; setUsed(POW_double); }
    dbgAdd(D,"双步判定(橙) 橙光×"+abilities[POW_double]+" → 本次步长 "+stepN);
    let k;
    for(k=1;k<=stepN;k++){
      const cx=wrapX(game.px+x*k), cy=wrapY(game.py+y*k);
      const isMid=(k<stepN);
      const tT=world.tile[z][cy][cx], oT=world.obj[z][cy][cx];
      if(isMid){
        // 原版 main.c L772–801:橙光双步只判定“终点”那一格;中途格一律越过
        // (不开门、不碎石、不看墙/投影器/反射镜)——因此无红光也能“跳过”门。
        let midNote="";
        if(tT===T.door)           midNote="(门:越过,不开)";
        else if(oT.type===O.stone) midNote="(石块:越过,不碎)";
        else if(tT===T.wall)       midNote="(墙:越过)";
        else if(oT.type===O.projector) midNote="(投影器:越过)";
        else if(oT.type===O.refl)  midNote="(反射镜:越过)";
        dbgAdd(D,"双步第"+k+"格(中途) "+dbgCellDesc(z,cx,cy)+" → 原版只判终点,直接越过"+midNote);
        continue;
      }
      const kind=cellKind(z,cx,cy,abilities);               // 终点判定(照原版;cellKind 参数为 列,行)
      if(kind==="block")
        return ret(false,"被挡:落点 "+dbgCellDesc(z,cx,cy)+" → "+dbgBlockReason(z,cx,cy,abilities));
      if(kind==="door"){
        setUsed(POW_doors); game.ability_flag=used;
        world.tile[z][cy][cx]=T.opendoor;
        game.pdir=proposed_pdir; lightDirty=true; pauseInput();
        return ret("open","开门(落点) "+dbgCellDesc(z,cx,cy)+" → open_door,人不动");
      }
      if(kind==="stone"){
        setUsed(POW_destroy); game.ability_flag=used;
        world.obj[z][cy][cx].type=O.empty;
        game.pdir=proposed_pdir; lightDirty=true; pauseInput();
        return ret("destroy","碎石(落点) "+dbgCellDesc(z,cx,cy)+" → 清空,人不动");
      }
      if(world.tile[z][cy][cx]===T.wall){
        setUsed(POW_walls);
        dbgAdd(D,"落点 "+dbgCellDesc(z,cx,cy)+" → 墙,用绿光穿墙(消耗绿光)");
      } else {
        dbgAdd(D,"落点 "+dbgCellDesc(z,cx,cy)+" → 判定="+kind);
      }
      gx=cx; gy=cy;
    }
  } else {
    const kindT=cellKind(z,gx,gy,abilities);   // cellKind(列,行):gx=列,gy=行
    if(kindT==="block")
      return ret(false,"被挡:远行落点 "+dbgCellDesc(z,gx,gy)+" → "+dbgBlockReason(z,gx,gy,abilities));
    if(kindT==="door"){
      setUsed(POW_doors); game.ability_flag=used;
      world.tile[z][gy][gx]=T.opendoor;
      game.pdir=proposed_pdir; lightDirty=true; pauseInput();
      return ret("open","开门(远行落点) "+dbgCellDesc(z,gx,gy)+" → open_door,人不动");
    }
    if(kindT==="stone"){
      setUsed(POW_destroy); game.ability_flag=used;
      world.obj[z][gy][gx].type=O.empty;
      game.pdir=proposed_pdir; lightDirty=true; pauseInput();
      return ret("destroy","碎石(远行落点) "+dbgCellDesc(z,gx,gy)+" → 清空,人不动");
    }
    dbgAdd(D,"远行落点 "+dbgCellDesc(z,gx,gy)+" → 判定="+kindT);
  }

  // ---- 落地(共用) ----
  const tgtObj=world.obj[z][gy][gx];
  let got_wand=false;
  if(tgtObj.type===O.wand){ game.has_wand=true; tgtObj.type=O.empty; got_wand=true; }

  let fx0=game.px, fy0=game.py;
  game.ability_flag=used;
  let nz=z;
  if(world.tile[z][gy][gx]===T.stairs) nz=(z+1)%2;

  game.px=gx; game.py=gy; game.pz=nz;
  game.pdir=proposed_pdir;
  game.player_timer=80;
  startAnim(fx0,fy0);
  game.steps++;
  if(nz!==z) lightDirty=true;
  if(got_wand){ ckptSnap=buildSnap(); }        // 魔杖快照(菜单恢复用)
  onViewChanged(false);
  return ret("move","移动 → ("+game.px+","+game.py+") Z"+game.pz+
    (travel?" [紫光远行]":(stepN>1?" [橙光双步×"+stepN+"]":""))+
    (nz!==z?" [楼梯切层]":"")+(got_wand?" [拾取魔杖]":""));
}

function snapshotState(){
  return {
    px:game.px, py:game.py, pz:game.pz, pdir:game.pdir,
    ability_flag:game.ability_flag, num_gems:game.num_gems,
    gems_stored:game.gems_stored, has_wand:game.has_wand,
    num_zaps:game.num_zaps, egg_timer:game.egg_timer
  };
}

// ---------- M5:差分撤销(一次性,无上限)+ IndexedDB 跨会话持久化 ----------
let HISTORY=[];        // 条目 {diffs:[{k,i,old,new}], pre:{player,t}}
let lastSnap=null;     // 最近一次提交后的完整状态(用于差分)
let ckptSnap=null;     // 魔杖快照(菜单“从 wand 恢复”用,M6)
let DB=null, saveTimer=null;

function pState(){ return {px:game.px,py:game.py,pz:game.pz,pdir:game.pdir,
  flag:game.ability_flag,gems:game.num_gems,fed:game.gems_stored,
  wand:game.has_wand,zaps:game.num_zaps,egg:game.egg_timer}; }
function tState(){ return {feed:feed_timer,rev:reverse_timer,rt:rover_timer}; }
function applyP(p){ game.px=p.px; game.py=p.py; game.pz=p.pz; game.pdir=p.pdir;
  game.ability_flag=p.flag; game.num_gems=p.gems; game.gems_stored=p.fed;
  game.has_wand=p.wand; game.num_zaps=p.zaps; game.egg_timer=p.egg; }
function applyT(t){ feed_timer=t.feed; reverse_timer=t.rev; rover_timer=t.rt; }

function buildSnap(){
  const S={tile:[],type:[],dir:[],col:[]};
  for(let z=0;z<2;z++){ S.tile[z]=[]; S.type[z]=[]; S.dir[z]=[]; S.col[z]=[];
    for(let y=0;y<WH;y++){ const rt=[],a=[],b=[],c=[];
      for(let x=0;x<WW;x++){ rt.push(world.tile[z][y][x]);
        const o=world.obj[z][y][x]; a.push(o.type); b.push(o.dir); c.push(o.color); }
      S.tile[z].push(rt); S.type[z].push(a); S.dir[z].push(b); S.col[z].push(c); } }
  S.player=pState(); S.t=tState();
  return S;
}
function cellIdx(z,y,x){ return (z*WH+y)*WW+x; }
// 差分只记“玩家可影响”的格子;rover 所在/移入的格子一律忽略(rover 状态不入历史)
function diffSnap(A,B){
  const diffs=[];
  for(let z=0;z<2;z++) for(let y=0;y<WH;y++) for(let x=0;x<WW;x++){
    if(A.type[z][y][x]===O.rover || B.type[z][y][x]===O.rover) continue;
    if(A.tile[z][y][x]!==B.tile[z][y][x])
      diffs.push({k:0,i:cellIdx(z,y,x),old:A.tile[z][y][x],new:B.tile[z][y][x]});
    if(A.type[z][y][x]!==B.type[z][y][x])
      diffs.push({k:1,i:cellIdx(z,y,x),old:A.type[z][y][x],new:B.type[z][y][x]});
    if(A.dir[z][y][x]!==B.dir[z][y][x])
      diffs.push({k:2,i:cellIdx(z,y,x),old:A.dir[z][y][x],new:B.dir[z][y][x]});
    if(A.col[z][y][x]!==B.col[z][y][x])
      diffs.push({k:3,i:cellIdx(z,y,x),old:A.col[z][y][x],new:B.col[z][y][x]});
  }
  return diffs;
}
function idxToC(i){ const z=(i/(WH*WW))|0; const r=i%(WH*WW); return {z:z,y:(r/WW)|0,x:r%WW}; }
function applyDiffWorld(d,useOld){
  const v=useOld?d.old:d.new, p=idxToC(d.i), o=world.obj[p.z][p.y][p.x];
  if(d.k===0){ world.tile[p.z][p.y][p.x]=v; }
  else if(d.k===1) o.type=v;
  else if(d.k===2) o.dir=v;
  else o.color=v;
}
function sameP(a,b){ return a.px===b.px&&a.py===b.py&&a.pz===b.pz&&a.pdir===b.pdir&&
  a.flag===b.flag&&a.gems===b.gems&&a.wand===b.wand&&a.zaps===b.zaps; }
// 注:fed(rover 吃宝石)/egg 不计入历史,撤销不回滚;rover 状态完全独立于撤销
function sameT(a,b){ return false; }   // rover 计时器永不触发“有变化”入栈
function commitHistory(){
  if(!lastSnap) return;
  const cur=buildSnap();
  const diffs=diffSnap(lastSnap,cur);
  const metaChanged=!sameP(lastSnap.player,cur.player);
  if(!diffs.length && !metaChanged){ lastSnap=cur; return; }   // 真正 no-op
  HISTORY.push({diffs:diffs, pre:{player:lastSnap.player, t:lastSnap.t}});
  lastSnap=cur;
  scheduleSave();
}
// Z 键撤销:回滚“玩家可影响”的改动;rover 完全独立(不入历史、不重置、持续自主移动)
function undo(){
  if(!HISTORY.length) return;
  const e=HISTORY.pop();
  const keepFed=game.gems_stored, keepEgg=game.egg_timer;
  for(let i=0;i<e.diffs.length;i++) applyDiffWorld(e.diffs[i],true);
  applyP(e.pre.player);
  game.gems_stored=keepFed; game.egg_timer=keepEgg;   // rover 计数不回滚
  game.player_timer=0; animMove=false;
  lightDirty=true;
  lastSnap=buildSnap();
  scheduleSave();
  onViewChanged(false);
}

// ---------- IndexedDB(状态+整局历史) ----------
function openDB(){
  return new Promise(function(res,rej){
    if(!window.indexedDB){ rej(new Error("no indexedDB")); return; }
    const rq=indexedDB.open("promesst2_save",1);
    rq.onupgradeneeded=function(){ const db=rq.result;
      if(!db.objectStoreNames.contains("kv")) db.createObjectStore("kv"); };
    rq.onsuccess=function(){ DB=rq.result; res(); };
    rq.onerror=function(){ rej(rq.error||new Error("idb open failed")); };
  });
}
function idbGet(key){
  return new Promise(function(res,rej){
    const rq=DB.transaction("kv","readonly").objectStore("kv").get(key);
    rq.onsuccess=function(){ res(rq.result||null); };
    rq.onerror=function(){ rej(rq.error); };
  });
}
function idbPut(key,val){
  return new Promise(function(res,rej){
    const rq=DB.transaction("kv","readwrite").objectStore("kv").put(val,key);
    rq.onsuccess=function(){ res(); };
    rq.onerror=function(){ rej(rq.error); };
  });
}
function packSave(){
  return { v:1, g:lastSnap, ck:ckptSnap, h:HISTORY,
           meta:{ savedAt:Date.now(), steps:game.steps,
                  gems:game.gems_stored, wand:game.has_wand,
                  cleared:!!clearedFlag, slot:activeSlot } };
}
function saveToDB(){
  if(!DB || !lastSnap) return Promise.resolve();
  return idbPut(slotKey(activeSlot),packSave());
}
function scheduleSave(){
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer=setTimeout(function(){ saveTimer=null; saveToDB(); },800);
}
// 读档(返回存档对象或 null)
function loadFromDB(){ return loadActiveSlot(); }
// 把快照(存档 gamestate 或 ckptSnap)应用到当前世界
function applySnap(g){
  for(let z=0;z<2;z++) for(let y=0;y<WH;y++) for(let x=0;x<WW;x++){
    world.tile[z][y][x]=g.tile[z][y][x];
    const o=world.obj[z][y][x];
    o.type=g.type[z][y][x]; o.dir=g.dir[z][y][x]; o.color=g.col[z][y][x];
  }
  applyP(g.player); applyT(g.t);
  game.player_timer=0; animMove=false; lightDirty=true;
}
function restoreSave(d){
  reset();                                        // 先建一份干净的底层(解析+默认)
  applySnap(d.g);
  HISTORY=(d.h||[]).slice();
  ckptSnap=d.ck||null;
  clearedFlag=!!(d.meta&&d.meta.cleared);
  lastSnap=buildSnap();
}
window.addEventListener("pagehide",function(){ if(DB&&lastSnap) saveToDB(); });

// V 键:宝石拾取 / 放置(移植 drop(),L855–874:捡宝石或放回底座)
function drop(){
  const z=game.pz, x=game.px, y=game.py;
  const o=world.obj[z][y][x];
  if(o.type===O.gem){                 // 站在宝石上 → 拾起
    o.type=O.empty;
    game.num_gems++;
  } else if(game.num_gems>0 && o.type===O.empty &&
            world.tile[z][y][x]===T.recep){   // 携带宝石且脚下是空底座 → 放入
    game.num_gems--;
    o.type=O.gem; o.dir=1;            // dir=1:变色动画宝石
  } else return false;
  lightDirty=true;                    // 供电/光束随之变化
  return true;
}

// ---------- Rover(移植 move_rovers 体系,L1093–1218;同房同步,单/多只通用) ----------
function roverCanEnter(z,cx,cy,allowGem){
  if(cx<0||cx>=WW||cy<0||cy>=WH) return false;
  const t=world.tile[z][cy][cx];
  if(t===T.wall||t===T.door) return false;
  const o=world.obj[z][cy][cx];
  if(o.type===O.gem) return allowGem;
  return o.type===O.empty;
}
// rover 首选方向:反转期(reverse>0)保持直行;否则踩箭头按箭头,被堵尝试掉头
function roverDir(z,rover,cx,cy){
  let d=rover.dir;
  if(reverse_timer>0) return d;
  const tt=world.tile[z][cy][cx];
  if(tt>=T.arrow_e && tt<T.arrow_e+4) d=tt-T.arrow_e;
  if(roverCanEnter(z,cx+XD[d],cy+YD[d],true)) return d;
  const d2=(d+2)&3;
  if(d2!==d && roverCanEnter(z,cx+XD[d2],cy+YD[d2],true)) return d2;
  return -1;
}
// 驱动玩家所在层的所有房间(每 630ms 一次,同 C 只跑 pz 层)
function stepRovers(){
  const z=game.pz;
  // 反转计时到 0:首只 rover 调头 180° 并恢复箭头逻辑(照 C L1168–1171/L1216–1217)
  if(reverse_timer===0){
    outer:
    for(let ry=0;ry<NY;ry++) for(let rx=0;rx<NX;rx++)
      for(let yy=0;yy<SY;yy++) for(let xx=0;xx<SX;xx++){
        const o0=world.obj[z][ry*SY+yy][rx*SX+xx];
        if(o0.type===O.rover){ o0.dir=(o0.dir+2)&3; break outer; }
      }
    reverse_timer=-1;
  }
  let rx2,ry2;
  for(ry2=0;ry2<NY;ry2++) for(rx2=0;rx2<NX;rx2++){
    let x0=rx2*SX, y0=ry2*SY, yy2, xx2;
    const list=[];
    for(yy2=0;yy2<SY;yy2++) for(xx2=0;xx2<SX;xx2++){
      const o=world.obj[z][y0+yy2][x0+xx2];
      if(o.type===O.rover) list.push({o:o,x:x0+xx2,y:y0+yy2});
    }
    for(let i=0;i<list.length;i++){
      const r=list[i];
      const d=roverDir(z,r.o,r.x,r.y);
      if(d<0) continue;
      const nx=r.x+XD[d], ny=r.y+YD[d];
      if(!roverCanEnter(z,nx,ny,true)) continue;
      const target=world.obj[z][ny][nx];
      if(target.type===O.rover) continue;          // 目标有另一只:本只等待
      let clash=false;
      for(let j=0;j<i;j++)
        if(list[j].moved && list[j].nx===nx && list[j].ny===ny) clash=true;
      if(clash) continue;                          // 同房多只同争一格:先到先得
      if(target.type===O.gem){                     // 吃宝石 → 计数 + 反转计时
        game.gems_stored++;
        feed_timer=FEED_MS;
        reverse_timer=REVERSE_MS;
      }
      world.obj[z][r.y][r.x].type=O.empty;
      world.obj[z][ny][nx].type=O.rover;
      world.obj[z][ny][nx].dir=d;
      r.moved=true; r.nx=nx; r.ny=ny;
      lightDirty=true;                             // 吃掉的若在底座上,供电会变
    }
  }
}

// ---------- 计时器步进(移植 timestep,L1237–1325:M3 能力 + M4 rover/宝石) ----------
function update(ms){
  // 魔杖归一(照 C:has_wand && gems_stored<0 → 0)
  if(game.has_wand && game.gems_stored<0) game.gems_stored=0;

  if(feed_timer>0){ feed_timer-=ms; if(feed_timer<0) feed_timer=0; }
  if(reverse_timer>0){
    reverse_timer-=ms;
    if(reverse_timer<0) reverse_timer=0;
  }

  // Rover 自主步进(玩家所在层;宝石未集满或仍在反转期才继续)
  if(FEATURE_ROVER && (game.gems_stored<MAX_GEMS || reverse_timer>0)){
    rover_timer-=ms;
    let guard=0;
    while(rover_timer<0 && guard<4 && (game.gems_stored<MAX_GEMS || reverse_timer>0)){
      rover_timer+=ROVER_MS;
      stepRovers();
      guard++;
    }
  }

  if(game.player_timer>0){
    game.player_timer-=ms;
    if(game.player_timer<0) game.player_timer=0;
  }
  if(game.player_timer<=0){
    let ch=null;
    if(q){ ch=q; q=null; }
    else if(held.length){ ch=held[held.length-1]; }
    if(ch){
      let dx=0,dy=0;
      if(ch==="a") dx=-1; else if(ch==="d") dx=1;
      else if(ch==="w") dy=-1; else if(ch==="s") dy=1;
      if(dx||dy){ tryMove(dx,dy); commitHistory(); }
      else if(ch==="x"){ shoot(); commitHistory(); }
      else if(ch==="v"){ drop(); commitHistory(); }
      else if(ch==="z"){ undo(); }
      // c=反射镜(逻辑保留)——后续里程碑
    }
  }

  // 集满 30 颗后累计 egg_timer,驱动结局动画(照 C L1322–1324;必须与是否有输入无关)
  if(game.gems_stored>=MAX_GEMS){ game.egg_timer += ms; }
}

// ---------- 结局/蜥蜴化/气泡(YOU WIN 等世界内文字用原版内置字体) ----------
function drawEndingOverlay(g,k){
  const z=game.pz, K=CELL*k;
  let rover=null, y, x;
  for(y=0;y<WH && !rover;y++) for(x=0;x<WW;x++)
    if(world.obj[z][y][x].type===O.rover){ rover={x:x,y:y}; break; }

  // 被喂饱的 rover“蜥蜴化”:彩虹光环(近似原版 L2035–2069)
  if(rover && game.egg_timer>0){
    const pulse=(Math.sin(animcycle/120)+1)/2;
    g.save();
    g.globalCompositeOperation="lighter";
    g.globalAlpha=0.30+0.35*pulse;
    g.fillStyle="hsl("+((animcycle/8)%360)+",85%,60%)";
    g.fillRect(rover.x*K-K*0.3, rover.y*K-K*0.3, K*1.6, K*1.6);
    g.restore();
  }
  // 气泡文字:照原版 L2144–2191(仅当 rover 在 z0 的 (2,3) 房间且已开始喂食)
  if(rover && z===0 && ((rover.x/SX)|0)===2 && ((rover.y/SY)|0)===3 && game.gems_stored>=0){
    let text=null;
    if(game.gems_stored===0){ if(animcycle%15000<2000) text="?"; }
    else if(game.egg_timer>=8000) text="WELL NOW";
    else if(animcycle%45000<2000 || feed_timer>0){
      const left=MAX_GEMS-game.gems_stored;
      if(game.gems_stored>=1 && game.gems_stored<=12) text="NEED MORE";
      else if(game.gems_stored%7===3) text=left+" TO GO";
      else text=left+" MORE";
    }
    if(text){
      const size=Math.max(0.9,k*0.55);
      const w=bmpTextWidth(size,text,1);
      g.save();
      g.fillStyle="rgba(0,0,0,0.55)";
      g.fillRect(rover.x*K+K/2-w/2-3, rover.y*K-size*10-3, w+6, size*9+6);
      g.fillStyle="#ffffff";
      drawBmpText(g, rover.x*K+K/2-w/2, rover.y*K-size*10, size, text, 1);
      g.restore();
    }
  }
  // 结局三阶段(照原版 L2382–2417)
  if(game.egg_timer>8000){
    let a=(game.egg_timer-8000)>>4;                 // 原版:比 >>4
    const pv=powers[5];                               // COLOR_violet
    let r=pv[0], gg=pv[1], b=pv[2];
    if(a>=128){ r=Math.min(255,r+a-128); gg=Math.min(255,gg+a-128); b=Math.min(255,b+a-128); }
    if(a>255) a=255;
    g.save();
    g.globalCompositeOperation="lighter";
    g.globalAlpha=Math.min(1,a/255);
    g.fillStyle="rgb("+r+","+gg+","+b+")";
    g.fillRect(0,0,cv.width,cv.height);
    g.restore();

    if(game.egg_timer>14000){
      g.save();
      g.fillStyle="rgba(0,0,0,0.78)";
      g.fillRect(0,0,cv.width,cv.height);
      g.fillStyle="#ffffff";
      const big=Math.max(2,k*2.2);
      const t1="YOU WIN";
      drawBmpText(g,(cv.width-bmpTextWidth(big,t1,1))/2,(cv.height-big*7)/2-10,big,t1,1);
      if(game.egg_timer>17000){
        const a2=Math.min(1,(game.egg_timer-17000)/2000);
        const t2="USED "+game.num_zaps+" ZAPS";
        const s2=Math.max(1.2,k*1.0);
        g.fillStyle="rgba(255,190,255,"+a2+")";
        drawBmpText(g,(cv.width-bmpTextWidth(s2,t2,1))/2,(cv.height+big*10)/2,s2,t2,1);
      }
      g.restore();
    }
    if(game.egg_timer>22000) enterResult();
  }
}

// ---------- 渲染 ----------
const cv=document.getElementById("cv");
const ctx=cv.getContext("2d");
let zoomK=2, autoFit=true, follow=true, showGrid=false;
const canvasSize=384;

function kPx(){ return CELL*zoomK; }

function render(){
  if(!world||!img) return;
  const z=game.pz, k=zoomK, K=kPx();
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.imageSmoothingEnabled=false;

  let y,x,i;
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    const t=world.tile[z][y][x];
    const rx=(x/SX)|0, ry=(y/SY)|0;
    let sp=TILE_SPR[t];
    if(t===T.wall && ((rx^ry)&1)) sp=[7,0];
    ctx.drawImage(cellFrom(sp[0],sp[1]), x*K,y*K,K,K);
    if(t>=T.floor){
      const chk=[ [x+1,y,1,0],[x-1,y,3,0],[x,y+1,4,0],[x,y-1,2,0] ];
      for(i=0;i<4;i++){
        const mx=((chk[i][0])%WW+WW)%WW, my=((chk[i][1])%WH+WH)%WH;
        if(world.tile[z][my][mx]===T.wall)
          ctx.drawImage(cellFrom(chk[i][2],chk[i][3]), x*K,y*K,K,K);
      }
    }
  }
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    const o=world.obj[z][y][x];
    if(o.type===O.empty) continue;
    let oc=null;
    switch(o.type){
      case O.projector: oc=cellFrom(0+o.dir,2); break;
      case O.gem:       oc=cellFrom(0,4); break;
      case O.refl:      oc=cellFrom(5+o.dir,6); break;
      case O.rover:     oc=cellFrom(6,2+o.dir); break;
      case O.stone:     oc=cellFrom(2,1); break;
      case O.wand:      oc=cellFrom(2,4); break;
      default: break;
    }
    if(oc) ctx.drawImage(oc, x*K,y*K,K,K);
  }

  // 光束辉光(加法混合;FEATURE_LIGHT 已开)
  if(FEATURE_LIGHT){
    ensureLight();
    const lit=lightCache[z];
    if(lit){
      for(y=0;y<WH;y++) for(x=0;x<WW;x++){
        if(!lit.any[y][x]) continue;
        let n=0, rr=0, gg=0, bb=0;
        for(let d=0;d<4;d++){
          const cc=lit.L[y][x][d];
          if(cc>=0){ const pc=powers[cc]; rr+=pc[0]; gg+=pc[1]; bb+=pc[2]; n++; }
        }
        if(n){
          ctx.globalAlpha=Math.min(0.42,0.10+0.06*n);
          ctx.fillStyle="rgb("+Math.round(rr/n)+","+Math.round(gg/n)+","+Math.round(bb/n)+")";
          ctx.globalCompositeOperation="lighter";
          ctx.fillRect(x*K,y*K,K,K);
          ctx.globalCompositeOperation="source-over";
          ctx.globalAlpha=1;
        }
      }
      // 通电投影器头部彩色标记
      for(y=0;y<WH;y++) for(x=0;x<WW;x++){
        const o2=world.obj[z][y][x];
        if(o2.type===O.projector && lit.pw[(y/SY)|0][(x/SX)|0]){
          const pc2=powers[o2.color];
          ctx.globalAlpha=0.55; ctx.globalCompositeOperation="lighter";
          ctx.fillStyle="rgb("+pc2[0]+","+pc2[1]+","+pc2[2]+")";
          ctx.fillRect(x*K+K*0.28, y*K+K*0.28, K*0.44, K*0.44);
          ctx.globalCompositeOperation="source-over"; ctx.globalAlpha=1;
        }
      }
    }
  }

  // 房间网格(开关在顶栏)
  if(showGrid){
    ctx.strokeStyle="rgba(255,255,255,0.55)";
    ctx.lineWidth=Math.max(1,Math.floor(k*0.5));
    ctx.beginPath();
    for(x=0;x<=NX;x++){ const gx=x*SX*K; ctx.moveTo(gx+0.5,0); ctx.lineTo(gx+0.5,WH*K); }
    for(y=0;y<=NY;y++){ const gy=y*SY*K; ctx.moveTo(0,gy+0.5); ctx.lineTo(WW*K,gy+0.5); }
    ctx.stroke();
  }

  // 玩家:照原版 draw_world L2004–2009,只做“最后一格”的滑入
  //   epx = -16*xdir[pdir]*(player_timer/80) → 画在“目标格往回一格”处,随时钟滑入目标格。
  //   这样双步/远行跨多格时不会拉一条长线滑过墙体(原版同样只滑最后一格)。
  let drawX=game.px, drawY=game.py;
  if(animMove && game.player_timer>0){
    const bigJump=(Math.abs(animFromX-game.px)>1 || Math.abs(animFromY-game.py)>1);
    const behindIsFrom=(wrapX(game.px-XD[game.pdir])===animFromX &&
                      wrapY(game.py-YD[game.pdir])===animFromY);
    if(!(bigJump && behindIsFrom)){          // 跨世界缝:瞬移,不做滑入
      const slide=game.player_timer/80;        // 80→0,偏移 1 格 → 0 格
      drawX=game.px - XD[game.pdir]*slide;
      drawY=game.py - YD[game.pdir]*slide;
    }
  }
  const dxs=game.pdir;
  ctx.globalAlpha=0.9;
  ctx.drawImage(cellFrom(dxs,6), drawX*K, drawY*K, K, K);
  ctx.globalAlpha=1;
  // 辅助环(便于识别)
  ctx.strokeStyle="rgba(255,212,121,0.9)"; ctx.lineWidth=Math.max(2,k*0.4);
  ctx.strokeRect(drawX*K+1, drawY*K+1, K-2, K-2);
  drawEndingOverlay(ctx,k);
  refreshHud();
}

// ---------- HUD ----------
const hud={z:"",xy:"",room:"",face:"",steps:"",carry:"",wand:"",gems:"",undo:"",move:"",lights:""};
function refreshHud(){
  const z=game.pz, x=game.px, y=game.py;
  const rx=(x/SX)|0, ry=(y/SY)|0;
  const zs="Z"+z, xys="("+x+","+y+")", rs="("+rx+","+ry+")",
      fs=DIRNAME[game.pdir], st=String(game.steps), cs=String(game.num_gems);
  if(hud.z!==zs){ hud.z=zs; byId("bz").textContent=zs; }
  if(hud.xy!==xys){ hud.xy=xys; byId("bxy").textContent=xys; }
  if(hud.room!==rs){ hud.room=rs; byId("broom").textContent=rs; }
  if(hud.face!==fs){ hud.face=fs; byId("bfacing").textContent=fs; }
  if(hud.steps!==st){ hud.steps=st; byId("bsteps").textContent=st; }
  if(hud.carry!==cs){ hud.carry=cs; byId("bcarry").textContent=cs; }
  const ws=game.has_wand?"有":"无";
  if(hud.wand!==ws){ hud.wand=ws; byId("bwand").textContent=ws; }
  const gs=(game.gems_stored>=0)?(game.gems_stored+"/"+MAX_GEMS):"—";
  if(hud.gems!==gs){ hud.gems=gs; byId("bgems").textContent=gs; }
  const u=String(HISTORY.length);
  if(hud.undo!==u){ hud.undo=u; byId("bund").textContent=u; }
  // 能力灯:照到=亮,用过(ability_flag)=暗(原版 HUD 语义 L2294–2305)
  if(FEATURE_LIGHT){
    const ab=[0,0,0,0,0,0,0,0];
    getAbilities(ab);
    const lamps=byId("lamps");
    if(lamps){
      const kids=lamps.children;
      for(let li=0;li<kids.length;li++){
        const c=parseInt(kids[li].getAttribute("data-c"),10);
        const on=ab[c]>0, used=(game.ability_flag&(1<<c))!==0;
        kids[li].classList.toggle("on",on);
        kids[li].classList.toggle("used",!on&&used);
      }
    }
    // 调试:玩家格四向入射光(E/N/W/S 各是什么颜色),用于核对紫光远行
    if(debugOn && lightCache[z]){
      const L=lightCache[z].L;
      const parts=[];
      for(let d=0;d<4;d++){
        const v=L[game.py][game.px][d];
        parts.push(["E","N","W","S"][d]+"="+(v>=0?CNAMES[v]:"—"));
      }
      const lightTxt="入射光:"+parts.join(" ");
      if(hud.lights!==lightTxt){ hud.lights=lightTxt; byId("dbgLights").textContent=lightTxt; }
      if(hud.move!==dbgMsg){ hud.move=dbgMsg; byId("dbgMove").textContent=dbgMsg; }
    }
  }
}
function byId(id){ return document.getElementById(id); }

// ---------- M6:模式机 / 菜单 / Credits / 存档槽 / 结算 ----------
let mainMode="logo";          // logo|menu|credits|slots|game|result
let logoTime=1500;            // 原版 MAX_LOGO = 1500ms
let gameStarted=false;
let menuSel=0;
let clearedFlag=false;
const MENU=[
  {id:"continue",label:"继续游戏",      sub:"回到当前进度"},
  {id:"wand",    label:"从魔杖恢复",    sub:"回到拾到魔杖那一刻的快照"},
  {id:"new",     label:"新游戏",        sub:"从头开始(清空撤销历史)"},
  {id:"slots",   label:"存档管理",      sub:"3 个存档槽 / 导出导入"},
  {id:"credits", label:"Credits",       sub:"原作者与贡献者"},
  {id:"quit",    label:"保存并回到标题",sub:"保存当前进度"}
];
function menuEnabled(){
  return MENU.map(function(it){
    if(it.id==="continue") return gameStarted;
    if(it.id==="wand")     return !!ckptSnap;
    return true;
  });
}
function buildMenu(){
  const host=byId("menuItems");
  if(!host) return;
  host.innerHTML="";
  MENU.forEach(function(it,i){
    const b=document.createElement("button");
    b.innerHTML=it.label+"<small>"+it.sub+"</small>";
    b.addEventListener("click",function(){ if(!b.disabled){ menuSel=i; activateMenu(); } });
    host.appendChild(b);
  });
  refreshMenu();
}
function refreshMenu(){
  const host=byId("menuItems"); if(!host) return;
  const en=menuEnabled(), ch=host.children;
  for(let i=0;i<ch.length;i++){
    ch[i].disabled=!en[i];
    ch[i].className=(i===menuSel?"sel":"");
  }
  byId("menuNote").textContent = gameStarted ? "" : "当前没有存档:请选择“新游戏”开始。";
}
function moveMenuSel(dir){
  const en=menuEnabled();
  for(let k=0;k<MENU.length;k++){
    menuSel=(menuSel+dir+MENU.length)%MENU.length;
    if(en[menuSel]) break;
  }
  refreshMenu();
}
function showScreen(name){
  ["scrLogo","scrMenu","scrCredits","scrSlots","scrResult"].forEach(function(id){
    const el=byId(id); if(el) el.classList.toggle("on", id==="scr"+name);
  });
}
function setMode(m){
  mainMode=m;
  const map={logo:"Logo",menu:"Menu",credits:"Credits",slots:"Slots",result:"Result"};
  showScreen(map[m]||"");
  if(m==="menu") refreshMenu();
  if(m==="game"){ last=(typeof performance!=="undefined"?performance.now():0); acc=0; }  // 暂停后避免大 dt
}
function activateMenu(){
  const id=MENU[menuSel].id;
  if(id==="continue"){ gameStarted=true; setMode("game"); }
  else if(id==="wand"){
    if(!ckptSnap) return;
    applySnap(ckptSnap);
    HISTORY=[]; lastSnap=buildSnap(); lightDirty=true;   // 原版:恢复 checkpoint 会清空 undo
    gameStarted=true; setMode("game"); scheduleSave();
  }
  else if(id==="new"){ reset(); gameStarted=true; setMode("game"); scheduleSave(); }
  else if(id==="slots"){ setMode("slots"); renderSlots(); }
  else if(id==="credits"){ setMode("credits"); }
  else if(id==="quit"){ scheduleSave(); setMode("menu"); }
}
function enterResult(){
  if(mainMode==="result") return;
  clearedFlag=true;
  HISTORY=[];                        // 原版通关不落档;这里只清历史并记录通关标记
  scheduleSave();
  byId("resZaps").textContent="USED "+game.num_zaps+" ZAPS";
  byId("resFed").textContent="已喂宝石 "+game.gems_stored+"/"+MAX_GEMS;
  setMode("result");
}

// ---------- 存档槽(3 槽 + 导出/导入) ----------
let activeSlot=1;
function slotKey(i){ return "v1.slot"+i; }
function loadActiveSlot(){
  try{ const s=parseInt(localStorage.getItem("promesst2.activeSlot")||"1",10);
       if(s>=1&&s<=3) activeSlot=s; }catch(e){}
  return idbGet(slotKey(activeSlot)).then(function(d){
    if(d&&d.g) return d;
    return idbGet("main");           // 兼容 M5 旧存档
  }).catch(function(){ return null; });
}
function setActiveSlot(i){
  activeSlot=i;
  try{ localStorage.setItem("promesst2.activeSlot",String(i)); }catch(e){}
}
function fmtTime(ms){
  if(!ms) return "—";
  const d=new Date(ms);
  function p(n){ return (n<10?"0":"")+n; }
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());
}
function renderSlots(){
  const host=byId("slotList"); if(!host) return;
  host.innerHTML="";
  const jobs=[];
  for(let i=1;i<=3;i++) jobs.push(idbGet(slotKey(i)).catch(function(){ return null; }));
  Promise.all(jobs).then(function(list){
    list.forEach(function(d,idx){
      const i=idx+1, m=d&&d.meta?d.meta:null;
      const row=document.createElement("div");
      row.className="slot"+(i===activeSlot?" active":"");
      const info=document.createElement("div");
      info.className="info";
      info.innerHTML="<b>槽 "+i+"</b>"+(i===activeSlot?" (当前)":"")+" — "+
        (m?("保存于 "+fmtTime(m.savedAt)+" · 步数 "+m.steps+" · 已喂 "+(m.gems>=0?m.gems:0)+"/30"+
            (m.wand?" · 有魔杖":"")+(m.cleared?" · 已通关":"")):"（空）");
      row.appendChild(info);
      function mk(label,fn){
        const b=document.createElement("button"); b.className="btn"; b.textContent=label;
        b.addEventListener("click",fn); row.appendChild(b);
      }
      mk("读取",function(){
        idbGet(slotKey(i)).then(function(dd){
          if(!dd||!dd.g){ byId("slotHint").textContent="槽 "+i+" 为空。"; return; }
          setActiveSlot(i); restoreSave(dd); gameStarted=true;
          byId("slotHint").textContent="已读取槽 "+i+"。";
          setMode("game");
        });
      });
      mk("保存到此处",function(){
        const prev=activeSlot; setActiveSlot(i);
        saveToDB().then(function(){ renderSlots();
          byId("slotHint").textContent="已保存到槽 "+i+(prev!==i?"(当前槽已切换)":"")+"。"; });
      });
      mk("设为当前",function(){ setActiveSlot(i); renderSlots();
        byId("slotHint").textContent="当前槽 = "+i+"(自动存档将写入此槽)。"; });
      mk("删除",function(){
        idbPut(slotKey(i),null).then(function(){ renderSlots();
          byId("slotHint").textContent="已删除槽 "+i+"。"; });
      });
      host.appendChild(row);
    });
  });
}
function exportSave(){
  const data=JSON.stringify(packSave());
  const blob=new Blob([data],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="promesst2-slot"+activeSlot+".json";
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },3000);
}
function importSave(file){
  const fr=new FileReader();
  fr.onload=function(){
    try{
      const d=JSON.parse(fr.result);
      if(!d||!d.g||!d.g.tile) throw new Error("不是有效的存档 JSON");
      idbPut(slotKey(activeSlot),d).then(function(){
        restoreSave(d); gameStarted=true; renderSlots();
        byId("slotHint").textContent="已导入到槽 "+activeSlot+"。";
      });
    }catch(ex){ byId("slotHint").textContent="导入失败:"+ex.message; }
  };
  fr.readAsText(file);
}

// ---------- 视野:适配(吃满可视区)/ 手动缩放 / 跟随 ----------
const stage=byId("stage");
let cssScale=1;        // 画布 CSS 显示尺寸 / 后备缓冲尺寸(适配模式下可能 <1,避免模糊)
function resizeCanvas(){
  if(autoFit){
    // 用 min(可视宽, 可视高) 的正方形尽量占满;后备缓冲取“接近显示倍率”的整数倍再交给 CSS 缩放
    const availW=Math.max(160, stage.clientWidth-16);
    const availH=Math.max(160, stage.clientHeight-16);
    const disp=Math.max(160, Math.min(availW, availH));
    const kBack=Math.max(1, Math.min(6, Math.round(disp/canvasSize)));
    zoomK=kBack;
    cv.width=canvasSize*kBack; cv.height=canvasSize*kBack;
    cv.style.width=disp+"px"; cv.style.height=disp+"px";
    cssScale=disp/(canvasSize*kBack);
  } else {
    cv.width=canvasSize*zoomK; cv.height=canvasSize*zoomK;
    cv.style.width=cv.width+"px"; cv.style.height=cv.height+"px";
    cssScale=1;
  }
  centerPlayer();
}
function centerPlayer(){
  if(!follow) return;
  const k=zoomK;
  // 滚动坐标是 CSS 像素,需要乘上 CSS 缩放系数
  const cx=(game.px*CELL+8)*k*cssScale, cy=(game.py*CELL+8)*k*cssScale;
  const sx=stage.clientWidth, sy=stage.clientHeight;
  const maxL=Math.max(0,stage.scrollWidth-sx), maxT=Math.max(0,stage.scrollHeight-sy);
  stage.scrollLeft=Math.max(0,Math.min(maxL, cx-sx/2));
  stage.scrollTop =Math.max(0,Math.min(maxT, cy-sy/2));
}
function onViewChanged(center){ if(center) resizeCanvas(); }

// ---------- 输入(按模式分发:游戏 / 菜单 / 子页面) ----------
const KEYMAP={ ArrowUp:"w", KeyW:"w", ArrowDown:"s", KeyS:"s",
             ArrowLeft:"a", KeyA:"a", ArrowRight:"d", KeyD:"d" };
window.addEventListener("keydown",function(e){
  // 菜单:上下选择 / 回车确认 / Esc 返回游戏
  if(mainMode==="menu"){
    if(e.code==="ArrowUp"||e.code==="KeyW"){ e.preventDefault(); moveMenuSel(-1); return; }
    if(e.code==="ArrowDown"||e.code==="KeyS"){ e.preventDefault(); moveMenuSel(1); return; }
    if(e.code==="Enter"||e.code==="Space"||e.code==="NumpadEnter"){ e.preventDefault(); activateMenu(); return; }
    if(e.code==="Escape"&&gameStarted){ e.preventDefault(); setMode("game"); return; }
    return;
  }
  if(mainMode==="credits"||mainMode==="slots"){
    if(e.code==="Escape"||e.code==="Enter"){ e.preventDefault(); setMode("menu"); }
    return;
  }
  if(mainMode!=="game") return;               // logo / result:交给按钮
  if(e.code==="Escape"){ e.preventDefault(); setMode("menu"); return; }
  const c=KEYMAP[e.code];
  if(c){ e.preventDefault(); q=c;
    const i=held.indexOf(c); if(i>=0) held.splice(i,1);
    held.push(c);
    return;
  }
  const a={KeyX:"x",KeyV:"v",KeyZ:"z",KeyC:"c"}[e.code];
  if(a){ e.preventDefault(); q=a; }
});
window.addEventListener("keyup",function(e){
  const c=KEYMAP[e.code];
  if(c){ const i=held.indexOf(c); if(i>=0) held.splice(i,1); }
});
window.addEventListener("blur",function(){ held=[]; q=null; });

// 控件
byId("btnFit").addEventListener("click",function(){ autoFit=true; resizeCanvas(); });
byId("btnZo").addEventListener("click",function(){ autoFit=false; zoomK=Math.max(1,zoomK-1); resizeCanvas(); });
byId("btnZi").addEventListener("click",function(){ autoFit=false; zoomK=Math.min(6,zoomK+1); resizeCanvas(); });
byId("btnUndo").addEventListener("click",function(){ if(mainMode==="game"){ undo(); } });
byId("btnMenu").addEventListener("click",function(){ setMode("menu"); });
byId("btnCreditsBack").addEventListener("click",function(){ setMode("menu"); });
byId("btnSlotsBack").addEventListener("click",function(){ setMode("menu"); });
byId("btnExport").addEventListener("click",exportSave);
byId("fileImport").addEventListener("change",function(e){
  if(e.target.files&&e.target.files[0]) importSave(e.target.files[0]);
  e.target.value="";
});
byId("btnAgain").addEventListener("click",function(){
  clearedFlag=false; reset(); gameStarted=true; setMode("game"); scheduleSave();
});
byId("btnResultMenu").addEventListener("click",function(){ setMode("menu"); });
byId("ckFollow").addEventListener("change",function(e){ follow=e.target.checked; centerPlayer(); });
byId("ckGrid").addEventListener("change",function(e){ showGrid=e.target.checked; });
byId("ckDbg").addEventListener("change",function(e){
  debugOn=e.target.checked;
  byId("dbgrow").style.display=debugOn?"block":"none";
});
byId("dbgWand").addEventListener("click",function(){ cheatWand(); });
byId("dbgFeed").addEventListener("click",function(){ game.gems_stored=MAX_GEMS; });   // 调试:直接触发结局
byId("dbgCopy").addEventListener("click",function(){
  const t=dbgMsg||"(无调试信息)";
  function done(ok){
    const st=byId("dbgCopyState"); if(!st) return;
    st.textContent=ok?"已复制到剪贴板":"请手动选择复制";
    setTimeout(function(){ st.textContent="最近 3 次"; },2000);
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(function(){ done(true); },function(){ done(false); });
  } else {
    try{
      const ta=document.createElement("textarea");
      ta.value=t; document.body.appendChild(ta); ta.select();
      const ok=document.execCommand("copy"); document.body.removeChild(ta); done(ok);
    }catch(e){ done(false); }
  }
});
byId("dbgNoclip").addEventListener("click",function(){
  cheatNoclip();
  byId("dbgNoclipState").textContent="穿墙:"+(noclip?"开":"关");
});
window.addEventListener("resize",function(){ if(autoFit) resizeCanvas(); });

// ---------- 主循环(rAF + 16ms 步进;仅游戏模式推进逻辑) ----------
let last=performance.now(), acc=0;
function loop(now){
  const dt=Math.min(now-last,250); last=now;
  animcycle+=dt;
  if(mainMode==="logo"){
    logoTime-=dt;
    if(logoTime<=0) setMode("menu");
  } else if(mainMode==="game"){
    acc+=dt; let guard=0;
    while(acc>=16 && guard<8){ update(16); acc-=16; guard++; }
    if(guard>=8) acc=0;
  } else {
    acc=0;                      // 菜单/结算:暂停模拟(与原版 process_metagame 一致)
  }
  render();
  if(mainMode==="game" && follow) centerPlayer();
  requestAnimationFrame(loop);
}

// ---------- 错误与启动 ----------
function err(msg){ const e=byId("err"); e.style.display="block"; e.textContent=msg; }
// 全局异常直接显示在页面上(此前静默失败很难排查)
window.addEventListener("error",function(e){
  err("运行错误: "+(e.message||e.error||"?")+"  @ "+(e.filename||"")+":"+(e.lineno||0));
});
window.addEventListener("unhandledrejection",function(e){
  const r=e.reason; err("异步错误: "+((r&&(r.message||r))||"?"));
});
(function boot(){
  try{
    if(!RAW||RAW.length!==24){ err("map-data.js 异常:期望 24 行,实际 "+(RAW?RAW.length:"未定义")+"。"); return; }
    img=new Image();
    img.onload=function(){
      try{
        const tmp=document.createElement("canvas"); tmp.width=ATLAS; tmp.height=ATLAS;
        const tc=tmp.getContext("2d"); tc.drawImage(img,0,0);
        imgData=tc.getImageData(0,0,ATLAS,ATLAS);
        computePowers();
        // 打开 IndexedDB → 读取“当前槽”(兼容 M5 的 main 键) → Logo → 菜单
        const p=openDB().then(function(){ return loadActiveSlot(); })
                      .catch(function(){ return null; });
        p.then(function(save){
          if(save && save.g){ restoreSave(save); gameStarted=true; }
          else { reset(); gameStarted=false; }
          resizeCanvas();
          render();
          buildMenu();
          logoTime=1500;
          setMode("logo");
          requestAnimationFrame(loop);
        });
      }catch(ex){ err("初始化失败:\n"+ex.message+"\n(file:// 打开可能有跨域限制,请用 Live Server 或 python -m http.server)"); }
    };
    img.onerror=function(){ err("无法加载 assets/sprites.png —— 请确认文件存在。"); };
    img.src="./assets/sprites.png";
  }catch(ex){ err("启动失败:"+ex.message); }
})();
