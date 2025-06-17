// ==UserScript==
// @name         Give it to Hollis
// @namespace    http://tampermonkey.net/
// @version      2025-02-26
// @description  try to take over the world!
// @author       You
// @match        https://www.torn.com/properties.php*
// @match        https://www.torn.com/item.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const INPUT_SETTER = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

    const PROPERTY_TYPE_SELECTOR = "ul.info";
    const JACKET_SELECTOR = "#clothes-items span.name-wrap > span.name"
    const PLACE_PROP_BTN_HERE_SELECTOR = "form > div.m-top10";
    const PLACE_ITEM_BTN_HERE_SELECTOR = "ul > li:nth-child(3)"
    const GIVE_SELECTOR = "input.give";
    const CONTINUE_BTN_SELECTOR = ".give-form input[type=submit]"


    function trailer_trash() {
        clearInterval(window.propertyInterval);
        window.propertyInterval = setInterval(() => {
            if (!document.querySelector(PROPERTY_TYPE_SELECTOR) || document.getElementById("trailerTrashBtn")) return;
            if (!document.querySelector(PROPERTY_TYPE_SELECTOR).textContent.includes("Trailer")) return
            addButton("trailerTrashBtn", "Send to Hollis", sendPropertyToHollis, PLACE_PROP_BTN_HERE_SELECTOR, "torn-btn");
            clearInterval(window.propertyInterval)
        }, 500);
    }

    function winter_coats() {
        clearInterval(window.jacketInterval);
        window.jacketInterval = setInterval(() => {
            if (document.getElementById("winterCoatsBtn")) return;

            const items = document.querySelectorAll(JACKET_SELECTOR);
            let found = false;

            items.forEach((item) => {
                if (item.textContent.includes("Jacket")) {
                    found = true;
                    const row = item.closest("li").querySelector(PLACE_ITEM_BTN_HERE_SELECTOR);
                    if (row) {
                        addButton("winterCoatsBtn", "H", sendItemToHollis, row, "option-send");
                    }
                }
            });

            if (!found) return;

        }, 500);
    }


    function addButton(id, text, onClick, selector, classes = "") {
        if (document.getElementById(id)) return;
        const btn = Object.assign(document.createElement("button"), { id, textContent: text, onclick: onClick });
        btn.style.cursor = 'pointer'
        if (classes.length > 0) btn.className = classes
        if (typeof selector == "string") document.querySelector(selector)?.appendChild(btn);
        else selector?.appendChild(btn)
    }

    async function sendPropertyToHollis() {
        const url = window.location.href;
        const hashPart = url.split('#')[1];

        // Convert the hash string to a query-friendly format by replacing '&' with '&' and adding a '?' at the front
        const queryString = '?' + hashPart.split('/').pop(); // gets "p=options&ID=5384581&tab=give"

        const params = new URLSearchParams(queryString);
        const id = params.get('ID');

        const res = await fetch(`https://www.torn.com/properties.php?rfcv=${getRFC()}`, {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                "baggage": "sentry-environment=production,sentry-release=react-apps%40a976d6811598d5675de87102360ad91588ac5b0e,sentry-public_key=d371f4cf64e5d467f59089bbd29a455f,sentry-trace_id=d975e5c77c444b78acec40e2e5d1a44b,sentry-sample_rate=0.001,sentry-sampled=false",
                "cache-control": "no-cache",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "pragma": "no-cache",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
                "sec-ch-ua-arch": "\"x86\"",
                "sec-ch-ua-bitness": "\"64\"",
                "sec-ch-ua-full-version": "\"136.0.7103.114\"",
                "sec-ch-ua-full-version-list": "\"Chromium\";v=\"136.0.7103.114\", \"Google Chrome\";v=\"136.0.7103.114\", \"Not.A/Brand\";v=\"99.0.0.0\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-model": "\"\"",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-ch-ua-platform-version": "\"10.0.0\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "sentry-trace": "d975e5c77c444b78acec40e2e5d1a44b-a56bddd50c8687f3-0",
                "x-requested-with": "XMLHttpRequest"
            },
            "referrer": "https://www.torn.com/properties.php",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": `step=giveProperty&userID=2276104&ID=${id}`,
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });

        const json = await res.json()
        console.log(json)

        if (json.success == true) window.location.href = "https://www.torn.com/properties.php"
    }

    function sendItemToHollis() {
        document.querySelector("#winterCoatsBtn").closest("ul.actions-wrap").querySelector("button[aria-label^=Send]").click()
        clearInterval(window.jacketSendInterval);
        window.jacketSendInterval = setInterval(() => {
            if(!document.querySelector("input.user-id")) return
            clearInterval(window.jacketSendInterval);
            const input = document.querySelector("input.user-id")
            if(input) {
                INPUT_SETTER.call(input, "Hollis [2276104]");
                input.dispatchEvent(new Event("input", { bubbles: true }));
            }
        }, 500);
    }

    function getRFC() {
        var rfc = $.cookie('rfc_v');
        if (!rfc) {
            var cookies = document.cookie.split('; ');
            for (var i in cookies) {
                var cookie = cookies[i].split('=');
                if (cookie[0] == 'rfc_v') {
                    return cookie[1];
                }
            }
        }
        return rfc;
    }

    const checkURL = () => {
        if (window.location.href.includes('tab=give')) trailer_trash()
        if (window.location.href.includes('item.php')) winter_coats()
    }

    window.addEventListener('hashchange', () => {
        checkURL()
    })

    checkURL()
})();
