// ==UserScript==
// @name         Bazaar - Remove All
// @namespace    titanic-5.uk
// @version      1.0
// @description  Adds a remove all button to bazaar page
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/bazaar.php*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/bazaar-remove_all.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/bazaar-remove_all.user.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

  const removeAll = (event) => {
    event.preventDefault();
    document.querySelectorAll("div[class^=row_]").forEach((item) => {
      const qt = item
        .querySelector("div[class*=desc_] span")
        .textContent.replace(/\D/g, "");
      const input = item.querySelector("input[class*=removeAmountInput_]");
      nativeSetter.call(input, qt);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  setInterval(() => {
    if (
      !document.querySelector("div[class^=confirmation_]") ||
      !document.querySelector("input[class*=removeAmountInput_]") ||
      document.querySelector("#removeAllBtn")
    )
      return;

    const undoBtn = document.querySelector("button[class^=undo_]");
    const removeAllBtn = Object.assign(undoBtn.cloneNode(), {
      textContent: "Remove All",
      id: "removeAllBtn",
      onclick: removeAll,
    });

    document
      .querySelector("div[class^=confirmation_]")
      .appendChild(removeAllBtn);
  }, 500);
})();
