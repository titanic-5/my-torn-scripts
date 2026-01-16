// ==UserScript==
// @name        Anti-Zerg (Attack loader links)
// @namespace   tampermonkey.com.eu.net.uk
// @version     1.2
// @description makes usernames on the attack loader clickable to their attack pages.
// @author      Titanic_ (based on intercept-link by seintz [2460991] (based on original by finally [2060206]) )
// @run-at      document-start
// @match       https://www.torn.com/loader.php?sid=attack*
// @require     https://unpkg.com/xhook@1.6.2/dist/xhook.min.js
// @updateURL   https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/zerg_defyer.user.js
// @downloadURL https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/zerg_defyer.user.js
// @grant       GM.addStyle
// ==/UserScript==

(function() {
    'use strict';
    const SCRIPT_PREFIX = '[Anti-Zerg]';

    const participantsSelector = "ul[class*='participants']";
    const actionLogSelector = "ul[class*='list']";
    const participantNameSelector = "div[class*='playerWrap'] > span[class*='playername']";
    const logMessageSelector = "span[class*='message'] > span";

    GM.addStyle(`
        .finally-ap-link { color: var(--default-color); text-decoration: none; }
        .finally-ap-link:hover { text-decoration: underline; }
    `);

    const userMap = new Map();

    xhook.after(async (request, response) => {
        if (!request.url.includes("/loader.php?sid=attackData")) return;

        try {
            const data = await response.clone().json();

            // userMap.clear();

            const { attackerUser, defenderUser, currentDefends, currentFightStatistics } = data?.DB || {};

            if (attackerUser) userMap.set(attackerUser.playername, attackerUser.userID);
            if (defenderUser) userMap.set(defenderUser.playername, defenderUser.userID);
            if (Array.isArray(currentDefends)) currentDefends.forEach(user => userMap.set(user.playername, user.attackerID));
            if (currentFightStatistics) Object.values(currentFightStatistics).forEach(user => userMap.set(user.playername, user.userID));

            processDOM();
        } catch (error) {
            console.error(`${SCRIPT_PREFIX} Error processing API response. The response may not have been valid JSON.`, error);
        }
    });

    function addLinkToParticipant(node) {
        if (!node || node.querySelector("a")) return;
        const playerName = node.textContent.trim();
        const userID = userMap.get(playerName);
        if (userID) {
            node.innerHTML = createAttackLink(userID, playerName);
        }
    }

    function addLinksToActionLog(node) {
        if (!node || !userMap.size || node.querySelector('a')) return;
        const names = Array.from(userMap.keys());
        const escapedNames = names.map(name => name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const regex = new RegExp(`\\b(${escapedNames.join('|')})\\b(?!['’])`, 'g');
        node.innerHTML = node.innerHTML.replace(regex, (match) => {
            const userID = userMap.get(match);
            return createAttackLink(userID, match);
        });
    }

    function createAttackLink(userID, playerName) {
        return `<a class="finally-ap-link" target="_blank" href="loader.php?sid=attack&user2ID=${userID}">${playerName}</a>`;
    }

    function processDOM() {
        if (userMap.size === 0) return;
        document.querySelectorAll(`${participantsSelector} ${participantNameSelector}:not(:has(a))`).forEach(addLinkToParticipant);
        document.querySelectorAll(`${actionLogSelector} ${logMessageSelector}:not(:has(a))`).forEach(addLinksToActionLog);
    }

    const bodyCheck = setInterval(() => {
        if (document.body) {
            clearInterval(bodyCheck);
            const observer = new MutationObserver(processDOM);
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }, 500);
})();
