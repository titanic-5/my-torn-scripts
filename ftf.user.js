// ==UserScript==
// @name         Faction Target Finder
// @version      1.0.7
// @namespace    http://tampermonkey.net/
// @description  Adds a button to the top of the page that opens a live raid target from the faction list.
// @author       Omanpx [1906686], Titanic_ [2968477]
// @license      MIT
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    let defaultFacIDs = [
        50231, 50157, 50586, 50498, 51275, 50597, 51684, 50994, 51668, 50664, 50194,
        50186, 52471, 50103, 51562, 51612, 50406, 51313, 50273, 50375, 50272, 50386,
        50328, 50401, 50216, 51145, 50433, 50094, 52528, 52442, 51382, 52377,
        52429, 52445, 52378, 48264,
    ];

    let facIDs, maxLevel, apiKey, attackLink, newTab, randTarget, randFaction, ffScouterApiKey, maxStats;

    const DB_NAME = 'FTF_Cache';
    const STORE_NAME = 'ff_stats';
    const DB_VERSION = 1;
    const CACHE_DURATION = 10 * 24 * 60 * 60 * 1000; // 10 days
    let db;

    function initDB() {
        return new Promise((resolve, reject) => {
            if (db) return resolve(db);
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = event => {
                const dbInstance = event.target.result;
                if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                    dbInstance.createObjectStore(STORE_NAME, { keyPath: 'userId' });
                }
            };
            request.onsuccess = event => {
                db = event.target.result;
                console.log("[FTF] IndexedDB initialized successfully.");
                resolve(db);
            };
            request.onerror = event => {
                console.error("[FTF] IndexedDB error:", event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    function getStatsFromDB(userIds) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const results = {};
            if (userIds.length === 0) return resolve(results);

            let processedCount = 0;
            userIds.forEach(id => {
                const request = store.get(id);
                request.onsuccess = event => {
                    const result = event.target.result;
                    if (result && (Date.now() - result.timestamp < CACHE_DURATION)) {
                        results[id] = result;
                    }
                    if (++processedCount === userIds.length) resolve(results);
                };
                request.onerror = () => {
                    if (++processedCount === userIds.length) resolve(results); // Resolve with what we have
                };
            });
        });
    }

    function saveStatsToDB(statsArray) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            statsArray.forEach(statData => store.put({
                userId: statData.player_id,
                stats: statData,
                timestamp: Date.now()
            }));
            transaction.oncomplete = () => resolve();
            transaction.onerror = event => reject(event.target.error);
        });
    }

    function fetchFFScouterStats(targetIds) {
        return new Promise((resolve) => {
            if (!ffScouterApiKey || targetIds.length === 0) return resolve([]);
            const FFSCOUTER_TARGETS_PER_REQ = 205;
            const promises = [];

            for (let i = 0; i < targetIds.length; i += FFSCOUTER_TARGETS_PER_REQ) {
                const chunk = targetIds.slice(i, i + FFSCOUTER_TARGETS_PER_REQ);
                const endpoint = `https://ffscouter.com/api/v1/get-stats?key=${ffScouterApiKey}&targets=${chunk.join(",")}`;
                promises.push(new Promise(resolveChunk => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: endpoint,
                        onload: response => {
                            try {
                                const responseData = JSON.parse(response.responseText);
                                if (Array.isArray(responseData)) resolveChunk(responseData);
                                else {
                                    console.error(`[FTF] FFScouter API Error:`, responseData.error || responseData);
                                    resolveChunk([]);
                                }
                            } catch (e) {
                                console.error(`[FTF] FFScouter JSON Parse Error:`, e);
                                resolveChunk([]);
                            }
                        },
                        onerror: error => {
                            console.error("[FTF] FFScouter Fetch Error:", error);
                            resolveChunk([]);
                        }
                    });
                }));
            }
            Promise.all(promises).then(results => resolve([].concat(...results)));
        });
    }
    
    init();

    function parseSuffixedNumber(input) {
        if (!input) return 0;
        const s = String(input).trim().toLowerCase();
        const lastChar = s.slice(-1);
        let value = parseFloat(s);

        if (isNaN(value)) return 0;

        switch (lastChar) {
            case 'k': value *= 1e3; break;
            case 'm': value *= 1e6; break;
            case 'b': value *= 1e9; break;
            case 't': value *= 1e12; break;
            case 'q': value *= 1e15; break;
        }
        return Math.floor(value);
    }

    function init() {
        const storedFacIDs = localStorage.getItem('FTF_FACTIONS') || defaultFacIDs.join(',');
        facIDs = storedFacIDs.split(',').map(Number).filter(id => !isNaN(id) && id > 0);

        maxLevel = localStorage.getItem('FTF_LEVEL') || 100;
        apiKey = localStorage.getItem('FTF_API') || null;
        attackLink = localStorage.getItem('FTF_PROFILE') === 'true'; // Default to opening profile
        newTab = localStorage.getItem('FTF_NEWTAB') === 'true'; // Default to opening in new tab
        randFaction = localStorage.getItem('FTF_RAND_FACTION') === 'true';
        randTarget = localStorage.getItem('FTF_RAND_TARGET') === 'true';

        ffScouterApiKey = localStorage.getItem('FTF_FF_API') || '';
        maxStats = parseSuffixedNumber(localStorage.getItem('FTF_MAX_STATS'));
    }

    function promptAPIKey() {
        const key = prompt('Enter a public API key here:');
        if (key && key.trim() !== '') {
            localStorage.setItem('FTF_API', key);
            init();
        } else {
            alert('No valid API key entered!');
        }
    }

    function changeSettings() {
        const newApiKey = document.querySelector('#ftf-api').value;
        const newLevel = document.querySelector('#ftf-max-level').value;
        const newProfile = document.querySelector('#ftf-profile').checked;
        const newNewTab = document.querySelector('#ftf-newtab').checked;
        const newRandFaction = document.querySelector('#ftf-random-faction').checked;
        const newRandTarget = document.querySelector('#ftf-random-target').checked;
        const newFFApiKey = document.querySelector('#ftf-ff-api').value;
        const newMaxStats = document.querySelector('#ftf-max-stats').value;

        localStorage.setItem('FTF_PROFILE', newProfile);
        localStorage.setItem('FTF_NEWTAB', newNewTab);
        localStorage.setItem('FTF_RAND_FACTION', newRandFaction);
        localStorage.setItem('FTF_RAND_TARGET', newRandTarget);
        localStorage.setItem('FTF_FACTIONS', facIDs.join(','));
        localStorage.setItem('FTF_FF_API', newFFApiKey);
        localStorage.setItem('FTF_MAX_STATS', newMaxStats);

        if (newApiKey && newApiKey.trim() !== '') {
            localStorage.setItem('FTF_API', newApiKey);
        } else {
            alert('Invalid API key entered!');
            return;
        }

        if (newLevel >= 0 && newLevel <= 100) {
            localStorage.setItem('FTF_LEVEL', newLevel);
        } else {
            alert('Invalid max level, please enter a value between 0 and 100!');
            return;
        }

        init();
        alert("Settings saved!");
    }

    function findTarget() {
        if (!apiKey) {
            promptAPIKey();
            return;
        }

        initDB().then(() => {
            console.log("Checking personal Target List first...");
            processTargetList(null, (targetID) => {
                if (targetID) {
                    console.log(`Target found: ${targetID}.`);
                } else {
                    console.log("No suitable targets in personal list. Checking factions...");
                    processUrls();
                }
            });
        }).catch(err => {
            console.error("[FTF] Failed to initialize DB. Stat checking will be disabled.", err);
             processTargetList(null, (targetID) => {
                if (targetID) {
                    console.log(`Target found: ${targetID}.`);
                } else {
                    console.log("No suitable targets in personal list. Checking factions...");
                    processUrls();
                }
            });
        });
    }

    async function filterAndSelectTarget(potentialTargets) {
        if (potentialTargets.length === 0) return null;

        if (!maxStats || maxStats <= 0 || !ffScouterApiKey) {
            const target = randTarget ? potentialTargets[Math.floor(Math.random() * potentialTargets.length)] : potentialTargets[0];
            return target.id || target;
        }

        console.log(`[FTF] Stat filtering ${potentialTargets.length} potential targets (max stats: ${maxStats.toLocaleString()})`);
        const targetIds = potentialTargets.map(t => t.id || t);

        try {
            const cachedStats = await getStatsFromDB(targetIds);
            const idsToFetch = targetIds.filter(id => !cachedStats[id]);

            if (idsToFetch.length > 0) {
                console.log(`[FTF] Fetching ${idsToFetch.length} users from FFScouter.`);
                const fetchedStats = await fetchFFScouterStats(idsToFetch);
                if (fetchedStats.length > 0) await saveStatsToDB(fetchedStats);
                fetchedStats.forEach(data => cachedStats[data.player_id] = { stats: data });
            }

            const finalTargets = potentialTargets.filter(target => {
                const id = target.id || target;
                const statInfo = cachedStats[id];
                if (!statInfo || !statInfo.stats || statInfo.stats.bs_estimate === undefined) return true;
                return statInfo.stats.bs_estimate <= maxStats;
            });

            console.log(`[FTF] After stat filtering, ${finalTargets.length} targets remain.`);
            if (finalTargets.length === 0) return null;

            const finalTarget = randTarget ? finalTargets[Math.floor(Math.random() * finalTargets.length)] : finalTargets[0];
            return finalTarget.id || finalTarget;
        } catch (error) {
            console.error("[FTF] Error during stat filtering, skipping.", error);
            const fallbackTarget = randTarget ? potentialTargets[Math.floor(Math.random() * potentialTargets.length)] : potentialTargets[0];
            return fallbackTarget.id || fallbackTarget;
        }
    }

    function processTargetList(url, callback) {
        const apiUrl = url || `https://api.torn.com/v2/user/list?cat=Targets&striptags=true&limit=50&sort=ASC&key=${apiKey}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            onload(response) {
                const data = JSON.parse(response.responseText);

                if (data.error) {
                    console.error("Failed fetching Target List, reason:", data.error.error);
                    return callback(null);
                }

                const suitableTargets = data.list.filter(user => user.level <= maxLevel && user.status.state === "Okay");

                filterAndSelectTarget(suitableTargets).then(targetId => {
                    if (targetId) {
                        openTargetPage(targetId);
                        return callback(targetId);
                    }

                    if (data._metadata && data._metadata.links.next) {
                        console.log("No valid targets on this page, checking next page...");
                        processTargetList(data._metadata.links.next, callback);
                    } else {
                        return callback(null);
                    }
                });
            },
            onerror(error) {
                console.error("Error loading Target List URL:", error);
                return callback(null);
            }
        });
    }

    function processUrls(index = 0, checked = new Set()) {
        if (facIDs.length === 0) {
            alert("Your faction list is empty. Please add some faction IDs in the settings panel.");
            return;
        }

        if (checked.size >= facIDs.length) {
            alert("No players met the conditions in any faction (or API key is invalid).");
            return;
        }

        if (randFaction) {
            do {
                index = Math.floor(Math.random() * facIDs.length);
            } while (checked.has(index));
        }

        checked.add(index);

        const url = `https://api.torn.com/faction/${facIDs[index]}?selections=basic&timestamp=${Date.now()}&key=${apiKey}`;
        console.log(`Checking faction ID: ${facIDs[index]}`);

        GM_xmlhttpRequest({
            method: "GET",
            url,
            onload(response) {
                const roster = JSON.parse(response.responseText);
                const potentialTargets = checkCondition(roster);

                if (potentialTargets && potentialTargets.length > 0) {
                    filterAndSelectTarget(potentialTargets).then(targetId => {
                        if (targetId) {
                            openTargetPage(targetId);
                        } else {
                            console.log(`No targets passed stat filter in faction ${facIDs[index]}. Moving on.`);
                            processUrls(index + 1, checked);
                        }
                    });
                } else {
                     processUrls(index + 1, checked);
                }
            },
            onerror() {
                console.log(`Error loading URL: ${url}`);
                processUrls(index + 1, checked);
            }
        });
    }

    function checkCondition(roster) {
        if ("error" in roster) {
            console.log("Failed fetching faction roster, reason:", roster.error.error);
            return [];
        }

        return Object.keys(roster.members).filter(userId => {
            const member = roster.members[userId];
            return member.level <= maxLevel && member.status.state === "Okay" && member.days_in_faction >= 15;
        });
    }

    function openTargetPage(targetId) {
        let profileLink;
        if (attackLink) {
            profileLink = `https://www.torn.com/loader.php?sid=attack&user2ID=${targetId}`;
        } else {
            profileLink = `https://www.torn.com/profiles.php?XID=${targetId}`;
        }

        if (newTab) {
            window.open(profileLink, '_blank');
        } else {
            window.location.href = profileLink;
        }
    }

    const raidBtn = createButton('Raid', 'ftf-btn', findTarget);
    const settBtn = createButton('Settings', 'ftf-settings', toggleSettings);

    const settDiv = createDiv('ftf-settings-container');
    settDiv.append(settBtn);
    const container = createDiv('ftf-container');
    container.append(raidBtn, settDiv);

    document.body.appendChild(container);

    function toggleSettings() {
        const container = document.getElementsByClassName("ftf-settings-container")[0];
        if (!container.classList.contains("ftf-settings-container-expanded")) {
            container.classList.toggle("ftf-settings-container-expanded");
            document.querySelector(".ftf-settings").textContent = "Close Settings";

            const appendElements = (parent, ...elements) => {
                const tempDiv = document.createElement('div');
                tempDiv.classList.add('temp-div');
                elements.forEach(el => tempDiv.append(el));
                parent.append(tempDiv);
            };

            const { input: apiKeyInput, label: apiKeyLabel } = createInput('ftf-api', "API Key (Public)", apiKey, "text");
            appendElements(container, apiKeyLabel, apiKeyInput);

            const { input: ffApiInput, label: ffApiLabel } = createInput('ftf-ff-api', "FFScouter Key", ffScouterApiKey, "text");
            appendElements(container, ffApiLabel, ffApiInput);

            const { input: maxInput, label: maxLabel } = createInput('ftf-max-level', "Max Level", maxLevel, "number");
            appendElements(container, maxLabel, maxInput);

            const { input: maxStatsInput, label: maxStatsLabel } = createInput('ftf-max-stats', "Max Stats (0=off, k,m,b,t,q)", localStorage.getItem('FTF_MAX_STATS') || maxStats, "text");
            appendElements(container, maxStatsLabel, maxStatsInput);

            const addFactionWrapper = createDiv('temp-div');
            const addFactionLabel = document.createElement('label');
            addFactionLabel.textContent = 'Add Faction ID';
            const addControlsDiv = document.createElement('div');
            const { input: addFactionInput } = createInput('ftf-add-faction-id', '', '', "number");
            addFactionInput.style.width = '65px';
            const addFactionBtn = createButton('Add', 'ftf-add-btn', () => {
                const newId = parseInt(addFactionInput.value, 10);
                if (newId && !isNaN(newId) && newId > 0) {
                    if (!facIDs.includes(newId)) {
                        facIDs.push(newId);
                        renderFactionList();
                        addFactionInput.value = '';
                    } else { alert('That faction ID is already in the list.'); }
                } else { alert('Please enter a valid faction ID.'); }
            });
            addControlsDiv.append(addFactionInput, addFactionBtn);
            addFactionWrapper.append(addFactionLabel, addControlsDiv);
            container.append(addFactionWrapper);

            const factionListContainer = createDiv('ftf-faction-list-container');
            factionListContainer.id = 'ftf-faction-list-container';
            container.append(factionListContainer);

            function renderFactionList() {
                factionListContainer.innerHTML = '';
                if (facIDs.length === 0) {
                    factionListContainer.textContent = 'No factions in list.';
                    return;
                }
                facIDs.forEach(id => {
                    const item = document.createElement('div');
                    item.className = 'ftf-faction-item';
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = id;
                    item.appendChild(nameSpan);
                    const removeBtn = createButton('✖', 'ftf-remove-btn', () => {
                        const index = facIDs.indexOf(id);
                        if (index > -1) facIDs.splice(index, 1);
                        renderFactionList();
                    });
                    item.appendChild(removeBtn);
                    factionListContainer.appendChild(item);
                });
            }
            renderFactionList();

            const { checkbox: profileCheckbox, label: profileLabel } = createCheckbox('ftf-profile', "Open directly to attack page?", attackLink);
            appendElements(container, profileLabel, profileCheckbox);

            const { checkbox: tabCheckbox, label: tabLabel } = createCheckbox('ftf-newtab', "Open in new tab?", newTab);
            appendElements(container, tabLabel, tabCheckbox);

            const { checkbox: randomFCheckbox, label: randomFLabel } = createCheckbox('ftf-random-faction', "Switch to random faction?", randFaction);
            appendElements(container, randomFLabel, randomFCheckbox);

            const { checkbox: randomTCheckbox, label: randomTLabel } = createCheckbox('ftf-random-target', "Switch to random targets?", randTarget);
            appendElements(container, randomTLabel, randomTCheckbox);

            const saveBtn = createButton('Save', 'ftf-save', changeSettings);
            container.append(saveBtn);
        } else {
            container.classList.toggle("ftf-settings-container-expanded");
            document.querySelector(".ftf-settings").textContent = "Settings";
            while (container.children.length > 1) {
                container.removeChild(container.lastChild);
            }
        }
    }

    function addGlobalStyle(css) {
        var head, style;
        head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    }

    addGlobalStyle(`
        .ftf-btn, .ftf-save {
            background-color: green;
            color: white;
            padding: 3px;
            border-radius: 3px;
            cursor: pointer;
        }
        .ftf-settings {
            padding: 3px;
            cursor: pointer;
            border-radius: 3px;
            background: #ffffff45;
        }
        .ftf-container {
            align-items: end;
            display: flex;
            flex-direction: column;
            gap: 3px;
            position: fixed;
            top: 30%;
            right: 0;
            z-index: 9999;
            background-color: transparent;
        }
        .ftf-settings-container {
           color: black;
           display: flex;
           flex-direction: column;
           align-items: flex-start;
           background-color: orange;
           border-radius: 3px;
        }
        .ftf-settings-container-expanded {
           width: 300px;
           height: fit-content;
           border: 1px solid white;
           align-items: center;
           justify-content: flex-start;
           gap: 8px;
           padding: 8px;
        }
        .temp-div {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            width: 95%;
        }
        #ftf-api, #ftf-ff-api { width: 120px; }
        #ftf-max-level { width: 50px; }
        #ftf-max-stats { width: 80px; } /* Adjust width for max stats input */
        #ftf-api, #ftf-ff-api, #ftf-max-level, #ftf-max-stats, #ftf-add-faction-id { text-align: right; background: #ffffff80; }
        #ftf-faction-list-container {
            width: 70%;
            max-height: 150px;
            overflow-y: auto;
            border: 1px solid #ccc;
            background: #ffffff45;
            padding: 5px;
            border-radius: 3px;
        }
        .ftf-faction-item {
            display: flex;
            justify-content: space-evenly;
            align-items: center;
            padding: 2px;
            border-bottom: 1px solid #eee;
        }
        .ftf-faction-item:last-child { border-bottom: none; }
        .ftf-add-btn, .ftf-remove-btn {
            background-color: green;
            color: white;
            border: none;
            padding: 3px 6px;
            cursor: pointer;
            border-radius: 3px;
            margin-left: 4px;
        }
        .ftf-remove-btn {
            background-color: #f44336;
            font-family: monospace;
            padding: 1px 5px;
        }
    `);

    function createButton(text, className, onClick) {
        const button = document.createElement('button');
        button.className = className;
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    function createDiv(className) {
        const div = document.createElement('div');
        div.className = className;
        return div;
    }

    function createInput(id, text, value, type) {
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.value = value;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = text;
        return { input, label };
    }

    function createCheckbox(id, text, value) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.checked = value;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = text;
        return { checkbox, label };
    }
})();
