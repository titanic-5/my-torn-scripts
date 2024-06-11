// ==UserScript==
// @name         Torn Bazaar Auto-Max Buy
// @namespace    Titanic_
// @version      v1.0
// @description  When you click the shopping cart button, quantity will be set to max you can afford.
// @license      MIT
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/bazaar*
// @grant        none
// ==/UserScript==
function createListeners() {
    $("#bazaarRoot").on("click", "[class^='controlPanel_'] button", function(e) {
        let item = $(this).closest("[class^=item_]");
        waitForElementToExist("[class^=numberInput").then(() => {
            setTimeout(() => setMaxQuantity(item), 100);
        });
    });
}

function setMaxQuantity(item) {
    let wallet = parseInt($("#user-money").text().replace(/[^0-9]/g, ''), 10);

    let input = $(item).find("[class^=numberInput]");
    let price = $(item).find("[class^=price_]").text().replace(/[^0-9]/g, '');
    let maxqt = $(item).find("[class^=amount_]").text().match(/\(([\d,]+)/)[1].replace(/[^0-9]/g, '');

    let newqt = 0;
    while(newqt < maxqt) {
        wallet -= price;
        if(wallet >= 0) {
            newqt++;
        } else {
            break;
        }
    }

    $(input).val(newqt).trigger("input");
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
