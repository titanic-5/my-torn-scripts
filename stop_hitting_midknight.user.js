// ==UserScript==
// @name         Stop hitting midknight
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Removes getInAttack links for specified user IDs
// @author       Titanic
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const blockThisGuy = ["332505", ];

    function removeBlockedAttackLinks() {
        document.querySelectorAll('a[href*="sid=getInAttack"]').forEach((link) => {
            let urlParams = new URLSearchParams(link.getAttribute("href"));
            let userId = urlParams.get("user2ID");

            if (blockThisGuy.includes(userId)) {
                link.remove();
                console.log(`Removed attack link for user ID: ${userId}`);
            }
        });
    }

    setInterval(removeBlockedAttackLinks, 1000);
})();
