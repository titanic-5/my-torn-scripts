// ==UserScript==
// @name         Stakeout Script
// @namespace    http://tampermonkey.net/
// @version      2.6.2
// @description  Stakeout factions or individual users
// @author       Titanic_
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://www.torn.com/factions.php?step=profile&ID=*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/stakeout.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/stakeout.user.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

const API_KEY_PLACEHOLDER = "YOUR_API_KEY_HERE";
const PROFILE_SELECTOR = "#profileroot div.profile-status div.title-black.top-round";
const FACTION_SELECTOR = "div#factions > div#react-root";
const ALERT_SOUND_URL = "https://www.myinstants.com/media/sounds/alert.mp3";
const CRITICAL_TIME_THRESHOLD = 40; // Seconds

const MAIN_CONTAINER_ID = "faction-members-status-display";
const CONTENT_WRAPPER_ID = "faction-members-content-wrapper";
const FACTION_CONTROLS_CONTAINER_ID = "stakeout-faction-controls-container";
const MODAL_ID = "stakeout-spies-modal";
const MODAL_OVERLAY_ID = "stakeout-spies-modal-overlay";
const YATA_API_ID = "stakeout-yata-api-key-input";
const FFSCOUTER_API_ID = "stakeout-ffscouter-api-key-input";
const TOOLTIP_ID = "stakeout-spy-tooltip";

const STATE_PREFIX = "stakeout_category_state_";
const COLLAPSED_KEY = "stakeout_main_display_collapsed";
const YATA_KEY = "stakeoutYataApiKey";
const FFSCOUTER_KEY = "stakeoutFFScouterApiKey";

const STATUS_CATEGORIES = {
	OKAY: "Okay",
	OKAY_ABROAD: "Abroad (Not Hospitalized)",
	HOSPITAL_TORN: "In Hospital (Torn)",
	HOSPITAL_ABROAD: "In Hospital (Abroad)",
	TRAVELING: "Traveling",
	JAIL: "In Jail",
	OTHER: "Other",
};
const CATEGORY_ORDER = [
	STATUS_CATEGORIES.OKAY,
	STATUS_CATEGORIES.HOSPITAL_TORN,
	STATUS_CATEGORIES.TRAVELING,
	STATUS_CATEGORIES.OKAY_ABROAD,
	STATUS_CATEGORIES.HOSPITAL_ABROAD,
	STATUS_CATEGORIES.JAIL,
	STATUS_CATEGORIES.OTHER,
];

const DB_NAME = "StakeoutDB";
const DB_VERSION = 3;
const YATA_SPIES_STORE_NAME = "yataFactionSpies";
const FFSCOUTER_SPIES_STORE_NAME = "ffscouterFactionSpies";
const TORN_FACTION_API_STORE_NAME = "tornFactionApiCache";

const TORN_FACTION_API_CACHE_DURATION_MS = 29 * 1000; // 29 seconds
const SPY_CACHE_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const FFSCOUTER_TARGETS_PER_REQ = 205;

let currentApiKey = localStorage.getItem("stakeoutUserApiKey") || API_KEY_PLACEHOLDER;
let timeouts = new Map();
let countdowns = new Map();
let currentStatuses = [];
let previouslyOkayIDs = new Set();
let currentYataSpies = {};
let currentFFScouterSpies = {};
let yataApiKeyChangedGlobal = false;
let modalEscapeKeyListener = null;
let dbPromise = null;

function createStyledElement(tag, styles = {}, attributes = {}) {
	const element = document.createElement(tag);
	Object.assign(element.style, styles);
	Object.assign(element, attributes);
	return element;
}

function parseTimeToSeconds(description) {
	if (!description) return Infinity;
	const timePattern =
		/(?:for|in|lands in)\s+(?=(?:(?:\d+\s*(?:days?|d))|(?:\d+\s*(?:hours?|hrs?|h))|(?:\d+\s*(?:minutes?|mins?|m))|(?:\d+\s*(?:seconds?|secs?|s))))(?:(\d+)\s*(?:days?|d))?\s*(?:(\d+)\s*(?:hours?|hrs?|h))?\s*(?:(\d+)\s*(?:minutes?|mins?|m))?\s*(?:(\d+)\s*(?:seconds?|secs?|s))?/i;
	const match = description.toLowerCase().match(timePattern);
	if (!match) return Infinity;
	const d = parseInt(match[1]) || 0,
		h = parseInt(match[2]) || 0,
		m = parseInt(match[3]) || 0,
		s = parseInt(match[4]) || 0;
	const totalSeconds = d * 86400 + h * 3600 + m * 60 + s;
	return totalSeconds > 0 ? totalSeconds : Infinity;
}

function formatTimeDescription(baseDescription, remainingSeconds) {
	const fullTimePhrasePattern = /((?:for|in|lands in)\s+)((?:\d+\s+(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b(?:\s+|$)?)+)/i;
	const match = baseDescription.match(fullTimePhrasePattern);
	let newTimeValue;

	if (remainingSeconds <= 0) newTimeValue = "now";
	else {
		const d = Math.floor(remainingSeconds / 86400);
		const h = Math.floor((remainingSeconds % 86400) / 3600);
		const m = Math.floor((remainingSeconds % 3600) / 60);
		const s = remainingSeconds % 60;

		if (d > 0) newTimeValue = `${d}d` + (h > 0 ? ` ${h}h` : "") + (m > 0 ? ` ${m}m` : "");
		else if (h > 0) newTimeValue = `${h}h` + (m > 0 ? ` ${m}m` : "");
		else if (m > 0) newTimeValue = `${m}m` + (m < 10 ? (s > 0 ? ` ${s}s` : "") : "");
		else newTimeValue = `${s}s`;
	}
	if (match?.[0]) return baseDescription.replace(match[0], `${match[1]}${newTimeValue}`);
	return `${baseDescription} (${newTimeValue})`;
}

function isApiKeySet() {
	return currentApiKey && currentApiKey !== API_KEY_PLACEHOLDER;
}
function playAlertSound() {
	new Audio(ALERT_SOUND_URL).play();
}
function clearAllCountdownIntervals() {
	countdowns.forEach(({ intervalId }) => clearInterval(intervalId));
	countdowns.clear();
}
function clearAllIndividualMonitors() {
	timeouts.forEach(clearTimeout);
	timeouts.clear();
}
function isCacheValid(cachedItem, duration = SPY_CACHE_DURATION_MS) {
	return cachedItem?.timestamp && Date.now() - cachedItem.timestamp < duration;
}

function openDB() {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = (event) => {
			console.error("[Stakeout] IndexedDB error:", event.target.errorCode);
			reject(event.target.errorCode);
		};
		request.onsuccess = (event) => resolve(event.target.result);
		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(YATA_SPIES_STORE_NAME)) db.createObjectStore(YATA_SPIES_STORE_NAME, { keyPath: "factionID" });
			if (!db.objectStoreNames.contains(FFSCOUTER_SPIES_STORE_NAME)) db.createObjectStore(FFSCOUTER_SPIES_STORE_NAME, { keyPath: "factionID" });
			if (!db.objectStoreNames.contains(TORN_FACTION_API_STORE_NAME)) db.createObjectStore(TORN_FACTION_API_STORE_NAME, { keyPath: "factionID" });
		};
	});
	return dbPromise;
}

async function operateOnDB(storeName, mode, operationCallback) {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([storeName], mode);
			const store = transaction.objectStore(storeName);
			const request = operationCallback(store);
			request.onsuccess = (event) => resolve(request.result === undefined ? true : request.result);
			request.onerror = (event) => {
				console.error(`[Stakeout] DB Error (Store: ${storeName}, Mode: ${mode}):`, event.target.errorCode);
				reject(event.target.errorCode);
			};
		});
	} catch (error) {
		console.error(`[Stakeout] Failed to open DB for ${storeName} operation:`, error);
		return null;
	}
}

function getSpyDataFromDB(factionID, storeName) {
	return operateOnDB(storeName, "readonly", (store) => store.get(factionID));
}
function saveSpyDataToDB(factionID, spyData, storeName) {
	return operateOnDB(storeName, "readwrite", (store) => store.put({ factionID, data: spyData, timestamp: Date.now() }));
}
function clearSpyDataForFactionFromDB(factionID, storeName) {
	return operateOnDB(storeName, "readwrite", (store) => store.delete(factionID));
}

async function getFactionApiDataFromDB(factionID) {
	return operateOnDB(TORN_FACTION_API_STORE_NAME, "readonly", (store) => store.get(factionID));
}

async function saveFactionApiCacheToDB(factionID, data) {
	return operateOnDB(TORN_FACTION_API_STORE_NAME, "readwrite", (store) => store.put({ factionID, data, timestamp: Date.now() }));
}

async function clearOldSpyDataFromDB() {
	for (const storeName of [YATA_SPIES_STORE_NAME, FFSCOUTER_SPIES_STORE_NAME]) {
		operateOnDB(storeName, "readwrite", (store) => {
			const cursorRequest = store.openCursor();
			cursorRequest.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor) {
					if (!isCacheValid(cursor.value)) store.delete(cursor.primaryKey);
					cursor.continue();
				}
			};
			return cursorRequest;
		}).catch((error) => console.error(`[Stakeout] Error clearing old spy data from ${storeName}:`, error));
	}
}

async function fetchApi(endpoint, selections = "basic", apiKey = currentApiKey) {
	return new Promise((resolve) => {
		const isTornApi = endpoint.startsWith("user/") || endpoint.startsWith("faction/") || endpoint.startsWith("v2/faction/");
		const isFFScouterApi = endpoint.startsWith("https://ffscouter.com/api/v1/get-stats");

		if (isTornApi && (!apiKey || apiKey === API_KEY_PLACEHOLDER)) return resolve({ error: { error: "API Key not set" } });

		if (!isTornApi && !isFFScouterApi && !apiKey && !endpoint.includes("key=")) return resolve({ error: { error: "API Key not set for external service" } });

		let finalUrl = isTornApi ? `https://api.torn.com/${endpoint}?key=${apiKey}&selections=${selections}` : endpoint;
		if (!isTornApi && !isFFScouterApi && !finalUrl.includes("key=")) finalUrl += `${finalUrl.includes("?") ? "&" : "?"}key=${apiKey}`;

		console.log(`[Stakeout] Fetching API: ${finalUrl}`);
		GM_xmlhttpRequest({
			method: "GET",
			url: finalUrl,
			timeout: 15000,
			onload: (response) => {
				try {
					const data = JSON.parse(response.responseText);
					if (response.status < 200 || response.status >= 300 || data?.error?.error) {
						const errorMsg = data?.error?.error || `HTTP Error ${response.status}`;
						console.error(`[Stakeout] API Error (${finalUrl.split("?")[0]}):`, errorMsg, data?.error ? "" : response.responseText);
						resolve(data?.error ? { error: data.error } : { error: { error: errorMsg, response: response.responseText } });
					} else {
						resolve(data);
					}
				} catch (e) {
					console.error(`[Stakeout] Error parsing JSON from ${finalUrl.split("?")[0]}:`, e, response.responseText);
					resolve({ error: { error: "JSON Parse Error", details: e.message, response: response.responseText } });
				}
			},
			onerror: (response) => {
				console.error(`[Stakeout] Network Error for ${finalUrl.split("?")[0]}:`, response);
				resolve({ error: { error: "Network Error", details: response.statusText || "Unknown network issue" } });
			},
			ontimeout: () => {
				console.error(`[Stakeout] Request Timeout for ${finalUrl.split("?")[0]}`);
				resolve({ error: { error: "Request Timeout" } });
			},
		});
	});
}

async function checkUserStatus(userID) {
	const data = await fetchApi(`user/${userID}`);
	return !data?.error && data?.status?.state === "Okay";
}

function formatStatValue(num) {
	if (num === null || num === undefined || num === -1) return "N/A";
	if (num === 0) return "0";
	const suffixes = ["", "k", "M", "B", "T", "Q"];
	let i = 0;
	let tempNum = Math.abs(num);
	while (tempNum >= 1000 && i < suffixes.length - 1) {
		tempNum /= 1000;
		i++;
	}
	const precision = i === 1 && tempNum < 100 ? 1 : i > 0 ? 2 : 0;
	let formattedNum = (num / Math.pow(1000, i)).toFixed(precision);
	return formattedNum.replace(/\.0+$/, "") + suffixes[i];
}

function formatSpyTimestamp(unixTimestamp) {
	if (!unixTimestamp || unixTimestamp === 0) return "Unknown age";
	const dS = Math.floor((Date.now() - unixTimestamp * 1000) / 1000);

	if (dS < 5) return "Just now";
	const dY = Math.floor(dS / (365.25 * 86400));
	if (dY > 0) return `~${dY}y ago`;
	const dMo = Math.floor(dS / (30.44 * 86400));
	if (dMo > 0) return `~${dMo}mo ago`;
	const dD = Math.floor(dS / 86400);
	if (dD > 0) return `~${dD}d ago`;
	const dH = Math.floor(dS / 3600);
	if (dH > 0) return `~${dH}h ago`;
	const dMin = Math.floor(dS / 60);
	if (dMin > 0) return `~${dMin}m ago`;
	return `~${dS}s ago`;
}

function createApiErrorDisplay(serviceName, errorMessage, errorId) {
	const controlsContainer = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
	if (controlsContainer && !document.getElementById(errorId)) {
		const errorMsgElement = createStyledElement(
			"p",
			{ color: "yellow", fontSize: "0.8em", marginLeft: "10px" },
			{ id: errorId, textContent: `${serviceName} API: ${errorMessage}` }
		);
		controlsContainer.appendChild(errorMsgElement);
	}
}

async function fetchFactionMembersWithCache(factionID) {
	const cachedItem = await getFactionApiDataFromDB(factionID);

	if (cachedItem && isCacheValid(cachedItem, TORN_FACTION_API_CACHE_DURATION_MS)) {
		console.log(`[Stakeout] Using cached faction data for ${factionID}`);
		return cachedItem.data;
	}

	console.log(`[Stakeout] Fetching fresh Torn faction data for Faction ID: ${factionID}`);
	const freshData = await fetchApi(`v2/faction/${factionID}/members`, "");

	if (freshData && !freshData.error) await saveFactionApiCacheToDB(factionID, freshData);

	return freshData;
}

async function fetchYataSpies(factionID) {
	const yataApiKey = localStorage.getItem(YATA_KEY);
	if (!yataApiKey) return null;

	const cached = await getSpyDataFromDB(factionID, YATA_SPIES_STORE_NAME);
	if (cached && isCacheValid(cached) && cached.data?.spies && Object.keys(cached.data.spies).length > 0) return cached.data;

	const freshData = await fetchApi(`https://yata.yt/api/v1/spies/?faction=${factionID}`, "", yataApiKey);
	if (freshData && !freshData.error) {
		await saveSpyDataToDB(factionID, freshData, YATA_SPIES_STORE_NAME);
		return freshData;
	}
	if (freshData?.error) {
		const { error, code } = freshData.error;
		const msg = error || JSON.stringify(freshData.error);
		if (code === 2 && (msg.includes("No spies") || msg.includes("faction not found"))) console.log("[Stakeout] YATA: No spies for faction or faction not found:", factionID);
		else {
			console.error("[Stakeout] YATA Spies API Error:", msg, code ? `(Code: ${code})` : "");
			createApiErrorDisplay("YATA", msg, "yata-api-error-message");
		}
	}
	return null;
}

async function fetchFFScouterSpies(factionID, memberIDs) {
	const ffscouterApiKey = localStorage.getItem(FFSCOUTER_KEY);
	if (!ffscouterApiKey || memberIDs.length === 0) return null;

	const cached = await getSpyDataFromDB(factionID, FFSCOUTER_SPIES_STORE_NAME);
	if (cached && isCacheValid(cached) && cached.data && Object.keys(cached.data).length > 0) return cached.data;

	let allFFScouterData = {};
	for (let i = 0; i < memberIDs.length; i += FFSCOUTER_TARGETS_PER_REQ) {
		const chunk = memberIDs.slice(i, i + FFSCOUTER_TARGETS_PER_REQ);
		const endpoint = `https://ffscouter.com/api/v1/get-stats?key=${ffscouterApiKey}&targets=${chunk.join(",")}`;
		const responseData = await fetchApi(endpoint);

		if (Array.isArray(responseData)) responseData.forEach((spy) => (allFFScouterData[spy.player_id.toString()] = spy));
		else if (responseData?.code && responseData?.error) {
			console.error(`[Stakeout] FFScouter API Error (Code ${responseData.code}): ${responseData.error}`);
			if (responseData.code === 6) createApiErrorDisplay("FFScouter", responseData.error, "ffscouter-api-error-message");
			if ([1, 2, 6].includes(responseData.code)) return null;
		} else if (responseData?.error) {
			console.error("[Stakeout] FFScouter Fetch Error:", responseData.error.error || responseData.error);
			return null;
		}
	}
	if (Object.keys(allFFScouterData).length > 0) {
		await saveSpyDataToDB(factionID, allFFScouterData, FFSCOUTER_SPIES_STORE_NAME);
		return allFFScouterData;
	}
	return null;
}

async function checkIndividualUserAndAlert(alertedUserID) {
	const stakeoutCheckbox = document.getElementById("factionStakeoutCheckbox");
	if (!stakeoutCheckbox?.checked && timeouts.has(alertedUserID)) {
		clearTimeout(timeouts.get(alertedUserID));
		timeouts.delete(alertedUserID);
		return;
	}

	if (timeouts.has(alertedUserID)) {
		clearTimeout(timeouts.get(alertedUserID));
		timeouts.delete(alertedUserID);
	}
	if (!isApiKeySet()) return;

	const data = await fetchApi(`user/${alertedUserID}`);
	if (data?.error) return;

	if (data?.status?.state === "Okay") {
		if (!previouslyOkayIDs.has(alertedUserID)) playAlertSound();
		previouslyOkayIDs.add(alertedUserID);

		const memberToUpdate = currentStatuses.find((m) => m.userID === alertedUserID);
		if (memberToUpdate) {
			Object.assign(memberToUpdate, {
				status: "Okay",
				description: data.status.description || "Available",
				durationSeconds: 0,
				lastActionStatus: data.last_action?.status || memberToUpdate.lastActionStatus,
			});
		}
		if (countdowns.has(alertedUserID)) {
			clearInterval(countdowns.get(alertedUserID).intervalId);
			countdowns.delete(alertedUserID);
		}
		const currentFactionID = new URLSearchParams(window.location.search).get("ID");
		if (currentFactionID) updateFactionDisplay(currentStatuses, currentFactionID);
	}
}

function createActionButton(icon, title, href, baseColor, hoverColor, additionalStyles = {}, onclick = null) {
	const button = createStyledElement(
		"a",
		{
			padding: "3px 5px",
			fontSize: "1em",
			color: "#f0f0f0",
			textDecoration: "none",
			borderRadius: "3px",
			border: `1px solid ${hoverColor}`,
			cursor: "pointer",
			display: "inline-flex",
			alignItems: "center",
			lineHeight: "1",
			backgroundColor: baseColor,
			...additionalStyles,
		},
		{ href, target: "_blank", title, innerHTML: icon }
	);
	button.onmouseover = () => (button.style.backgroundColor = hoverColor);
	button.onmouseout = () => (button.style.backgroundColor = baseColor);
    if (typeof onclick === "function") button.addEventListener("click", onclick)
	return button;
}

function createMemberElement(member, categoryName) {
	const isTimedStatus = categoryName.includes("Hospital") || categoryName.includes("Jail") || categoryName.includes("Traveling");

	if (isTimedStatus && member.durationSeconds < CRITICAL_TIME_THRESHOLD && member.durationSeconds !== Infinity && member.durationSeconds > 0 && !timeouts.has(member.userID)) {
		const timeoutId = setTimeout(() => checkIndividualUserAndAlert(member.userID), Math.max(1000, member.durationSeconds * 1000));
		timeouts.set(member.userID, timeoutId);
	}

	const memberDiv = createStyledElement("div", {
		padding: "6px 8px",
		fontSize: "0.9em",
		backgroundColor: "#383838",
		borderRadius: "3px",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "flex-start",
		position: "relative",
		borderLeft: `3px solid ${
			member.status === "Okay"
				? "#4CAF50"
				: member.status.includes("Hospital")
				? "#FF9800"
				: member.status === "Traveling"
				? "#2196F3"
				: member.status === "Abroad"
				? "#9C27B0"
				: member.status.includes("Jail")
				? member.status.includes("Federal")
					? "#f44336"
					: "#FFEB3B"
				: "white"
		}`,
	});

	const memberInfoContainer = createStyledElement("div", { display: "flex", flexDirection: "column", flexGrow: 1, marginRight: "8px" });
	const onlineStatusIcon = createStyledElement("span", {
		width: "10px",
		height: "10px",
		borderRadius: "50%",
		marginRight: "6px",
		flexShrink: 0,
		backgroundColor: member.lastActionStatus === "Online" ? "#4CAF50" : member.lastActionStatus === "Idle" ? "#FF9800" : "#9E9E9E",
	});
	const nameContainer = createStyledElement("div", { display: "flex", alignItems: "center", marginBottom: "1px", maxWidth: "130px", overflow: "hidden" });
	nameContainer.append(onlineStatusIcon, createStyledElement("span", { fontWeight: "bold", color: "#E0E0E0" }, { textContent: member.name, title: member.name }));
	const statusDescSpan = createStyledElement(
		"span",
		{ color: "#B0B0B0", fontSize: "0.85em", display: "block", marginTop: "2px" },
		{ id: `status-desc-${member.userID}`, textContent: `(${formatTimeDescription(member.description, member.durationSeconds)})` }
	);
	memberInfoContainer.append(nameContainer, statusDescSpan);

	if (isTimedStatus && member.durationSeconds < 600 && member.durationSeconds !== Infinity && member.durationSeconds > 0) {
		if (countdowns.has(member.userID)) clearInterval(countdowns.get(member.userID).intervalId);
		const endTime = Date.now() + member.durationSeconds * 1000 - 1000;
		const intervalId = setInterval(() => {
			const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
			const descSpan = document.getElementById(`status-desc-${member.userID}`);
			if (descSpan) descSpan.textContent = `(${formatTimeDescription(member.description, remaining)})`;
			if (remaining <= 0) {
				clearInterval(intervalId);
				countdowns.delete(member.userID);
			}
		}, 1000);
		countdowns.set(member.userID, { intervalId, originalDescription: member.description });
		statusDescSpan.textContent = `(${formatTimeDescription(member.description, Math.max(0, member.durationSeconds))})`;
	} else if (countdowns.has(member.userID)) {
		clearInterval(countdowns.get(member.userID).intervalId);
		countdowns.delete(member.userID);
	}

	const actionsContainer = createStyledElement("div", { display: "flex", gap: "5px", flexShrink: 0, alignItems: "center" });
	const spyData =
		member.yataSpyData && (member.yataSpyData.total > 0 || Object.values(member.yataSpyData).some((v) => typeof v === "number" && v > 0 && v !== -1))
			? { source: "yata", data: member.yataSpyData }
			: member.ffscouterSpyData && (member.ffscouterSpyData.bs_estimate !== null || member.ffscouterSpyData.fair_fight !== null)
			? { source: "ffscouter", data: member.ffscouterSpyData }
			: null;

	if (spyData) {
		const spyButton = createActionButton("🕵️‍♂️", "", "#", spyData.source === "yata" ? "#3498DB" : "#555", spyData.source === "yata" ? "#2980B9" : "#444", {
			border: `1px solid ${spyData.source === "yata" ? "#2980B9" : "#5a6268"}`,
		});
		spyButton.onclick = (e) => e.preventDefault();
		spyButton.onmouseover = (event) => {
			let tooltip =
				document.getElementById(TOOLTIP_ID) ||
				document.body.appendChild(
					createStyledElement(
						"div",
						{
							position: "absolute",
							backgroundColor: "#2c2c2c",
							color: "#e0e0e0",
							padding: "10px 12px",
							borderRadius: "6px",
							border: "1px solid #555",
							zIndex: "10001",
							fontSize: "0.9em",
							whiteSpace: "nowrap",
							boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
							pointerEvents: "none",
							minWidth: "220px",
						},
						{ id: TOOLTIP_ID }
					)
				);
			const s = spyData.data;
			tooltip.innerHTML =
				spyData.source === "yata"
					? `
                <div style="font-family: Verdana, Arial, sans-serif;">
                    <div style="font-size: 1.15em; font-weight: bold; color: #76D7C4; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #4a4a4a; text-align: center;">YATA Spy Report</div>
                    <div style="display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 5px 12px; margin-bottom: 10px; font-size: 0.95em;">
                        ${["Str", "Def", "Spd", "Dex"]
													.map(
														(stat) =>
															`<span style="font-weight: bold; color: #ccc;">${stat}:</span> <span style="color: #f0f0f0; text-align: right;">${formatStatValue(
																s[stat.toLowerCase() + "erity"] || s[stat.toLowerCase()]
															)}</span>`
													)
													.join("")}
                    </div>
                    <div style="font-size: 1em; margin-bottom: 8px; padding-top: 8px; border-top: 1px solid #4a4a4a; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: #ddd;">Total:</span> <span style="font-weight: bold; color: #58D68D; font-size: 1.1em;">${formatStatValue(
													s.total
												)}</span>
                    </div>
                    <div style="font-size: 0.85em; color: #999; text-align: right; margin-top: 5px;">${formatSpyTimestamp(
											s.update || Math.max(s.strength_timestamp || 0, s.speed_timestamp || 0, s.defense_timestamp || 0, s.dexterity_timestamp || 0, s.total_timestamp || 0)
										)}</div>
                </div>`
					: `
                <div style="font-family: Verdana, Arial, sans-serif;">
                    <div style="font-size: 1.15em; font-weight: bold; color: #5DADE2; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #4a4a4a; text-align: center;">FFScouter Report</div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; margin-bottom: 10px; font-size: 0.95em;">
                        <span style="font-weight: bold; color: #ccc;">Fair Fight:</span> <span style="color: #f0f0f0; text-align: right;">${
													s.fair_fight !== null ? s.fair_fight.toFixed(2) : "N/A"
												}</span>
                        <span style="font-weight: bold; color: #ccc;">BS Estimate:</span> <span style="color: #f0f0f0; text-align: right;">${
													s.bs_estimate_human || (s.bs_estimate ? formatStatValue(s.bs_estimate) : "N/A")
												}</span>
                    </div>
                    <div style="font-size: 0.85em; color: #999; text-align: right; margin-top: 10px; padding-top: 5px; border-top: 1px solid #4a4a4a;">${formatSpyTimestamp(
											s.last_updated
										)}</div>
                </div>`;

			const rect = spyButton.getBoundingClientRect();
			tooltip.style.display = "block";
			tooltip.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - tooltip.offsetWidth - 10)}px`;
			tooltip.style.top = `${rect.bottom + window.scrollY + 7 + (rect.bottom + tooltip.offsetHeight > window.innerHeight - 10 ? -(tooltip.offsetHeight + rect.height + 14) : 0)}px`;
		};
		spyButton.onmouseout = () => {
			const tt = document.getElementById(TOOLTIP_ID);
			if (tt) tt.style.display = "none";
		};
		actionsContainer.appendChild(spyButton);
	}

    function tooltipBug() {
        const existingTooltips = new Set(Array.from(document.querySelectorAll('[id^="ui-tooltip-"]')).map(el => el.id));

        const interval = setInterval(() => {
            const newTooltip = Array.from(document.querySelectorAll('[id^="ui-tooltip-"]')).find(el => !existingTooltips.has(el.id));

            if (newTooltip) {
                newTooltip.remove();
                clearInterval(interval);
            }
        }, 500);
    }

	actionsContainer.append(
		createActionButton("👤", "View Profile", `https://www.torn.com/profiles.php?XID=${member.userID}`, "#555", "#666", null, tooltipBug),
		createActionButton("⚔️", "Attack User", `https://www.torn.com/loader.php?sid=attack&user2ID=${member.userID}`, "#c0392b", "#a93226", null, tooltipBug)
    )
	memberDiv.append(memberInfoContainer, actionsContainer);
	return memberDiv;
}

function createCategoryElement(categoryName, membersInCategory, factionID) {
	const categoryDiv = createStyledElement("div", { marginBottom: "10px" });
	const memberListDiv = createStyledElement("div", {
		padding: "5px",
		backgroundColor: "#303030",
		borderRadius: "0 0 4px 4px",
		gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
		gap: "8px",
	});
	const storageKey = `${STATE_PREFIX}${factionID}_${categoryName.replace(/\s+/g, "_")}`;
	const isCollapsedStored = localStorage.getItem(storageKey) === "true";
	memberListDiv.style.display = isCollapsedStored ? "none" : "grid";

	const categoryHeader = createStyledElement("h4", {
		margin: "0 0 5px 0",
		padding: "6px 8px",
		backgroundColor: "#3a3a3a",
		color: "#f0f0f0",
		cursor: "pointer",
		borderBottom: "1px solid #555",
		borderRadius: "4px 4px 0 0",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		fontSize: "1.25em",
	});
	const updateHeaderContent = (isCollapsed) => (categoryHeader.innerHTML = `${categoryName} <span>(${membersInCategory.length}) ${isCollapsed ? "▼" : "▲"}</span>`);
	updateHeaderContent(isCollapsedStored);
	categoryHeader.addEventListener("click", () => {
		const isNowCollapsed = memberListDiv.style.display === "none";
		memberListDiv.style.display = isNowCollapsed ? "grid" : "none";
		updateHeaderContent(!isNowCollapsed);
		localStorage.setItem(storageKey, JSON.stringify(!isNowCollapsed));
	});
	membersInCategory.forEach((member) => memberListDiv.appendChild(createMemberElement(member, categoryName)));
	categoryDiv.append(categoryHeader, memberListDiv);
	return categoryDiv;
}

function updateFactionDisplay(memberStatusesToDisplay, factionID) {
	let displayContainer = document.getElementById(MAIN_CONTAINER_ID);
	let contentWrapper = document.getElementById(CONTENT_WRAPPER_ID);

	if (!displayContainer) {
		displayContainer = createStyledElement(
			"div",
			{
				backgroundColor: "#282828",
				color: "white",
				padding: "10px",
				marginBottom: "10px",
				borderRadius: "8px",
				fontSize: "1em",
				position: "relative",
				border: "1px solid #444",
				fontFamily: "Verdana, Arial, sans-serif",
				maxHeight: "600px",
				overflowY: "auto",
				display: localStorage.getItem(COLLAPSED_KEY) === "true" ? "none" : "block",
			},
			{ id: MAIN_CONTAINER_ID }
		);
		contentWrapper = createStyledElement("div", {}, { id: CONTENT_WRAPPER_ID });
		displayContainer.appendChild(contentWrapper);

		const targetElement = document.querySelector(FACTION_SELECTOR);
		const controlsContainer = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
		if (targetElement) {
			if (controlsContainer?.parentNode === targetElement && controlsContainer.nextSibling) targetElement.insertBefore(displayContainer, controlsContainer.nextSibling);
			else targetElement.insertBefore(displayContainer, controlsContainer ? controlsContainer.nextSibling : targetElement.firstChild);
		}
	} else {
		contentWrapper.innerHTML = "";
	}

	if (!isApiKeySet()) {
		contentWrapper.innerHTML = '<p style="color: #ffcc00; text-align: center; padding: 20px;">Please set your Torn API Key to view statuses.</p>';
		return;
	}

	const currentMemberIDsInDisplay = new Set(memberStatusesToDisplay.map((m) => m.userID));
	countdowns.forEach((countdownData, userId) => {
		const memberInNewData = memberStatusesToDisplay.find((m) => m.userID === userId);
		const duration = memberInNewData?.durationSeconds ?? parseTimeToSeconds(memberInNewData?.description);
		const isEligible = duration < 60 && duration !== Infinity && duration > 0 && memberInNewData?.status?.match(/Hospital|Jail|Traveling/);
		if (!isEligible || !currentMemberIDsInDisplay.has(userId)) {
			clearInterval(countdownData.intervalId);
			countdowns.delete(userId);
		}
	});

	const categorizedMembers = Object.fromEntries(CATEGORY_ORDER.map((cat) => [cat, []]));
	memberStatusesToDisplay.forEach((member) => {
		member.durationSeconds ??= parseTimeToSeconds(member.description);
		const { status, description } = member;
		let category = STATUS_CATEGORIES.OTHER;
		if (status === "Hospital") category = description.toLowerCase().match(/hospital in|in a .* hospital/) ? STATUS_CATEGORIES.HOSPITAL_ABROAD : STATUS_CATEGORIES.HOSPITAL_TORN;
		else if (status === "Traveling") category = STATUS_CATEGORIES.TRAVELING;
		else if (status === "Abroad") category = STATUS_CATEGORIES.OKAY_ABROAD;
		else if (status.includes("Jail")) category = STATUS_CATEGORIES.JAIL;
		else if (status === "Okay") category = STATUS_CATEGORIES.OKAY;
		categorizedMembers[category].push(member);
	});

	CATEGORY_ORDER.forEach((categoryName) => {
		const membersInCategory = categorizedMembers[categoryName];
		if (membersInCategory.length === 0) return;
		membersInCategory.sort((a, b) => a.durationSeconds - b.durationSeconds || a.name.localeCompare(b.name));
		contentWrapper.appendChild(createCategoryElement(categoryName, membersInCategory, factionID));
	});
}

async function fetchMonitorAndUpdate(factionID, stakeoutCheckbox, isInitialCall = false) {
	if (!isApiKeySet()) {
		updateFactionDisplay([], factionID);
		return;
	}

	const usersOkayInPreviousCycle = new Set(previouslyOkayIDs);
	previouslyOkayIDs.clear();
	document.getElementById("yata-api-error-message")?.remove();
	document.getElementById("ffscouter-api-error-message")?.remove();

	const tornFactionData = await fetchFactionMembersWithCache(factionID, TORN_FACTION_API_CACHE_DURATION_MS); // fetchApi(`v2/faction/${factionID}/members`, "");

	if (tornFactionData?.error || !tornFactionData?.members) {
		console.error("[Stakeout] Error fetching faction data:", tornFactionData?.error?.error || "No member data");
		const cw = document.getElementById(CONTENT_WRAPPER_ID);
		if (cw) cw.innerHTML = `<p style="color: #ff6666; text-align: center; padding: 10px;">Error fetching faction data: ${tornFactionData?.error?.error || "No member data"}.</p>`;
		return;
	}

	if (isInitialCall || yataApiKeyChangedGlobal) {
		const yataFullResponse = await fetchYataSpies(factionID);
		currentYataSpies = yataFullResponse?.spies || {};
		if (yataApiKeyChangedGlobal) yataApiKeyChangedGlobal = false;
	}

	const memberIDs = Object.values(tornFactionData.members).map((m) => m.id);
	currentFFScouterSpies = (await fetchFFScouterSpies(factionID, memberIDs)) || {};

	currentStatuses = Object.entries(tornFactionData.members).map(([_, m]) => ({
		userID: m.id,
		name: m.name,
		level: m.level,
		last_action: m.last_action,
		lastActionStatus: m.last_action.status,
		status: m.status.state,
		until: m.status.until || false,
		description: m.status.description,
		is_revivable: m.status.is_revivable,
		durationSeconds: (m.status.until - Math.floor(Date.now() / 1000) || 0) * (m.status.state === "Okay" ? 0 : 1),
		yataSpyData: currentYataSpies[m.id.toString()] || null,
		ffscouterSpyData: currentFFScouterSpies[m.id.toString()] || null,
	}));

	let newlyOkayPlayerDetected = false;
	currentStatuses.forEach((member) => {
		if (member.status === "Okay") {
			previouslyOkayIDs.add(member.userID);
			if (!usersOkayInPreviousCycle.has(member.userID)) newlyOkayPlayerDetected = true;
		}
	});

	if (stakeoutCheckbox?.checked && newlyOkayPlayerDetected) playAlertSound();
	updateFactionDisplay(currentStatuses, factionID);
}

function closeSpiesModal() {
	document.getElementById(MODAL_OVERLAY_ID)?.remove();
	if (modalEscapeKeyListener) {
		document.removeEventListener("keydown", modalEscapeKeyListener);
		modalEscapeKeyListener = null;
	}
}

async function saveSpyApiKeys() {
	const currentFactionID = new URLSearchParams(window.location.search).get("ID");
	const processKey = async (inputId, storageKey, storeName, errorMsgId, changeCallback) => {
		const input = document.getElementById(inputId);
		const oldKey = localStorage.getItem(storageKey);
		const newKey = input.value.trim();

		if (newKey) localStorage.setItem(storageKey, newKey);
		else localStorage.removeItem(storageKey);

		if (newKey !== oldKey) {
			if (changeCallback) changeCallback();
			if (currentFactionID) {
				await clearSpyDataForFactionFromDB(currentFactionID, storeName);
				document.getElementById(errorMsgId)?.remove();
			}
		}
	};

	await processKey(YATA_API_ID, YATA_KEY, YATA_SPIES_STORE_NAME, "yata-api-error-message", () => {
		yataApiKeyChangedGlobal = true;
	});
	await processKey(FFSCOUTER_API_ID, FFSCOUTER_KEY, FFSCOUTER_SPIES_STORE_NAME, "ffscouter-api-error-message");

	closeSpiesModal();
	const stakeoutCheckboxElement = document.getElementById("factionStakeoutCheckbox");
	if (currentFactionID) fetchMonitorAndUpdate(currentFactionID, stakeoutCheckboxElement, false);
}

function createModalInputCard(titleText, inputId, inputValue, placeholder, cardStyles = {}, titleStyles = {}) {
	const card = createStyledElement("div", { backgroundColor: "#3a3a3a", padding: "15px", borderRadius: "6px", ...cardStyles });
	const title = createStyledElement("h3", { margin: "0 0 10px 0", ...titleStyles }, { textContent: titleText });
	const input = createStyledElement(
		"input",
		{ width: "calc(100% - 16px)", padding: "8px", borderRadius: "3px", border: "1px solid #555", backgroundColor: "#222", color: "#f0f0f0", fontSize: "0.9em" },
		{ type: "text", id: inputId, value: inputValue || "", placeholder }
	);
	card.append(title, input);
	return card;
}

function openSpiesModal() {
	if (document.getElementById(MODAL_ID)) return;
	closeSpiesModal();

	const overlay = createStyledElement(
		"div",
		{
			position: "fixed",
			top: "0",
			left: "0",
			width: "100%",
			height: "100%",
			backgroundColor: "rgba(0,0,0,0.7)",
			zIndex: "10000",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},
		{ id: MODAL_OVERLAY_ID }
	);
	const modal = createStyledElement(
		"div",
		{
			backgroundColor: "#2c2c2c",
			color: "#f0f0f0",
			padding: "25px",
			borderRadius: "10px",
			border: "1px solid #555",
			width: "90%",
			maxWidth: "550px",
			boxShadow: "0 5px 15px rgba(0,0,0,0.5)",
			fontFamily: "Verdana, Arial, sans-serif",
		},
		{ id: MODAL_ID }
	);

	modal.append(
		createStyledElement(
			"h2",
			{ margin: "0 0 15px 0", color: "#76D7C4", textAlign: "center", borderBottom: "1px solid #444", paddingBottom: "10px" },
			{ textContent: "Configure Spy Data Sources" }
		),
		createStyledElement(
			"p",
			{ fontSize: "0.9em", color: "#ccc", marginBottom: "20px", lineHeight: "1.5", textAlign: "center" },
			{ innerHTML: "Enter API key(s) for external spy services.<br>These are service-specific keys, not your Torn API key." }
		)
	);

	const cardsContainer = createStyledElement("div", { display: "flex", flexDirection: "column", gap: "15px", marginBottom: "25px" });
	cardsContainer.append(
		createModalInputCard("YATA", YATA_API_ID, localStorage.getItem(YATA_KEY), "Enter YATA API Key", { borderLeft: "4px solid #2980B9" }, { color: "#AED6F1" }),
		createModalInputCard("FFScouter", FFSCOUTER_API_ID, localStorage.getItem(FFSCOUTER_KEY), "Enter FFScouter API Key", { borderLeft: "4px solid #3498DB" }, { color: "#85C1E9" })
	);
	modal.appendChild(cardsContainer);

	const actionsContainer = createStyledElement("div", { display: "flex", justifyContent: "flex-end", gap: "10px" });
	const saveButton = createStyledElement(
		"button",
		{ padding: "8px 15px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.95em" },
		{ textContent: "Save & Close" }
	);
	saveButton.addEventListener("click", saveSpyApiKeys);

	const closeButton = createStyledElement(
		"button",
		{ padding: "8px 15px", backgroundColor: "#777", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.95em" },
		{ textContent: "Cancel" }
	);
	closeButton.addEventListener("click", closeSpiesModal);

	actionsContainer.append(closeButton, saveButton);
	modal.appendChild(actionsContainer);
	overlay.appendChild(modal);
	document.body.appendChild(overlay);

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) closeSpiesModal();
	});
	modalEscapeKeyListener = (e) => {
		if (e.key === "Escape") closeSpiesModal();
	};
	document.addEventListener("keydown", modalEscapeKeyListener);
}

function createFactionControlButton(text, onClick, id = null, additionalStyles = {}) {
	const button = createStyledElement(
		"button",
		{ padding: "4px 8px", backgroundColor: "#555", color: "white", border: "1px solid #666", borderRadius: "3px", cursor: "pointer", marginLeft: "10px", ...additionalStyles },
		{ textContent: text }
	);
	if (id) button.id = id;
	button.addEventListener("click", onClick);
	return button;
}

function addFactionStakeoutElements(factionPageElement, factionID) {
	let monitorIntervalId = null;
	document.getElementById(FACTION_CONTROLS_CONTAINER_ID)?.remove();
	const controlsContainer = createStyledElement(
		"div",
		{
			padding: "10px",
			marginBottom: "10px",
			borderRadius: "8px",
			display: "flex",
			alignItems: "center",
			backgroundColor: "#222",
			color: "white",
			border: "1px solid #444",
			flexWrap: "wrap",
			gap: "10px",
		},
		{ id: FACTION_CONTROLS_CONTAINER_ID }
	);

	const monitorControls = createStyledElement("div", { display: "flex", alignItems: "center" });
	const stakeoutCheckbox = createStyledElement("input", { marginRight: "5px", cursor: "pointer" }, { type: "checkbox", id: "factionStakeoutCheckbox" });
	const intervalDropdown = createStyledElement(
		"select",
		{ marginRight: "5px", backgroundColor: "#444", color: "white", border: "1px solid #666", padding: "3px" },
		{ id: "factionStakeoutInterval" }
	);

	[30, 60].forEach((val) => intervalDropdown.add(new Option(val.toString(), val.toString())));
	intervalDropdown.value = "30";
	monitorControls.append(
		stakeoutCheckbox,
		createStyledElement("label", { marginRight: "5px", cursor: "pointer" }, { htmlFor: "factionStakeoutCheckbox", textContent: "Monitor every" }),
		intervalDropdown,
		createStyledElement("label", { cursor: "pointer" }, { htmlFor: "factionStakeoutInterval", textContent: "seconds" })
	);

	const apiKeyButton = createFactionControlButton(
		isApiKeySet() ? "Change Torn API Key" : "Set Torn API Key",
		() => {
			const newKey = prompt("Please enter your Torn API key:", isApiKeySet() ? currentApiKey : "");
			if (newKey !== null) {
				currentApiKey = newKey.trim() || API_KEY_PLACEHOLDER;
				localStorage.setItem("stakeoutUserApiKey", currentApiKey === API_KEY_PLACEHOLDER ? "" : currentApiKey);
				if (currentApiKey === API_KEY_PLACEHOLDER) localStorage.removeItem("stakeoutUserApiKey");
				previouslyOkayIDs.clear();
				apiKeyButton.textContent = isApiKeySet() ? "Change Torn API Key" : "Set Torn API Key";
				fetchMonitorAndUpdate(factionID, stakeoutCheckbox);
			}
		},
		"stakeoutApiKeyButton"
	);

	const toggleDisplayButton = createFactionControlButton(localStorage.getItem(COLLAPSED_KEY) === "true" ? "Show Member List" : "Hide Member List", () => {
		const displayDiv = document.getElementById(MAIN_CONTAINER_ID);
		if (displayDiv) {
			const isHidden = displayDiv.style.display === "none";
			displayDiv.style.display = isHidden ? "block" : "none";
			toggleDisplayButton.textContent = isHidden ? "Hide Member List" : "Show Member List";
			localStorage.setItem(COLLAPSED_KEY, JSON.stringify(!isHidden));
		}
	});

	const spiesButton = createFactionControlButton("Spies Config", openSpiesModal, null, { backgroundColor: "rgb(66 71 207)", border: "1px solid rgb(66 71 207)" });
	controlsContainer.append(monitorControls, apiKeyButton, toggleDisplayButton, spiesButton);

	const startMonitoring = (interval) => {
		if (monitorIntervalId) clearInterval(monitorIntervalId);
		clearAllIndividualMonitors();
		clearAllCountdownIntervals();
		fetchMonitorAndUpdate(factionID, stakeoutCheckbox);
		monitorIntervalId = setInterval(() => fetchMonitorAndUpdate(factionID, stakeoutCheckbox), interval * 1000);
	};

	const stopMonitoring = () => {
		if (monitorIntervalId) clearInterval(monitorIntervalId);
		monitorIntervalId = null;
		clearAllIndividualMonitors();
		clearAllCountdownIntervals();
		previouslyOkayIDs.clear();
		document.getElementById("yata-api-error-message")?.remove();
		document.getElementById("ffscouter-api-error-message")?.remove();
	};

	stakeoutCheckbox.addEventListener("change", () => (stakeoutCheckbox.checked ? startMonitoring(parseInt(intervalDropdown.value)) : stopMonitoring()));
	intervalDropdown.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) startMonitoring(parseInt(intervalDropdown.value));
	});

	factionPageElement.insertBefore(controlsContainer, factionPageElement.firstChild);
}

function initialFactionLoad(factionID) {
	yataApiKeyChangedGlobal = false;
	fetchMonitorAndUpdate(factionID, { checked: false } /* stakeoutCheckbox dummy */, true /* isInitialCall */);
}

function addStakeoutElementsToProfiles(statusElement) {
	let intervalId = null,
		profileUserWasOkay = false;

	const stakeoutContainer = createStyledElement("div", { float: "right", paddingRight: "10px", display: "flex", alignItems: "center" });
	const stakeoutCheckbox = createStyledElement("input", { marginRight: "5px", cursor: "pointer" }, { type: "checkbox", id: "stakeoutCheckbox" });
	const intervalDropdown = createStyledElement("select", { marginRight: "5px" }, { id: "stakeoutInterval" });

	[1, 2, 3, 4, 5, 30, 60].forEach((val) => intervalDropdown.add(new Option(val.toString(), val.toString())));
	stakeoutContainer.append(
		stakeoutCheckbox,
		createStyledElement("label", { marginRight: "5px", cursor: "pointer" }, { htmlFor: "stakeoutCheckbox", textContent: "Check status every" }),
		intervalDropdown,
		createStyledElement("label", { cursor: "pointer" }, { htmlFor: "stakeoutInterval", textContent: "seconds" })
	);

	const startStakeout = async (interval) => {
		if (intervalId) clearInterval(intervalId);
		const userID = new URLSearchParams(window.location.search).get("XID");
		if (!userID || !isApiKeySet()) {
			if (!isApiKeySet()) alert("Set Torn API key on a faction page for profile stakeout.");
			stakeoutCheckbox.checked = false;
			return;
		}

		if (await checkUserStatus(userID)) {
			if (!profileUserWasOkay) playAlertSound();
			profileUserWasOkay = true;
			stakeoutCheckbox.checked = false;
			return;
		} else profileUserWasOkay = false;

		intervalId = setInterval(async () => {
			if (await checkUserStatus(userID)) {
				if (!profileUserWasOkay) playAlertSound();
				profileUserWasOkay = true;
				clearInterval(intervalId);
				intervalId = null;
				stakeoutCheckbox.checked = false;
			} else profileUserWasOkay = false;
		}, interval * 1000);
	};

	const stopStakeout = () => {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	};

	stakeoutCheckbox.addEventListener("change", () => (stakeoutCheckbox.checked ? ((profileUserWasOkay = false), startStakeout(parseInt(intervalDropdown.value))) : stopStakeout()));
	intervalDropdown.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) startStakeout(parseInt(intervalDropdown.value));
	});
	statusElement.appendChild(stakeoutContainer);
}

function observe() {
	clearOldSpyDataFromDB();
	if (window.StakeOutInterval) clearInterval(window.StakeOutInterval);

	window.StakeOutInterval = setInterval(() => {
		const profileStatusElement = document.querySelector(PROFILE_SELECTOR);
		if (profileStatusElement && !document.getElementById("stakeoutCheckbox")) addStakeoutElementsToProfiles(profileStatusElement);

		const factionProfileElement = document.querySelector(FACTION_SELECTOR);
		if (factionProfileElement && !document.getElementById(FACTION_CONTROLS_CONTAINER_ID)) {
			const factionID = new URLSearchParams(window.location.search).get("ID");
			if (factionID) {
				addFactionStakeoutElements(factionProfileElement, factionID);
				if (!document.getElementById(MAIN_CONTAINER_ID)) initialFactionLoad(factionID);
			}
		}

		if ((profileStatusElement && document.getElementById("stakeoutCheckbox")) || (factionProfileElement && document.getElementById(FACTION_CONTROLS_CONTAINER_ID)))
			clearInterval(window.StakeOutInterval);
	}, 500);
}

observe();
