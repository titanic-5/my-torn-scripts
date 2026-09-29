// ==UserScript==
// @name         Warring - Stop hitting midknight
// @namespace    titanic-5.uk
// @version      1.0
// @description  Removes attack buttons for specified user IDs
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Warring%20-%20Stop%20hitting%20midknight.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Warring%20-%20Stop%20hitting%20midknight.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const blockThisGuy = ["332505", ];

    function remove() {
        document.querySelectorAll('a[href*="sid=getInAttack"]').forEach((link) => {
            let urlParams = new URLSearchParams(link.getAttribute("href"));
            let userId = urlParams.get("user2ID");

            if (blockThisGuy.includes(userId)) {
                link.remove();
                console.log(`Removed attack link for user ID: ${userId}`);
            }
        });
    }

    setInterval(remove, 1000);
})();
