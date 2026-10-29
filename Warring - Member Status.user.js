// ==UserScript==
// @name         Ranked War Member Status
// @namespace    titanic-5.uk
// @version      1.4
// @description  Displays online, offline, and idle counts in faction wars
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/factions.php*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/ranked_war_member_states.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/ranked_war_member_states.user.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  function getMemberStatus(memberEl) {
    const fillPath = memberEl.querySelector("[fill*='userStatus'], svg[class*='userOnlineStatusIcon'] path, svg[class*='default']");
    const fill = fillPath?.getAttribute("fill") || "";

    if (fill.includes("userStatusOnline") || fill.includes("online")) return "online";
    if (fill.includes("userStatusIdle") || fill.includes("idle")) return "idle";
    if (fill.includes("userStatusOffline") || fill.includes("offline")) return "offline";

    const labelWrap = memberEl.querySelector("[class*='userStatusWrap'], [class*='customStatus']");
    const label = labelWrap?.getAttribute("aria-label")?.toLowerCase() || "";

    if (label.includes("is online")) return "online";
    if (label.includes("is idle")) return "idle";
    if (label.includes("is offline")) return "offline";

    return null;
  }

  function countStatuses() {
    let enemyOnline = 0,
      enemyOffline = 0,
      enemyIdle = 0;
    let yourOnline = 0,
      yourOffline = 0,
      yourIdle = 0;

    const enemyMembers = document.querySelectorAll("ul.members-list > li.enemy, ul.members-list > li[class*='enemy']");
    const yourMembers = document.querySelectorAll("ul.members-list > li.your, ul.members-list > li[class*='your']");

    enemyMembers.forEach((enemy) => {
      const status = getMemberStatus(enemy);
      if (status === "idle") enemyIdle++;
      else if (status === "online") enemyOnline++;
      else if (status === "offline") enemyOffline++;
    });

    yourMembers.forEach((your) => {
      const status = getMemberStatus(your);
      if (status === "idle") yourIdle++;
      else if (status === "online") yourOnline++;
      else if (status === "offline") yourOffline++;
    });

    if (enemyMembers.length > 0 || yourMembers.length > 0) {
      updateDisplay(enemyOnline, enemyOffline, enemyIdle, yourOnline, yourOffline, yourIdle);
    }
  }

  function updateDisplay(eOnline, eOffline, eIdle, yOnline, yOffline, yIdle) {
    let factionNamesDiv = document.querySelector(".faction-names");
    if (!factionNamesDiv) return;

    let existingDisplay = document.getElementById("faction-status-display");
    if (existingDisplay) {
      existingDisplay.innerHTML = `
                <div>🟢 ${eOnline} 🟡 ${eIdle} 🔴 ${eOffline}</div>
                <div>🟢 ${yOnline} 🟡 ${yIdle} 🔴 ${yOffline}</div>
            `;
      return;
    }

    let statusDiv = document.createElement("div");
    statusDiv.id = "faction-status-display";
    statusDiv.style.cssText = `
            display: flex;
            flex-direction: row;
            justify-content: space-evenly;
            margin-top: 10px;
            padding: 15px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 5px;
            text-align: center;
            font-size: 12px;
        `;

    statusDiv.innerHTML = `
            <div>🟢 ${eOnline} 🟡 ${eIdle} 🔴 ${eOffline}</div>
            <div>🟢 ${yOnline} 🟡 ${yIdle} 🔴 ${yOffline}</div>
        `;

    factionNamesDiv.appendChild(statusDiv);
  }

  setInterval(countStatuses, 1000);
})();
