// ==UserScript==
// @name         Company - Max $
// @namespace    titanic-5.uk
// @version      1.0
// @description  Automatically maxes out the deposit input in a company vault
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/companies.php*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Company%20-%20Max%20-.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Company%20-%20Max%20-.user.js
// @grant        window.onurlchange
// ==/UserScript==

const observer = new MutationObserver(() => {
    if (window.location.href.includes("option=funds")) {
        inputCheck();
    }
});

observer.observe(document.body, { childList: true, subtree: true });

function inputCheck() {
    setTimeout(function() {
        if (document.querySelector('.deposit > form > .funds-cont > .input-money-group > input.input-money')) {
            max();
        }
    }, 300);
}

function max() {
    let $inputVisible = document.querySelector(".deposit > form > .funds-cont > .input-money-group > input.input-money");
    let $inputHidden = document.querySelectorAll(".deposit > form > .funds-cont > .input-money-group > input.input-money")[1];
    let value = parseInt($inputHidden.value) || 0;
    let amountOnHand = parseInt($("[class^='value_']").attr("data-money"));

    if(amountOnHand > 0) {
        value += amountOnHand;
        $inputVisible.value = value;
        $inputVisible.dispatchEvent(new Event("input", { bubbles: true }));
    }

    var button = $('input[type="submit"].torn-btn.disabled[value="DEPOSIT"][disabled]');
    button.prop('disabled', false).removeClass("disabled");
}