// ==UserScript==
// @name         Ranked War Member Status
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Displays online, offline, and idle counts in faction wars
// @author       You
// @match        https://www.torn.com/factions.php*
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

        // Check if the status display already exists, update it if so
        let existingDisplay = document.getElementById("faction-status-display");
        if (existingDisplay) {
            existingDisplay.innerHTML = `
                <div><strong>Enemy:</strong> 🟢 ${eOnline} | 🟡 ${eIdle} | 🔴 ${eOffline}</div>
                <div><strong>Friendly:</strong> 🟢 ${yOnline} | 🟡 ${yIdle} | 🔴 ${yOffline}</div>
            `;
            return;
        }

        // Create a new div for the status display
        let statusDiv = document.createElement("div");
        statusDiv.id = "faction-status-display";
        statusDiv.style.cssText = `
            margin-top: 10px;
            padding: 25px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 5px;
            text-align: center;
            font-size: 14px;
        `;

        statusDiv.innerHTML = `
            <div><strong>Enemy:</strong> 🟢 ${eOnline} | 🟡 ${eIdle} | 🔴 ${eOffline}</div>
            <div><strong>Friendly:</strong> 🟢 ${yOnline} | 🟡 ${yIdle} | 🔴 ${yOffline}</div>
        `;

        // Append the status display to the faction-names container
        factionNamesDiv.appendChild(statusDiv);
    }

    function waitForFactionWar() {
        let observer = new MutationObserver((mutations, obs) => {
            if (document.querySelector(".faction-war")) {
                obs.disconnect(); // Stop observing once found
                countStatuses();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    waitForFactionWar();
})();
