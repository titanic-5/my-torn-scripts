// ==UserScript==
// @name         Attack Bind
// @namespace    titanic-5.uk
// @version      1.0
// @description  Press ALT+A on player profile to go to attack page
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/profiles.php*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Attack%20Bind.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Attack%20Bind.user.js
// @grant        none
// ==/UserScript==

document.addEventListener("keydown", function(event) {
    if (event.altKey && event.key === "a") { // ALT + A to take to attack page
        const targetID = window.location.href.split("XID=")[1] ? window.location.href.split("XID=")[1].split("&")[0] : null;
        if(targetID) {
            window.location.href = `https://www.torn.com/page.php?sid=attack&user2ID=${targetID}`
        }
    }
});
