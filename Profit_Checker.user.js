// ==UserScript==
// @name         Profit Checker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a button in sidebar to profit check.
// @author       Titanic_
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      api.torn.com
// @connect      weav3r.dev
// ==/UserScript==

(function () {
    "use strict";

    const styles = `
        #profit-checker-container {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            z-index: 99999;
            overflow-y: auto;
            padding: 20px;
            box-sizing: border-box;
        }
        #profit-checker-main {
            max-width: 1400px;
            margin: 20px auto;
            padding: 20px;
            background-color: #1a1a2e;
            color: #e0e0e0;
            font-family: Arial, sans-serif;
            border-radius: 10px;
        }
        #profit-checker-main body { background-color: #1a1a2e; color: #e0e0e0; font-family: Arial, sans-serif; }
        #profit-checker-main #items-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        #profit-checker-main .item-container { background-color: #16213e; border: 1px solid #0f3460; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6); }
        #profit-checker-main .form-input { width: 100%; margin-bottom: 10px; padding: 8px; box-sizing: border-box; background-color: #1a1a2e; color: #e0e0e0; border: 1px solid #0f3460; }
        #profit-checker-main .api-input { text-align: center; margin-bottom: 10px; padding: 8px; box-sizing: border-box; background-color: #1a1a2e; color: #e0e0e0; border: 1px solid #0f3460; }
        #profit-checker-main .form-input::placeholder { color: #555; }
        #profit-checker-main .info-row { display: flex; align-items: center; justify-content: space-evenly; }
        #profit-checker-main .input-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-right: 10px; }
        #profit-checker-main .input-group { flex: 1; display: flex; flex-direction: column; margin-right: 10px; }
        #profit-checker-main .input-group:last-child { margin-right: 0; }
        #profit-checker-main .input-row label { margin-bottom: 5px; height: 40px; display: flex; align-items: center; white-space: nowrap; }
        #profit-checker-main .input-row input, #profit-checker-main .input-row select { width: 100%; padding: 8px; box-sizing: border-box; height: 40px; }
        #profit-checker-main button { background-color: #e94560; color: #fff; border: none; padding: 10px 20px; cursor: pointer; border-radius: 5px; margin: 10px; }
        #profit-checker-main button:hover { background-color: #ff2e63; }
        #profit-checker-main table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        #profit-checker-main th, #profit-checker-main td { border: 1px solid #0f3460; padding: 8px; text-align: center; }
        #profit-checker-main th { background-color: #0f3460; color: #e0e0e0; }
        #profit-checker-main td { background-color: #1a1a2e; color: white; }
        #profit-checker-main a { color: #4fc3f7; text-decoration: none; }
        #profit-checker-main a:visited { color: #d1a4ff; }
        #profit-checker-main a:hover { color: #80deea; text-decoration: underline; }
        #profit-checker-main .modal { display: block; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0, 0, 0, 0.8); padding-top: 60px; }
        #profit-checker-main .modal-content { background-color: #16213e; margin: 5% auto; padding: 20px; border: 1px solid #0f3460; border-radius: 10px; width: 80%; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.7); }
        #profit-checker-main .rainbow { text-align: center; text-decoration: underline; font-size: 32px; font-family: monospace; letter-spacing: 5px; }
        #profit-checker-main .rainbow_text_animated { background: linear-gradient(to right, #6666ff, #0099ff, #00ff00, #ff3399, #6666ff); -webkit-background-clip: text; background-clip: text; color: transparent; animation: rainbow_animation 6s ease-in-out infinite; background-size: 400% 100%; }
        @keyframes rainbow_animation { 0%, 100% { background-position: 0 0; } 50% { background-position: 100% 0; } }
        #profit-checker-main .refresh-btn { position: absolute; top: 0px; left: 33px; background: transparent; border: 1px solid orange; color: orange; border-radius: 30%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin-right: 5px; padding: 0; }
        #profit-checker-main .delete-btn { position: absolute; top: 0px; left: 76px; background: transparent; border: 1px solid red; color: red; border-radius: 30%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; padding: 0; }
        #profit-checker-main .market-btn { position: absolute; top: 0px; left: -10px; background: transparent; border: 1px solid white; border-radius: 30%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; padding: 0; }
        #profit-checker-main .refresh-btn:hover, #profit-checker-main .delete-btn:hover, #profit-checker-main .market-btn:hover { background-color: transparent; opacity: 0.8; }
        #profit-checker-main .modal-content { display: flex; gap: 20px; max-width: 1200px; height: 600px; padding: 20px; }
        #profit-checker-main .modal-categories { width: 200px; overflow-y: auto; border-right: 1px solid #0f3460; }
        #profit-checker-main .category-button { width: 80%; text-align: left; padding: 10px; background: none; border: none; color: #e0e0e0; cursor: pointer; margin-top: 2px; margin-bottom: 2px; }
        #profit-checker-main .category-button.active { background-color: #0f3460; }
        #profit-checker-main .category-list { background-color: #111b34; border-radius: 10px 0px 0px 10px; }
        #profit-checker-main .modal-items { flex: 1; overflow-y: auto; background-color: #111b34; }
        #profit-checker-main .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; padding: 10px; }
        #profit-checker-main .item-card { border: 1px solid #0f3460; border-radius: 5px; padding: 10px; cursor: pointer; text-align: center; transition: all 0.2s; }
        #profit-checker-main .item-card:hover { background-color: #0f3460; }
        #profit-checker-main .item-card.selected { border-color: #e94560; background-color: rgba(233, 69, 96, 0.2); }
        #profit-checker-main .item-card img { width: 50px; height: 50px; object-fit: contain; }
        #profit-checker-main .item-card .item-name { font-size: 12px; margin-top: 5px; }
        #profit-checker-main .modal-options { width: 250px; border-left: 1px solid #0f3460; padding-left: 20px; }
        #profit-checker-main .close-btn { margin-top: 10px; }
        #profit-checker-main *::-webkit-scrollbar { width: 8px; }
        #profit-checker-main *::-webkit-scrollbar-thumb { background-color: #2556dd; border-radius: 22px; }
        #profit-checker-main .item-type { font-size: 10px; color: #888; margin-top: 2px; }
        #profit-checker-main .search-container { position: sticky; top: 0; background: #111b34; padding: 10px; z-index: 1; border-bottom: 1px solid #0f3460; border-radius: 10px 0px 0px 0px; display: flex; justify-content: center; }
        #profit-checker-main .search-input { width: 100%; padding: 8px; border: 1px solid #0f3460; border-radius: 6px; background: #16213e; color: #e0e0e0; }
        #profit-checker-main .search-input:focus { outline: none; border-color: #e94560; }
        #profit-checker-main #criteria-container { overflow: scroll; max-height: 80%; padding: 10px; background-color: #111b34; border-radius: 5px; }
        #profit-checker-main .criteria { margin-bottom: 10px; }
        #profit-checker-main .modal-options { display: flex; flex-direction: column; justify-content: space-between; }
        #profit-checker-main .market-price { top: 1rem; position: relative; }
        #profit-checker-main .hidden { display: none !important; }
        #profit-checker-main .alt-btn { background: transparent; border: 1px solid; }
        #profit-checker-main .alt-btn:hover { background-color: #cf59775d; }
        #profit-checker-main .category-button:first-child { margin-top: 10px; }
        #profit-checker-main .add-criteria-container { position: relative; width: 100%; display: flex; justify-content: center; align-items: center; }
        #profit-checker-main .add-criteria-btn { position: relative; background: transparent; border: 2px solid #006a00; color: green; border-radius: 50px; font-size: 20px; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; padding: 3px 20px; font-weight: 100; margin: 0; }
        #profit-checker-main .add-criteria-btn:hover { background: #006a00; color: white; }
        #profit-checker-main .add-criteria-btn::before, #profit-checker-main .add-criteria-btn::after { content: ""; position: absolute; top: 50%; width: 40px; height: 2px; background-color: #006a00; transform: translateY(-50%); }
        #profit-checker-main .add-criteria-btn::before { left: -50px; }
        #profit-checker-main .add-criteria-btn::after { right: -50px; }
        #profit-checker-main .remove-criteria-btn { margin-bottom: 10px; cursor: pointer; color: red; }
        #profit-checker-main #multi-bazaar-table { width: 80%; }
        #profit-checker-main #multi-bazaar { display: flex; justify-content: center; }
        #profit-checker-main #pc-close-button { position: absolute; top: 10px; right: 20px; font-size: 24px; font-weight: bold; color: white; cursor: pointer; background: #e94560; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; padding-bottom: 4px; }
        @media screen and (max-width: 1200px) { #profit-checker-main #items-container { grid-template-columns: repeat(2, 1fr); } }
        @media screen and (max-width: 768px) { #profit-checker-main #items-container { grid-template-columns: repeat(1, 1fr); } }
        .fa-solid, .fas { font-family: "Font Awesome 6 Free"; font-weight: 900; }
        #pc-items-container { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        #pc-multi-bazaar { display: flex; justify-content: center; }
        .item-container { max-height: 350px; overflow-y: auto; }
        `;
    GM_addStyle(styles);

    const fontAwesomeLink = document.createElement('link');
    fontAwesomeLink.rel = 'stylesheet';
    fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
    document.head.appendChild(fontAwesomeLink);

    const appContainer = document.createElement('div');
    appContainer.id = 'profit-checker-container';
    appContainer.innerHTML = `
        <div id="profit-checker-main">
            <span id="pc-close-button">&times;</span>
            <input type="text" id="pc-apikey" class="api-input" placeholder="Enter API Key" />
            <input type="text" id="pc-salestax" class="api-input" placeholder="Enter Sales Tax (0-5)" />

            <button id="pc-add-item-btn">Add Item</button>
            <button id="pc-start">Search all</button>
            <button id="pc-export">Export</button>
            <button id="pc-import">Import</button>

            <p style="text-wrap: auto; color: #e0e0e0;" class="informational">
                The amount of time it takes to search each item depends on your filters. Less strict filters will result in longer search times. All bazaar data is sourced from https://weav3r.dev/
            </p>
            <p style="text-wrap: auto; color: #e0e0e0;" class="informational">
                Generally, refreshing the page will fix any issues.
            </p>
            <p style="text-wrap: auto; color: #e0e0e0;" class="informational">
                I recommend you use <a href="https://github.com/titanic-5/my-torn-scripts/blob/main/bazaar-search%2Bfill-max.user.js" target="_blank" rel="noopener noreferrer">this script</a> to auto-filter and auto-fill the item in bazaars.
            </p>
            <br/>
            <button class="alt-btn" id="pc-updateItems">Update Market Values</button>

            <div id="pc-items-container"></div>
            <div id="pc-multi-bazaar" class="hidden"></div>
            <div id="pc-itemModal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-categories">
                        <div class="category-list"></div>
                    </div>
                    <div class="modal-items">
                        <div class="search-container">
                            <input type="text" id="pc-itemSearch" class="search-input" placeholder="Search items..." />
                        </div>
                        <div class="items-grid"></div>
                    </div>
                    <div class="modal-options">
                        <div id="pc-criteria-container">
                            <div class="input-group criteria">
                                <select class="form-input filter-type">
                                    <option value="profit">Min Profit</option>
                                    <option value="roi">Min ROI %</option>
                                    <option value="price">Max Price</option>
                                    <option value="totalProfit">Min Total Profit</option>
                                    <option value="qt">Min QTY</option>
                                </select>
                                <input class="form-input filter-value" type="number" placeholder="Enter value" />
                            </div>
                            <button id="pc-add-criteria">Add Criteria</button>
                        </div>
                        <div class="modal-btns">
                            <button disabled id="pc-createItemBtn">Add Item</button>
                            <button id="pc-close-modal-btn" class="close-btn">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(appContainer);

    let itemCount = 0,
        itemsData = {},
        selectedItems = new Set();

    const mainDiv = document.getElementById("profit-checker-main");
    const $ = (selector, context = mainDiv) => context.querySelector(selector);
    const $$ = (selector, context = mainDiv) => context.querySelectorAll(selector);

    const CACHED_TORN_API = {};
    const CACHED_W3_API = {};
    const CACHE_DURATION = 30 * 1000; // 30 sec

    const DB = {
        _db: null,
        _dbName: 'TornProfitCheckerDB',
        _storeName: 'itemDataStore',
        _dbVersion: 1,

        async open() {
            if (this._db) return this._db;
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this._dbName, this._dbVersion);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this._storeName)) {
                        db.createObjectStore(this._storeName);
                    }
                };
                request.onsuccess = (event) => {
                    this._db = event.target.result;
                    resolve(this._db);
                };
                request.onerror = (event) => {
                    console.error('IndexedDB error:', event.target.errorCode);
                    reject(event.target.errorCode);
                };
            });
        },

        async get(key) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this._storeName, 'readonly');
                const store = transaction.objectStore(this._storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => {
                    console.error(`Error getting data for key ${key}:`, event.target.errorCode);
                    reject(event.target.errorCode);
                }
            });
        },

        async set(key, value) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this._storeName, 'readwrite');
                const store = transaction.objectStore(this._storeName);
                const request = store.put(value, key);
                request.onsuccess = () => resolve();
                request.onerror = (event) => {
                    console.error(`Error setting data for key ${key}:`, event.target.errorCode);
                    reject(event.target.errorCode);
                }
            });
        }
    };

    function gmRequest(details) {
        return new Promise((resolve, reject) => {
            details.onload = (response) => {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch (e) {
                        resolve({ _nonJson: true, content: response.responseText });
                    }
                } else {
                    reject({
                        status: response.status,
                        statusText: response.statusText,
                        responseText: response.responseText,
                    });
                }
            };
            details.onerror = (error) => reject(error);
            details.ontimeout = (error) => reject({ ...error, error: "timeout" });
            GM_xmlhttpRequest(details);
        });
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    function checkCached(cachedData, expiry = CACHE_DURATION) {
        if (cachedData && Date.now() - cachedData.timestamp < expiry) return cachedData.response;
        return false;
    }

    async function tornApiCall(url, retries = 5) {
        await delay(250);
        const cachedData = checkCached(CACHED_TORN_API[url]);
        if (cachedData) return cachedData;

        try {
            const response = await gmRequest({ method: "GET", url, timeout: 10000 });
            if (response.error) {
                if (response.error.code === 5 && retries > 0) {
                    console.warn(`Torn API Error 5 (Too many requests). Retrying... (${retries} left)`);
                    await delay(5000);
                    return await tornApiCall(url, retries - 1);
                }
                throw new Error(`Torn API Error: ${response.error.error} (Code: ${response.error.code})`);
            }
            CACHED_TORN_API[url] = { response, timestamp: Date.now() };
            return response;
        } catch (error) {
            console.error(`Error calling Torn API (${url}):`, error);
            throw error;
        }
    }

    async function w3ApiCall(itemId, maxRetries = 5) {
        const url = `https://weav3r.dev/api/marketplace/${itemId}`;
        const cachedData = checkCached(CACHED_W3_API[url]);
        if (cachedData) return cachedData;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await gmRequest({
                    method: "GET",
                    url: url,
                    headers: { "User-Agent": "Mozilla/5.0" },
                    timeout: 15000,
                });

                if (response._nonJson) {
                    throw new Error("W3 API blocked (Cloudflare).");
                }

                if (response.error) {
                    throw new Error(`W3 API returned an error: ${JSON.stringify(response.error)}`);
                }
                if (!Array.isArray(response.listings)) {
                    throw new Error("W3 API response is missing 'listings' array.");
                }
                CACHED_W3_API[url] = { response, timestamp: Date.now() };
                return response;
            } catch (error) {
                console.warn(`W3 API call for item ${itemId} failed (Attempt ${attempt + 1}): ${error.message || 'Unknown error'}`);
                if (attempt < maxRetries) {
                    await delay(2000 * (attempt + 1));
                } else {
                    throw new Error(`W3 API request failed after ${maxRetries + 1} attempts: ${error.message}`);
                }
            }
        }
    }

    const createElement = (tag, className, content) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (content) el.innerHTML = content;
        return el;
    };

    async function loadItemsFromJson() {
        try {
            const storedItems = await DB.get("tornItemsData");
            if (storedItems) {
                itemsData = storedItems;
                console.log("Loaded items from IndexedDB.");
            } else {
                alert("Item data not found. Please click 'Update Market Values' to fetch it.");
            }
        } catch (error) {
            console.error("Error loading items from IndexedDB:", error);
            alert("Could not load item data from the database. It might be corrupted or unsupported by your browser.");
        }
    }

    async function updateItemsJson() {
        const apiKey = $("#pc-apikey").value;
        if (!apiKey) return alert("Please enter API Key");
        alert("Updating market values... This may take a moment.");
        try {
            const url = `https://api.torn.com/torn/?selections=items&key=${apiKey}`;
            const response = await gmRequest({ method: "GET", url });
            if (response.error) {
                throw new Error(`Torn API Error: ${response.error.error}`);
            }
            await DB.set("tornItemsData", response.items);
            itemsData = response.items;
            alert("Market values updated successfully!");
        } catch (error) {
            console.error("Error updating items.json:", error);
            alert(`An error occurred: ${error.message}`);
        }
    }

    function toggleModal(open) {
        $("#pc-itemModal").classList.toggle("hidden", !open);
        if (!open) selectedItems.clear();
        else populateCategories();
        $$(".item-card.selected").forEach((el) => el.classList.remove("selected"));
    }

    function populateCategories() {
        const categoryList = $(".category-list");
        categoryList.innerHTML = "";
        if (!itemsData || Object.keys(itemsData).length === 0) {
            categoryList.innerHTML = "<p style='padding: 10px; color: #ff5555;'>No item data loaded. Please use the 'Update Market Values' button.</p>";
            return;
        }

        const categories = new Set(Object.values(itemsData).map((item) => item.type));
        categories.forEach((category) => {
            const button = createElement("button", "category-button", category);
            button.onclick = () => showItemsInCategory(category);
            categoryList.appendChild(button);
        });
        categoryList.firstChild?.click();
    }

    let currentCategory = null;
    function showItemsInCategory(category) {
        currentCategory = category;
        $$(".category-button").forEach((btn) => btn.classList.toggle("active", btn.textContent === category));
        showFilteredItems("", category);
    }

    function selectItem(itemId, card) {
        selectedItems.has(itemId) ? selectedItems.delete(itemId) : selectedItems.add(itemId);
        card.classList.toggle("selected");
        $("#pc-createItemBtn").disabled = !selectedItems.size;
    }

    function createItem() {
        const criteria = [...$$("#pc-criteria-container .criteria")]
            .map((c) => ({
                type: $(".filter-type", c).value,
                value: $(".filter-value", c).value,
            }))
            .filter((c) => c.value);

        if (!criteria.length || !selectedItems.size) return alert("Please select items and enter at least one criterion value");

        selectedItems.forEach((itemId) => addItem(criteria, itemId));
        toggleModal(false);
    }

    function addItem(filters = [], itemId = "", skipSave = false) {
        itemCount++;
        const itemDiv = createElement("div", "item-container");
        itemDiv.id = `pc-item-${itemCount}`;
        itemDiv.dataset.instanceId = itemCount;

        itemDiv.innerHTML = `
            <div style="position: relative; width: 100%; margin-bottom: 20px; top: -20px; text-align: center;">
                <button title="Open item market" class="market-btn">
                <a href="https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${itemId}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-up-right-from-square"></i>
                </a>
                </button>
                <button title="Refresh" class="refresh-btn"><i class="fas fa-sync-alt"></i></button>
                <button title="Remove" class="delete-btn"><i class="fas fa-trash"></i></button>
                <span class="market-price"><strong>Market Price:</strong> <span id="pc-market-price-${itemCount}"></span></span>
            </div>
            <input id="pc-item-id-${itemCount}" class="form-input" value="${itemsData[itemId]?.name || ""}" data-id="${itemId}" disabled>
            <table id="pc-player-data-${itemCount}">
                <thead><tr><th>Player ID</th><th>Price</th><th>Profit</th><th>ROI</th><th>QTY</th></tr></thead>
                <tbody></tbody>
            </table>`;

        const fragment = document.createDocumentFragment();
        filters.forEach(({ type, value }) => {
            const inputRow = createElement("div", "input-row");
            inputRow.innerHTML = `
                <select class="form-input">
                    <option value="profit" ${type === "profit" ? "selected" : ""}>Min Profit</option>
                    <option value="roi" ${type === "roi" ? "selected" : ""}>Min ROI %</option>
                    <option value="price" ${type === "price" ? "selected" : ""}>Max Price</option>
                    <option value="totalProfit" ${type === "totalProfit" ? "selected" : ""}>Min Total Profit</option>
                    <option value="qt" ${type === "qt" ? "selected" : ""}>Min QTY</option>
                </select>
                <input class="form-input" value="${value}" placeholder="Enter value">
                <i class="fa-solid fa-ban remove-criteria-btn"></i>`;

            inputRow.querySelector(".remove-criteria-btn").addEventListener("click", () => {
                inputRow.remove();
                saveItemsToStorage();
            });
            inputRow.querySelector("select").addEventListener("change", saveItemsToStorage);
            inputRow.querySelector("input").addEventListener("input", saveItemsToStorage);
            fragment.appendChild(inputRow);
        });

        const addButton = createElement("button", "add-criteria-btn", "+");
        const addContainer = createElement("div", "add-criteria-container");
        addContainer.appendChild(addButton);

        itemDiv.insertBefore(fragment, itemDiv.lastElementChild);
        itemDiv.insertBefore(addContainer, itemDiv.lastElementChild);
        $("#pc-items-container").appendChild(itemDiv);

        const instId = itemDiv.dataset.instanceId;
        itemDiv.querySelector('.refresh-btn').addEventListener('click', () => checkProfit(instId));
        itemDiv.querySelector('.delete-btn').addEventListener('click', () => deleteItem(instId));
        itemDiv.querySelector('.add-criteria-btn').addEventListener('click', (e) => addCriteria(e.target.closest('.item-container')));


        if (!skipSave) saveItemsToStorage();
    }

    function deleteItem(itemNum) {
        $(`#pc-item-${itemNum}`)?.remove();
        saveItemsToStorage();
    }

    function addCriteria(target = false) {
        if (target) {
            const newCriteria = createElement("div", "input-row");
            newCriteria.innerHTML = `
                <select class="form-input filter-type" onchange="saveItemsToStorage()">
                <option value="profit">Min Profit</option>
                <option value="roi">Min ROI %</option>
                <option value="price">Max Price</option>
                <option value="totalProfit">Min Total Profit</option>
                <option value="qt">Min QTY</option>
                </select>
                <input class="form-input filter-value" type="number" placeholder="Enter value" oninput="saveItemsToStorage()">
                <i class="fa-solid fa-ban remove-criteria-btn"></i>`;
            newCriteria.querySelector(".remove-criteria-btn").addEventListener("click", () => {
                newCriteria.remove();
                saveItemsToStorage();
            });
            target.insertBefore(newCriteria, target.querySelector(".add-criteria-container"));
        } else {
            const criteriaContainer = $("#pc-criteria-container");
            const newCriteria = createElement("div", "input-group criteria");
            newCriteria.innerHTML = `
                <select class="form-input filter-type">
                <option value="profit">Min Profit</option>
                <option value="roi">Min ROI %</option>
                <option value="price">Max Price</option>
                <option value="totalProfit">Min Total Profit</option>
                <option value="qt">Min QTY</option>
                </select>
                <input class="form-input filter-value" type="number" placeholder="Enter value">`;
            criteriaContainer.insertBefore(newCriteria, criteriaContainer.lastElementChild);
        }
    }

    async function saveApiKey() { await GM_setValue("savedApiKey", $("#pc-apikey").value); }
    async function loadApiKey() { $("#pc-apikey").value = await GM_getValue("savedApiKey") || ""; }
    async function saveSalesTax() { await GM_setValue("savedSalesTax", $("#pc-salestax").value); }
    async function loadSalesTax() { $("#pc-salestax").value = await GM_getValue("savedSalesTax") || ""; }

    async function saveItemsToStorage() {
        const items = [...$$(".item-container")].map((card) => ({
            itemId: $(`[id*=pc-item-id-]`, card).dataset.id,
            filters: [...$$(".input-row", card)].map((row) => ({
                type: $("select", row).value,
                value: $("input", row).value,
            })),
        }));
        await GM_setValue("savedItems", items);
    }

    async function loadItemsFromStorage() {
        const savedItems = await GM_getValue("savedItems") || [];
        savedItems.forEach(({ filters, itemId }) => {
            addItem(filters, itemId, true);
        });
    }

    function formatProfit(profit) {
        if (profit >= 1000000) return (profit / 1000000).toFixed(1) + "m";
        if (profit >= 1000) return (profit / 1000).toFixed(1) + "k";
        else return Math.floor(profit, 1)
    }

    async function checkProfit(instanceId) {
        const itemDiv = $(`#pc-item-${instanceId}`);
        if (!itemDiv) return;

        const filters = Object.fromEntries([...$$(".input-row", itemDiv)].map((row) => [$("select", row).value, $("input", row).value]));
        const apiKey = $("#pc-apikey").value;
        const salesTaxStr = $("#pc-salestax").value;

        const table = $(`#pc-player-data-${instanceId} tbody`, itemDiv);
        table.innerHTML = `<tr><td colspan="5" class="searching-placeholder rainbow rainbow_text_animated">Searching...</td></tr>`;
        $(`#pc-market-price-${instanceId}`).textContent = "N/A";

        if (!apiKey || !salesTaxStr) {
            table.innerHTML = `<tr><td colspan="5" style="color:red;">API Key and Sales Tax required.</td></tr>`;
            return;
        }

        const itemId = $(`#pc-item-id-${instanceId}`, itemDiv).dataset.id;
        const itemName = itemsData[itemId]?.name;
        const market_value = itemsData[itemId]?.market_value;

        if (!itemName || typeof market_value !== "number") {
            table.innerHTML = `<tr><td colspan="5" style="color:red;">Invalid item data. Try updating market values.</td></tr>`;
            return;
        }

        $(`#pc-market-price-${instanceId}`).textContent = market_value.toLocaleString();
        const salesTax = parseFloat(salesTaxStr) || 0;
        const taxRate = salesTax / 100;
        const adjustedMarketValue = market_value * (1 - taxRate);

        try {
            const w3Data = await w3ApiCall(itemId);
            const dedupIds = new Set();
            let initialListings = [];

            for (const listing of w3Data.listings) {
                if (dedupIds.has(listing.player_id) || listing.price <= 1) continue;
                const profit = (adjustedMarketValue - listing.price) * listing.quantity;
                const roi = listing.price > 0 ? (profit / (listing.price * listing.quantity)) * 100 : 0;

                if (filters["profit"] && (adjustedMarketValue - listing.price) < filters["profit"]) continue;
                if (filters["roi"] && roi < parseFloat(filters["roi"])) continue;
                if (filters["price"] && listing.price > parseFloat(filters["price"])) continue;
                if (filters["totalProfit"] && profit < filters["totalProfit"]) continue;
                if (filters["qt"] && listing.quantity < filters["qt"]) continue;

                initialListings.push(listing);
                dedupIds.add(listing.player_id);
            }

            if (initialListings.length === 0) {
                throw new Error("No listings found matching initial criteria from W3.");
            }

            const bazaarChecks = initialListings.map(async (listing) => {
                try {
                    const url = `https://api.torn.com/user/${listing.player_id}?selections=bazaar&key=${apiKey}`;
                    const bazaarData = await tornApiCall(url);
                    if (!bazaarData || !bazaarData.bazaar) return null;

                    const itemInBazaar = Object.values(bazaarData.bazaar).find(i => i.ID == itemId);
                    if (!itemInBazaar || itemInBazaar.price > listing.price) return null; // Price check against W3

                    const profit = (adjustedMarketValue - itemInBazaar.price) * itemInBazaar.quantity;
                    const roi = itemInBazaar.price > 0 ? (profit / (itemInBazaar.price * itemInBazaar.quantity)) * 100 : 0;

                    if (filters["profit"] && (adjustedMarketValue - itemInBazaar.price) < filters["profit"]) return null;
                    if (filters["roi"] && roi < parseFloat(filters["roi"])) return null;
                    if (filters["price"] && itemInBazaar.price > parseFloat(filters["price"])) return null;
                    if (filters["totalProfit"] && profit < filters["totalProfit"]) return null;
                    if (filters["qt"] && itemInBazaar.quantity < filters["qt"]) return null;

                    return {
                        player_id: listing.player_id,
                        price: itemInBazaar.price,
                        quantity: itemInBazaar.quantity,
                        formattedProfit: formatProfit((adjustedMarketValue - itemInBazaar.price)),
                        percentageROI: roi.toFixed(1),
                    };
                } catch (err) {
                    console.error(`Failed to check bazaar for ${listing.player_id}:`, err);
                    return null;
                }
            });

            const checkedListings = (await Promise.all(bazaarChecks)).filter(Boolean);
            checkedListings.sort((a, b) => b.profit - a.profit);

            const counter = $("#pc-counter");
            if (checkedListings.length === 0) {
                if (counter) counter.textContent = parseInt(counter.textContent) + 1;
                table.innerHTML = `<tr><td colspan="5" class="no-listings-message">No listings found matching criteria.</td></tr>`;
            } else {
                table.innerHTML = checkedListings.map(l => `
                    <tr>
                        <td><a target="_blank" href="https://www.torn.com/bazaar.php?userId=${l.player_id}&itemName=${encodeURIComponent(itemName)}">${l.player_id}</a></td>
                        <td>${l.price.toLocaleString()}</td>
                        <td>${l.formattedProfit}</td>
                        <td>${l.percentageROI}%</td>
                        <td>${l.quantity.toLocaleString()}</td>
                    </tr>`).join("");
            }

        } catch (error) {
            console.error(`Error checking profit for item ${itemId}:`, error);
            table.innerHTML = `<tr><td colspan="5" style="color:red;">Error: ${error.message}</td></tr>`;
            itemDiv.classList.remove("hidden");
        }
    }

    async function checkAllProfits() {
        $("#pc-counter").textContent = "0";
        $("#pc-start").disabled = true;

        let multiBazaar = $("#pc-multi-bazaar");
        let bazaars = {};
        multiBazaar.innerHTML = "";
        multiBazaar.classList.add("hidden");

        const allItemDivs = [...$$(".item-container")];
        for (const itemDiv of allItemDivs) {
            await checkProfit(itemDiv.dataset.instanceId);
            let rows = itemDiv.querySelectorAll(`tbody > tr`);
            let itemName = itemDiv.querySelector(`input[data-id]`)?.value;

            if (!rows || !rows.length || !itemName) continue;

            rows.forEach(row => {
                let playerID = row.querySelector("td")?.textContent;
                if (playerID) {
                    if (!bazaars[playerID]) bazaars[playerID] = [];
                    bazaars[playerID].push(itemName);
                }
            });
        }

        let first = true;
        for (const id in bazaars) {
            if (first) {
                multiBazaar.classList.remove("hidden");
                multiBazaar.innerHTML = `
                    <table id="multi-bazaar-table">
                        <thead><tr><th>Player ID</th><th>Items</th></tr></thead>
                        <tbody id="multi-bazaar-tbody"></tbody>
                    </table>`;
                first = false;
            }
            multiBazaar.querySelector("#multi-bazaar-tbody").innerHTML += `
                <tr>
                    <td><a href="https://www.torn.com/bazaar.php?userId=${id}" target="_blank">${id}</a></td>
                    <td>${bazaars[id].join(", ")}</td>
                </tr>`;
        }
        $("#pc-start").disabled = false;
    }

    function showFilteredItems(search = "") {
        const itemsGrid = $(".items-grid");
        itemsGrid.innerHTML = "";
        if (!itemsData || Object.keys(itemsData).length === 0) return;

        Object.entries(itemsData)
            .filter(([, item]) => (!search || item.name.toLowerCase().includes(search)) && (!currentCategory || item.type === currentCategory))
            .forEach(([id, item]) => {
                const card = createElement("div", "item-card");
                if (selectedItems.has(id)) card.classList.add("selected");
                card.addEventListener("click", () => selectItem(id, card));
                card.innerHTML = `<img src="${item.image.replace("/large.png", "/small.png")}" alt="${item.name}"><div class="item-name">${item.name}</div><div class="item-type">${item.type}</div>`;
                itemsGrid.appendChild(card);
            });
    }

    async function importItems() {
        try {
            const cb = await navigator.clipboard.readText();
            const json = JSON.parse(cb);
            if (json && Array.isArray(json)) {
                await GM_setValue("savedItems", json);
                alert("Imported " + json.length + " items. Please refresh the page to see the changes.");
            } else {
                alert("Invalid format in clipboard.");
            }
        } catch (e) {
            alert("Could not read from clipboard or parse JSON. Error: " + e.message);
        }
    }

    async function exportItems() {
        const items = await GM_getValue("savedItems");
        if (items) {
            await navigator.clipboard.writeText(JSON.stringify(items));
            alert("Copied saved items to clipboard.");
        } else {
            alert("No items saved to export.");
        }
    }

    async function init() {
        await loadApiKey();
        await loadSalesTax();
        await loadItemsFromJson();
        await loadItemsFromStorage();

        $("#pc-apikey").addEventListener("input", saveApiKey);
        $("#pc-salestax").addEventListener("input", saveSalesTax);
        $("#pc-add-item-btn").addEventListener("click", () => toggleModal(true));
        $("#pc-start").addEventListener("click", checkAllProfits);
        $("#pc-export").addEventListener("click", exportItems);
        $("#pc-import").addEventListener("click", importItems);
        $("#pc-updateItems").addEventListener("click", updateItemsJson);

        $("#pc-itemSearch").addEventListener("input", (e) => showFilteredItems(e.target.value.toLowerCase()));
        $("#pc-add-criteria").addEventListener("click", () => addCriteria(false));
        $("#pc-createItemBtn").addEventListener("click", createItem);
        $("#pc-close-modal-btn").addEventListener("click", () => toggleModal(false));

        const observer = new MutationObserver((mutations, obs) => {
            const areasHeader = Array.from(document.querySelectorAll('h2.title___XfwKa'))
                .find(h2 => h2.textContent.trim().startsWith('Areas'));

            if (areasHeader) {
                const areasContainer = areasHeader.closest('.toggle-block___oKpdF')?.querySelector('.toggle-content___BJ9Q9');

                if (areasContainer && !areasContainer.querySelector('#profit-checker-link-container')) {
                    const firstLink = areasContainer.querySelector('.area-desktop___bpqAS');
                    if (firstLink) {
                        const triggerDiv = firstLink.cloneNode(true);
                        triggerDiv.id = 'profit-checker-link-container';

                        const link = triggerDiv.querySelector('a');
                        const iconSpan = triggerDiv.querySelector('.svgIconWrap___AMIqR');
                        const textSpan = triggerDiv.querySelector('.linkName___FoKha');

                        link.href = "#";
                        link.onclick = (e) => {
                            e.preventDefault();
                            appContainer.style.display = 'block';
                        };

                        if (iconSpan) iconSpan.innerHTML = `<i class="fa-solid fa-sack-dollar" style="font-size: 16px; width: 34px; text-align: center;"></i>`;
                        if (textSpan) textSpan.textContent = "Profit Checker";

                        areasContainer.insertBefore(triggerDiv, areasContainer.firstChild);
                        obs.disconnect();
                    }
                }
            }
        });

        const sidebarRoot = document.getElementById('sidebarroot');
        if (sidebarRoot) {
            observer.observe(sidebarRoot, {
                childList: true,
                subtree: true
            });
        }

        $("#pc-close-button").addEventListener("click", () => {
            appContainer.style.display = 'none';
        });
    }

    init();
})();
