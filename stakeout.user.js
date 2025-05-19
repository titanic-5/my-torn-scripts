// ==UserScript==
// @name         Stakeout Script
// @namespace    http://tampermonkey.net/
// @version      2.4.0
// @description  Stakeout factions or individual users
// @author       Titanic_
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://www.torn.com/factions.php?step=profile&ID=*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/stakeout.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/stakeout.user.js
// @grant        none
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

let individualMonitorTimeouts = new Map();
let activeCountdownIntervals = new Map();
let currentDisplayableMemberStatuses = [];
let previouslyOkayFactionUserIDs = new Set();

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
	else if (remainingSeconds < 60) newTimeValue = `${remainingSeconds}s`; // seconds only
	else if (remainingSeconds < 3600) {
		// minutes and seconds
		const mins = Math.floor(remainingSeconds / 60);
		const secs = remainingSeconds % 60;
		newTimeValue = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
	} else if (remainingSeconds < 86400) {
		// hours and minutes
		const hrs = Math.floor(remainingSeconds / 3600);
		const mins = Math.floor((remainingSeconds % 3600) / 60);
		newTimeValue = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
	} else {
		// days and hours
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

async function fetchApi(endpoint, selections = "basic") {
	if (!isApiKeySet()) return { error: { error: "API Key not set" } };

	try {
		const url = `https://api.torn.com/${endpoint}?key=${currentApiKey}&selections=${selections}`;
		const response = await fetch(url);
		const data = await response.json();
		if (data?.error) console.error(`API Error (${endpoint}):`, data.error.error);
		return data;
	} catch (error) {
		console.error(`Error fetching API (${endpoint}):`, error);
		return { error: { error: "Network or fetch error" } };
	}
}

async function checkUserStatus(userID) {
	const data = await fetchApi(`user/${userID}`);
	return !data?.error && data?.status?.state === "Okay";
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
	});

	let statusColor = "white";
	if (member.status === "Okay") statusColor = "#4CAF50"; // Green
	else if (member.status.includes("Hospital")) statusColor = "#FF9800"; // Orange
	else if (member.status === "Traveling") statusColor = "#2196F3"; // Blue
	else if (member.status === "Abroad") statusColor = "#9C27B0"; // Purple
	else if (member.status.includes("Jail")) statusColor = member.status.includes("Federal") ? "#f44336" : "#FFEB3B"; // Red (Fed) or Yellow
	memberDiv.style.borderLeftColor = statusColor;

	const memberInfoContainer = createStyledElement("div", { display: "flex", flexDirection: "column", flexGrow: 1, marginRight: "8px" });

	const onlineStatusIcon = createStyledElement("span", {
		width: "10px",
		height: "10px",
		borderRadius: "50%",
		marginRight: "6px",
		flexShrink: 0,
	});

	if (member.lastActionStatus === "Online") onlineStatusIcon.style.backgroundColor = "#4CAF50"; // Green
	else if (member.lastActionStatus === "Idle") onlineStatusIcon.style.backgroundColor = "#FF9800"; // Orange
	else onlineStatusIcon.style.backgroundColor = "#9E9E9E"; // Grey

	const nameColor = member.status.includes("Jail") && !member.status.includes("Federal") ? "#333" : "#E0E0E0";
	const nameSpan = createStyledElement("span", { fontWeight: "bold", color: nameColor }, { textContent: member.name });

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
				duration < 60 && duration !== Infinity && duration > 0 && (memberInNewData.status.includes("Hospital") || memberInNewData.status.includes("Jail"));
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

	const data = await fetchApi(`faction/${factionID}`);
	if (data?.error || !data?.members) {
		console.error("Error fetching or processing faction data:", data?.error?.error || "No member data");
		const contentWrapper = document.getElementById(CONTENT_WRAPPER_ID);
		if (contentWrapper) {
			contentWrapper.innerHTML = `<p style="color: #ff6666; text-align: center; padding: 10px;">Error fetching faction data: ${
				data?.error?.error || "No member data"
			}. Check API key and network.</p>`;
		}
		return;
	}

	currentDisplayableMemberStatuses = Object.entries(data.members).map(([userID, memberData]) => ({
		userID,
		name: memberData.name,
		status: memberData.status.state,
		description: memberData.status.description,
		durationSeconds: parseTimeToSeconds(memberData.status.description),
		lastActionStatus: memberData.last_action?.status || "Offline",
	}));

	let newlyOkayPlayerDetected = false;
	currentDisplayableMemberStatuses.forEach((member) => {
		if (member.status === "Okay") {
			previouslyOkayFactionUserIDs.add(member.userID);
			if (!usersOkayInPreviousCycle.has(member.userID)) {
				newlyOkayPlayerDetected = true;
			}
		}
	});

	if (stakeoutCheckbox?.checked && newlyOkayPlayerDetected) playAlertSound();
	updateFactionDisplay(currentDisplayableMemberStatuses, factionID);
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

	controlsContainer.append(monitorControls, apiKeyControls, displayToggleControls);

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
