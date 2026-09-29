// ==UserScript==
// @name         Attackig - Halloween Target List
// @namespace    titanic-5.uk
// @version      1.1
// @description  Adds toggle to profiles and displays the list under Enemies and Targets
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/profiles.php*
// @match        https://www.torn.com/page.php?sid=list&type=enemies*
// @match        https://www.torn.com/page.php?sid=list&type=targets*
// @grant        GM_getValue
// @grant        GM_setValue
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Attacking%20-%20Halloween%20Target%20List.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Attacking%20-%20Halloween%20Target%20List.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
  
    const DB_KEY = "thl_targets";
    const SETTING_HONOR_KEY = "thl_show_honor_bars";
    const $ = window.jQuery || window.$;
  
    let currentSort = { column: "name", dir: "asc" };
  
    function getTargets() {
      try {
        return JSON.parse(GM_getValue(DB_KEY, "{}"));
      } catch (e) {
        return {};
      }
    }
  
    function setTargets(data) {
      GM_setValue(DB_KEY, JSON.stringify(data));
    }
  
    function getShowHonorBars() {
      return GM_getValue(SETTING_HONOR_KEY, true);
    }
  
    function setShowHonorBars(val) {
      GM_setValue(SETTING_HONOR_KEY, val);
    }
  
    function cleanNativeTooltips() {
      if ($ && $.fn && $.fn.tooltip) {
        $(".ui-tooltip").remove();
      }
      document.querySelectorAll('.ui-tooltip, [role="tooltip"]').forEach((el) => el.remove());
    }
  
    function getProfileData() {
      let id = new URLSearchParams(window.location.search).get("XID");
      let username = "";
  
      const heading = document.querySelector("#skip-to-content");
      if (heading && heading.textContent) {
        const match = heading.textContent.match(/(.*?)\s*\[(\d+)\]/);
        if (match) {
          username = match[1].trim();
          id = match[2].trim();
        }
      }
  
      if (!username) {
        const infoRows = document.querySelectorAll(".basic-information .info-table li");
        for (const row of infoRows) {
          const label = row.querySelector(".user-information-section");
          if (label && label.textContent.trim() === "Name") {
            const val = row.querySelector(".user-info-value");
            if (val) {
              const m = val.textContent.match(/(.*?)\s*\[(\d+)\]/);
              if (m) {
                username = m[1].trim();
                id = m[2].trim();
              }
            }
            break;
          }
        }
      }
  
      let level = "";
      const levelBox = document.querySelector(".profile-information-wrapper .box-info:not(.rank):not(.age) .box-value");
      if (levelBox) {
        level = levelBox.innerText.replace(/\s+/g, "");
      }
  
      let honorImg = "";
      const honorEl = document.querySelector(".honorContainer___AYJYZ img, .userHonor___dZ7W1 img, .honor-text-wrap img");
      if (honorEl) {
        honorImg = honorEl.getAttribute("src") || "";
      }
  
      return { id, username, level, honorImg };
    }
  
    function addProfileButton() {
      const container = document.querySelector(".profile-buttons .buttons-list");
      if (!container || document.getElementById("button-halloween-list")) return;
  
      const { id, username, level, honorImg } = getProfileData();
      if (!id || !username) return;
  
      const targets = getTargets();
      const isInList = !!targets[id];
      const labelText = isInList ? "Remove from Halloween list" : "Add to Halloween list";
  
      const btn = document.createElement("a");
      btn.id = "button-halloween-list";
      btn.className = `profile-button profile-button-halloween active ${isInList ? "hl-active" : ""}`;
      btn.setAttribute("aria-label", labelText);
      btn.setAttribute("title", labelText);
      btn.setAttribute("data-is-tooltip-opened", "false");
      btn.style.touchAction = "manipulation";
      btn.style.cursor = "pointer";
  
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 15" class="icon___GP196">
          <path class="hl-svg-path" fill="${isInList ? "#e28122" : "currentColor"}" d="M9.48 3C8.92 2.32 7.35 0.47 7.15 0.26L6.91 0C6.91 0 6.19 0.31 6.24 0.6C6.29 0.89 7 2.15 6.78 2.49C6.69 2.63 6.57 2.82 6.48 2.98C2.87 3.14 0 5.77 0 9C0 12.23 3.05 15 6.82 15H9.18C13 15 16 12.31 16 9C16 5.69 13.11 3.12 9.48 3ZM11.48 5.56C11.7548 5.99215 11.9606 6.46448 12.09 6.96C11.6854 7.19343 11.2271 7.3175 10.76 7.32C10.1746 7.38179 9.58389 7.37508 9 7.3C9.11129 6.69947 9.31362 6.11945 9.6 5.58C9.80013 5.16169 10.0595 4.77438 10.37 4.43C10.7926 4.73028 11.1554 5.10671 11.44 5.54L11.48 5.56ZM9 9.61H7.15L8.08 8L9 9.61ZM4.51 6C4.71926 5.5561 5.0396 5.17376 5.44 4.89C5.79826 5.21134 6.10516 5.58568 6.35 6C6.58453 6.4391 6.77223 6.90164 6.91 7.38C6.48709 7.53075 6.04702 7.62817 5.6 7.67C5.04092 7.71535 4.47908 7.71535 3.92 7.67C3.99978 7.0787 4.20063 6.51019 4.51 6ZM13.28 10.72H12.66L12.32 11.34L12.66 11.79C12.3524 12.0844 12.0176 12.3489 11.66 12.58C11.2943 12.8242 10.9017 13.0255 10.49 13.18L10.04 12.37L9 12.64V13.29H6.35V12.59L5.68 12.35L5.42 12.94C4.65489 12.5521 3.95348 12.0496 3.34 11.45C2.25 10.45 2.41 8.11 2.41 8.11C2.59955 8.55376 2.84125 8.97338 3.13 9.36C3.38066 9.66547 3.68166 9.92588 4.02 10.13L3.82 10.53L4.4 10.92L4.7 10.52C4.93408 10.6016 5.17506 10.6618 5.42 10.7C5.79068 10.7545 6.16594 10.7712 6.54 10.75L6.68 11.55H7.54L7.6 10.77C8.06935 10.8049 8.54065 10.8049 9.01 10.77C9.55285 10.7584 10.0914 10.6709 10.61 10.51L10.95 11.17L11.68 10.89L11.52 10.15C11.892 9.85775 12.2277 9.52203 12.52 9.15C12.8993 8.62978 13.1774 8.04293 13.34 7.42C13.5063 8.01046 13.6069 8.61747 13.64 9.23C13.6959 9.74704 13.5685 10.2673 13.28 10.7V10.72Z"/>
        </svg>
      `;
  
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        cleanNativeTooltips();
  
        const current = getTargets();
        const path = btn.querySelector(".hl-svg-path");
        let updatedText = "";
  
        if (current[id]) {
          delete current[id];
          btn.classList.remove("hl-active");
          updatedText = "Add to Halloween list";
          path.setAttribute("fill", "currentColor");
        } else {
          const today = new Date().toLocaleDateString("en-GB");
          current[id] = {
            id,
            username,
            origUsername: username,
            level: level || "??",
            dateAdded: today,
            desc: `${today} - ${username}`,
            honorImg: honorImg || "",
          };
          btn.classList.add("hl-active");
          updatedText = "Remove from Halloween list";
          path.setAttribute("fill", "#e28122");
        }
  
        btn.setAttribute("aria-label", updatedText);
        btn.setAttribute("title", updatedText);
  
        if ($ && $(btn).data("ui-tooltip")) {
          $(btn).tooltip("option", "content", updatedText);
          $(btn).tooltip("close");
        }
  
        setTargets(current);
      });
  
      container.appendChild(btn);
  
      if ($ && $.fn && $.fn.tooltip) {
        $(btn).tooltip();
      }
    }
  
    function removeTarget(id) {
      cleanNativeTooltips();
  
      const targets = getTargets();
      delete targets[id];
      setTargets(targets);
  
      const row = document.getElementById(`hw-row-${id}`);
      if (row) row.remove();
  
      const remaining = Object.keys(targets).length;
      const countSpan = document.getElementById("hw-list-count");
      if (countSpan) countSpan.textContent = remaining;
  
      if (remaining === 0) {
        const list = document.querySelector("#hw-list-table ul");
        if (list) {
          list.innerHTML = `<li class="tableRow___xLJyV tableRowWrapper___gBiJV" style="padding: 12px; text-align: center; color: #888;">No players added to the Halloween list.</li>`;
        }
      }
    }
  
    function editDescription(id) {
      cleanNativeTooltips();
  
      const targets = getTargets();
      if (!targets[id]) return;
  
      const currentDesc = targets[id].desc || "";
      const updated = prompt("Edit description:", currentDesc);
      if (updated !== null) {
        targets[id].desc = updated.trim();
        setTargets(targets);
  
        const descText = document.getElementById(`hw-desc-${id}`);
        if (descText) descText.textContent = updated.trim();
      }
    }
  
    function getSortedTargets() {
      const list = Object.values(getTargets());
      const { column, dir } = currentSort;
  
      return list.sort((a, b) => {
        let res = 0;
        if (column === "name") {
          const nameA = (a.username || a.name || "").toLowerCase();
          const nameB = (b.username || b.name || "").toLowerCase();
          res = nameA.localeCompare(nameB);
        } else if (column === "level") {
          const lvlA = parseInt(a.level) || 0;
          const lvlB = parseInt(b.level) || 0;
          res = lvlA - lvlB;
        } else if (column === "desc") {
          const descA = (a.desc || "").toLowerCase();
          const descB = (b.desc || "").toLowerCase();
          res = descA.localeCompare(descB);
        }
        return dir === "desc" ? -res : res;
      });
    }
  
    function renderRows() {
      const ul = document.querySelector("#hw-list-table ul");
      if (!ul) return;
  
      const targets = getSortedTargets();
      const showHonorBars = getShowHonorBars();
  
      if (targets.length === 0) {
        ul.innerHTML = `<li class="tableRow___xLJyV tableRowWrapper___gBiJV" style="padding: 12px; text-align: center; color: #888;">No players added to the Halloween list.</li>`;
        return;
      }
  
      const allTargets = getTargets();
      let updatedStorage = false;
  
      ul.innerHTML = targets
        .map((t) => {
          const name = t.username || t.name;
          const desc = t.desc || `${t.dateAdded ? t.dateAdded + " - " : ""}${t.origUsername || name}`.trim();
  
          let honorImg = t.honorImg || "";
          if (!honorImg) {
            const nativeLink = document.querySelector(`.tableRow___xLJyV a[href*="XID=${t.id}"]`);
            if (nativeLink) {
              const foundImg = nativeLink.closest(".playerCell___XXiu4")?.querySelector("img");
              if (foundImg && foundImg.src) {
                honorImg = foundImg.src;
                allTargets[t.id].honorImg = honorImg;
                updatedStorage = true;
              }
            }
          }
  
          const renderBar = showHonorBars && honorImg;
  
          return `
            <li class="tableRow___xLJyV tableRowWrapper___gBiJV" id="hw-row-${t.id}">
              <div class="contentGroup___aJqBF">
                <div class="name___kYEei hw-col-name">
                  <div class="playerCell___XXiu4">
                    <div class="userInfoBox___SpD9F rowSection___wdqaD flexCenter___k97k4 container___XJJi_">
                      <div class="honorWrap___HZmuX flexCenter___k97k4 textWrap___Y7pQD flexCenter___k97k4 blockWrap___fZvNz">
                        <a rel="noopener noreferrer" class="linkWrap___oVXBN flexCenter___k97k4 hw-honor-link" href="/profiles.php?XID=${t.id}" aria-label="View profile of ${name}">
                          ${
                            renderBar
                              ? `
                              <div class="hw-honor-bar-wrap">
                                <img class="hw-honor-bg" src="${honorImg}" alt="">
                                <span class="hw-honor-text">${name}</span>
                              </div>
                            `
                              : `
                              <span class="honorName___s2vRc">${name}</span>
                            `
                          }
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="border___RF5gD level___lxwCB hw-col-level">
                  <span class="srOnly___vrc2S">level</span>${t.level}
                </div>
                <div class="description___ZlDf_ border___RF5gD hw-col-desc">
                  <div class="content___UWWiQ">
                    <div class="text___GVN_K" id="hw-desc-${t.id}">${desc}</div>
                  </div>
                </div>
              </div>
              <div class="buttonsGroup___utqHm border___RF5gD hw-col-actions">
                <a class="button___AHKdW" href="/page.php?sid=attack&user2ID=${t.id}" target="_blank" aria-label="Attack" title="Attack" data-is-tooltip-opened="false">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="13" viewBox="0 0 18 13">
                    <path fill="currentColor" d="M115.221,196.6v.558a.774.774,0,0,0,.767.767l1.882.07a.774.774,0,0,0,.767-.767,1.109,1.109,0,0,0-.07-.627.216.216,0,0,0-.07.139h0a.068.068,0,0,1,.07.07c0,.07,0,.07-.07.07a1.431,1.431,0,0,1-.7,1.045.068.068,0,0,1-.07-.07h-.07c-.139,0-.07-.209-.07-.209l.279-.836a2.5,2.5,0,0,0-.279-.767l-1.6-.209a.773.773,0,0,0-.767.767Zm-6.412-4.182.279-.349h.139l.209.349h14.358l.139-.418h.279l.139.418h.488a.311.311,0,0,1,.279.209v1.464l-.07.07v.488a.3.3,0,0,1,.139.279c0,.209-.139.209-.139.209a2.973,2.973,0,0,0-.627.139c-.627.209-.7.836-.558,1.743a5.011,5.011,0,0,0,.627,1.673c-.07,0-.07,0-.07.07s.07.07.139.07l.07.07c-.07,0-.07,0-.07.07s.07.07.139.07l.07.07c-.07,0-.07,0-.07.07s.07.07.139.07l.07.07c-.07,0-.07,0-.07.07a.243.243,0,0,0,.139.07l.07.07c-.07,0-.07,0-.07.07a.243.243,0,0,0,.139.07l.07.139c-.07,0-.07,0-.07.07a.243.243,0,0,0,.139.07l.07.07-.07.07.07.07.07.139a.068.068,0,0,0-.07.07l.07.07.07.139h0a.068.068,0,0,0,.07.07l.07.139h0a.068.068,0,0,0,.07.07l.07.139h0a.068.068,0,0,0,.07.07l.07.139h0a.068.068,0,0,0,.07.07l.07.139h0l.07.07a.243.243,0,0,0,.07.139h0v.07c0,.07.07.07.07.139h0l.07.07c0,.07,0,.07.07.139h0l.07.07c0,.07,0,.07.07.139h0l.07.07v.418a1.364,1.364,0,0,1-.07.7c-.139.279-.7.488-.7.488h-.558v.07a1.188,1.188,0,0,1,.279.488c0,.279-.418.209-.418.209h-2.788c-.627,0-.558-.418-.558-.418l-.07-.418a2.237,2.237,0,0,1-.348-.209.747.747,0,0,1-.139-.418v-.488a3.765,3.765,0,0,0-.279-.836.791.791,0,0,0-.418-.418c-.139-.07-.07-.139-.07-.139a.784.784,0,0,0,0-.767c-.139-.279-.209-.488-.418-.558s-.139-.209-.139-.209.209-.279-.07-.976c-.209-.418-.418-.558-.7-.558a1.65,1.65,0,0,0-.7.209,3.394,3.394,0,0,1-.836.07c-.139,0-2.718-.139-2.718-.139l-.07-.139.07-.139a2.413,2.413,0,0,0,.139-.976,3.975,3.975,0,0,0-.07-.906,1.828,1.828,0,0,0-.558-.418s-4.531-.139-5.018-.209c-.488,0-.488-.349-.488-.349s-.07-.488-.07-.627v-.279h-.07v-.418h0l-.07-.07a1.7,1.7,0,0,1-.07-.488.964.964,0,0,1,.139-.488v-.139c0-.07.07,0,.07-.139a.137.137,0,0,1,.139-.139l-.139-.07Z" transform="translate(-108.6 -192)"/>
                  </svg>
                  <span class="hw-btn-label">Attack</span>
                </a>
                <button type="button" class="button___AHKdW hw-edit-btn" data-id="${t.id}" aria-label="Edit description" title="Edit description" data-is-tooltip-opened="false">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 16 16">
                    <path fill="currentColor" d="M4.75,15.04l-4.75.96.96-4.75,3.79,3.79ZM1.9,10.31l3.79,3.79L16,3.79l-3.79-3.79L1.9,10.31Z"/>
                  </svg>
                  <span class="hw-btn-label">Edit</span>
                </button>
                <button type="button" class="button___AHKdW hw-del-btn" data-id="${t.id}" aria-label="Remove player from the list" title="Remove player from the list" data-is-tooltip-opened="false">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
                    <path fill="currentColor" d="M12,10.09l-4.16-4.1L11.94,1.85l-1.85-1.85-4.11,4.16L1.83.06,0,1.89l4.16,4.12L.06,10.17l1.83,1.83,4.12-4.16,4.14,4.1,1.85-1.85Z"/>
                  </svg>
                  <span class="hw-btn-label">Delete</span>
                </button>
              </div>
            </li>
          `;
        })
        .join("");
  
      if (updatedStorage) {
        setTargets(allTargets);
      }
  
      if ($ && $.fn && $.fn.tooltip) {
        $("#hw-list-table [title]").tooltip();
      }
    }
  
    function updateSortIcons() {
      const { column, dir } = currentSort;
      document.querySelectorAll("#hw-list-table .tableHead___wbSrG .sortIcon___Cociw").forEach((icon) => {
        const btn = icon.closest("button");
        const col = btn.getAttribute("data-sort");
        if (col === column) {
          icon.style.opacity = "1";
          icon.style.transform = dir === "desc" ? "rotate(180deg)" : "rotate(0deg)";
        } else {
          icon.style.opacity = "0.35";
          icon.style.transform = "none";
        }
      });
    }
  
    function renderHalloweenList() {
      const mainTable = document.querySelector(".tableWrapper___vNEZb");
      if (!mainTable) return;
  
      const existing = document.getElementById("hw-list-container");
      if (existing) {
        if (mainTable.nextSibling !== existing) {
          mainTable.parentNode.insertBefore(existing, mainTable.nextSibling);
        }
        return;
      }
  
      const targets = Object.values(getTargets());
      const showHonorBars = getShowHonorBars();
  
      const wrapper = document.createElement("div");
      wrapper.id = "hw-list-container";
      wrapper.style.marginTop = "25px";
  
      wrapper.innerHTML = `
        <style>
          @media screen and (min-width: 785px) {
            #hw-list-table .tableHead___wbSrG,
            #hw-list-table .tableRow___xLJyV {
              display: flex !important;
              width: 100% !important;
            }
            #hw-list-table .contentGroup___aJqBF {
              display: flex !important;
              flex: 1 1 auto !important;
              min-width: 0 !important;
            }
            #hw-list-table .hw-col-name {
              flex: 1 1 45% !important;
              min-width: 0 !important;
              padding-left: 10px !important;
            }
            #hw-list-table .hw-col-level {
              flex: 0 0 55px !important;
              width: 55px !important;
              min-width: 55px !important;
              max-width: 55px !important;
              text-align: center !important;
              justify-content: center !important;
            }
            #hw-list-table .hw-col-desc {
              flex: 1 1 55% !important;
              min-width: 0 !important;
            }
            #hw-list-table .hw-col-actions {
              flex: 0 0 104px !important;
              width: 104px !important;
              min-width: 104px !important;
              max-width: 104px !important;
            }
            #hw-list-table .hw-btn-label {
              display: none !important;
            }
          }
  
          @media screen and (max-width: 784px) {
            #hw-list-table .tableRow___xLJyV {
              display: flex !important;
              flex-direction: column !important;
              width: 100% !important;
              height: auto !important;
              cursor: pointer;
            }
            #hw-list-table .contentGroup___aJqBF {
              display: flex !important;
              width: 100% !important;
              min-height: 34px !important;
              align-items: center !important;
            }
            #hw-list-table .hw-col-name {
              flex: 1 1 auto !important;
              min-width: 0 !important;
              padding-left: 8px !important;
            }
            #hw-list-table .hw-col-level {
              flex: 0 0 45px !important;
              min-width: 45px !important;
              text-align: center !important;
              justify-content: center !important;
            }
            #hw-list-table .hw-col-desc {
              flex: 1 1 auto !important;
              min-width: 0 !important;
            }
            #hw-list-table .hw-col-desc .text___GVN_K {
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
            #hw-list-table .buttonsGroup___utqHm {
              display: none !important;
              width: 100% !important;
              border-top: 1px solid var(--default-border-color, #333) !important;
              background: rgba(0, 0, 0, 0.15) !important;
            }
            #hw-list-table .tableRow___xLJyV.activeRow___TKT6h .buttonsGroup___utqHm {
              display: flex !important;
              flex-direction: row !important;
            }
            #hw-list-table .buttonsGroup___utqHm .button___AHKdW {
              flex: 1 1 0% !important;
              height: 36px !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 6px !important;
              font-size: 12px !important;
              font-weight: bold !important;
              color: var(--default-color, inherit) !important;
              text-decoration: none !important;
              border: none !important;
              border-right: 1px solid var(--default-border-color, #333) !important;
              background: transparent !important;
            }
            #hw-list-table .buttonsGroup___utqHm .button___AHKdW:last-child {
              border-right: none !important;
            }
            #hw-list-table .hw-btn-label {
              display: inline !important;
            }
            #hw-list-table .headingWrapper___ybMNh.hw-col-actions {
              flex: 0 0 44px !important;
              width: 44px !important;
            }
          }
  
          #hw-list-table .sortIcon___Cociw {
            transition: transform 0.15s ease, opacity 0.15s ease;
          }
          #hw-list-table .hw-honor-link {
            text-decoration: none !important;
            display: inline-flex !important;
            align-items: center !important;
          }
          #hw-list-table .hw-honor-bar-wrap {
            position: relative !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 194px !important;
            height: 18px !important;
            overflow: hidden !important;
            border-radius: 2px !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.4) !important;
          }
          #hw-list-table .hw-honor-bg {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: fill !important;
            pointer-events: none !important;
          }
          #hw-list-table .hw-honor-text {
            position: relative !important;
            z-index: 1 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            color: #fff !important;
            text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 1px 3px rgba(0,0,0,0.9) !important;
            letter-spacing: 0.5px !important;
            line-height: 18px !important;
            text-align: center !important;
            width: 100% !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            padding: 0 8px !important;
            box-sizing: border-box !important;
          }
          .hw-switch-wrap {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            height: 100%;
            padding-right: 8px;
            box-sizing: border-box;
          }
          .hw-switch {
            position: relative;
            display: inline-block;
            width: 26px;
            height: 14px;
            cursor: pointer;
            margin: 0;
          }
          .hw-switch input {
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
          }
          .hw-slider {
            position: absolute;
            cursor: pointer;
            inset: 0;
            background-color: #2b2b2b;
            border: 1px solid #444;
            transition: 0.15s ease;
            border-radius: 14px;
          }
          .hw-slider:before {
            position: absolute;
            content: "";
            height: 8px;
            width: 8px;
            left: 2px;
            bottom: 2px;
            background-color: #888;
            transition: 0.15s ease;
            border-radius: 50%;
          }
          .hw-switch input:checked + .hw-slider {
            background-color: #74B816;
            border-color: #5c9411;
          }
          .hw-switch input:checked + .hw-slider:before {
            transform: translateX(12px);
            background-color: #fff;
          }
        </style>
        <div class="topSection___JhyDv m-bottom10">
          <div class="titleContainer___dTehe">
            <h4 class="title___TTyhL">Halloween List (<span id="hw-list-count">${targets.length}</span>)</h4>
          </div>
        </div>
        <div class="tableWrapper___vNEZb" id="hw-list-table">
          <div class="tableWrapper">
            <div class="tableHead___wbSrG">
              <div class="headingWrapper___ybMNh name___kYEei border___GzQUZ hw-col-name">
                <button type="button" class="toggleButton___LEhWH hw-sort-btn" data-sort="name" tabindex="-1">name<div aria-hidden="true" class="sortIcon___Cociw"></div></button>
              </div>
              <div class="headingWrapper___ybMNh level___lxwCB border___GzQUZ hw-col-level">
                <button type="button" class="toggleButton___LEhWH hw-sort-btn" data-sort="level" tabindex="-1">level<div aria-hidden="true" class="sortIcon___Cociw"></div></button>
              </div>
              <div class="headingWrapper___ybMNh description___ZlDf_ border___GzQUZ hw-col-desc">
                <button type="button" class="toggleButton___LEhWH hw-sort-btn" data-sort="desc" tabindex="-1">description<div aria-hidden="true" class="sortIcon___Cociw"></div></button>
              </div>
              <div class="headingWrapper___ybMNh border___GzQUZ hw-col-actions">
                <div class="hw-switch-wrap">
                  <label class="hw-switch">
                    <input type="checkbox" id="hw-toggle-honor-input" ${showHonorBars ? "checked" : ""}>
                    <span class="hw-slider"></span>
                  </label>
                </div>
              </div>
            </div>
            <ul></ul>
          </div>
        </div>
      `;
  
      mainTable.parentNode.insertBefore(wrapper, mainTable.nextSibling);
  
      renderRows();
      updateSortIcons();
  
      const toggleInput = document.getElementById("hw-toggle-honor-input");
      if (toggleInput) {
        toggleInput.addEventListener("change", function () {
          setShowHonorBars(this.checked);
          renderRows();
        });
      }
  
      wrapper.querySelectorAll(".hw-sort-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const col = btn.getAttribute("data-sort");
          if (currentSort.column === col) {
            currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
          } else {
            currentSort.column = col;
            currentSort.dir = "asc";
          }
          renderRows();
          updateSortIcons();
        });
      });
  
      wrapper.addEventListener("click", (e) => {
        const delBtn = e.target.closest(".hw-del-btn");
        if (delBtn) {
          if ($ && $(delBtn).data("ui-tooltip")) {
            $(delBtn).tooltip("close");
          }
          delBtn.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
          delBtn.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
          cleanNativeTooltips();
  
          const id = delBtn.getAttribute("data-id");
          if (id) removeTarget(id);
          return;
        }
  
        const editBtn = e.target.closest(".hw-edit-btn");
        if (editBtn) {
          if ($ && $(editBtn).data("ui-tooltip")) {
            $(editBtn).tooltip("close");
          }
          cleanNativeTooltips();
  
          const id = editBtn.getAttribute("data-id");
          if (id) editDescription(id);
          return;
        }
  
        if (e.target.closest(".linkWrap___oVXBN") || e.target.closest(".button___AHKdW") || e.target.closest("input")) {
          return;
        }
  
        const row = e.target.closest(".tableRow___xLJyV");
        if (row) {
          row.classList.toggle("activeRow___TKT6h");
        }
      });
    }
  
    function checkPage() {
      const path = window.location.pathname;
      const search = window.location.search;
  
      if (path.includes("profiles.php")) {
        addProfileButton();
      } else if (path.includes("page.php") && search.includes("sid=list") && (search.includes("type=enemies") || search.includes("type=targets"))) {
        renderHalloweenList();
      }
    }
  
    const observer = new MutationObserver(checkPage);
    observer.observe(document.body, { childList: true, subtree: true });
  
    checkPage();
  })();