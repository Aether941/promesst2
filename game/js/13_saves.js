"use strict";
/* PROMESST 2 网页版移植  13_saves.js
   存档槽、导出与导入
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 存档槽(3 槽 + 导出/导入) ----------
let activeSlot = 1;
let copySource = null;
let slotRenderToken = 0;
/**
 * 功能:返回存档槽 i 对应的存储键。
 * @param {*} i
 */
function slotKey(i) {
  return `v1.slot${i}`;
}
/**
 * 功能:读取当前激活槽;若无则兼容旧的 main 键。
 */
function loadActiveSlot() {
  try {
    const s = parseInt(localStorage.getItem("promesst2.activeSlot") || "1", 10);
    if (s >= 1 && s <= 3) activeSlot = s;
  } catch (e) {}
  return idbGet(slotKey(activeSlot))
    .then(function (d) {
      if (d && d.g) return d;
      return idbGet("main"); // 兼容 M5 旧存档
    })
    .catch(function () {
      return null;
    });
}
/**
 * 功能:设置当前激活存档槽并持久化槽号。
 * @param {*} i
 */
function setActiveSlot(i) {
  activeSlot = i;
  try {
    localStorage.setItem("promesst2.activeSlot", String(i));
  } catch (e) {}
}
/**
 * 功能:把当前进度保存到指定槽,但不改变当前激活槽。
 * @param {*} i
 */
function saveToSlot(i) {
  if (!globalThis.DB || !globalThis.lastSnap) return Promise.resolve(false);
  const prev = activeSlot;
  activeSlot = i;
  let payload;
  try {
    payload = packSave();
  } finally {
    activeSlot = prev;
  }
  return idbPut(slotKey(i), payload).then(function () {
    return true;
  });
}
/**
 * 功能:切换当前存档槽;有存档就读取,空档则重置为空游戏状态。
 * @param {*} i
 */
function switchSlot(i) {
  return idbGet(slotKey(i))
    .then(function (dd) {
      setActiveSlot(i);
      copySource = null;
      if (dd && dd.g) {
        restoreSave(dd);
        gameStarted = true;
        byId("slotHint").textContent = `已切换到槽 ${i}。`;
      } else {
        reset();
        gameStarted = false;
        clearedFlag = false;
        byId("slotHint").textContent = `槽 ${i} 为空,已切换为空档。`;
      }
      renderSlots();
    })
    .catch(function (e) {
      byId("slotHint").textContent = `切换失败:${e.message}`;
    });
}
/**
 * 功能:读取指定槽的存档;当前槽优先取内存快照,保证未落盘的自动保存也能复制。
 * @param {*} i
 */
function readSlotData(i) {
  if (i === activeSlot && globalThis.lastSnap) return Promise.resolve(packSave());
  return idbGet(slotKey(i));
}
/**
 * 功能:把源槽存档复制到目标槽;若目标是当前自动保存槽,同时把内存进度切到复制后的存档。
 * @param {*} src
 * @param {*} dst
 */
function pasteSlot(src, dst) {
  return readSlotData(src)
    .then(function (data) {
      if (!data || !data.g) {
        copySource = null;
        renderSlots();
        byId("slotHint").textContent = `槽 ${src} 没有可复制的存档。`;
        return;
      }
      if (data.meta) data.meta.slot = dst;
      if (dst === activeSlot && globalThis.saveTimer) {
        clearTimeout(globalThis.saveTimer);
        globalThis.saveTimer = null;
      }
      return idbPut(slotKey(dst), data).then(function () {
        if (dst === activeSlot) {
          restoreSave(data);
          gameStarted = true;
        }
        copySource = null;
        renderSlots();
        byId("slotHint").textContent = `已从槽 ${src} 复制到槽 ${dst}。`;
      });
    })
    .catch(function (e) {
      byId("slotHint").textContent = `复制失败:${e.message}`;
    });
}
/**
 * 功能:把时间戳格式化为 YYYY-MM-DD HH:mm;0 返回 。
 * @param {*} ms
 */
function fmtTime(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  /**
   * 功能:数字两位补零。
   * @param {*} n
   */
  function p(n) {
    return `${n < 10 ? "0" : ""}${n}`;
  }
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
/**
 * 功能:渲染 3 个存档槽及读取/保存/删除/设为当前按钮。
 */
function renderSlots() {
  // 实现:异步读取三个槽位,生成状态行和读取/保存/删除按钮。
  const host = byId("slotList");
  if (!host) return;
  const token = ++slotRenderToken;
  const jobs = [];
  for (let i = 1; i <= 3; i++)
    jobs.push(
      idbGet(slotKey(i)).catch(function () {
        return null;
      }),
    );
  Promise.all(jobs).then(function (list) {
    if (token !== slotRenderToken) return;
    const frag = document.createDocumentFragment();
    list.forEach(function (d, idx) {
      const i = idx + 1,
        m = d && d.meta ? d.meta : null;
      const carry =
        i === activeSlot && globalThis.lastSnap
          ? globalThis.game.num_gems
          : d && d.g && d.g.player && typeof d.g.player.gems === "number"
            ? d.g.player.gems
            : 0;
      const hasWand =
        i === activeSlot && globalThis.lastSnap ? globalThis.game.has_wand : !!(m && m.wand);
      const row = document.createElement("div");
      row.className = `slot${i === activeSlot ? " active" : ""}${i === copySource ? " copying" : ""}`;
      const info = document.createElement("div");
      info.className = "info";
      info.innerHTML = `<b>槽 ${i}</b>${i === activeSlot ? " (当前)" : ""}${i === copySource ? " [复制源]" : ""} — ${
        m
          ? `保存于 ${fmtTime(m.savedAt)} · 步数 ${m.steps} · 宝石 ${carry} · 魔杖 ${hasWand ? "有" : "无"}${m.cleared ? " · 已通关" : ""}`
          : "（空）"
      }`;
      row.appendChild(info);
      /**
       * 功能:创建槽位操作按钮并绑定回调。
       * @param {*} label
       * @param {*} fn
       */
      function mk(label, fn, disabled) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = label;
        b.disabled = !!disabled;
        b.addEventListener("click", fn);
        row.appendChild(b);
      }
      mk("读取", function () {
        idbGet(slotKey(i)).then(function (dd) {
          if (!dd || !dd.g) {
            byId("slotHint").textContent = `槽 ${i} 为空。`;
            return;
          }
          setActiveSlot(i);
          restoreSave(dd);
          gameStarted = true;
          byId("slotHint").textContent = `已读取槽 ${i}。`;
          setMode("game");
        });
      });
      if (copySource === null) {
        mk("复制", function () {
          if (!m) {
            byId("slotHint").textContent = `槽 ${i} 为空,不能作为复制源。`;
            return;
          }
          copySource = i;
          renderSlots();
          byId("slotHint").textContent = `已选中槽 ${i} 作为复制源,请点击其他槽的「粘贴」。`;
        });
      } else if (copySource === i) {
        mk("取消", function () {
          copySource = null;
          renderSlots();
          byId("slotHint").textContent = "已取消复制。";
        });
      } else {
        mk("粘贴", function () {
          pasteSlot(copySource, i);
        });
      }
      mk("设为当前", function () {
        switchSlot(i);
      });
      mk("删除", function () {
        if (copySource === i) copySource = null;
        idbPut(slotKey(i), null).then(function () {
          renderSlots();
          byId("slotHint").textContent = `已删除槽 ${i}。`;
        });
      });
      frag.appendChild(row);
    });
    host.replaceChildren(frag);
  });
}
/**
 * 功能:导出当前槽为 JSON 文件。
 */
function exportSave() {
  const data = JSON.stringify(packSave());
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const now = new Date();
  const p = function (n) {
    return (n < 10 ? "0" : "") + n;
  };
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const carry = globalThis.game.num_gems;
  const wand = globalThis.game.has_wand ? "wand" : "nowand";
  a.download = `promesst2-slot${activeSlot}-gems${carry}-${wand}-${stamp}.json`;
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
  }, 3000);
}
/**
 * 功能:从用户选择的 JSON 文件导入存档。
 * @param {*} file
 */
function importSave(file) {
  const fr = new FileReader();
  fr.onload = function () {
    try {
      const d = JSON.parse(fr.result);
      if (!d || !d.g || !d.g.tile) throw new Error("不是有效的存档 JSON");
      idbPut(slotKey(activeSlot), d).then(function () {
        restoreSave(d);
        gameStarted = true;
        renderSlots();
        byId("slotHint").textContent = `已导入到槽 ${activeSlot}。`;
      });
    } catch (ex) {
      byId("slotHint").textContent = `导入失败:${ex.message}`;
    }
  };
  fr.readAsText(file);
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.slotKey = slotKey;
globalThis.loadActiveSlot = loadActiveSlot;
globalThis.setActiveSlot = setActiveSlot;
globalThis.saveToSlot = saveToSlot;
globalThis.switchSlot = switchSlot;
globalThis.fmtTime = fmtTime;
globalThis.renderSlots = renderSlots;
globalThis.exportSave = exportSave;
globalThis.importSave = importSave;
Object.defineProperty(globalThis, "activeSlot", {
  configurable: true,
  get() {
    return activeSlot;
  },
  set(value) {
    activeSlot = value;
  },
});
