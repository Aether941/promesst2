"use strict";
/* PROMESST 2 网页版移植  13_saves.js
   存档槽、导出与导入
   拆分自原 game.js;模块加载顺序见 index.html。 */

// ---------- 存档槽(3 槽 + 导出/导入) ----------
let activeSlot = 1;
/**
 * 功能:返回存档槽 i 对应的存储键。
 * @param {*} i
 */
function slotKey(i) {
  return "v1.slot" + i;
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
    return (n < 10 ? "0" : "") + n;
  }
  return (
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    " " +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes())
  );
}
/**
 * 功能:渲染 3 个存档槽及读取/保存/删除/设为当前按钮。
 */
function renderSlots() {
  // 实现:异步读取三个槽位,生成状态行和读取/保存/删除按钮。
  const host = byId("slotList");
  if (!host) return;
  host.innerHTML = "";
  const jobs = [];
  for (let i = 1; i <= 3; i++)
    jobs.push(
      idbGet(slotKey(i)).catch(function () {
        return null;
      }),
    );
  Promise.all(jobs).then(function (list) {
    list.forEach(function (d, idx) {
      const i = idx + 1,
        m = d && d.meta ? d.meta : null;
      const row = document.createElement("div");
      row.className = "slot" + (i === activeSlot ? " active" : "");
      const info = document.createElement("div");
      info.className = "info";
      info.innerHTML =
        "<b>槽 " +
        i +
        "</b>" +
        (i === activeSlot ? " (当前)" : "") +
        " — " +
        (m
          ? "保存于 " +
            fmtTime(m.savedAt) +
            " · 步数 " +
            m.steps +
            " · 已喂 " +
            (m.gems >= 0 ? m.gems : 0) +
            "/30" +
            (m.wand ? " · 有魔杖" : "") +
            (m.cleared ? " · 已通关" : "")
          : "（空）");
      row.appendChild(info);
      /**
       * 功能:创建槽位操作按钮并绑定回调。
       * @param {*} label
       * @param {*} fn
       */
      function mk(label, fn) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = label;
        b.addEventListener("click", fn);
        row.appendChild(b);
      }
      mk("读取", function () {
        idbGet(slotKey(i)).then(function (dd) {
          if (!dd || !dd.g) {
            byId("slotHint").textContent = "槽 " + i + " 为空。";
            return;
          }
          setActiveSlot(i);
          restoreSave(dd);
          gameStarted = true;
          byId("slotHint").textContent = "已读取槽 " + i + "。";
          setMode("game");
        });
      });
      mk("保存到此处", function () {
        const prev = activeSlot;
        setActiveSlot(i);
        saveToDB().then(function () {
          renderSlots();
          byId("slotHint").textContent =
            "已保存到槽 " + i + (prev !== i ? "(当前槽已切换)" : "") + "。";
        });
      });
      mk("设为当前", function () {
        setActiveSlot(i);
        renderSlots();
        byId("slotHint").textContent = "当前槽 = " + i + "(自动存档将写入此槽)。";
      });
      mk("删除", function () {
        idbPut(slotKey(i), null).then(function () {
          renderSlots();
          byId("slotHint").textContent = "已删除槽 " + i + "。";
        });
      });
      host.appendChild(row);
    });
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
  a.download = "promesst2-slot" + activeSlot + ".json";
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
        byId("slotHint").textContent = "已导入到槽 " + activeSlot + "。";
      });
    } catch (ex) {
      byId("slotHint").textContent = "导入失败:" + ex.message;
    }
  };
  fr.readAsText(file);
}

/* ---------- ESM 全局桥:保持原经典脚本的跨模块状态共享 ---------- */
globalThis.slotKey = slotKey;
globalThis.loadActiveSlot = loadActiveSlot;
globalThis.setActiveSlot = setActiveSlot;
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
