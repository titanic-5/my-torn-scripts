// ==UserScript==
// @name         Torn Pickpocket Helper
// @namespace    titanic-5.uk
// @version      1.0
// @description  Pickpocket HUD
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/page.php?sid=crimes
// @exclude      https://www.torn.com/forums.php*
// @exclude      https://www.torn.com/trade.php*
// @exclude      https://www.torn.com/item.php*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Pickpocket%20Helper.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Pickpocket%20Helper.user.js
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const cfg = {
    get: (k, def) => localStorage.getItem(k) ?? def,
    set: (k, v) => localStorage.setItem(k, v),
  };

  let panelOpen = cfg.get("pph-panel-open", "false") === "true";
  let filterBarOpen = cfg.get("pph-filter-open", "false") === "true";
  let sortMode = cfg.get("pph-sort-mode", "profit");
  let minProfit = parseInt(cfg.get("pph-min-profit", "0"), 10);
  let targetFilter = cfg.get("pph-target-filter", "all");
  let soundEnabled = cfg.get("pph-sound-enabled", "true") === "true";
  let soundTargetMode = cfg.get("pph-sound-target", "top");

  let activeTargets = [];
  let seenTargetIds = new Set();
  let timerInterval = null;
  let currentUser = null;
  let currentCS = 100;
  let latestRfcv = "";

  const isPickpocketPage = () => window.location.hash.toLowerCase().includes("pickpocket");

  function getRfcv() {
    if (latestRfcv) return latestRfcv;
    const c = win.$?.cookie?.("rfc_v") || document.cookie.match(/rfc_v=([a-zA-Z0-9]+)/)?.[1];
    return c || "";
  }

  function playAlertChime() {
    if (!soundEnabled || soundTargetMode === "none") return;
    try {
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn("[PPH] Audio alert blocked or unsupported:", e);
    }
  }

  function shouldAlertForTarget(t) {
    if (!soundEnabled || soundTargetMode === "none") return false;
    if (soundTargetMode === "top") return t.titleKey.includes("cyclist") || t.titleKey.includes("mobster");
    if (soundTargetMode === "cyclist") return t.titleKey.includes("cyclist");
    if (soundTargetMode === "mobster") return t.titleKey.includes("mobster");
    if (soundTargetMode === "skinny") return t.build.toLowerCase().includes("skinny");
    if (soundTargetMode === "highval") return t.profit >= 3000;
    return false;
  }

  const TARGET_DB = {
    mobster: { tier: "risky", profit: 11779, rates: [43, 53, 57, 92, 91] },
    cyclist: { tier: "dangerous", profit: 11399, rates: [42, 70, 72, 64, 88] },
    "rich kid": { tier: "unsafe", profit: 3055, rates: [84, 85, 91, 86, 96] },
    "drunk woman": { tier: "safe", profit: 2702, rates: [99, 96, 98, 100, 100], avoidStatus: "distracted" },
    "postal worker": { tier: "moderate", profit: 2643, rates: [93, 89, 95, 100, 100] },
    "classy lady": { tier: "moderate", profit: 2512, rates: [88, 93, 96, 93, 95] },
    businessman: { tier: "risky", profit: 2496, rates: [65, 74, 77, 79, 88], avoidStatus: "walking", avoidBuild: "skinny" },
    thug: { tier: "unsafe", profit: 2304, rates: [81, 83, 87, 91, 97], reqStatus: "running", avoidBuild: "muscular" },
    "gang member": { tier: "risky", profit: 2125, rates: [71, 73, 92, 83, 90], avoidBuild: "muscular" },
    businesswoman: { tier: "risky", profit: 1861, rates: [66, 74, 78, 88, 93], avoidStatus: "walking" },
    "sex worker": { tier: "unsafe", profit: 1708, rates: [82, 88, 88, 87, 97], avoidStatus: "distracted", avoidBuild: "muscular" },
    "police officer": { tier: "extreme", profit: 1598, rates: [3, 19, 9, 0, 36] },
    "young man": { tier: "moderate", profit: 1550, rates: [89, 94, 93, 96, 95], avoidStatus: "walking" },
    laborer: { tier: "moderate", profit: 1479, rates: [88, 96, 97, 94, 96], avoidStatus: "distracted" },
    junkie: { tier: "safe", profit: 1283, rates: [95, 96, 95, 100, 100], avoidStatus: "loitering", avoidBuild: "muscular" },
    jogger: { tier: "risky", profit: 1160, rates: [69, 73, 88, 96, 94], reqStatus: "walking" },
    "drunk man": { tier: "safe", profit: 1140, rates: [97, 98, 100, 93, 100], avoidStatus: "distracted", avoidBuild: "muscular" },
    student: { tier: "moderate", profit: 1041, rates: [93, 92, 96, 100, 100], avoidStatus: "walking", avoidBuild: "athletic" },
    "elderly man": { tier: "safe", profit: 997, rates: [96, 96, 98, 93, 100], avoidBuild: "muscular" },
    "young woman": { tier: "moderate", profit: 787, rates: [92, 94, 91, 96, 99], avoidStatus: "walking" },
    "homeless person": { tier: "safe", profit: 717, rates: [91, 96, 100, 100, 100], avoidStatus: "loitering" },
    "elderly woman": { tier: "safe", profit: 613, rates: [97, 94, 100, 100, 80], avoidBuild: "muscular" },
  };

  const formatProfit = (val) => (val ? `$${val.toLocaleString()} / Nerve` : "$0 / Nerve");

  function evaluateTarget(title = "", status = "", build = "") {
    const key = title.toLowerCase().trim();
    const statKey = status.toLowerCase().trim();
    const bldKey = build.toLowerCase().trim();

    const def = TARGET_DB[key] || { tier: "moderate", profit: 0, rates: [80, 85, 90, 95, 98] };
    const bIdx = Math.min(4, Math.floor(currentCS / 20.001));
    let rate = def.rates[bIdx];

    if (def.reqStatus && !def.reqStatus.includes(statKey)) rate -= 25;
    else if (def.avoidStatus && def.avoidStatus.includes(statKey)) rate -= 15;
    else if (def.avoidBuild && def.avoidBuild.includes(bldKey)) rate -= 20;

    return { tier: def.tier, profit: def.profit, rate: Math.max(10, rate) };
  }

  const origFetch = win.fetch;
  win.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const m = url.match(/rfcv=([a-zA-Z0-9]+)/);
      if (m) latestRfcv = m[1];

      if (url.includes("sid=crimesData") && url.includes("step=crimesList")) {
        res
          .clone()
          .json()
          .then((data) => {
            const db = data.DB || data;
            if (db?.crimesByType) processServerData(db);
          })
          .catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  async function executePickpocket(target, btn) {
    const rfcv = getRfcv();
    if (!rfcv || target.expiresAt - Date.now() <= 0) {
      btn.disabled = true;
      return;
    }

    btn.disabled = true;
    btn.textContent = "...";

    try {
      const res = await origFetch(`/page.php?sid=crimesData&step=attempt&typeID=5&crimeID=${target.crimeID}&value1=${target.id}&rfcv=${rfcv}`, {
        method: "POST",
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      const db = (await res.json()).DB;
      if (db?.outcome) {
        const ok = db.outcome.result === "success";
        btn.textContent = ok ? "Success" : "Failure";
        btn.className = `pph-pick-btn ${ok ? "c-bg-ok" : "c-bg-err"}`;

        if (db.user) {
          currentUser = db.user;
          renderHeader();
        }
        setTimeout(() => {
          activeTargets = activeTargets.filter((t) => t.id !== target.id);
          renderTargetCards();
        }, 1200);
      } else {
        btn.textContent = "Err";
        btn.disabled = false;
      }
    } catch (e) {
      btn.textContent = `Pick ${target.nerve}`;
      btn.disabled = false;
    }
  }

  function processServerData(db) {
    currentUser = db.user || currentUser;
    currentCS = db.currentLevel || db.currentUserStats?.skill || currentCS;

    const now = Date.now();
    let hasNewAlertTarget = false;
    const currentBatchIds = new Set();

    activeTargets = (db.crimesByType || [])
      .filter((t) => t.timeLeft > 0)
      .map((t) => {
        const status = t.crimeInfo?.status?.title || "Walking";
        const build = t.crimeInfo?.muscular || "";
        const ev = evaluateTarget(t.title, status, build);
        const titleKey = (t.title || "").toLowerCase().trim();
        currentBatchIds.add(t.commitID);

        const calibratedRemaining = Math.max(0, t.timeLeft - 1);

        const targetObj = {
          id: t.commitID,
          crimeID: t.crimeID,
          title: t.title || "Unknown",
          titleKey,
          nerve: t.nerve || 5,
          profit: ev.profit,
          successRate: ev.rate,
          tierClass: `tier-${ev.tier}`,
          status,
          build,
          expiresAt: now + calibratedRemaining * 1000,
          stats: t.crimeInfo?.stats || {},
        };

        if (!seenTargetIds.has(t.commitID)) {
          if (shouldAlertForTarget(targetObj)) hasNewAlertTarget = true;
        }

        return targetObj;
      });

    seenTargetIds = currentBatchIds;
    if (hasNewAlertTarget) playAlertChime();

    renderHeader();
    renderTargetCards();
    startTimerLoop();
  }

  function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!isPickpocketPage()) return;
      const now = Date.now();

      activeTargets.forEach((t) => {
        const left = Math.max(0, Math.floor((t.expiresAt - now) / 1000));
        const el = document.getElementById(`pph-t-${t.id}`);
        if (el) el.textContent = `${left}s`;

        if (left === 0) {
          const card = document.getElementById(`pph-c-${t.id}`);
          if (card) {
            card.classList.add("is-expired");
            const btn = card.querySelector(".pph-pick-btn");
            if (btn) btn.disabled = true;
          }
        }
      });
    }, 1000);
  }

  function renderHeader() {
    const statsEl = document.getElementById("pph-user-stats");
    if (!statsEl) return;
    const attacked = Boolean(currentUser?.isUnderAttack);
    document.getElementById("pph-container")?.classList.toggle("is-under-attack", attacked);
    statsEl.innerHTML = `Nerve: <span class="c-warn">${currentUser?.nerve ?? "--"}</span> &nbsp;&nbsp; Under Attack: ${
      attacked ? '<span class="c-err">YES</span>' : '<span class="c-ok">No</span>'
    }`;
  }

  function renderTargetCards() {
    const listEl = document.getElementById("pph-target-list");
    const noticeEl = document.getElementById("pph-hidden-notice");
    if (!listEl) return;

    const now = Date.now();
    let filtered = activeTargets.filter((t) => {
      if (minProfit > 0 && t.profit < minProfit) return false;
      if (targetFilter === "cyclist" && !t.titleKey.includes("cyclist")) return false;
      if (targetFilter === "mobster" && !t.titleKey.includes("mobster")) return false;
      if (targetFilter === "skinny" && !t.build.toLowerCase().includes("skinny")) return false;
      return true;
    });

    const hidden = activeTargets.length - filtered.length;
    if (noticeEl) {
      noticeEl.style.display = hidden > 0 ? "flex" : "none";
      noticeEl.innerHTML = `<span>${hidden} hidden</span><button type="button" id="pph-rst-btn">Reset</button>`;
      const resetBtn = document.getElementById("pph-rst-btn");
      if (resetBtn) {
        resetBtn.onclick = () => {
          minProfit = 0;
          targetFilter = "all";
          cfg.set("pph-min-profit", 0);
          cfg.set("pph-target-filter", "all");
          document.getElementById("pph-profit-select").value = "0";
          document.getElementById("pph-target-select").value = "all";
          renderTargetCards();
        };
      }
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="pph-msg">${activeTargets.length ? "No targets match filters." : "Waiting for targets..."}</div>`;
      return;
    }

    filtered.sort((a, b) => {
      if (sortMode === "profit") return b.profit - a.profit;
      if (sortMode === "time") return a.expiresAt - b.expiresAt;
      return b.successRate - a.successRate;
    });

    const existing = new Map();
    listEl.querySelectorAll(".pph-target-card").forEach((el) => existing.set(parseInt(el.dataset.id, 10), el));
    if (listEl.querySelector(".pph-msg")) listEl.innerHTML = "";

    filtered.forEach((t) => {
      const left = Math.max(0, Math.floor((t.expiresAt - now) / 1000));
      const rateClass = t.successRate >= 90 ? "c-ok" : t.successRate >= 75 ? "c-warn" : "c-err";
      let card = existing.get(t.id);

      if (card) {
        existing.delete(t.id);
        card.querySelector(".pph-sub-status").textContent = t.status;
        const rEl = card.querySelector(".pph-rate");
        rEl.textContent = `${t.successRate}%`;
        rEl.className = `pph-rate ${rateClass}`;
        card.querySelector(`#pph-t-${t.id}`).textContent = `${left}s`;
        listEl.appendChild(card);
      } else {
        card = document.createElement("div");
        card.className = `pph-target-card ${t.tierClass} ${left <= 0 ? "is-expired" : ""}`;
        card.id = `pph-c-${t.id}`;
        card.dataset.id = t.id;
        card.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div class="pph-trunc" style="font-weight:bold;">${t.title}</div>
                <div class="pph-trunc" style="font-size:10px;color:#7ba3b8;">${
                  [t.build, t.stats.heightImperial, t.stats.weightImperial].filter(Boolean).join(" ") || "Unknown"
                }</div>
                <div style="font-size:10px;color:var(--c-ok);font-weight:600;">${formatProfit(t.profit)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                <div style="text-align:right;">
                    <div class="pph-sub-status" style="font-size:10px;color:var(--txt-2);">${t.status}</div>
                    <div class="pph-rate ${rateClass}" style="font-size:10px;font-family:monospace;">${t.successRate}%</div>
                </div>
                <span class="c-warn" style="font-size:12px;min-width:24px;text-align:right;font-family:monospace;" id="pph-t-${t.id}">${left}s</span>
                <button type="button" class="pph-pick-btn" ${left <= 0 ? "disabled" : ""}>
                    Pick <span class="c-warn">${t.nerve}</span>
                </button>
            </div>`;

        const btn = card.querySelector(".pph-pick-btn");
        btn.onclick = () => executePickpocket(t, btn);
        listEl.appendChild(card);
      }
    });
    existing.forEach((el) => el.remove());
  }

  function initUI() {
    if (document.getElementById("pph-container") || !document.body) return;

    const container = document.createElement("div");
    container.id = "pph-container";
    container.className = panelOpen ? "is-open" : "";

    const trigger = document.createElement("div");
    trigger.id = "pph-trigger";
    trigger.className = panelOpen ? "is-hidden" : "";
    trigger.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H9V7z"/></svg><span>Targets</span>`;

    container.innerHTML = `
        <div id="pph-controls">
            <div style="display:flex;align-items:center;gap:6px;">
                <button id="pph-min-btn" style="background:none;border:none;cursor:pointer;color:var(--acc);">▶</button>
                <div id="pph-user-stats" style="font-size:11px;color:var(--txt-2);">Nerve: --</div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
                <button id="pph-snd-btn" class="${soundEnabled ? "is-active" : "is-muted"}" title="Toggle Audio Alerts">${soundEnabled ? "Mute" : "Muted"}</button>
                <button id="pph-flt-btn" class="${filterBarOpen ? "active" : ""}">Filter</button>
            </div>
        </div>
        <div id="pph-filter-bar" class="${filterBarOpen ? "is-open" : ""}">
            <div class="pph-frow"><label>Sort:</label>
                <select id="pph-sort-select">
                    <option value="profit" ${sortMode === "profit" ? "selected" : ""}>$/Nerve</option>
                    <option value="time" ${sortMode === "time" ? "selected" : ""}>Time</option>
                    <option value="success" ${sortMode === "success" ? "selected" : ""}>Success %</option>
                </select>
            </div>
            <div class="pph-frow"><label>Min $/N:</label>
                <select id="pph-profit-select">
                    <option value="0" ${minProfit === 0 ? "selected" : ""}>All ($0+)</option>
                    <option value="1500" ${minProfit === 1500 ? "selected" : ""}>$1,500+</option>
                    <option value="2500" ${minProfit === 2500 ? "selected" : ""}>$2,500+</option>
                    <option value="5000" ${minProfit === 5000 ? "selected" : ""}>$5,000+</option>
                    <option value="10000" ${minProfit === 10000 ? "selected" : ""}>$10,000+</option>
                </select>
            </div>
            <div class="pph-frow"><label>Target:</label>
                <select id="pph-target-select">
                    <option value="all" ${targetFilter === "all" ? "selected" : ""}>All</option>
                    <option value="cyclist" ${targetFilter === "cyclist" ? "selected" : ""}>Cyclist</option>
                    <option value="mobster" ${targetFilter === "mobster" ? "selected" : ""}>Mobster</option>
                    <option value="skinny" ${targetFilter === "skinny" ? "selected" : ""}>Skinny</option>
                </select>
            </div>
            <div class="pph-frow"><label>Alerts:</label>
                <select id="pph-sound-select">
                    <option value="top" ${soundTargetMode === "top" ? "selected" : ""}>Cyclist & Mobster</option>
                    <option value="cyclist" ${soundTargetMode === "cyclist" ? "selected" : ""}>Cyclist (Xanax)</option>
                    <option value="mobster" ${soundTargetMode === "mobster" ? "selected" : ""}>Mobster ($11.8k)</option>
                    <option value="skinny" ${soundTargetMode === "skinny" ? "selected" : ""}>Skinny (Merit)</option>
                    <option value="highval" ${soundTargetMode === "highval" ? "selected" : ""}>Any $3k+/N</option>
                    <option value="none" ${soundTargetMode === "none" ? "selected" : ""}>Disabled</option>
                </select>
            </div>
        </div>
        <div id="pph-hidden-notice"></div>
        <div id="pph-target-list"></div>`;

    document.body.append(trigger, container);

    trigger.onclick = () => {
      panelOpen = true;
      cfg.set("pph-panel-open", "true");
      container.classList.add("is-open");
      trigger.classList.add("is-hidden");
    };

    container.querySelector("#pph-min-btn").onclick = () => {
      panelOpen = false;
      cfg.set("pph-panel-open", "false");
      container.classList.remove("is-open");
      trigger.classList.remove("is-hidden");
    };

    const sBtn = container.querySelector("#pph-snd-btn");
    sBtn.onclick = () => {
      soundEnabled = !soundEnabled;
      cfg.set("pph-sound-enabled", soundEnabled);
      sBtn.textContent = soundEnabled ? "Mute" : "Muted";
      sBtn.className = soundEnabled ? "is-active" : "is-muted";
      if (soundEnabled) playAlertChime();
    };

    const fBtn = container.querySelector("#pph-flt-btn");
    const fBar = container.querySelector("#pph-filter-bar");
    fBtn.onclick = () => {
      filterBarOpen = !filterBarOpen;
      cfg.set("pph-filter-open", filterBarOpen);
      fBar.classList.toggle("is-open", filterBarOpen);
      fBtn.classList.toggle("active", filterBarOpen);
    };

    const bindSelect = (id, key, fn) => {
      container.querySelector(id).onchange = (e) => {
        fn(e.target.value);
        cfg.set(key, e.target.value);
        renderTargetCards();
      };
    };

    bindSelect("#pph-sort-select", "pph-sort-mode", (v) => (sortMode = v));
    bindSelect("#pph-profit-select", "pph-min-profit", (v) => (minProfit = parseInt(v, 10) || 0));
    bindSelect("#pph-target-select", "pph-target-filter", (v) => (targetFilter = v));
    bindSelect("#pph-sound-select", "pph-sound-target", (v) => {
      soundTargetMode = v;
      if (v !== "none" && soundEnabled) playAlertChime();
    });

    updateRouteState();
  }

  function updateRouteState() {
    const c = document.getElementById("pph-container");
    const t = document.getElementById("pph-trigger");
    if (!c || !t) return;

    const isPP = isPickpocketPage();
    c.style.display = isPP ? "flex" : "none";
    t.style.display = isPP && !panelOpen ? "flex" : "none";
    if (isPP) renderTargetCards();
  }

  window.addEventListener("hashchange", updateRouteState);
  setInterval(updateRouteState, 500);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUI);
  else initUI();

  const style = document.createElement("style");
  style.textContent = `
        :root { --bg-1:#1e2124; --bg-2:#282b30; --bg-3:#36393e; --bdr:#424549; --txt-1:#e0e0e0; --txt-2:#b0b0b0; --acc:#00a8ff; --c-ok:#37b24d; --c-warn:#ffa726; --c-err:#f44336; }
        .c-ok { color: var(--c-ok); font-weight: bold; }
        .c-warn { color: var(--c-warn); font-weight: bold; }
        .c-err { color: var(--c-err); font-weight: bold; }
        .c-bg-ok { background: var(--c-ok) !important; border-color: var(--c-ok) !important; color: #fff !important; }
        .c-bg-err { background: var(--c-err) !important; border-color: var(--c-err) !important; color: #fff !important; }
        .pph-trunc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        #pph-container { position: fixed; top: 0; right: 0; width: 295px; height: calc(100vh - 45px); background: var(--bg-1); border-left: 1px solid var(--bdr); z-index: 99999; display: none; flex-direction: column; transform: translateX(100%); transition: transform .2s ease; font-family: sans-serif; font-size: 12px; }
        #pph-container.is-open { transform: translateX(0); }
        #pph-container.is-under-attack { background: #220a0a; border-left-color: var(--c-err); }

        #pph-trigger { position: fixed; top: 115px; right: 0; background: var(--bg-2); color: var(--txt-2); padding: 6px 8px; border: 1px solid var(--bdr); border-right: none; border-radius: 6px 0 0 6px; cursor: pointer; z-index: 99999; display: none; align-items: center; gap: 4px; font-size: 11px; }
        #pph-trigger span { display: none; }
        #pph-trigger:hover span { display: inline; }
        #pph-trigger.is-hidden { display: none !important; }

        #pph-controls, .pph-frow, #pph-hidden-notice { display: flex; align-items: center; justify-content: space-between; }
        #pph-controls { padding: 6px 10px; border-bottom: 1px solid var(--bdr); background: var(--bg-2); }
        #pph-filter-bar { display: none; flex-direction: column; gap: 4px; padding: 6px 10px; background: #181a1d; border-bottom: 1px solid var(--bdr); }
        #pph-filter-bar.is-open { display: flex; }
        .pph-frow select { background: var(--bg-2); color: var(--txt-1); border: 1px solid var(--bdr); border-radius: 3px; width: 140px; }

        #pph-flt-btn, #pph-snd-btn { background: var(--bg-3); border: 1px solid var(--bdr); color: var(--txt-2); border-radius: 3px; font-size: 10px; padding: 2px 6px; cursor: pointer; }
        #pph-flt-btn.active, #pph-snd-btn.is-active { background: #2b3a4a; color: #fff; border-color: var(--acc); }
        #pph-snd-btn.is-muted { opacity: 0.6; }
        #pph-hidden-notice { display: none; padding: 3px 10px; background: #22252a; border-bottom: 1px solid var(--bdr); font-size: 10px; color: var(--c-warn); }
        #pph-hidden-notice button { background: none; border: none; color: var(--acc); cursor: pointer; text-decoration: underline; }

        #pph-target-list { flex: 1; overflow-y: auto; padding: 4px; display: flex; flex-direction: column; gap: 4px; }
        .pph-msg { padding: 12px; color: var(--txt-2); text-align: center; }
        .pph-target-card { background: var(--bg-2); border: 1px solid var(--bdr); border-left: 3px solid var(--acc); border-radius: 3px; padding: 4px 6px; display: flex; align-items: center; justify-content: space-between; }
        .pph-target-card:hover { background: var(--bg-3); }
        .pph-target-card.is-expired { opacity: .35 !important; pointer-events: none !important; }

        .tier-safe { border-left-color: var(--c-ok); }
        .tier-moderate { border-left-color: #74b816; }
        .tier-unsafe { border-left-color: #f59f00; }
        .tier-risky { border-left-color: #f76707; }
        .tier-dangerous { border-left-color: #f03e3e; }
        .tier-extreme { border-left-color: #7048e8; }

        .pph-pick-btn { background: #212529; border: 1px solid #495057; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; cursor: pointer; min-width: 48px; white-space: nowrap; text-align: center; }
        .pph-pick-btn:hover { border-color: var(--acc); }
        .pph-pick-btn:disabled { opacity: .5; cursor: not-allowed; }
    `;
  document.head.appendChild(style);
})();