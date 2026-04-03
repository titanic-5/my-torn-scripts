// ==UserScript==
// @name         Remove Revives Below X%
// @namespace    titanic-5.uk
// @version      1.0
// @description  Title
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/hospital*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/hospital-remove_revives_below_percent.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/hospital-remove_revives_below_percent.user.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  setInterval(() => {
    let minChance = localStorage.getItem("RRBX_chance") || 80;

    if (!document.querySelector(".rrbx")) {
      document.querySelector("#top-page-links-list").appendChild(
        Object.assign(document.createElement("button"), {
          innerHTML: "% Setting",
          className: "rrbx t-clear h c-pointer  m-icon line-h24 right last",
          onclick: () => {
            minChance = parseFloat(prompt("Minimum revive chance to keep?", minChance))
            localStorage.setItem("RRBX_chance", minChance);
          },
        })
      );
    }

    let rev = document.querySelectorAll("div.ajax-action");
    if (!rev.length) return;

    rev.forEach((el) => {
      let succ = el.querySelector("b").textContent.replace("%", "");
      if (parseFloat(succ) > minChance) return;
      el.closest("li").remove();
    });
  }, 100);
})();
