// ==UserScript==
// @name         Auto Maxer
// @namespace    Titanic_
// @version      v1.0
// @description  Auto-max Bazaar on clicking Buy
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/bazaar.php*
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        none
// ==/UserScript==

function init() {
    waitForKeyElements("[class^=numberInput]", createListeners)
}

function createListeners() {
    $("button[class*='buy_'").on("click", function(e) {
        setMaxQuantity(e);
    });
}

function setMaxQuantity(e) {
    let item = e.target.parentElement.parentElement.parentElement

    const wallet = parseInt($("#user-money").text().replace(/[^0-9]/g, ''), 10);
    const input = $(item).find("[class^=numberInput]");
    const price = parseInt($(item).find("[class^=price_]").text().replace(/[^0-9]/g, ''), 10);
    const maxQt = parseInt($(item).find("[class^=amount_]").text().match(/\(([\d,]+)/)[1].replace(/[^0-9]/g, ''), 10);
    const newQt = Math.min(Math.floor(wallet / price), Math.max(0, maxQt));

    const prototype = Object.getPrototypeOf(input[0]);
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    setter.call(input[0], newQt);
    input[0].dispatchEvent(new Event('input', { bubbles: true }));
}

if(window.location.href.includes("bazaar.php?")) {
    setTimeout(() => init(), 500);
}
