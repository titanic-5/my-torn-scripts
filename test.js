// ==UserScript==
// @name         TEST
// @namespace    Titanic_
// @version      v1.1
// @description  Auto-max Bazaar on clicking Buy
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/bazaar.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let ran = false;
    let ran2 = false;

    function init() {
        alert("Init fired")
        waitForElementToExist("[class^=numberInput]").then(createListeners());
    }

    function createListeners() {
        $("button[class*='buy_'").on("click", function(e) {
            alert("Buy clicked");
            setMaxQuantity(e);
        });
    }

    function setMaxQuantity(e) {
        alert("max triggered");
        console.log(e);
        let item = e.target.parentElement.parentElement.parentElement

        const wallet = parseInt($("#user-money").attr("data-money").replace(/[^0-9]/g, ''), 10);
        const input = $(item).find("[class^=numberInput]");
        const price = parseInt($(item).find("[class^=price_]").text().replace(/[^0-9]/g, ''), 10);
        const maxQt = parseInt($(item).find("[class^=amount_]").text().match(/\(([\d,]+)/)[1].replace(/[^0-9]/g, ''), 10);
        const newQt = Math.min(Math.floor(wallet / price), Math.max(0, maxQt));

        const prototype = Object.getPrototypeOf(input[0]);
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
        setter.call(input[0], newQt);
        input[0].dispatchEvent(new Event('input', { bubbles: true }));
    }

    function waitForElementToExist(selector) {
        return new Promise(resolve => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
            } else {
                const observer = new MutationObserver(() => {
                    const targetElement = document.querySelector(selector);
                    if (targetElement) {
                        resolve(targetElement);
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { subtree: true, childList: true });
            }
        });
    }

    setTimeout(() => init(), 500);
})();
