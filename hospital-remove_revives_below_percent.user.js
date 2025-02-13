// ==UserScript==
// @name         Remove Revives Below X%
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  try to take over the world!
// @author       Titanic_
// @match        https://www.torn.com/hospital*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  let minChance = localStorage.getItem("RRBX_chance") || 80;

  document.querySelector("#top-page-links-list").appendChild(
    Object.assign(document.createElement("button"), {
      innerHTML: "% Setting",
      className: "t-clear h c-pointer  m-icon line-h24 right last",
      onclick: () => {
        minChance = prompt("Minimum revive chance to keep?", minChance);
        localStorage.setItem("RRBX_chance", minChance);
      },
    })
  );

  setInterval(() => {
    let rev = document.querySelectorAll("div.ajax-action");
    if (!rev.length) return;

    rev.forEach((el) => {
      let succ = el.querySelector("b").textContent.replace("%", "");
      if (parseFloat(succ) > minChance) return;
      el.closest("li").remove();
    });
  }, 100);
})();
