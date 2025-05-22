// ==UserScript==
// @name         Company Withdraw Buttons
// @namespace    Titanic_
// @version      2.0
// @description  Adds buttons to remove at million $ intervals to the vault page to make it easier to manage money in company vault.
// @license      MIT
// @author       Titanic_
// @match        https://www.torn.com/companies.php*
// @grant        none
// ==/UserScript==

let playMoney = 10000000; // Set this for magic button

// Feel free to add to or change these
const BUTTONS = [
    { label: "-1m", amount: 1000000 },
    { label: "-5m", amount: 5000000 },
    { label: "-10m", amount: 10000000 }
];

function addElements() {
    const div = document.querySelector("#funds");
    if (!div) return;

    const parent = document.createElement("div");
    parent.id = "custom-buttons";

    BUTTONS.forEach(btn => addButton(parent, btn.label, btn.amount));
    addPasteButton(parent);
    addMagicButton(parent);

    div.append(parent);
}

function addButton(parent, label, amount) {
    let btn = createButton(label, () => adjustMoney(amount));
    parent.appendChild(btn);
}

function addPasteButton(parent) {
    let btn = createButton("Paste", async () => {
        try {
            let clipboardValue = (await navigator.clipboard.readText()).replace(/[, $]/g, '');
            let value = parseInt(clipboardValue);
            if (!isNaN(value)) adjustMoney(value, true);
            else alert("Not a number");
        } catch (err) {
            alert("Clipboard access denied. Please paste manually.");
        }
    });
    parent.appendChild(btn);
}

function addMagicButton(parent) {
    let btn = createButton("Magic", () => {
        let inputVisible = document.querySelector(".deposit > form > .funds-cont > .input-money-group > input.input-money");
        let widthrawVisible = document.querySelector(".withdraw > form > .funds-cont > .input-money-group > input.input-money");
        let amountOnHand = parseInt(document.querySelector("[class^='value_']")?.getAttribute("data-money")) || 0;

        if(amountOnHand < playMoney) {
            widthrawVisible.value = playMoney - amountOnHand;
            widthrawVisible.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (playMoney < amountOnHand) {
            inputVisible.value = amountOnHand - playMoney;
            inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });

    parent.appendChild(btn);
}

function createButton(label, onClick) {
    let btn = document.createElement("input");
    btn.value = label;
    btn.type = "button";
    btn.classList.add("torn-btn");
    btn.addEventListener("click", onClick);
    return btn;
}

function adjustMoney(amount, set = false) {
    let [inputVisible, inputHidden] = document.querySelectorAll(".input-money-group .input-money");
    if (!inputVisible || !inputHidden) return;

    let newValue = set ? amount : (parseInt(inputHidden.value) || 0) + amount;
    if (newValue < 0) newValue = 0;

    inputVisible.value = newValue;
    inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
}

function observe() {
    if (!window.location.href.includes("option=funds")) return;
    clearInterval(window.VaultBtnInterval);
    window.VaultBtnInterval = setInterval(() => {
        if (document.querySelector('.withdraw > form > .funds-cont > .input-money-group > input.input-money') &&
            !document.querySelector("#custom-buttons")) {
            addElements();
        }
    }, 100);
}

window.addEventListener("hashchange", observe);
observe();

function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}

addGlobalStyle('#custom-buttons { justify-content: center; display: flex; gap: 2px; padding-top: 2.5px; padding-bottom: 2.5px; }');
addGlobalStyle('#custom-buttons > input:nth-of-type(5) { background: #6a0dad; color: #ffffff; border: 1.5px solid #8a2be2; border-radius: 12px; font-size: 16px; box-shadow: 0 0 10px rgba(138, 43, 226, 0.5), 0 0 20px rgba(138, 43, 226, 0.5), 0 0 30px rgba(138, 43, 226, 0.5); text-shadow: 0 0 5px rgba(255, 255, 255, 0.5); transition: transform 0.3s ease, box-shadow 0.3s ease; }');
addGlobalStyle('#custom-buttons > input:nth-of-type(5):hover { transform: scale(1.1); box-shadow: 0 0 20px rgba(138, 43, 226, 0.7), 0 0 30px rgba(138, 43, 226, 0.7), 0 0 40px rgba(138, 43, 226, 0.7); }');
addGlobalStyle('@media only screen and (max-width: 600px) { #custom-buttons { justify-content: space-between; } }');