// ==UserScript==
// @name         Ghost Trade Buttons
// @namespace    Titanic_
// @version      1.61
// @description  Adds buttons to remove at million $ intervals to the trade page to make it easier to manage money in ghost trades.
// @license      MIT
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/trade.php*
// @grant        window.onurlchange
// @downloadURL https://update.greasyfork.org/scripts/493082/Ghost%20Trade%20Buttons.user.js
// @updateURL https://update.greasyfork.org/scripts/493082/Ghost%20Trade%20Buttons.meta.js
// ==/UserScript==

let ran = false;

function addElements() {
    ran = false;

    let div;
    let parent = document.createElement("div");

    addButton(parent, "-1m", 1000000);
    addButton(parent, "-2.5m", 2500000);
    addButton(parent, "-5m", 5000000);
    addButton(parent, "-10m", 10000000);
    addCustomButton(parent);
    addPasteButton(parent);

    div = document.querySelector("div.input-money-group.success");

    div.parentNode.insertBefore(parent, div.nextSibling);
}

function addButton(parent, label, amount) {
    let btn = document.createElement("input");
    btn.value = label;
    btn.type = "button";
    btn.classList.add("torn-btn");

    btn.addEventListener("click", () => {
        let $inputVisible = document.querySelector(".user-id.input-money");
        let $inputHidden = document.querySelectorAll(".user-id.input-money")[1];
        let value = parseInt($inputHidden.value);

        if (value - amount > 0) {
            value -= amount;
            $inputVisible.value = value;
            $inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
            $inputVisible.value = 0;
            $inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });

    if (ran == false) {
        parent.prepend(document.querySelector("span.btn-wrap.silver").previousElementSibling.cloneNode());
        ran = true;
    }

    parent.appendChild(btn);
}

function addPasteButton(parent) {
    let btn = document.createElement("input");
    btn.value = "Paste";
    btn.type = "button";
    btn.classList.add("torn-btn");

    btn.addEventListener("click", () => {
        let $inputVisible = document.querySelector(".user-id.input-money");
        let $inputHidden = document.querySelectorAll(".user-id.input-money")[1];
        navigator.clipboard.readText().then((clipboardValue) => {
            if (parseInt(clipboardValue)) {
                $inputVisible.value = parseInt(clipboardValue);
                $inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
                alert("Not a number");
            }
        });
    });

    parent.appendChild(btn);
}

function addCustomButton(parent) {
    let btn = document.createElement("input");
    btn.value = "Custom";
    btn.type = "button";
    btn.classList.add("torn-btn");

    btn.addEventListener("click", () => {
        let $inputVisible = document.querySelector(".user-id.input-money");
        let $inputHidden = document.querySelectorAll(".user-id.input-money")[1];
        navigator.clipboard.readText().then((clipboardValue) => {
            if (parseInt(clipboardValue)) {
                $inputVisible.value = parseInt($inputHidden.value) - parseInt(clipboardValue);
                $inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
                var value = prompt("How much to subtract");
                if (parseInt(value)) {
                    $inputVisible.value = parseInt($inputHidden.value) - parseInt(value);
                    $inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
                }
            }
        });
    });

    parent.appendChild(btn);
}

if (window.onurlchange === null) {
    window.addEventListener('urlchange', () => {
        inputCheck();
    });
}

if (window.location.href.includes("trade.php#step=addmoney")) {
    inputCheck();
}

function inputCheck() {
    setTimeout(function() {
        if ($('.user-id.input-money').length > 0) {
            addElements();
        }
    }, 300);
}
