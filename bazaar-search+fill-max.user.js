// ==UserScript==
// @name         Torn Bazaar Auto-Fill Search
// @namespace    titanic-5.uk
// @version      1.0
// @description  Auto-fills search field with item name in bazaars
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/bazaar.php?userId=*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/bazaar-search+fill-max.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/bazaar-search+fill-max.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let params = new URL(window.location.href).searchParams;
    let itemname = params.get("itemName");
    if (!itemname) return;

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

    let interval = setInterval(() => {
        if (!document.querySelector("div[class*=itemDescription]")) return
        let search = document.querySelector("#bazaarRoot [class*='search___'] input");
        if (!search) return

        // fill search with item name
        clearInterval(interval);
        nativeSetter.call(search, itemname);
        search.dispatchEvent(new Event("input", { bubbles: true }));

        awaitInput()
    }, 100);

    function awaitInput() {
        let interval = setInterval(() => {
            let input = document.querySelector("input[class*=numberInput][class*=buyAmountInput]")
            if (!input || input.value != 1) return

            let maxqt = parseInt(input.parentElement.parentElement.parentElement.querySelector("[class*=amount]").textContent.match(/\d+/)[0])
            if (!maxqt || maxqt == 1) return

            let wallet = parseInt(document.querySelector("#user-money").getAttribute("data-money"))
            let price = parseInt(input.parentElement.parentElement.parentElement.querySelector("[class*=price]").textContent.replace("$","").replaceAll(",",""))
            let newVal = Math.min(Math.floor(wallet / price), maxqt)
            if(input.value == newVal) return

            nativeSetter.call(input, newVal)
            input.dispatchEvent(new Event("input", {bubbles:true}));
        }, 100);
    }
})();
