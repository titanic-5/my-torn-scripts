// ==UserScript==
// @name         Torn - Riggers and Minors
// @namespace    Titanic
// @version      1.1
// @description  Highlight oil riggers on Torn
// @author       Titanic
// @match        https://www.torn.com/page.php?sid=UserList*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        none
// ==/UserScript==

function checkJob(element) {
    //const hasBazaar = checkBazaar(element)
    //if(hasBazaar) return

    const iconTray = element[0].querySelector("span.user-icons > span.icons-wrap > ul#iconTray");
    if (!iconTray) return

    const anchor = iconTray.querySelector('a[href*="/joblist.php"]');
    if (!anchor) return;

    const parentElement = anchor.closest('li');
    if (!parentElement) return;

    const titleAttr = parentElement.getAttribute('title');
    if(!titleAttr) return;

    if(titleAttr.includes("Oil Rig")) {
        element[0].style.backgroundColor = "rebeccapurple";
    }
}

function checkBazaar(element) {
    const bazaar = element[0].querySelector('a[href*="/bazaar"]')
    if (!bazaar) return false

    element[0].style.backgroundColor = "darkred";

    return true
}

waitForKeyElements("li[class^='user']", checkJob);
