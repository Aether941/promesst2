"use strict";
/* ============================================================
   PROMESST 2 网页版移植 — game.js
   当前里程碑:M4(宝石拾放 V / Rover 自主移动 / 供电随放置刷新)
   设计源:docs-map-port/README.md v4;规则基准 main.c(2014)
   FEATURE_LIGHT / FEATURE_ROVER 均已启用。
   ============================================================ */

// ---------- 常量(与 main.c 一致) ----------
var SX=6, SY=6, NX=4, NY=4;          // 房间 6×6,每层 4×4
var WW=NX*SX, WH=NY*SY;              // 24×24
var DIR_E=0, DIR_N=1, DIR_W=2, DIR_S=3;
var XD=[1,0,-1,0], YD=[0,-1,0,1];
var DIRNAME=["E","N","W","S"];

var T={ wall:0, door:1, opendoor:2, floor:3, recep:4, frag:5,
        arrow_e:6, arrow_n:7, arrow_w:8, arrow_s:9, stairs:10, egg:11 };
var EGG_BASE=11;
var O={ empty:0, stone:1, gem:2, projector:3, wand:4, refl:5, rover:6 };

// 颜色枚举与能力映射(POWER_* 值=颜色值,与 L707–712 一致)
// 颜色能力位(值=颜色枚举;与 L707–712 宏一致:destroy 是黄=4,勿用蓝)
var POW_doors=0, POW_walls=1, POW_destroy=4, POW_double=3, POW_travel=5;

// 精灵表索引(与 tile_sprite[]/obj_sprite[] 一致)
var TILE_SPR=[
  [0,0],[6,0],[5,0],[0,3],[1,4],[6,2],
  [0,3],[0,3],[0,3],[0,3],
  [1,3],
  [5,3],[6,3],[7,3],[3,1],[4,1],[5,1],[6,5],[6,6]
];
var OBJ_SPR=[
  [6,1],[2,1],[0,4],[0,2],[2,4],[5,6],[6,2]
];

// 投影器字母→颜色/方向(与 lights[]/lightdata[] 一致)
var LIGHTS="rRPwgGHyYLtTVjoOAa";
var LIGHTDATA=[
  {c:0,d:DIR_E},{c:0,d:DIR_N},{c:0,d:DIR_S},{c:0,d:DIR_W},
  {c:1,d:DIR_E},{c:1,d:DIR_S},{c:1,d:DIR_W},
  {c:4,d:DIR_S},{c:4,d:DIR_E},{c:4,d:DIR_W},
  {c:5,d:DIR_W},{c:5,d:DIR_S},{c:5,d:DIR_N},{c:5,d:DIR_E},
  {c:3,d:DIR_E},{c:3,d:DIR_W},{c:3,d:DIR_N},{c:3,d:DIR_S}
];
var CNAMES=["红","绿","蓝","橙","黄","紫","青","粉"];
var CCOL =["#ff6b6b","#59e06a","#5aa9ff","#ff9d5c","#ffe66d","#b07cff","#5ee8d8","#ff8cd8"];

// ---------- 里程碑特性开关 ----------
var FEATURE_LIGHT=true;    // M3:供电+光束+能力 已启用
var FEATURE_ROVER=true;    // M4:Rover 自主移动 + V 宝石拾放 已启用

// ---------- 数据与采样 ----------
var RAW=window.PROMESST_MAP_RAW;
var ATLAS=128, CELL=16, img=null, imgData=null;
var powers=null;           // 8 种能力色(取样自精灵表,供 M3 光束)
var tileCache={};

function sample(x,y){
  var i=(y*ATLAS+x)*4;
  return [imgData.data[i],imgData.data[i+1],imgData.data[i+2],imgData.data[i+3]];
}
function computePowers(){
  powers=[];
  for(var i=0;i<8;i++) powers.push(sample(112+i,96));
}
function cellFrom(s,t){
  var key="c_"+s+"_"+t, c=tileCache[key];
  if(!c){ c=document.createElement("canvas"); c.width=CELL; c.height=CELL;
          c.getContext("2d").drawImage(img, s*CELL,t*CELL,CELL,CELL, 0,0,CELL,CELL);
          tileCache[key]=c; }
  return c;
}

// ---------- 关卡解析(移植 init_game,同 ./map) ----------
function parseWorld(){
  var tile=[[],[]], obj=[[],[]];
  var player=null, egg=null;
  var z,y,x;
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
      var s=RAW[y][z];
      for(x=0;x<WW;x++){
        var idx=x+Math.floor(x/SX);               // 跳房间间空格
        var d=idx<s.length ? s.charAt(idx) : " ";
        var o=obj[z][y][x], t=T.floor;
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
            var li=LIGHTS.indexOf(d);
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
      for(var d=0;d<4;d++){
        var ny=((y-YD[d])%WH+WH)%WH, nx=((x-XD[d])%WW+WW)%WW;
        if(tile[z][ny][nx]===T.arrow_e+d){ obj[z][y][x].dir=d; break; }
      }
    }
  }
  if(!player){ player={x:0,y:0,z:0}; }
  return {tile:tile, obj:obj, player:player, egg:egg};
}

// ---------- 供电与光束(移植,FEATURE_LIGHT 打开后启用) ----------
function computePowered(z,world){
  var pw=[]; var ry,rx,y,x;
  for(ry=0;ry<NY;ry++) pw[ry]=new Array(NX).fill(0);
  for(y=0;y<WH;y++) for(x=0;x<WW;x++)
    if(world.tile[z][y][x]===T.recep) pw[(y/SY)|0][(x/SX)|0]=1;
  for(y=0;y<WH;y++) for(x=0;x<WW;x++)
    if(world.tile[z][y][x]===T.recep && world.obj[z][y][x].type!==O.gem)
      pw[(y/SY)|0][(x/SX)|0]=0;
  return pw;
}
function propagate(z,world,pw){
  var L=[], any=[], y,x;
  for(y=0;y<WH;y++){ L[y]=[]; any[y]=new Array(WW).fill(0);
    for(x=0;x<WW;x++) L[y].push([-1,-1,-1,-1]); }
  function wrapX(a){ return ((a%WW)+WW)%WW; }
  function wrapY(a){ return ((a%WH)+WH)%WH; }
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    var o=world.obj[z][y][x];
    if(o.type!==O.projector) continue;
    if(!pw[(y/SY)|0][(x/SX)|0]) continue;
    var dir=o.dir, ax=x, dx=XD[o.dir], ay=y, dy=YD[o.dir];
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
var world=null;
var game={
  px:0, py:0, pz:0, pdir:DIR_S,
  player_timer:0,            // 剩余“可输入”时间(80→0)
  ability_flag:0,
  num_gems:0, gems_stored:-1,
  has_wand:false, num_zaps:0, egg_timer:0,
  steps:0
};
// 移动动画:提交时刻固定起止,单向推进,避免回退抖动
var animFromX=0, animFromY=0, animToX=0, animToY=0, animT0=0, animOn=false;
var q=null;                   // 排队按键(单槽,同 C queued_key)
var held=[];                  // 按住中的移动键(最近优先)
var checkpoint=null;

// M4:Rover / 喂食计时(常量与 C 一致)
var MAX_GEMS=30, ROVER_MS=630, FEED_MS=1200, REVERSE_MS=1100;
var rover_timer=0, feed_timer=0, reverse_timer=-1;

function copyWorld(){
  var c={tile:[], obj:[]};
  for(var z=0;z<2;z++){
    c.tile[z]=[]; c.obj[z]=[];
    for(var y=0;y<WH;y++){
      c.tile[z][y]=world.tile[z][y].slice();
      c.obj[z][y]=[];
      for(var x=0;x<WW;x++) c.obj[z][y][x]={type:world.obj[z][y][x].type,
        dir:world.obj[z][y][x].dir, color:world.obj[z][y][x].color};
    }
  }
  return c;
}

function reset(){
  world=parseWorld();
  var p=world.player;
  game.px=p.x; game.py=p.y; game.pz=p.z; game.pdir=DIR_S;
  game.player_timer=0; animOn=false;
  game.ability_flag=0; game.num_gems=0; game.gems_stored=-1;
  game.has_wand=false; game.num_zaps=0; game.egg_timer=0; game.steps=0;
  q=null; held=[]; checkpoint=null;
  rover_timer=0; feed_timer=0; reverse_timer=-1;
  lightCache=[null,null]; lightDirty=true;
  onViewChanged(true);
}

function startAnim(fx,fy,tx,ty){
  animFromX=fx; animFromY=fy; animToX=tx; animToY=ty;
  animT0=performance.now(); animOn=true;
}

// ---------- 光照缓存 / 能力判定 / 射击(移植 compute_powered+propagate 应用层) ----------
var lightCache=[null,null];   // lightCache[z]={pw,L,any}
var lightDirty=true;

function wrapX(a){ return ((a%WW)+WW)%WW; }
function wrapY(a){ return ((a%WH)+WH)%WH; }

function ensureLight(){
  if(!FEATURE_LIGHT) return;
  var z=game.pz;
  if(!lightCache[z]||lightDirty){
    var pw=computePowered(z,world);
    lightCache[z]=propagate(z,world,pw);
    lightCache[z].pw=pw;
    lightDirty=false;
  }
}

// 能力判定(移植 get_abilities,L714–721):站在玩家格,统计四向入射光颜色
function getAbilities(out){
  for(var i=0;i<8;i++) out[i]=0;
  if(!FEATURE_LIGHT) return out;
  ensureLight();
  var L=lightCache[game.pz].L;
  for(var d=0;d<4;d++){
    var c=L[game.py][game.px][d];
    if(c>=0) out[c]+=1;
  }
  return out;
}

// 找出所有照到玩家格的有电投影器(移植 find_lights_on_player,L538–577)
function findLightsOnPlayer(){
  var out=[];
  if(!FEATURE_LIGHT) return out;
  ensureLight();
  var pw=lightCache[game.pz].pw, z=game.pz;
  var y,x;
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    var o=world.obj[z][y][x];
    if(o.type!==O.projector) continue;
    if(!pw[(y/SY)|0][(x/SX)|0]) continue;      // 未通电不发光
    var dir=o.dir, ax=x, dx=XD[o.dir], ay=y, dy=YD[o.dir];
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
  var z=game.pz, any=false;
  var hits=findLightsOnPlayer();
  for(var i=0;i<hits.length;i++){
    var o=world.obj[z][hits[i].y][hits[i].x];
    if(o.type===O.projector && o.dir!==game.pdir){
      o.dir=game.pdir; any=true;
    }
  }
  if(any){ game.num_zaps++; lightDirty=true; return true; }
  return false;
}

// 调试开关(顶栏“调试”启用):noclip 穿墙、直接给魔杖
var noclip=false, debugOn=false;
var dbgMsg="";   // 最近一次移动的判定诊断(调试行显示)
function cheatWand(){ game.has_wand=true; game.num_gems=30; }
function cheatNoclip(){ noclip=!noclip; }

// 目标格分类(能力已内联判定):block=不能走 / door=红光可开 / stone=黄光可碎 / walk=可走(含绿光穿墙)
function cellKind(z,cx,cy,abilities){
  var t=world.tile[z][cy][cx], o=world.obj[z][cy][cx];
  if(o.type===O.projector || o.type===O.refl) return "block";
  if(t===T.wall)  return abilities[POW_walls] ? "walk" : "block";
  if(t===T.door)  return abilities[POW_doors] ? "door" : "block";
  if(o.type===O.stone) return abilities[POW_destroy] ? "stone" : "block";
  return "walk";
}

// ---------- 移动(移植 move(),L742–853;双步按逐格判定,门/石中途拦截) ----------
function tryMove(x,y){
  var z=game.pz;
  if(FEATURE_LIGHT) ensureLight();
  var abilities=[0,0,0,0,0,0,0,0];
  getAbilities(abilities);
  var proposed_pdir = x ? (x<0?DIR_W:DIR_E) : (y<0?DIR_N:DIR_S);
  var used=game.ability_flag;
  function setUsed(b){ used |= (1<<b); }

  // 调试穿墙:无视一切直接走一格
  if(noclip){
    var fx0=game.px, fy0=game.py;
    game.px=wrapX(game.px+x); game.py=wrapY(game.py+y);
    startAnim(fx0,fy0,game.px,game.py);
    game.pdir=proposed_pdir; game.player_timer=80; game.steps++;
    onViewChanged(false);
    return "move";
  }

  var L=FEATURE_LIGHT ? lightCache[z] : null;
  function isTravelCell(r,c){               // (行,列),与 L[r][c] 一致
    return L && (L.L[r][c][proposed_pdir]===POW_travel ||
                 L.L[r][c][proposed_pdir^2]===POW_travel);
  }
  // 移动诊断(调试):起点是否紫光 + 前方连续紫光格数
  if(debugOn && L){
    var dName= x ? (x>0?"E":"W") : (y>0?"S":"N");
    var cnt=0, cxa=game.px+x, cya=game.py+y;
    while(cnt<WW*WH && isTravelCell(cya,cxa)){
      cnt++; cxa=wrapX(cxa+x); cya=wrapY(cya+y);
    }
    dbgMsg="["+dName+"] 起点紫:"+(isTravelCell(game.py,game.px)?"是":"否")
           +" 前方连续紫格:"+cnt+" → "
           +(cnt>0?"应远行至第 "+cnt+" 格":"起点即终点,退化为普通移动");
  }

  // ---- 紫光远行(照 C:只判定终点,中途仅受“仍在紫光上”约束) ----
  var travel=false, gx=game.px, gy=game.py;
  if(L && isTravelCell(game.py,game.px)){
    gx=wrapX(game.px+x); gy=wrapY(game.py+y);
    while(isTravelCell(gy,gx)){ gx=wrapX(gx+x); gy=wrapY(gy+y); }
    gx=wrapX(gx-x); gy=wrapY(gy-y);
    if(gx!==game.px || gy!==game.py){ setUsed(POW_travel); travel=true; }
  }

  if(!travel){
    // 橙光双步:终点按原版判定;但路径中途若遇门(红光)/石块(黄光)则停下开门/砸碎
    var n=1;
    if(abilities[POW_double]){ n=1<<abilities[POW_double]; setUsed(POW_double); }
    var k;
    for(k=1;k<=n;k++){
      var cx=wrapX(game.px+x*k), cy=wrapY(game.py+y*k);
      var isMid=(k<n);
      var tT=world.tile[z][cy][cx], oT=world.obj[z][cy][cx];
      if(isMid){
        if(tT===T.door){                                  // 中途门:可开则开并停,不可开则挡
          if(!abilities[POW_doors]) return false;
          setUsed(POW_doors); game.ability_flag=used;
          world.tile[z][cy][cx]=T.opendoor;
          game.pdir=proposed_pdir; lightDirty=true; game.player_timer=80;
          return "open";
        }
        if(oT.type===O.stone){                            // 中途石:可碎则碎并停,不可碎则挡
          if(!abilities[POW_destroy]) return false;
          setUsed(POW_destroy); game.ability_flag=used;
          oT.type=O.empty;
          game.pdir=proposed_pdir; lightDirty=true; game.player_timer=80;
          return "destroy";
        }
        continue;                                         // 墙/投影器等中途按原版“过路”放行
      }
      var kind=cellKind(z,cx,cy,abilities);               // 终点判定(照原版)
      if(kind==="block") return false;
      if(kind==="door"){
        setUsed(POW_doors); game.ability_flag=used;
        world.tile[z][cy][cx]=T.opendoor;
        game.pdir=proposed_pdir; lightDirty=true; game.player_timer=80;
        return "open";
      }
      if(kind==="stone"){
        setUsed(POW_destroy); game.ability_flag=used;
        world.obj[z][cy][cx].type=O.empty;
        game.pdir=proposed_pdir; lightDirty=true; game.player_timer=80;
        return "destroy";
      }
      if(world.tile[z][cy][cx]===T.wall) setUsed(POW_walls);
      gx=cx; gy=cy;
    }
  } else {
    var kindT=cellKind(z,gy,gx,abilities);
    if(kindT==="block") return false;
    if(kindT==="door"){
      setUsed(POW_doors); game.ability_flag=used;
      world.tile[z][gy][gx]=T.opendoor;
      game.pdir=proposed_pdir; lightDirty=true; game.player_timer=80;
      return "open";
    }
    if(kindT==="stone"){
      setUsed(POW_destroy); game.ability_flag=used;
      world.obj[z][gy][gx].type=O.empty;
      game.pdir=proposed_pdir; lightDirty=true; game.player_timer=80;
      return "destroy";
    }
  }

  // ---- 落地(共用) ----
  var tgtObj=world.obj[z][gy][gx];
  var got_wand=false;
  if(tgtObj.type===O.wand){ game.has_wand=true; tgtObj.type=O.empty; got_wand=true; }

  var fx0=game.px, fy0=game.py;
  game.ability_flag=used;
  var nz=z;
  if(world.tile[z][gy][gx]===T.stairs) nz=(z+1)%2;

  game.px=gx; game.py=gy; game.pz=nz;
  startAnim(fx0,fy0,gx,gy);
  game.pdir=proposed_pdir;
  game.player_timer=80;
  game.steps++;
  if(nz!==z) lightDirty=true;
  if(got_wand){ checkpoint=copyWorld(); checkpoint.state=snapshotState(); }
  onViewChanged(false);
  return "move";
}

function snapshotState(){
  return {
    px:game.px, py:game.py, pz:game.pz, pdir:game.pdir,
    ability_flag:game.ability_flag, num_gems:game.num_gems,
    gems_stored:game.gems_stored, has_wand:game.has_wand,
    num_zaps:game.num_zaps, egg_timer:game.egg_timer
  };
}

// V 键:宝石拾取 / 放置(移植 drop(),L855–874:捡宝石或放回底座)
function drop(){
  var z=game.pz, x=game.px, y=game.py;
  var o=world.obj[z][y][x];
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
  var t=world.tile[z][cy][cx];
  if(t===T.wall||t===T.door) return false;
  var o=world.obj[z][cy][cx];
  if(o.type===O.gem) return allowGem;
  return o.type===O.empty;
}
// rover 首选方向:反转期(reverse>0)保持直行;否则踩箭头按箭头,被堵尝试掉头
function roverDir(z,rover,cx,cy){
  var d=rover.dir;
  if(reverse_timer>0) return d;
  var tt=world.tile[z][cy][cx];
  if(tt>=T.arrow_e && tt<T.arrow_e+4) d=tt-T.arrow_e;
  if(roverCanEnter(z,cx+XD[d],cy+YD[d],true)) return d;
  var d2=(d+2)&3;
  if(d2!==d && roverCanEnter(z,cx+XD[d2],cy+YD[d2],true)) return d2;
  return -1;
}
// 驱动玩家所在层的所有房间(每 630ms 一次,同 C 只跑 pz 层)
function stepRovers(){
  var z=game.pz;
  // 反转计时到 0:首只 rover 调头 180° 并恢复箭头逻辑(照 C L1168–1171/L1216–1217)
  if(reverse_timer===0){
    outer:
    for(var ry=0;ry<NY;ry++) for(var rx=0;rx<NX;rx++)
      for(var yy=0;yy<SY;yy++) for(var xx=0;xx<SX;xx++){
        var o0=world.obj[z][ry*SY+yy][rx*SX+xx];
        if(o0.type===O.rover){ o0.dir=(o0.dir+2)&3; break outer; }
      }
    reverse_timer=-1;
  }
  var rx2,ry2;
  for(ry2=0;ry2<NY;ry2++) for(rx2=0;rx2<NX;rx2++){
    var x0=rx2*SX, y0=ry2*SY, yy2, xx2;
    var list=[];
    for(yy2=0;yy2<SY;yy2++) for(xx2=0;xx2<SX;xx2++){
      var o=world.obj[z][y0+yy2][x0+xx2];
      if(o.type===O.rover) list.push({o:o,x:x0+xx2,y:y0+yy2});
    }
    for(var i=0;i<list.length;i++){
      var r=list[i];
      var d=roverDir(z,r.o,r.x,r.y);
      if(d<0) continue;
      var nx=r.x+XD[d], ny=r.y+YD[d];
      if(!roverCanEnter(z,nx,ny,true)) continue;
      var target=world.obj[z][ny][nx];
      if(target.type===O.rover) continue;          // 目标有另一只:本只等待
      var clash=false;
      for(var j=0;j<i;j++)
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
    var guard=0;
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
    var ch=null;
    if(q){ ch=q; q=null; }
    else if(held.length){ ch=held[held.length-1]; }
    if(!ch) return;
    var dx=0,dy=0;
    if(ch==="a") dx=-1; else if(ch==="d") dx=1;
    else if(ch==="w") dy=-1; else if(ch==="s") dy=1;
    if(dx||dy){ tryMove(dx,dy); }
    else if(ch==="x"){ shoot(); }
    else if(ch==="v"){ drop(); }
    // z=撤销(M5)、c=反射镜(逻辑保留)——后续里程碑
  }
}

// ---------- 渲染 ----------
var cv=document.getElementById("cv");
var ctx=cv.getContext("2d");
var zoomK=2, autoFit=true, follow=true, showGrid=false;
var canvasSize=384;

function kPx(){ return CELL*zoomK; }

function render(){
  if(!world||!img) return;
  var z=game.pz, k=zoomK, K=kPx();
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.imageSmoothingEnabled=false;

  var y,x,i;
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    var t=world.tile[z][y][x];
    var rx=(x/SX)|0, ry=(y/SY)|0;
    var sp=TILE_SPR[t];
    if(t===T.wall && ((rx^ry)&1)) sp=[7,0];
    ctx.drawImage(cellFrom(sp[0],sp[1]), x*K,y*K,K,K);
    if(t>=T.floor){
      var chk=[ [x+1,y,1,0],[x-1,y,3,0],[x,y+1,4,0],[x,y-1,2,0] ];
      for(i=0;i<4;i++){
        var mx=((chk[i][0])%WW+WW)%WW, my=((chk[i][1])%WH+WH)%WH;
        if(world.tile[z][my][mx]===T.wall)
          ctx.drawImage(cellFrom(chk[i][2],chk[i][3]), x*K,y*K,K,K);
      }
    }
  }
  for(y=0;y<WH;y++) for(x=0;x<WW;x++){
    var o=world.obj[z][y][x];
    if(o.type===O.empty) continue;
    var oc=null;
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
    var lit=lightCache[z];
    if(lit){
      for(y=0;y<WH;y++) for(x=0;x<WW;x++){
        if(!lit.any[y][x]) continue;
        var n=0, rr=0, gg=0, bb=0;
        for(var d=0;d<4;d++){
          var cc=lit.L[y][x][d];
          if(cc>=0){ var pc=powers[cc]; rr+=pc[0]; gg+=pc[1]; bb+=pc[2]; n++; }
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
        var o2=world.obj[z][y][x];
        if(o2.type===O.projector && lit.pw[(y/SY)|0][(x/SX)|0]){
          var pc2=powers[o2.color];
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
    for(x=0;x<=NX;x++){ var gx=x*SX*K; ctx.moveTo(gx+0.5,0); ctx.lineTo(gx+0.5,WH*K); }
    for(y=0;y<=NY;y++){ var gy=y*SY*K; ctx.moveTo(0,gy+0.5); ctx.lineTo(WW*K,gy+0.5); }
    ctx.stroke();
  }

  // 玩家(80ms 单向插值;跨世界缝直接瞬移)
  var drawX=game.px, drawY=game.py;
  if(animOn){
    var fr=Math.min(1,(performance.now()-animT0)/80);
    if(fr>=1){ animOn=false; }
    else if(!seamCross(animFromX,animToX,WW) && !seamCross(animFromY,animToY,WH)){
      drawX=animFromX+(animToX-animFromX)*fr;
      drawY=animFromY+(animToY-animFromY)*fr;
    } else { animOn=false; }                 // 跨界:瞬移不插值
  }
  var dxs=game.pdir;
  ctx.globalAlpha=0.9;
  ctx.drawImage(cellFrom(dxs,6), drawX*K, drawY*K, K, K);
  ctx.globalAlpha=1;
  // 辅助环(便于识别)
  ctx.strokeStyle="rgba(255,212,121,0.9)"; ctx.lineWidth=Math.max(2,k*0.4);
  ctx.strokeRect(drawX*K+1, drawY*K+1, K-2, K-2);
  refreshHud();
}
function seamCross(a,b,n){ return Math.abs(a-b)>1; }

// ---------- HUD ----------
var hud={z:"",xy:"",room:"",face:"",steps:"",ab:"",wand:"",gems:""};
function refreshHud(){
  var z=game.pz, x=game.px, y=game.py;
  var rx=(x/SX)|0, ry=(y/SY)|0;
  var zs="Z"+z, xys="("+x+","+y+")", rs="("+rx+","+ry+")",
      fs=DIRNAME[game.pdir], st=String(game.steps);
  if(hud.z!==zs){ hud.z=zs; byId("bz").textContent=zs; }
  if(hud.xy!==xys){ hud.xy=xys; byId("bxy").textContent=xys; }
  if(hud.room!==rs){ hud.room=rs; byId("broom").textContent=rs; }
  if(hud.face!==fs){ hud.face=fs; byId("bfacing").textContent=fs; }
  if(hud.steps!==st){ hud.steps=st; byId("bsteps").textContent=st; }
  var ws=game.has_wand?"有":"无";
  if(hud.wand!==ws){ hud.wand=ws; byId("bwand").textContent=ws; }
  var gs=(game.gems_stored>=0)?(game.gems_stored+"/"+MAX_GEMS):"—";
  if(hud.gems!==gs){ hud.gems=gs; byId("bgems").textContent=gs; }
  // 当前可用能力(站在什么颜色的光束里)
  if(FEATURE_LIGHT){
    var ab=[0,0,0,0,0,0,0,0];
    getAbilities(ab);
    var names=[];
    for(var i=0;i<8;i++) if(ab[i]) names.push(CNAMES[i]);
    var as=names.length?names.join(" "):"—";
    if(hud.ab!==as){ hud.ab=as; byId("bab").textContent=as; }
    // 调试:玩家格四向入射光(E/N/W/S 各是什么颜色),用于核对紫光远行
    if(debugOn && lightCache[z]){
      var L=lightCache[z].L;
      var parts=[];
      for(var d=0;d<4;d++){
        var v=L[game.py][game.px][d];
        parts.push(["E","N","W","S"][d]+"="+(v>=0?CNAMES[v]:"—"));
      }
      byId("dbgLights").textContent="入射光:"+parts.join(" ");
      byId("dbgMove").textContent=dbgMsg||"—";
    }
  }
}
function byId(id){ return document.getElementById(id); }

// ---------- 视野:适配/缩放/跟随 ----------
var stage=byId("stage");
function fitZoom(){
  var w=stage.clientWidth-24, h=stage.clientHeight-24;
  var k=Math.floor(Math.min(w,h)/canvasSize);
  return Math.max(1, Math.min(4, k||1));
}
function resizeCanvas(){
  if(autoFit) zoomK=fitZoom();
  cv.width=canvasSize*zoomK; cv.height=canvasSize*zoomK;
  centerPlayer();
}
function centerPlayer(){
  if(!follow) return;
  var k=zoomK;
  var cx=(game.px*CELL+8)*k, cy=(game.py*CELL+8)*k;
  var sx=stage.clientWidth, sy=stage.clientHeight;
  var maxL=Math.max(0,stage.scrollWidth-sx), maxT=Math.max(0,stage.scrollHeight-sy);
  stage.scrollLeft=Math.max(0,Math.min(maxL, cx-sx/2));
  stage.scrollTop =Math.max(0,Math.min(maxT, cy-sy/2));
}
function onViewChanged(center){ if(center) resizeCanvas(); }

// ---------- 输入 ----------
var KEYMAP={ ArrowUp:"w", KeyW:"w", ArrowDown:"s", KeyS:"s",
             ArrowLeft:"a", KeyA:"a", ArrowRight:"d", KeyD:"d" };
window.addEventListener("keydown",function(e){
  var c=KEYMAP[e.code];
  if(c){ e.preventDefault(); q=c;
    var i=held.indexOf(c); if(i>=0) held.splice(i,1);
    held.push(c);
    return;
  }
  var a={KeyX:"x",KeyV:"v",KeyZ:"z",KeyC:"c"}[e.code];
  if(a){ e.preventDefault(); q=a; }
});
window.addEventListener("keyup",function(e){
  var c=KEYMAP[e.code];
  if(c){ var i=held.indexOf(c); if(i>=0) held.splice(i,1); }
});
window.addEventListener("blur",function(){ held=[]; q=null; });

// 控件
byId("btnFit").addEventListener("click",function(){ autoFit=true; resizeCanvas(); });
byId("btnZo").addEventListener("click",function(){ autoFit=false; zoomK=Math.max(1,zoomK-1); resizeCanvas(); });
byId("btnZi").addEventListener("click",function(){ autoFit=false; zoomK=Math.min(4,zoomK+1); resizeCanvas(); });
byId("btnRestart").addEventListener("click",function(){ reset(); resizeCanvas(); render(); });
byId("ckFollow").addEventListener("change",function(e){ follow=e.target.checked; centerPlayer(); });
byId("ckGrid").addEventListener("change",function(e){ showGrid=e.target.checked; });
byId("ckDbg").addEventListener("change",function(e){
  debugOn=e.target.checked;
  byId("dbgrow").style.display=debugOn?"block":"none";
});
byId("dbgWand").addEventListener("click",function(){ cheatWand(); });
byId("dbgNoclip").addEventListener("click",function(){
  cheatNoclip();
  byId("dbgNoclipState").textContent="穿墙:"+(noclip?"开":"关");
});
window.addEventListener("resize",function(){ if(autoFit) resizeCanvas(); });

// ---------- 主循环(rAF + 16ms 步进) ----------
var last=performance.now(), acc=0;
function loop(now){
  var dt=Math.min(now-last,250); last=now;
  acc+=dt; var guard=0;
  while(acc>=16 && guard<8){ update(16); acc-=16; guard++; }
  if(guard>=8) acc=0;
  render();
  if(follow) centerPlayer();
  requestAnimationFrame(loop);
}

// ---------- 错误与启动 ----------
function err(msg){ var e=byId("err"); e.style.display="block"; e.textContent=msg; }
(function boot(){
  try{
    if(!RAW||RAW.length!==24){ err("map-data.js 异常:期望 24 行,实际 "+(RAW?RAW.length:"未定义")+"。"); return; }
    img=new Image();
    img.onload=function(){
      try{
        var tmp=document.createElement("canvas"); tmp.width=ATLAS; tmp.height=ATLAS;
        var tc=tmp.getContext("2d"); tc.drawImage(img,0,0);
        imgData=tc.getImageData(0,0,ATLAS,ATLAS);
        computePowers();
        reset();
        resizeCanvas();
        render();
        requestAnimationFrame(loop);
      }catch(ex){ err("初始化失败:\n"+ex.message+"\n(file:// 打开可能有跨域限制,请用 Live Server 或 python -m http.server)"); }
    };
    img.onerror=function(){ err("无法加载 assets/sprites.png —— 请确认文件存在。"); };
    img.src="./assets/sprites.png";
  }catch(ex){ err("启动失败:"+ex.message); }
})();
