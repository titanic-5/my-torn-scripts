// ==UserScript==
// @name         Ranked War Member Status
// @namespace    titanic-5.uk
// @version      1.3
// @description  Displays online, offline, and idle counts in faction wars
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/factions.php*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/ranked_war_member_states.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/ranked_war_member_states.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function countStatuses() {
        let enemyOnline = 0, enemyOffline = 0, enemyIdle = 0;
        let yourOnline = 0, yourOffline = 0, yourIdle = 0;

        document.querySelectorAll(".enemy").forEach((enemy) => {
            let status = enemy?.querySelector("svg[class*=default]")?.getAttribute("fill") || "";

            if (status.includes("idle")) enemyIdle++;
            else if (status.includes("online")) enemyOnline++;
            else if (status.includes("offline")) enemyOffline++;
        });

        document.querySelectorAll(".your").forEach((your) => {
            let status = your?.querySelector("svg[class*=default]")?.getAttribute("fill") || "";

            if (status.includes("idle")) yourIdle++;
            else if (status.includes("online")) yourOnline++;
            else if (status.includes("offline")) yourOffline++;
        });

        updateDisplay(enemyOnline, enemyOffline, enemyIdle, yourOnline, yourOffline, yourIdle);
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
