// ==UserScript==
// @name         Display Case Checklist
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Title
// @author       Titanic_
// @match        https://www.torn.com/displaycase.php*
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        GM.xmlHttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      api.torn.com
// ==/UserScript==

(function () {
    'use strict';

    let apiKey = '';

    function initialize() {
        injectUI();
        addEventListeners();
        injectStyles();
    }

    function injectUI() {
        waitForKeyElements("#top-page-links-list", (node) => {
            if (document.getElementById('dcc-checklist-btn')) return;
            const lastLink = node[0].querySelector('a.last');
            const buttonHTML = `<a id="dcc-checklist-btn" href="#" class="t-clear h c-pointer line-h24 right"><span>✅ Checklist</span></a>`;
            lastLink ? lastLink.insertAdjacentHTML('beforebegin', buttonHTML) : node[0].insertAdjacentHTML('beforeend', buttonHTML);
        });

        if (document.getElementById('dcc-modal')) return;
        const modalHTML = `
        <div id="dcc-modal" class="dcc-hidden">
            <div id="dcc-modal-content">
                <span id="dcc-modal-close" title="Close">&times;</span>
                <div id="dcc-modal-body">
                    <div id="dcc-api-view">
                        <h3>API Key Required</h3>
                        <p>To check your display case, please provide a Torn API key with at least 'Public' access.</p>
                        <input type="text" id="dcc-api-key-input" placeholder="Enter your API Key here">
                        <button id="dcc-save-api-key" class="dcc-btn">Save and Load Checklist</button>
                    </div>
                    <div id="dcc-loading-view" class="dcc-hidden">
                        <div class="dcc-spinner"></div><p>Loading items...</p>
                    </div>
                    <div id="dcc-checklist-view" class="dcc-hidden">
                        <div id="dcc-controls">
                            <div id="dcc-summary"></div>
                        </div>
                        <div id="dcc-tabs"></div>
                        <div id="dcc-items-container"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    function addEventListeners() {
        document.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.closest('#dcc-checklist-btn')) {
                e.preventDefault();
                openChecklistModal();
            } else if (target.closest('#dcc-modal-close') || target.id === 'dcc-modal') {
                closeChecklistModal();
            } else if (target.closest('#dcc-save-api-key')) {
                await handleSaveApiKey();
            } else if (target.closest('.dcc-tab')) {
                handleTabClick(target.closest('.dcc-tab'));
            }
        });
    }

    async function openChecklistModal() {
        document.getElementById('dcc-modal').classList.remove('dcc-hidden');
        apiKey = await GM_getValue('dcc-api-key', '');

        if (!apiKey) {
            switchView('api');
        } else {
            switchView('loading');
            loadAndRenderChecklist();
        }
    }

    function closeChecklistModal() {
        document.getElementById('dcc-modal').classList.add('dcc-hidden');
    }

    function switchView(viewName) {
        document.querySelectorAll('#dcc-modal-body > div').forEach(div => div.classList.add('dcc-hidden'));
        document.getElementById(`dcc-${viewName}-view`).classList.remove('dcc-hidden');
    }

    async function handleSaveApiKey() {
        const inputKey = document.getElementById('dcc-api-key-input').value.trim();
        if (inputKey) {
            await GM_setValue('dcc-api-key', inputKey);
            apiKey = inputKey;
            switchView('loading');
            loadAndRenderChecklist();
        } else {
            alert('Please enter a valid API key.');
        }
    }

    function fetchApi(selection) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'GET',
                url: `https://api.torn.com/${selection}&key=${apiKey}`,
                onload: (res) => {
                    const data = JSON.parse(res.responseText);
                    data.error ? reject(new Error(`API Error: ${data.error.error}`)) : resolve(data);
                },
                onerror: () => reject(new Error('Network error during request')),
                ontimeout: () => reject(new Error('Request timed out.')),
                timeout: 15000
            });
        });
    }

    async function fetchCachedAllItems() {
        const cacheKey = 'dcc-all-items-cache';
        const cached = await GM_getValue(cacheKey, null);
        if (cached && (Date.now() - cached.timestamp < 72 * 60 * 60 * 1000)) {
            return cached.data;
        }
        const freshData = await fetchApi('torn/?selections=items');
        await GM_setValue(cacheKey, { timestamp: Date.now(), data: freshData });
        return freshData;
    }

    async function loadAndRenderChecklist() {
        try {
            const [displayData, allItemsData] = await Promise.all([
                fetchApi(`user/?selections=display`),
                fetchCachedAllItems()
            ]);

            const collectedItemIDs = new Set(displayData.display.map(item => item.ID));

            const groupedItems = Object.entries(allItemsData.items)
                .filter(([, item]) => item.tradeable)
                .reduce((groups, [id, item]) => {
                    const type = item.type === "Miscellaneous" ? "Other" : item.type;
                    if (!groups[type]) groups[type] = [];
                    groups[type].push({ ...item, id: parseInt(id) });
                    return groups;
                }, {});

            Object.values(groupedItems).forEach(items => items.sort((a, b) => a.name.localeCompare(b.name)));
            const sortedGroupedItems = Object.fromEntries(Object.entries(groupedItems).sort(([a], [b]) => a.localeCompare(b)));

            renderChecklist(sortedGroupedItems, collectedItemIDs);
            switchView('checklist');
            document.querySelector('#dcc-tabs .dcc-tab').click();

        } catch (error) {
            console.error('DisplayChecklist Error:', error);
            alert(`Error loading data: ${error.message}\nYour API key might be invalid or lacking permissions.`);
            await GM_setValue('dcc-api-key', '');
            switchView('api');
        }
    }

    function renderChecklist(groupedItems, collectedIDs) {
        const categories = Object.keys(groupedItems);
        const totalItems = Object.values(groupedItems).reduce((sum, items) => sum + items.length, 0);
        const collectedCount = collectedIDs.size;
        const percentage = totalItems > 0 ? (collectedCount / totalItems * 100).toFixed(1) : 0;

        document.getElementById('dcc-summary').innerHTML = `
        <span>Collected: <strong>${collectedCount} / ${totalItems}</strong> (${percentage}%)</span>
    `;

        document.getElementById('dcc-tabs').innerHTML = categories.map(type =>
            `<button class="dcc-tab" data-type="${type}">${type}</button>`
        ).join('');

        document.getElementById('dcc-items-container').innerHTML = categories.map(type => `
        <div id="dcc-list-${type}" class="dcc-item-list dcc-hidden">
            ${groupedItems[type].map(item => {
            const isCollected = collectedIDs.has(item.id);
            const marketURL = `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${item.id}`;
            return `
                <a href="${marketURL}" target="_blank" rel="noopener noreferrer" title="View on Item Market" class="dcc-item ${isCollected ? 'collected' : ''}" data-name="${item.name.toLowerCase()}">
                    <img src="${item.image}" alt="${item.name}" loading="lazy">
                    <span>${item.name}</span>
                    <div class="dcc-checkmark">✔</div>
                </a>`;
        }).join('')}
        </div>
    `).join('');
    }

    function handleTabClick(tabElement) {
        document.querySelectorAll('.dcc-tab').forEach(t => t.classList.remove('active'));
        tabElement.classList.add('active');
        document.querySelectorAll('.dcc-item-list').forEach(list => list.classList.add('dcc-hidden'));
        document.getElementById(`dcc-list-${tabElement.dataset.type}`).classList.remove('dcc-hidden');
    }

    function injectStyles() {
        GM_addStyle(`
        #dcc-modal {
            position: fixed;
            z-index: 99999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .dcc-hidden {
            display: none !important;
        }

        #dcc-modal-content {
            background-color: #2e2e2e;
            width: 90%;
            height: 90%;
            position: relative;
            display: flex;
        }

        #dcc-modal-close {
            position: absolute;
            top: 10px;
            right: 15px;
            font-size: 28px;
            cursor: pointer;
        }

        #dcc-modal-body {
            padding: 10px 15px;
        }

        #dcc-api-view,
        #dcc-loading-view {
            text-align: center;
            padding: 40px 0;
            margin: auto;
        }

        #dcc-api-key-input {
            width: 80%;
            max-width: 400px;
            padding: 10px;
            margin: 15px 0;
            background: #222;
            border: 1px solid #666;
            color: #fff;
            border-radius: 4px;
        }

        .dcc-btn {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.2s;
        }

        .dcc-btn:hover {
            background-color: #0056b3;
        }

        .dcc-spinner {
            border: 6px solid #444;
            border-top: 6px solid #3498db;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: dcc-spin 1.5s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes dcc-spin {
            0% {
                transform: rotate(0deg);
            }

            100% {
                transform: rotate(360deg);
            }
        }

        #dcc-checklist-view {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        #dcc-controls {
            margin-bottom: 10px;
        }

        #dcc-summary strong {
            color: #4CAF50;
        }

        #dcc-tabs {
            border-bottom: 2px solid #555;
            margin-bottom: 5px;
        }

        .dcc-tab {
            padding: 8px 10px;
            border: none;
            color: #ccc;
            cursor: pointer;
            border-bottom: 3px solid transparent;
        }

        .dcc-tab:hover {
            background: #444;
        }

        .dcc-tab.active {
            color: #fff;
            font-weight: bold;
            border-bottom-color: #00A8FF;
        }

        #dcc-items-container {
            overflow-y: auto;
        }

        .dcc-item-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 8px;
            padding-right: 5px;
        }

        .dcc-item {
            display: flex;
            align-items: center;
            background: #3c3c3c;
            padding: 5px;
            border-left: 4px solid #F44336;
            position: relative;
            overflow: hidden;
            color: inherit;
            text-decoration: none;
        }

        .dcc-item:hover {
            background-color: #4a4a4a;
        }

        .dcc-item.collected {
            border-left-color: #4CAF50;
        }

        .dcc-item img {
            height: 20px;
        }

        .dcc-item span {
            flex-grow: 1;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            font-size: 0.9em;
        }

        .dcc-checkmark {
            position: absolute;
            right: 0px;
            width: 30px;
            height: 30px;
            background: #4CAF50;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .dcc-item.collected .dcc-checkmark {
            display: flex;
        }
    `);
    }

    initialize();

})();
