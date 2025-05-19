// ==UserScript==
// @name         Stakeout Script
// @namespace    http://tampermonkey.net/
// @version      2.5.1
// @description  Stakeout factions or individual users
// @author       Titanic_
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://www.torn.com/factions.php?step=profile&ID=*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/stakeout.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/stakeout.user.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

const API_KEY_PLACEHOLDER = "YOUR_API_KEY_HERE";
let currentApiKey = localStorage.getItem("stakeoutUserApiKey") || API_KEY_PLACEHOLDER;

const PROFILE_STATUS_SELECTOR = "#profileroot div.profile-status div.title-black.top-round";
const FACTION_STATUS_SELECTOR = "div#factions > div#react-root";
const ALERT_SOUND_URL = "https://www.myinstants.com/media/sounds/alert.mp3";

const CRITICAL_TIME_THRESHOLD = 40; // Seconds: If hospitalized < this time, queue API call for user endpoint check

const DISPLAY_CONTAINER_ID = "faction-members-status-display";
const CONTENT_WRAPPER_ID = "faction-members-content-wrapper";
const FACTION_CONTROLS_CONTAINER_ID = "stakeout-faction-controls-container";
const CATEGORY_STATE_PREFIX = "stakeout_category_state_";
const MAIN_DISPLAY_COLLAPSED_KEY = "stakeout_main_display_collapsed";

const TEXT_SHOW_LIST = "Show Member List";
const TEXT_HIDE_LIST = "Hide Member List";

const STATUS_CATEGORIES = {
	OKAY: "Okay",
	HOSPITAL_TORN: "In Hospital (Torn)",
	HOSPITAL_ABROAD: "In Hospital (Abroad)",
	TRAVELING: "Traveling",
	ABROAD_NOT_HOSPITALIZED: "Abroad (Not Hospitalized)",
	JAIL: "In Jail",
	OTHER: "Other",
};

const CATEGORY_ORDER = [
	STATUS_CATEGORIES.OKAY,
	STATUS_CATEGORIES.HOSPITAL_TORN,
	STATUS_CATEGORIES.HOSPITAL_ABROAD,
	STATUS_CATEGORIES.TRAVELING,
	STATUS_CATEGORIES.ABROAD_NOT_HOSPITALIZED,
	STATUS_CATEGORIES.JAIL,
	STATUS_CATEGORIES.OTHER,
];

const YATA_API_KEY_STORAGE_KEY = "stakeoutYataApiKey";
const TORNSTATS_API_KEY_STORAGE_KEY = "stakeoutTornStatsApiKey";
const SPIES_MODAL_ID = "stakeout-spies-modal";
const SPIES_MODAL_OVERLAY_ID = "stakeout-spies-modal-overlay";
const YATA_API_KEY_INPUT_ID = "stakeout-yata-api-key-input";
const TORNSTATS_API_KEY_INPUT_ID = "stakeout-tornstats-api-key-input";
const SPY_TOOLTIP_ID = "stakeout-spy-tooltip";

const DB_NAME = "StakeoutDB";
const DB_VERSION = 1;
const YATA_SPIES_STORE_NAME = "yataFactionSpies";
const CACHE_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

let individualMonitorTimeouts = new Map();
let activeCountdownIntervals = new Map();
let currentDisplayableMemberStatuses = [];
let previouslyOkayFactionUserIDs = new Set();
let currentYataSpies = {};
let spiesModalEscapeKeyListener = null;
let dbPromise = null;

function createStyledElement(tag, styles = {}, attributes = {}) {
	const element = document.createElement(tag);
	Object.assign(element.style, styles);
	Object.assign(element, attributes);
	return element;
}

function parseTimeToSeconds(description) {
	if (!description) return Infinity;
	const descLower = description.toLowerCase();
	const timePattern =
		/(?:for|in|lands in)\s+(?=(?:(?:\d+\s*(?:days?|d))|(?:\d+\s*(?:hours?|hrs?|h))|(?:\d+\s*(?:minutes?|mins?|m))|(?:\d+\s*(?:seconds?|secs?|s))))(?:(\d+)\s*(?:days?|d))?\s*(?:(\d+)\s*(?:hours?|hrs?|h))?\s*(?:(\d+)\s*(?:minutes?|mins?|m))?\s*(?:(\d+)\s*(?:seconds?|secs?|s))?/i;
	const match = descLower.match(timePattern);
	if (match) {
		const days = parseInt(match[1]) || 0;
		const hours = parseInt(match[2]) || 0;
		const minutes = parseInt(match[3]) || 0;
		const seconds = parseInt(match[4]) || 0;
		const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
		return totalSeconds > 0 ? totalSeconds : Infinity;
	}
	return Infinity;
}

function formatTimeDescription(baseDescription, remainingSeconds) {
	const fullTimePhrasePattern = /((?:for|in|lands in)\s+)((?:\d+\s+(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b(?:\s+|$)?)+)/i;
	const match = baseDescription.match(fullTimePhrasePattern);

	let newTimeValue;
	if (remainingSeconds <= 0) newTimeValue = "now";
	else if (remainingSeconds < 60) newTimeValue = `${remainingSeconds}s`;
	else if (remainingSeconds < 3600) {
		const mins = Math.floor(remainingSeconds / 60);
		const secs = remainingSeconds % 60;
		newTimeValue = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
	} else if (remainingSeconds < 86400) {
		const hrs = Math.floor(remainingSeconds / 3600);
		const mins = Math.floor((remainingSeconds % 3600) / 60);
		newTimeValue = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
	} else {
		const days = Math.floor(remainingSeconds / 86400);
		const hrs = Math.floor((remainingSeconds % 86400) / 3600);
		newTimeValue = hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
	}

	if (match && match[0]) return baseDescription.replace(match[0], `${match[1]}${newTimeValue}`);
	else return `${baseDescription} (${newTimeValue})`;
}

function isApiKeySet() {
	return currentApiKey && currentApiKey !== API_KEY_PLACEHOLDER;
}

function playAlertSound() {
	new Audio(ALERT_SOUND_URL).play();
}

function clearAllCountdownIntervals() {
	activeCountdownIntervals.forEach(({ intervalId }) => clearInterval(intervalId));
	activeCountdownIntervals.clear();
}

function clearAllIndividualMonitors() {
	individualMonitorTimeouts.forEach(clearTimeout);
	individualMonitorTimeouts.clear();
}

function openDB() {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = (event) => {
			console.error("IndexedDB error:", event.target.errorCode);
			reject(event.target.errorCode);
		};
		request.onsuccess = (event) => {
			resolve(event.target.result);
		};
		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(YATA_SPIES_STORE_NAME)) {
				db.createObjectStore(YATA_SPIES_STORE_NAME, { keyPath: "factionID" });
			}
		};
	});
	return dbPromise;
}

async function getSpyDataFromDB(factionID) {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([YATA_SPIES_STORE_NAME], "readonly");
			const store = transaction.objectStore(YATA_SPIES_STORE_NAME);
			const request = store.get(factionID);
			request.onsuccess = (event) => resolve(event.target.result);
			request.onerror = (event) => {
				console.error("Error getting spy data from DB:", event.target.errorCode);
				reject(event.target.errorCode);
			};
		});
	} catch (error) {
		console.error("Failed to open DB for getSpyData:", error);
		return null;
	}
}

async function saveSpyDataToDB(factionID, spyData) {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([YATA_SPIES_STORE_NAME], "readwrite");
			const store = transaction.objectStore(YATA_SPIES_STORE_NAME);
			const item = {
				factionID: factionID,
				data: spyData,
				timestamp: Date.now(),
			};
			const request = store.put(item);
			request.onsuccess = () => resolve();
			request.onerror = (event) => {
				console.error("Error saving spy data to DB:", event.target.errorCode);
				reject(event.target.errorCode);
			};
		});
	} catch (error) {
		console.error("Failed to open DB for saveSpyData:", error);
	}
}

function isCacheValid(cachedItem) {
	if (!cachedItem || !cachedItem.timestamp) return false;
	return Date.now() - cachedItem.timestamp < CACHE_DURATION_MS;
}

async function clearOldSpyDataFromDB() {
	try {
		const db = await openDB();
		const transaction = db.transaction([YATA_SPIES_STORE_NAME], "readwrite");
		const store = transaction.objectStore(YATA_SPIES_STORE_NAME);
		const request = store.openCursor();

		request.onsuccess = (event) => {
			const cursor = event.target.result;
			if (cursor) {
				if (!isCacheValid(cursor.value)) store.delete(cursor.primaryKey);
				cursor.continue();
			}
		};
		request.onerror = (event) => console.error("Error clearing old spy data from DB:", event.target.errorCode);
	} catch (error) {
		console.error("Failed to open DB for clearOldSpyDataFromDB:", error);
	}
}

async function fetchApi(endpoint, selections = "basic", apiKey = currentApiKey) {
	return new Promise((resolve, reject) => {
		const isTornApi = endpoint.startsWith("user/") || endpoint.startsWith("faction/");
		if (isTornApi && (!apiKey || apiKey === API_KEY_PLACEHOLDER)) {
			console.warn("Stakeout Script: Torn API Key not set for endpoint:", endpoint);
			resolve({ error: { error: "API Key not set" } });
			return;
		}
		if (!isTornApi && !apiKey) {
			// console.warn("Stakeout Script: API Key not set for external endpoint:", endpoint);
			resolve({ error: { error: "API Key not set for external service" } });
			return;
		}

		const baseUrl = isTornApi ? "https://api.torn.com/" : "";
		let finalUrl;

		if (isTornApi) {
			finalUrl = `${baseUrl}${endpoint}?key=${apiKey}&selections=${selections}`;
		} else {
			if (endpoint.includes("?")) {
				finalUrl = `${endpoint}&key=${apiKey}`;
			} else {
				finalUrl = `${endpoint}?key=${apiKey}`;
			}
		}

		GM_xmlhttpRequest({
			method: "GET",
			url: finalUrl,
			timeout: 15000,
			onload: function (response) {
				if (response.status >= 200 && response.status < 300) {
					try {
						const data = JSON.parse(response.responseText);
						if (data?.error) {
							const errorMsg = data.error.error || JSON.stringify(data.error);
							console.error(`API Error (${finalUrl.split("?")[0]} - Status ${response.status}):`, errorMsg);
						}
						resolve(data);
					} catch (e) {
						console.error(`Error parsing JSON response from ${finalUrl.split("?")[0]}:`, e, "Response:", response.responseText);
						resolve({ error: { error: "JSON Parse Error", details: e.message, response: response.responseText } });
					}
				} else {
					console.error(`API Request Failed for ${finalUrl.split("?")[0]}: Status ${response.status}`, "Response:", response.responseText);
					try {
						const data = JSON.parse(response.responseText); // Attempt to parse error from body
						resolve(data.error ? data : { error: { error: `HTTP Error ${response.status}`, response: response.responseText } });
					} catch (e) {
						resolve({ error: { error: `HTTP Error ${response.status}`, response: response.responseText } });
					}
				}
			},
			onerror: function (response) {
				console.error(`Network Error for ${finalUrl.split("?")[0]}:`, response);
				resolve({ error: { error: "Network Error", details: response.statusText || "Unknown network issue" } });
			},
			ontimeout: function () {
				console.error(`Request Timeout for ${finalUrl.split("?")[0]}`);
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
	formattedNum = formattedNum.replace(/\.0+$/, "");
	return formattedNum + suffixes[i];
}

function formatSpyTimestamp(unixTimestamp) {
	if (!unixTimestamp || unixTimestamp === 0) return "Unknown age";
	const spyDate = new Date(unixTimestamp * 1000);
	const now = new Date();
	const diffMs = now - spyDate;
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);
	const diffMonths = Math.floor(diffDays / 30.44);
	const diffYears = Math.floor(diffDays / 365.25);

	if (diffYears > 0) return `~${diffYears}y ago`;
	if (diffMonths > 0) return `~${diffMonths}mo ago`;
	if (diffDays > 0) return `~${diffDays}d ago`;
	if (diffHours > 0) return `~${diffHours}h ago`;
	if (diffMinutes > 0) return `~${diffMinutes}m ago`;
	return "Just now";
}

async function fetchYataSpies(factionID) {
	const yataApiKey = localStorage.getItem(YATA_API_KEY_STORAGE_KEY);
	if (!yataApiKey) return null;

	const cachedData = await getSpyDataFromDB(factionID);
	if (cachedData && isCacheValid(cachedData)) return cachedData.data;

	const endpoint = `https://yata.yt/api/v1/spies/?faction=${factionID}`;
	const freshData = await fetchApi(endpoint, "", yataApiKey);

	if (freshData && !freshData.error) {
		await saveSpyDataToDB(factionID, freshData);
		return freshData;
	}
	if (freshData?.error) {
		const errorMessage = freshData.error.error || "Unknown YATA API error";
		const errorCode = freshData.error.code;

		if (errorCode === 2 && (errorMessage.includes("No spies for faction") || errorMessage.includes("No spies") || errorMessage.includes("faction not found")))
			console.log("YATA: No spies for faction ID:", factionID, "or faction not found.");
		else {
			console.error("YATA Spies API Error:", errorMessage, errorCode ? `(Code: ${errorCode})` : `(Details: ${freshData.error.details || "N/A"})`);
			const controlsContainer = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
			if (controlsContainer && !document.getElementById("yata-api-error-message")) {
				const errorMsgElement = createStyledElement(
					"p",
					{ color: "yellow", fontSize: "0.8em", marginLeft: "10px" },
					{ id: "yata-api-error-message", textContent: `YATA API: ${errorMessage.substring(0, 50)}... (see console)` }
				);
				controlsContainer.appendChild(errorMsgElement);
			}
		}
	}
	return null;
}

async function checkIndividualUserAndAlert(alertedUserID) {
	const stakeoutCheckbox = document.getElementById("factionStakeoutCheckbox");
	if ((!stakeoutCheckbox || !stakeoutCheckbox.checked) && individualMonitorTimeouts.has(alertedUserID)) {
		clearTimeout(individualMonitorTimeouts.get(alertedUserID));
		individualMonitorTimeouts.delete(alertedUserID);
		return;
	}

	if (individualMonitorTimeouts.has(alertedUserID)) {
		clearTimeout(individualMonitorTimeouts.get(alertedUserID));
		individualMonitorTimeouts.delete(alertedUserID);
	}

	if (!isApiKeySet()) return;

	const data = await fetchApi(`user/${alertedUserID}`);
	if (data?.error) return;

	if (data?.status?.state === "Okay") {
		if (!previouslyOkayFactionUserIDs.has(alertedUserID)) playAlertSound();
		previouslyOkayFactionUserIDs.add(alertedUserID);

		const memberToUpdate = currentDisplayableMemberStatuses.find((m) => m.userID === alertedUserID);
		if (memberToUpdate) {
			memberToUpdate.status = "Okay";
			memberToUpdate.description = data.status.description || "Available";
			memberToUpdate.durationSeconds = 0;
			memberToUpdate.lastActionStatus = data.last_action?.status || memberToUpdate.lastActionStatus;
		}

		if (activeCountdownIntervals.has(alertedUserID)) {
			clearInterval(activeCountdownIntervals.get(alertedUserID).intervalId);
			activeCountdownIntervals.delete(alertedUserID);
		}

		const currentFactionID = new URLSearchParams(window.location.search).get("ID");
		if (currentFactionID) updateFactionDisplay(currentDisplayableMemberStatuses, currentFactionID);
	}
}

function createMemberElement(member, categoryName) {
	const isTimedStatus = categoryName.includes("Hospital") || categoryName.includes("Jail") || categoryName.includes("Traveling");

	if (isTimedStatus && member.durationSeconds < CRITICAL_TIME_THRESHOLD && member.durationSeconds !== Infinity && member.durationSeconds > 0) {
		if (!individualMonitorTimeouts.has(member.userID)) {
			const checkDelayMs = Math.max(1000, member.durationSeconds * 1000);
			const timeoutId = setTimeout(() => checkIndividualUserAndAlert(member.userID), checkDelayMs);
			individualMonitorTimeouts.set(member.userID, timeoutId);
		}
	}

	const memberDiv = createStyledElement("div", {
		padding: "6px 8px",
		fontSize: "0.9em",
		backgroundColor: "#383838",
		borderRadius: "3px",
		borderLeft: "3px solid transparent",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "flex-start",
		position: "relative",
	});

	let statusColor = "white";
	if (member.status === "Okay") statusColor = "#4CAF50";
	else if (member.status.includes("Hospital")) statusColor = "#FF9800";
	else if (member.status === "Traveling") statusColor = "#2196F3";
	else if (member.status === "Abroad") statusColor = "#9C27B0";
	else if (member.status.includes("Jail")) statusColor = member.status.includes("Federal") ? "#f44336" : "#FFEB3B";
	memberDiv.style.borderLeftColor = statusColor;

	const memberInfoContainer = createStyledElement("div", { display: "flex", flexDirection: "column", flexGrow: 1, marginRight: "8px" });
	const onlineStatusIcon = createStyledElement("span", { width: "10px", height: "10px", borderRadius: "50%", marginRight: "6px", flexShrink: 0 });
	if (member.lastActionStatus === "Online") onlineStatusIcon.style.backgroundColor = "#4CAF50";
	else if (member.lastActionStatus === "Idle") onlineStatusIcon.style.backgroundColor = "#FF9800";
	else onlineStatusIcon.style.backgroundColor = "#9E9E9E";

	const nameSpan = createStyledElement("span", { fontWeight: "bold", color: "#E0E0E0" }, { textContent: member.name });
	const nameContainer = createStyledElement("div", { display: "flex", alignItems: "center", marginBottom: "1px" });
	nameContainer.append(onlineStatusIcon, nameSpan);

	const statusDescSpan = createStyledElement(
		"span",
		{ color: "#B0B0B0", fontSize: "0.85em", display: "block", marginTop: "2px" },
		{ id: `status-desc-${member.userID}`, textContent: `(${member.description})` }
	);
	memberInfoContainer.append(nameContainer, statusDescSpan);

	if (isTimedStatus && member.durationSeconds < 60 && member.durationSeconds !== Infinity && member.durationSeconds > 0) {
		if (activeCountdownIntervals.has(member.userID)) clearInterval(activeCountdownIntervals.get(member.userID).intervalId);
		const endTime = Date.now() + member.durationSeconds * 1000;
		const baseDescriptionForTimer = member.description;
		const intervalId = setInterval(() => {
			const remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
			const currentDescSpan = document.getElementById(`status-desc-${member.userID}`);
			if (currentDescSpan) currentDescSpan.textContent = `(${formatTimeDescription(baseDescriptionForTimer, remainingSeconds)})`;
			if (remainingSeconds <= 0) {
				clearInterval(intervalId);
				activeCountdownIntervals.delete(member.userID);
			}
		}, 1000);
		activeCountdownIntervals.set(member.userID, { intervalId, originalDescription: baseDescriptionForTimer });
		statusDescSpan.textContent = `(${formatTimeDescription(baseDescriptionForTimer, Math.max(0, member.durationSeconds))})`;
	} else if (activeCountdownIntervals.has(member.userID)) {
		clearInterval(activeCountdownIntervals.get(member.userID).intervalId);
		activeCountdownIntervals.delete(member.userID);
	}

	const actionsContainer = createStyledElement("div", { display: "flex", gap: "5px", flexShrink: 0, alignItems: "center" });

	if (member.yataSpyData && (member.yataSpyData.total > 0 || Object.values(member.yataSpyData).some((v) => typeof v === "number" && v > 0 && v !== -1))) {
		const spyButton = createStyledElement(
			"button",
			{
				padding: "3px 5px",
				fontSize: "1em",
				color: "#f0f0f0",
				backgroundColor: "#555",
				textDecoration: "none",
				borderRadius: "3px",
				border: "1px solid #5a6268",
				cursor: "pointer",
				display: "inline-flex",
				alignItems: "center",
				lineHeight: "1",
			},
			{ innerHTML: "🕵️‍♂️" }
		);

		spyButton.onmouseover = (event) => {
			let tooltip = document.getElementById(SPY_TOOLTIP_ID);
			if (!tooltip) {
				tooltip = createStyledElement(
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
					{ id: SPY_TOOLTIP_ID }
				);
				document.body.appendChild(tooltip);
			}

			const spy = member.yataSpyData;
			let tooltipHTML = `
                <div style="font-family: Verdana, Arial, sans-serif;">
                    <div style="font-size: 1.15em; font-weight: bold; color: #76D7C4; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #4a4a4a; text-align: center;">
                        YATA Spy Report
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 5px 12px; margin-bottom: 10px; font-size: 0.95em;">
                        <span style="font-weight: bold; color: #ccc;">Str:</span> <span style="color: #f0f0f0; text-align: right;">${formatStatValue(spy.strength)}</span>
                        <span style="font-weight: bold; color: #ccc;">Def:</span> <span style="color: #f0f0f0; text-align: right;">${formatStatValue(spy.defense)}</span>
                        <span style="font-weight: bold; color: #ccc;">Spd:</span> <span style="color: #f0f0f0; text-align: right;">${formatStatValue(spy.speed)}</span>
                        <span style="font-weight: bold; color: #ccc;">Dex:</span> <span style="color: #f0f0f0; text-align: right;">${formatStatValue(spy.dexterity)}</span>
                    </div>
                    <div style="font-size: 1em; margin-bottom: 8px; padding-top: 8px; border-top: 1px solid #4a4a4a; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: #ddd;">Total:</span>
                        <span style="font-weight: bold; color: #58D68D; font-size: 1.1em;">${formatStatValue(spy.total)}</span>
                    </div>
                    <div style="font-size: 0.85em; color: #999; text-align: right; margin-top: 5px;">
                        ${formatSpyTimestamp(
													spy.update ||
														Math.max(spy.strength_timestamp || 0, spy.speed_timestamp || 0, spy.defense_timestamp || 0, spy.dexterity_timestamp || 0, spy.total_timestamp || 0)
												)}
                    </div>
                </div>
            `;
			tooltip.innerHTML = tooltipHTML;

			const rect = spyButton.getBoundingClientRect();
			let topPosition = rect.bottom + window.scrollY + 7;
			let leftPosition = rect.left + window.scrollX;

			tooltip.style.display = "block";

			if (leftPosition + tooltip.offsetWidth > window.innerWidth - 10) leftPosition = rect.right + window.scrollX - tooltip.offsetWidth;
			if (leftPosition < 10) leftPosition = 10;
			if (topPosition + tooltip.offsetHeight > window.innerHeight - 10) topPosition = rect.top + window.scrollY - tooltip.offsetHeight - 7;
			if (topPosition < 10) topPosition = 10;

			tooltip.style.left = `${leftPosition}px`;
			tooltip.style.top = `${topPosition}px`;
		};
		spyButton.onmouseout = () => {
			const tooltip = document.getElementById(SPY_TOOLTIP_ID);
			if (tooltip) tooltip.style.display = "none";
		};
		actionsContainer.appendChild(spyButton);
	}

	const profileButton = createStyledElement(
		"a",
		{
			padding: "3px 5px",
			fontSize: "1em",
			color: "#f0f0f0",
			backgroundColor: "#555",
			textDecoration: "none",
			borderRadius: "3px",
			border: "1px solid #666",
			cursor: "pointer",
			display: "inline-flex",
			alignItems: "center",
			lineHeight: "1",
		},
		{ href: `https://www.torn.com/profiles.php?XID=${member.userID}`, target: "_blank", title: "View Profile", innerHTML: "👤" }
	);
	profileButton.onmouseover = () => (profileButton.style.backgroundColor = "#666");
	profileButton.onmouseout = () => (profileButton.style.backgroundColor = "#555");

	const attackButton = createStyledElement(
		"a",
		{
			padding: "3px 5px",
			fontSize: "1em",
			color: "#f0f0f0",
			backgroundColor: "#c0392b",
			textDecoration: "none",
			borderRadius: "3px",
			border: "1px solid #a93226",
			cursor: "pointer",
			display: "inline-flex",
			alignItems: "center",
			lineHeight: "1",
		},
		{ href: `https://www.torn.com/loader.php?sid=attack&user2ID=${member.userID}`, target: "_blank", title: "Attack User", innerHTML: "⚔️" }
	);
	attackButton.onmouseover = () => (attackButton.style.backgroundColor = "#d64537");
	attackButton.onmouseout = () => (attackButton.style.backgroundColor = "#c0392b");

	actionsContainer.append(profileButton, attackButton);
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

	const storageKey = `${CATEGORY_STATE_PREFIX}${factionID}_${categoryName.replace(/\s+/g, "_")}`;
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
		const isCurrentlyCollapsed = memberListDiv.style.display === "none";
		memberListDiv.style.display = isCurrentlyCollapsed ? "grid" : "none";
		updateHeaderContent(!isCurrentlyCollapsed);
		localStorage.setItem(storageKey, JSON.stringify(!isCurrentlyCollapsed));
	});

	membersInCategory.forEach((member) => memberListDiv.appendChild(createMemberElement(member, categoryName)));
	categoryDiv.append(categoryHeader, memberListDiv);
	return categoryDiv;
}

function updateFactionDisplay(memberStatusesToDisplay, factionID) {
	let displayContainer = document.getElementById(DISPLAY_CONTAINER_ID);
	let contentWrapper;

	if (!displayContainer) {
		const isMainCollapsedStored = localStorage.getItem(MAIN_DISPLAY_COLLAPSED_KEY) === "true";
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
				display: isMainCollapsedStored ? "none" : "block",
			},
			{ id: DISPLAY_CONTAINER_ID }
		);
		contentWrapper = createStyledElement("div", {}, { id: CONTENT_WRAPPER_ID });
		displayContainer.appendChild(contentWrapper);

		const targetElement = document.querySelector(FACTION_STATUS_SELECTOR);
		if (targetElement) {
			const controlsContainer = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
			if (controlsContainer?.parentNode === targetElement && controlsContainer.nextSibling) targetElement.insertBefore(displayContainer, controlsContainer.nextSibling);
			else if (controlsContainer?.parentNode === targetElement) targetElement.appendChild(displayContainer);
			else targetElement.insertBefore(displayContainer, targetElement.firstChild);
		}
	} else {
		contentWrapper = document.getElementById(CONTENT_WRAPPER_ID);
		contentWrapper.innerHTML = "";
	}

	if (!isApiKeySet()) {
		contentWrapper.innerHTML = '<p style="color: #ffcc00; text-align: center; padding: 20px;">Please set your API Key using the button above to view faction member statuses.</p>';
		return;
	}

	const currentMemberIDsInDisplay = new Set(memberStatusesToDisplay.map((m) => m.userID));
	activeCountdownIntervals.forEach((countdownData, userIdString) => {
		const userId = userIdString;
		const memberInNewData = memberStatusesToDisplay.find((m) => m.userID === userId);
		let shouldClear = true;
		if (memberInNewData) {
			const duration = memberInNewData.durationSeconds ?? parseTimeToSeconds(memberInNewData.description);
			const isEligibleForCountdown =
				duration < 60 &&
				duration !== Infinity &&
				duration > 0 &&
				(memberInNewData.status.includes("Hospital") || memberInNewData.status.includes("Jail") || memberInNewData.status.includes("Traveling"));
			if (isEligibleForCountdown) shouldClear = false;
		}
		if (shouldClear || !currentMemberIDsInDisplay.has(userId)) {
			clearInterval(countdownData.intervalId);
			activeCountdownIntervals.delete(userId);
		}
	});

	const categorizedMembers = Object.fromEntries(CATEGORY_ORDER.map((cat) => [cat, []]));
	memberStatusesToDisplay.forEach((member) => {
		member.durationSeconds = member.durationSeconds ?? parseTimeToSeconds(member.description);
		const { status, description } = member;
		const descLower = description.toLowerCase();
		if (status === "Hospital") {
			if (descLower.includes(" hospital in ") || (descLower.includes("in a ") && descLower.includes(" hospital")))
				categorizedMembers[STATUS_CATEGORIES.HOSPITAL_ABROAD].push(member);
			else categorizedMembers[STATUS_CATEGORIES.HOSPITAL_TORN].push(member);
		} else if (status === "Traveling") categorizedMembers[STATUS_CATEGORIES.TRAVELING].push(member);
		else if (status === "Abroad") categorizedMembers[STATUS_CATEGORIES.ABROAD_NOT_HOSPITALIZED].push(member);
		else if (status.includes("Jail")) categorizedMembers[STATUS_CATEGORIES.JAIL].push(member);
		else if (status === "Okay") categorizedMembers[STATUS_CATEGORIES.OKAY].push(member);
		else categorizedMembers[STATUS_CATEGORIES.OTHER].push(member);
	});

	CATEGORY_ORDER.forEach((categoryName) => {
		const membersInCategory = categorizedMembers[categoryName];
		if (membersInCategory.length === 0) return;
		membersInCategory.sort((a, b) => {
			const durA = a.durationSeconds;
			const durB = b.durationSeconds;
			if (durA !== Infinity && durB !== Infinity) {
				if (durA !== durB) return durA - durB;
			} else if (durA !== Infinity) return -1;
			else if (durB !== Infinity) return 1;
			return a.name.localeCompare(b.name);
		});
		contentWrapper.appendChild(createCategoryElement(categoryName, membersInCategory, factionID));
	});
}

async function fetchMonitorAndUpdate(factionID, stakeoutCheckbox) {
	if (!isApiKeySet()) {
		updateFactionDisplay([], factionID);
		return;
	}

	const usersOkayInPreviousCycle = new Set(previouslyOkayFactionUserIDs);
	previouslyOkayFactionUserIDs.clear();
	document.getElementById("yata-api-error-message")?.remove();

	const tornFactionData = await fetchApi(`faction/${factionID}`);
	if (tornFactionData?.error || !tornFactionData?.members) {
		console.error("Error fetching or processing faction data:", tornFactionData?.error?.error || "No member data");
		const contentWrapper = document.getElementById(CONTENT_WRAPPER_ID);
		if (contentWrapper) {
			contentWrapper.innerHTML = `<p style="color: #ff6666; text-align: center; padding: 10px;">Error fetching faction data: ${
				tornFactionData?.error?.error || "No member data"
			}. Check API key and network.</p>`;
		}
		return;
	}

	const yataFullResponse = await fetchYataSpies(factionID);
	currentYataSpies = yataFullResponse ? yataFullResponse.spies : {};

	currentDisplayableMemberStatuses = Object.entries(tornFactionData.members).map(([userID, memberData]) => ({
		userID,
		name: memberData.name,
		status: memberData.status.state,
		description: memberData.status.description,
		durationSeconds: parseTimeToSeconds(memberData.status.description),
		lastActionStatus: memberData.last_action?.status || "Offline",
		yataSpyData: currentYataSpies[userID] || null,
	}));

	let newlyOkayPlayerDetected = false;
	currentDisplayableMemberStatuses.forEach((member) => {
		if (member.status === "Okay") {
			previouslyOkayFactionUserIDs.add(member.userID);
			if (!usersOkayInPreviousCycle.has(member.userID)) newlyOkayPlayerDetected = true;
		}
	});

	if (stakeoutCheckbox?.checked && newlyOkayPlayerDetected) playAlertSound();
	updateFactionDisplay(currentDisplayableMemberStatuses, factionID);
}

function closeSpiesModal() {
	const overlay = document.getElementById(SPIES_MODAL_OVERLAY_ID);
	if (overlay) {
		overlay.remove();
	}
	if (spiesModalEscapeKeyListener) {
		document.removeEventListener("keydown", spiesModalEscapeKeyListener);
		spiesModalEscapeKeyListener = null;
	}
}

function saveSpyApiKeys() {
	const yataKeyInput = document.getElementById(YATA_API_KEY_INPUT_ID);
	const tsKeyInput = document.getElementById(TORNSTATS_API_KEY_INPUT_ID);

	if (yataKeyInput.value.trim()) localStorage.setItem(YATA_API_KEY_STORAGE_KEY, yataKeyInput.value.trim());
	else localStorage.removeItem(YATA_API_KEY_STORAGE_KEY);

	if (tsKeyInput.value.trim()) localStorage.setItem(TORNSTATS_API_KEY_STORAGE_KEY, tsKeyInput.value.trim());
	else localStorage.removeItem(TORNSTATS_API_KEY_STORAGE_KEY);
	closeSpiesModal();

	const currentFactionID = new URLSearchParams(window.location.search).get("ID");
	const stakeoutCheckbox = document.getElementById("factionStakeoutCheckbox");
	if (currentFactionID && stakeoutCheckbox) {
		clearSpyDataForFactionFromDB(currentFactionID).then(() => fetchMonitorAndUpdate(currentFactionID, stakeoutCheckbox));
	}
}

async function clearSpyDataForFactionFromDB(factionID) {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([YATA_SPIES_STORE_NAME], "readwrite");
			const store = transaction.objectStore(YATA_SPIES_STORE_NAME);
			const request = store.delete(factionID);
			request.onsuccess = () => resolve();
			request.onerror = (event) => {
				console.error("Error deleting spy data for faction from DB:", event.target.errorCode);
				reject(event.target.errorCode);
			};
		});
	} catch (error) {
		console.error("Failed to open DB for clearSpyDataForFaction:", error);
	}
}

function openSpiesModal() {
	if (document.getElementById(SPIES_MODAL_ID)) return;
	if (spiesModalEscapeKeyListener) {
		document.removeEventListener("keydown", spiesModalEscapeKeyListener);
		spiesModalEscapeKeyListener = null;
	}

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
		{ id: SPIES_MODAL_OVERLAY_ID }
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
		{ id: SPIES_MODAL_ID }
	);
	const title = createStyledElement(
		"h2",
		{
			margin: "0 0 15px 0",
			color: "#76D7C4",
			textAlign: "center",
			borderBottom: "1px solid #444",
			paddingBottom: "10px",
		},
		{ textContent: "Configure Spy Data Sources" }
	);
	const description = createStyledElement(
		"p",
		{
			fontSize: "0.9em",
			color: "#ccc",
			marginBottom: "20px",
			lineHeight: "1.5",
		},
		{
			innerHTML:
				"Enter your API key(s) for YATA and/or TornStats to fetch spy data for faction members. <br>Make sure these are the same API key(s) you use specific to those services.",
		}
	);
	const cardsContainer = createStyledElement("div", { display: "flex", flexDirection: "column", gap: "20px", marginBottom: "25px" });
	const yataCard = createStyledElement("div", { backgroundColor: "#3a3a3a", padding: "15px", borderRadius: "6px", borderLeft: "4px solid #2980B9" });
	const yataTitle = createStyledElement("h3", { margin: "0 0 10px 0", color: "#AED6F1" }, { textContent: "YATA" });
	const yataInput = createStyledElement(
		"input",
		{
			width: "calc(100% - 12px)",
			padding: "8px",
			borderRadius: "3px",
			border: "1px solid #555",
			backgroundColor: "#222",
			color: "#f0f0f0",
			fontSize: "0.9em",
		},
		{ type: "text", id: YATA_API_KEY_INPUT_ID, value: localStorage.getItem(YATA_API_KEY_STORAGE_KEY) || "" }
	);
	yataCard.append(yataTitle, yataInput);
	const tsCard = createStyledElement("div", { backgroundColor: "#3a3a3a", padding: "15px", borderRadius: "6px", borderLeft: "4px solid #AF7AC5" });
	const tsTitle = createStyledElement("h3", { margin: "0 0 10px 0", color: "#D7BDE2" }, { textContent: "TornStats - Not built yet" });
	const tsInput = createStyledElement(
		"input",
		{
			width: "calc(100% - 12px)",
			padding: "8px",
			borderRadius: "3px",
			border: "1px solid #555",
			backgroundColor: "#222",
			color: "#f0f0f0",
			fontSize: "0.9em",
		},
		{ type: "text", id: TORNSTATS_API_KEY_INPUT_ID, value: localStorage.getItem(TORNSTATS_API_KEY_STORAGE_KEY) || "" }
	);
	tsCard.append(tsTitle, tsInput);
	cardsContainer.append(yataCard, tsCard);
	const actionsContainer = createStyledElement("div", { display: "flex", justifyContent: "flex-end", gap: "10px" });
	const saveButton = createStyledElement(
		"button",
		{
			padding: "8px 15px",
			backgroundColor: "#4CAF50",
			color: "white",
			border: "none",
			borderRadius: "4px",
			cursor: "pointer",
			fontSize: "0.95em",
		},
		{ textContent: "Save & Close" }
	);
	saveButton.onmouseover = () => (saveButton.style.backgroundColor = "#45a049");
	saveButton.onmouseout = () => (saveButton.style.backgroundColor = "#4CAF50");
	saveButton.addEventListener("click", saveSpyApiKeys);
	const closeButton = createStyledElement(
		"button",
		{
			padding: "8px 15px",
			backgroundColor: "#777",
			color: "white",
			border: "none",
			borderRadius: "4px",
			cursor: "pointer",
			fontSize: "0.95em",
		},
		{ textContent: "Cancel" }
	);
	closeButton.onmouseover = () => (closeButton.style.backgroundColor = "#888");
	closeButton.onmouseout = () => (closeButton.style.backgroundColor = "#777");
	closeButton.addEventListener("click", closeSpiesModal);
	actionsContainer.append(closeButton, saveButton);
	modal.append(title, description, cardsContainer, actionsContainer);
	overlay.appendChild(modal);
	document.body.appendChild(overlay);

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) closeSpiesModal();
	});

	spiesModalEscapeKeyListener = (e) => {
		if (e.key === "Escape") {
			closeSpiesModal();
		}
	};
	document.addEventListener("keydown", spiesModalEscapeKeyListener);
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
	[30, 60].forEach((val) => intervalDropdown.add(createStyledElement("option", { backgroundColor: "#222", color: "white" }, { value: val, text: val.toString() })));
	intervalDropdown.value = "30";
	monitorControls.append(
		stakeoutCheckbox,
		createStyledElement("label", { marginRight: "5px", cursor: "pointer" }, { htmlFor: "factionStakeoutCheckbox", textContent: "Monitor faction every" }),
		intervalDropdown,
		createStyledElement("label", { cursor: "pointer" }, { htmlFor: "factionStakeoutInterval", textContent: "seconds" })
	);
	const apiKeyControls = createStyledElement("div", { display: "flex", alignItems: "center" });
	const apiKeyButton = createStyledElement(
		"button",
		{ padding: "4px 8px", backgroundColor: "#555", color: "white", border: "1px solid #666", borderRadius: "3px", cursor: "pointer", marginLeft: "10px" },
		{ id: "stakeoutApiKeyButton" }
	);
	const updateButtonText = () => (apiKeyButton.textContent = isApiKeySet() ? "Change API Key" : "Set API Key");
	updateButtonText();
	apiKeyButton.addEventListener("click", () => {
		const newKey = prompt("Please enter your Torn API key:", isApiKeySet() ? currentApiKey : "");
		if (newKey !== null) {
			currentApiKey = newKey.trim() || API_KEY_PLACEHOLDER;
			if (currentApiKey === API_KEY_PLACEHOLDER) localStorage.removeItem("stakeoutUserApiKey");
			else localStorage.setItem("stakeoutUserApiKey", currentApiKey);
			previouslyOkayFactionUserIDs.clear();
			updateButtonText();
			fetchMonitorAndUpdate(factionID, stakeoutCheckbox);
		}
	});
	apiKeyControls.appendChild(apiKeyButton);
	const displayToggleControls = createStyledElement("div", { display: "flex", alignItems: "center" });
	const isInitiallyCollapsed = localStorage.getItem(MAIN_DISPLAY_COLLAPSED_KEY) === "true";
	const toggleDisplayButton = createStyledElement(
		"button",
		{ padding: "4px 8px", backgroundColor: "#555", color: "white", border: "1px solid #666", borderRadius: "3px", cursor: "pointer", marginLeft: "10px" },
		{ textContent: isInitiallyCollapsed ? TEXT_SHOW_LIST : TEXT_HIDE_LIST }
	);
	toggleDisplayButton.addEventListener("click", () => {
		const displayDiv = document.getElementById(DISPLAY_CONTAINER_ID);
		if (displayDiv) {
			const isCurrentlyHidden = displayDiv.style.display === "none";
			displayDiv.style.display = isCurrentlyHidden ? "block" : "none";
			toggleDisplayButton.textContent = isCurrentlyHidden ? TEXT_HIDE_LIST : TEXT_SHOW_LIST;
			localStorage.setItem(MAIN_DISPLAY_COLLAPSED_KEY, JSON.stringify(!isCurrentlyHidden));
		}
	});
	displayToggleControls.appendChild(toggleDisplayButton);
	const spiesControls = createStyledElement("div", { display: "flex", alignItems: "center" });
	const spiesButton = createStyledElement(
		"button",
		{ padding: "4px 8px", backgroundColor: "rgb(66 71 207)", color: "white", border: "1px solid rgb(66 71 207)", borderRadius: "3px", cursor: "pointer", marginLeft: "10px" },
		{ textContent: "Spies Config" }
	);
	spiesButton.onmouseover = () => (spiesButton.style.backgroundColor = "#2E86C1");
	spiesButton.onmouseout = () => (spiesButton.style.backgroundColor = "rgb(66 71 207)");
	spiesButton.addEventListener("click", openSpiesModal);
	spiesControls.appendChild(spiesButton);
	controlsContainer.append(monitorControls, apiKeyControls, displayToggleControls, spiesControls);
	const startMonitoring = (intervalSeconds) => {
		if (monitorIntervalId) clearInterval(monitorIntervalId);
		clearAllIndividualMonitors();
		clearAllCountdownIntervals();
		fetchMonitorAndUpdate(factionID, stakeoutCheckbox);
		monitorIntervalId = setInterval(() => fetchMonitorAndUpdate(factionID, stakeoutCheckbox), intervalSeconds * 1000);
	};
	const stopMonitoring = () => {
		if (monitorIntervalId) clearInterval(monitorIntervalId);
		monitorIntervalId = null;
		clearAllIndividualMonitors();
		clearAllCountdownIntervals();
		previouslyOkayFactionUserIDs.clear();
		currentYataSpies = {};
		document.getElementById("yata-api-error-message")?.remove();
	};
	stakeoutCheckbox.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) startMonitoring(parseInt(intervalDropdown.value));
		else stopMonitoring();
	});
	intervalDropdown.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) startMonitoring(parseInt(intervalDropdown.value));
	});
	factionPageElement.insertBefore(controlsContainer, factionPageElement.firstChild);
}

function initialFactionLoad(factionID) {
	fetchMonitorAndUpdate(factionID, { checked: false });
}

function addStakeoutElementsToProfiles(statusElement) {
	let intervalId = null;
	let profileUserWasOkay = false;
	const stakeoutContainer = createStyledElement("div", { float: "right", paddingRight: "10px", display: "flex", alignItems: "center" });
	const stakeoutCheckbox = createStyledElement("input", { marginRight: "5px", cursor: "pointer" }, { type: "checkbox", id: "stakeoutCheckbox" });
	const intervalDropdown = createStyledElement("select", { marginRight: "5px" }, { id: "stakeoutInterval" });
	[1, 2, 3, 4, 5, 30, 60].forEach((val) => intervalDropdown.add(createStyledElement("option", {}, { value: val, text: val.toString() })));
	stakeoutContainer.append(
		stakeoutCheckbox,
		createStyledElement("label", { marginRight: "5px", cursor: "pointer" }, { htmlFor: "stakeoutCheckbox", textContent: "Check status every" }),
		intervalDropdown,
		createStyledElement("label", { cursor: "pointer" }, { htmlFor: "stakeoutInterval", textContent: "seconds" })
	);
	const startStakeout = async (intervalSeconds) => {
		if (intervalId) clearInterval(intervalId);
		const userID = new URLSearchParams(window.location.search).get("XID");
		if (!userID || !isApiKeySet()) {
			if (!isApiKeySet()) alert("Please set your API key on a faction page first to use profile stakeout.");
			stakeoutCheckbox.checked = false;
			return;
		}
		const isNowOkay = await checkUserStatus(userID);
		if (isNowOkay) {
			if (!profileUserWasOkay) playAlertSound();
			profileUserWasOkay = true;
			stakeoutCheckbox.checked = false;
			return;
		} else profileUserWasOkay = false;
		intervalId = setInterval(async () => {
			const isCurrentlyOkay = await checkUserStatus(userID);
			if (isCurrentlyOkay) {
				if (!profileUserWasOkay) playAlertSound();
				profileUserWasOkay = true;
				clearInterval(intervalId);
				intervalId = null;
				stakeoutCheckbox.checked = false;
			} else profileUserWasOkay = false;
		}, intervalSeconds * 1000);
	};
	const stopStakeout = () => {
		if (intervalId) clearInterval(intervalId);
		intervalId = null;
	};
	stakeoutCheckbox.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) {
			profileUserWasOkay = false;
			startStakeout(parseInt(intervalDropdown.value));
		} else stopStakeout();
	});
	intervalDropdown.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) startStakeout(parseInt(intervalDropdown.value));
	});
	statusElement.appendChild(stakeoutContainer);
}

function observe() {
	clearOldSpyDataFromDB();

	if (window.StakeOutInterval) clearInterval(window.StakeOutInterval);
	window.StakeOutInterval = setInterval(() => {
		const profileStatusElement = document.querySelector(PROFILE_STATUS_SELECTOR);
		if (profileStatusElement && !document.getElementById("stakeoutCheckbox")) addStakeoutElementsToProfiles(profileStatusElement);
		const factionProfileElement = document.querySelector(FACTION_STATUS_SELECTOR);
		if (factionProfileElement) {
			if (!document.getElementById(FACTION_CONTROLS_CONTAINER_ID)) {
				const factionID = new URLSearchParams(window.location.search).get("ID");
				if (factionID) {
					addFactionStakeoutElements(factionProfileElement, factionID);
					if (!document.getElementById(DISPLAY_CONTAINER_ID)) initialFactionLoad(factionID);
				}
			}
		}
		if ((profileStatusElement && document.getElementById("stakeoutCheckbox")) || (factionProfileElement && document.getElementById(FACTION_CONTROLS_CONTAINER_ID)))
			clearInterval(window.StakeOutInterval);
	}, 500);
}

observe();
