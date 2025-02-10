// ==UserScript==
// @name         Display Case - Move to Top/Bottom
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds buttons to move to top or bottom of list
// @author       Titanic_
// @match        https://www.torn.com/displaycase.php*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const move = (item, direction) => {
    const list = item.closest(".sortable-list");
    const items = Array.from(list.children);

    direction === "up"
      ? list.insertBefore(item, items[0])
      : list.appendChild(item);

    update();
  };

  const update = () => {
    const items = Array.from(document.querySelector(".sortable-list").children);
    items.forEach((item, index) => {
      const up = item.querySelectorAll(".draggable-wrap > button")[0];
      const down = item.querySelectorAll(".draggable-wrap > button")[1];
      if (!up || !down) return;

      item === items[0]
        ? (up.style.display = "none")
        : (up.style.display = "inline-block");

      item === items[items.length - 1]
        ? (down.style.display = "none")
        : (down.style.display = "inline-block");
    });
  };

  setInterval(() => {
    document
      .querySelectorAll("ul.dc-list.sortable-list > li")
      .forEach((item) => {
        if (item.innerHTML.includes("▲") || item.innerHTML.includes("▼"))
          return;

        const up = Object.assign(document.createElement("button"), {
          innerHTML: "▲",
          onclick: () => move(item, "up"),
        });

        const upContainer = document.createElement("div");
        upContainer.classList.add("draggable-wrap");
        upContainer.appendChild(up);

        const down = Object.assign(document.createElement("button"), {
          innerHTML: "▼",
          onclick: () => move(item, "down"),
        });

        const downContainer = document.createElement("div");
        downContainer.classList.add("draggable-wrap");
        downContainer.appendChild(down);

        const img = item.querySelector(".img-wrap");
        img.parentNode.insertBefore(upContainer, img);
        img.parentNode.insertBefore(downContainer, img);

        update();
      });
  }, 500);
})();
