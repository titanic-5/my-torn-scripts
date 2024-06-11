// ==UserScript==
// @name         Auto Max Bazaar
// @namespace    Titanic_
// @version      v1.3
// @description  When you click the shopping cart button, quantity will be set to max you can afford.
// @license      MIT
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/bazaar*
// @grant        none
// ==/UserScript==

function createListeners() {
    $("#bazaarRoot").on("click", "[class^='controlPanel_'] button", function(e) {
        const item = $(this).closest("[class^=item_]");

        waitForElementToExist("[class^=numberInput]").then(() => {
            setTimeout(() => setMaxQuantity(item), 100);
        });
    });
}

function setMaxQuantity(item) {
    let wallet = parseInt($("#user-money").text().replace(/[^0-9]/g, ''), 10);

    const input = $(item).find("[class^=numberInput]");
    const price = parseInt($(item).find("[class^=price_]").text().replace(/[^0-9]/g, ''), 10);
    const maxqt = parseInt($(item).find("[class^=amount_]").text().match(/\(([\d,]+)/)[1].replace(/[^0-9]/g, ''), 10);

    let newqt = Math.floor(wallet / price);
    newqt = Math.min(newqt, maxqt);

    setNativeValue(input[0], newqt);
    input[0].dispatchEvent(new Event('input', { bubbles: true }));
}

function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
    } else {
        valueSetter.call(element, value);
    }
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

setTimeout(() => createListeners(), 1000);
