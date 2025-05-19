// ==UserScript==
// @name         Stakeout Script
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Alerts when a Torn user leaves the hospital or monitors faction members with API key management and precise individual checks.
// @author       Titanic_
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://www.torn.com/factions.php?step=profile&ID=*
// @grant        none
// ==/UserScript==

const API_KEY_PLACEHOLDER = "YOUR_API_KEY_HERE";
let currentApiKey = localStorage.getItem("stakeoutUserApiKey") || API_KEY_PLACEHOLDER;

const PROFILE_STATUS_SELECTOR = "#profileroot div.profile-status div.title-black.top-round";
const FACTION_STATUS_SELECTOR = "div#factions > div#react-root"; // Torn's container for faction page content
const ALERT_SOUND = "https://www.myinstants.com/media/sounds/alert.mp3";

const DISPLAY_CONTAINER_ID = "faction-members-status-display";
const CONTENT_WRAPPER_ID = "faction-members-content-wrapper";
const CRITICAL_TIME_THRESHOLD = 40;
const FACTION_CONTROLS_CONTAINER_ID = "stakeout-faction-controls-container"; // ID for our main controls bar

let individualMonitorTimeouts = new Map();
let currentDisplayableMemberStatuses = []; // To hold the last rendered member list for immediate UI updates

function createStyledElement(tag, styles, attributes = {}) {
	const element = document.createElement(tag);
	Object.assign(element.style, styles);
	Object.assign(element, attributes);
	return element;
}
function parseTimeToSeconds(description) {
	if (!description) return Infinity;
	const descLower = description.toLowerCase();
	let totalSeconds = 0;
	const timePattern =
		/(?:for|in|lands in)\s+(?=(?:(?:\d+\s*(?:days?|d))|(?:\d+\s*(?:hours?|hrs?|h))|(?:\d+\s*(?:minutes?|mins?|m))|(?:\d+\s*(?:seconds?|secs?|s))))(?:(\d+)\s*(?:days?|d))?\s*(?:(\d+)\s*(?:hours?|hrs?|h))?\s*(?:(\d+)\s*(?:minutes?|mins?|m))?\s*(?:(\d+)\s*(?:seconds?|secs?|s))?/i;
	const match = descLower.match(timePattern);
	if (match) {
		const days = parseInt(match[1]) || 0;
		const hours = parseInt(match[2]) || 0;
		const minutes = parseInt(match[3]) || 0;
		const seconds = parseInt(match[4]) || 0;
		totalSeconds = days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds;
		return totalSeconds > 0 ? totalSeconds : Infinity;
	}
	return Infinity;
}
function isApiKeySet() {
	return currentApiKey && currentApiKey !== API_KEY_PLACEHOLDER;
}

function playAlertSound() {
	new Audio(ALERT_SOUND).play();
}

async function checkIndividualUserAndAlert(alertedUserID) {
	if (!isApiKeySet()) return;
	const stakeoutCheckbox = document.getElementById("factionStakeoutCheckbox");
	if (!stakeoutCheckbox || !stakeoutCheckbox.checked) {
		if (individualMonitorTimeouts.has(alertedUserID)) {
			clearTimeout(individualMonitorTimeouts.get(alertedUserID));
			individualMonitorTimeouts.delete(alertedUserID);
		}
		return;
	}
	if (individualMonitorTimeouts.has(alertedUserID)) {
		// Clear the timeout as it's now being processed
		clearTimeout(individualMonitorTimeouts.get(alertedUserID));
		individualMonitorTimeouts.delete(alertedUserID);
	}
	try {
		const url = `https://api.torn.com/user/${alertedUserID}?key=${currentApiKey}&selections=basic`;
		const response = await fetch(url);
		const data = await response.json();
		if (data?.error) {
			console.error(`API Error checking user ${alertedUserID}:`, data.error.error);
			return;
		}

		if (data?.status?.state === "Okay") {
			playAlertSound();
			// console.log(`User ${alertedUserID} is Okay (individual check) - Updating UI`);

			// Update local cache and re-render
			const memberToUpdate = currentDisplayableMemberStatuses.find((m) => m.userID === alertedUserID);
			if (memberToUpdate) {
				memberToUpdate.status = "Okay";
				memberToUpdate.description = "Available (recently checked!)";
				memberToUpdate.durationSeconds = 0; // Or Infinity, as "Okay" status doesn't have a timed duration
			}
			const currentFactionID = new URLSearchParams(window.location.search).get("ID");
			if (currentFactionID) {
				updateFactionDisplayDOM(currentDisplayableMemberStatuses, currentFactionID);
			}
		}
	} catch (error) {
		console.error(`Error fetching status for individual user ${alertedUserID}:`, error);
	}
}
function clearAllIndividualMonitors() {
	individualMonitorTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
	individualMonitorTimeouts.clear();
}
async function checkUserStatus(userID) {
	if (!isApiKeySet()) {
		console.warn("Stakeout Script: API Key not set. Cannot check user status.");
		return false;
	}
	try {
		const url = `https://api.torn.com/user/${userID}?key=${currentApiKey}&selections=basic`;
		const response = await fetch(url);
		const data = await response.json();
		if (data?.error) {
			console.error("API Error:", data.error.error);
			return false;
		}
		return data?.status?.state === "Okay";
	} catch (error) {
		console.error("Error fetching user status:", error);
		return false;
	}
}
function addStakeoutElements(statusElement) {
	let intervalId = null;
	const stakeoutContainer = createStyledElement("div", { float: "right", paddingRight: "10px", display: "flex", alignItems: "center" });
	const stakeoutCheckbox = createStyledElement("input", { marginRight: "5px", cursor: "pointer" }, { type: "checkbox", id: "stakeoutCheckbox" });
	const intervalDropdown = createStyledElement("select", { marginRight: "5px" }, { id: "stakeoutInterval" });
	[1, 2, 3, 4, 5].forEach((interval) => intervalDropdown.appendChild(createStyledElement("option", {}, { value: interval, textContent: interval.toString() })));
	stakeoutContainer.appendChild(stakeoutCheckbox);
	stakeoutContainer.appendChild(createStyledElement("label", { marginRight: "5px", cursor: "pointer" }, { htmlFor: "stakeoutCheckbox", textContent: "Check status every" }));
	stakeoutContainer.appendChild(intervalDropdown);
	stakeoutContainer.appendChild(createStyledElement("label", { cursor: "pointer" }, { htmlFor: "stakeoutInterval", textContent: "seconds" }));
	const startStakeout = async (interval) => {
		clearInterval(intervalId);
		const userID = new URLSearchParams(window.location.search).get("XID");
		intervalId = setInterval(async () => {
			if (await checkUserStatus(userID)) {
				clearInterval(intervalId);
				intervalId = null;
				stakeoutCheckbox.checked = false;
				playAlertSound();
			}
		}, interval * 1000);
	};
	const stopStakeout = () => clearInterval(intervalId);
	stakeoutCheckbox.addEventListener("change", () => (stakeoutCheckbox.checked ? startStakeout(parseInt(intervalDropdown.value, 10)) : stopStakeout()));
	intervalDropdown.addEventListener("change", () => (stakeoutCheckbox.checked ? startStakeout(parseInt(intervalDropdown.value, 10)) : null));
	statusElement.appendChild(stakeoutContainer);
}
function updateApiKeyButtonText(button) {
	button.textContent = isApiKeySet() ? "Change API Key" : "Set API Key";
}
function updateFactionDisplayDOM(memberStatusesToDisplay, factionID) {
	let displayContainer = document.getElementById(DISPLAY_CONTAINER_ID);
	let contentWrapper;
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
			},
			{ id: DISPLAY_CONTAINER_ID }
		);
		contentWrapper = createStyledElement("div", {}, { id: CONTENT_WRAPPER_ID });
		displayContainer.appendChild(contentWrapper);
		const targetElement = document.querySelector(FACTION_STATUS_SELECTOR);
		if (targetElement) {
			const allControlsContainer = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
			if (allControlsContainer && allControlsContainer.parentNode === targetElement) {
				if (allControlsContainer.nextSibling) targetElement.insertBefore(displayContainer, allControlsContainer.nextSibling);
				else targetElement.appendChild(displayContainer);
			} else targetElement.insertBefore(displayContainer, targetElement.firstChild);
		}
	} else {
		contentWrapper = document.getElementById(CONTENT_WRAPPER_ID);
		contentWrapper.innerHTML = "";
	}
	if (!isApiKeySet()) {
		contentWrapper.innerHTML = '<p style="color: #ffcc00; text-align: center; padding: 20px;">Please set your API Key using the button above to view faction member statuses.</p>';
		return;
	}

	const categorizedMembers = {
		"Okay": [],
		"In Hospital (Local)": [],
		"In Hospital (Abroad)": [],
		"Traveling": [],
		"Abroad (Not Hospitalized)": [],
		"In Jail": [],
		"In Federal Jail": [],
		"Other Status": [],
	};
	// Use the passed memberStatusesToDisplay for categorization
	memberStatusesToDisplay.forEach((member) => {
		// Ensure durationSeconds is present, parse if not (e.g. initial load from API)
		if (typeof member.durationSeconds === "undefined") {
			member.durationSeconds = parseTimeToSeconds(member.description);
		}
		const state = member.status;
		const descLower = member.description.toLowerCase();
		if (state === "Hospital") {
			if (
				descLower.includes(" hospital in ") ||
				descLower.includes(" an emirati hospital") ||
				descLower.includes(" a south african hospital") ||
				descLower.includes(" united kingdom") ||
				descLower.includes(" argentina") ||
				descLower.includes(" canada") ||
				descLower.includes(" cayman islands") ||
				descLower.includes(" china") ||
				descLower.includes(" hawaii") ||
				descLower.includes(" japan") ||
				descLower.includes(" mexico") ||
				descLower.includes(" south africa") ||
				descLower.includes(" switzerland") ||
				descLower.includes(" uae") ||
				(descLower.includes("abroad") && descLower.includes("hospital"))
			)
				categorizedMembers["In Hospital (Abroad)"].push(member);
			else categorizedMembers["In Hospital (Local)"].push(member);
		} else if (state === "Traveling") categorizedMembers["Traveling"].push(member);
		else if (state === "Abroad") categorizedMembers["Abroad (Not Hospitalized)"].push(member);
		else if (state === "Jail") categorizedMembers["In Jail"].push(member);
		else if (state === "Federal jail") categorizedMembers["In Federal Jail"].push(member);
		else if (state === "Okay") categorizedMembers["Okay"].push(member);
		else categorizedMembers["Other Status"].push(member);
	});
	const categoryOrder = ["Okay", "In Hospital (Local)", "In Hospital (Abroad)", "Traveling", "Abroad (Not Hospitalized)", "In Jail", "In Federal Jail", "Other Status"];
	categoryOrder.forEach((categoryName) => {
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
		const categoryDiv = createStyledElement("div", { marginBottom: "10px" });
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
		categoryHeader.innerHTML = `${categoryName} <span>(${membersInCategory.length}) ▲</span>`;
		const memberListDiv = createStyledElement("div", {
			display: "grid",
			padding: "5px",
			backgroundColor: "#303030",
			borderRadius: "0 0 4px 4px",
			gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
			gap: "8px",
		});
		categoryHeader.addEventListener("click", () => {
			const isHidden = memberListDiv.style.display === "none";
			memberListDiv.style.display = isHidden ? "grid" : "none";
			categoryHeader.innerHTML = `${categoryName} <span>(${membersInCategory.length}) ${isHidden ? "▲" : "▼"}</span>`;
		});
		membersInCategory.forEach((member) => {
			if (
				(categoryName.includes("Hospital") || categoryName.includes("Traveling") || categoryName.includes("Jail")) &&
				member.durationSeconds < CRITICAL_TIME_THRESHOLD &&
				member.durationSeconds !== Infinity
			) {
				if (!individualMonitorTimeouts.has(member.userID)) {
					const checkDelayMs = Math.max(1000, (member.durationSeconds + 2) * 1000);
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
			if (member.status === "Okay") statusColor = "#4CAF50";
			else if (member.status === "Hospital") statusColor = "#FF9800";
			else if (member.status === "Traveling") statusColor = "#2196F3";
			else if (member.status === "Abroad") statusColor = "#9C27B0";
			else if (member.status === "Jail") statusColor = "#FFEB3B";
			else if (member.status === "Federal jail") statusColor = "#f44336";
			memberDiv.style.borderLeftColor = statusColor;
			const memberInfoContainer = createStyledElement("div", { display: "flex", flexDirection: "column", flexGrow: 1, marginRight: "8px" });
			const nameColor = member.status === "Jail" ? "#333" : "#E0E0E0";
			const nameSpan = createStyledElement("span", { fontWeight: "bold", color: nameColor }, { textContent: `${member.name}` });
			const statusDescSpan = createStyledElement("span", { color: "#B0B0B0", fontSize: "0.85em", display: "block", marginTop: "2px" }, { textContent: `(${member.description})` });
			memberInfoContainer.appendChild(nameSpan);
			memberInfoContainer.appendChild(statusDescSpan);
			const actionsContainer = createStyledElement("div", { display: "flex", gap: "5px", flexShrink: 0 });
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
				{ href: `https://www.torn.com/profiles.php?XID=${member.userID}`, target: "_blank", title: "View Profile" }
			);
			profileButton.innerHTML = "👤";
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
				{ href: `https://www.torn.com/loader.php?sid=attack&user2ID=${member.userID}`, target: "_blank", title: "Attack User" }
			);
			attackButton.innerHTML = "⚔️";
			attackButton.onmouseover = () => (attackButton.style.backgroundColor = "#d64537");
			attackButton.onmouseout = () => (attackButton.style.backgroundColor = "#c0392b");
			actionsContainer.appendChild(profileButton);
			actionsContainer.appendChild(attackButton);
			memberDiv.appendChild(memberInfoContainer);
			memberDiv.appendChild(actionsContainer);
			memberListDiv.appendChild(memberDiv);
		});
		categoryDiv.appendChild(categoryHeader);
		categoryDiv.appendChild(memberListDiv);
		contentWrapper.appendChild(categoryDiv);
	});
}
async function fetchMonitorAndUpdate(factionID, stakeoutCheckbox) {
	if (!isApiKeySet()) {
		if (document.getElementById(DISPLAY_CONTAINER_ID) && !document.querySelector(`#${CONTENT_WRAPPER_ID} p`)) {
			updateFactionDisplayDOM([], factionID);
		}
		return;
	}
	try {
		const url = `https://api.torn.com/faction/${factionID}?key=${currentApiKey}&selections=basic`;
		const response = await fetch(url);
		const data = await response.json();
		if (data?.error) {
			console.error("API Error:", data.error.error);
			return;
		}
		if (!data || !data.members) {
			console.error("Error fetching faction data:", data);
			return;
		}
		const memberStatusesFromAPI = Object.entries(data.members).map(([userID, memberData]) => ({
			userID,
			name: memberData.name,
			status: memberData.status.state,
			description: memberData.status.description,
			// durationSeconds will be parsed in updateFactionDisplayDOM
		}));

		currentDisplayableMemberStatuses = memberStatusesFromAPI; // Update the global cache

		if (stakeoutCheckbox && stakeoutCheckbox.checked) {
			const firstOkayMember = currentDisplayableMemberStatuses.find((member) => member.status === "Okay");
			if (firstOkayMember) {
				playAlertSound();
			}
		}
		updateFactionDisplayDOM(currentDisplayableMemberStatuses, factionID);
	} catch (error) {
		console.error("Error in fetchMonitorAndUpdate:", error);
	}
}

function addFactionStakeoutElements(factionPageElement, factionID) {
	let intervalId = null;
	const existingControls = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
	if (existingControls) existingControls.remove();
	const stakeoutContainer = createStyledElement(
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
	[1, 2, 3, 4, 5, 10, 15, 30, 60].forEach((interval) => {
		const option = createStyledElement("option", { backgroundColor: "#222", color: "white" }, { value: interval, textContent: interval.toString() });
		intervalDropdown.appendChild(option);
	});
	intervalDropdown.value = "30";
	const labelCheck = createStyledElement("label", { marginRight: "5px", cursor: "pointer" }, { htmlFor: "factionStakeoutCheckbox", textContent: "Monitor faction every" });
	const labelSeconds = createStyledElement("label", { cursor: "pointer" }, { htmlFor: "factionStakeoutInterval", textContent: "seconds" });
	monitorControls.appendChild(stakeoutCheckbox);
	monitorControls.appendChild(labelCheck);
	monitorControls.appendChild(intervalDropdown);
	monitorControls.appendChild(labelSeconds);
	const apiKeyControls = createStyledElement("div", { display: "flex", alignItems: "center" });
	const apiKeyButton = createStyledElement(
		"button",
		{ padding: "4px 8px", backgroundColor: "#555", color: "white", border: "1px solid #666", borderRadius: "3px", cursor: "pointer", marginLeft: "10px" },
		{ id: "stakeoutApiKeyButton" }
	);
	updateApiKeyButtonText(apiKeyButton);
	apiKeyButton.addEventListener("click", () => {
		const newKey = prompt("Please enter your Torn API key:", isApiKeySet() ? currentApiKey : "");
		if (newKey && newKey.trim() !== "") {
			currentApiKey = newKey.trim();
			localStorage.setItem("stakeoutUserApiKey", currentApiKey);
			updateApiKeyButtonText(apiKeyButton);
			const factionCheckboxElem = document.getElementById("factionStakeoutCheckbox");
			if (factionCheckboxElem) {
				if (document.getElementById(DISPLAY_CONTAINER_ID) || factionCheckboxElem.checked) {
					fetchMonitorAndUpdate(factionID, factionCheckboxElem);
				}
			}
		} else if (newKey === "") {
			currentApiKey = API_KEY_PLACEHOLDER;
			localStorage.removeItem("stakeoutUserApiKey");
			updateApiKeyButtonText(apiKeyButton);
			updateFactionDisplayDOM([], factionID); // Pass empty array
		}
	});
	apiKeyControls.appendChild(apiKeyButton);
	stakeoutContainer.appendChild(monitorControls);
	stakeoutContainer.appendChild(apiKeyControls);
	const startStakeout = (interval) => {
		clearInterval(intervalId);
		clearAllIndividualMonitors();
		fetchMonitorAndUpdate(factionID, stakeoutCheckbox);
		intervalId = setInterval(() => fetchMonitorAndUpdate(factionID, stakeoutCheckbox), interval * 1000);
	};
	const stopStakeout = () => {
		clearInterval(intervalId);
		intervalId = null;
		clearAllIndividualMonitors();
		const display = document.getElementById(DISPLAY_CONTAINER_ID);
		if (display) display.remove();
		currentDisplayableMemberStatuses = []; /* Clear cache on stop */
	};
	stakeoutCheckbox.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) startStakeout(parseInt(intervalDropdown.value, 10));
		else stopStakeout();
	});
	intervalDropdown.addEventListener("change", () => {
		if (stakeoutCheckbox.checked) startStakeout(parseInt(intervalDropdown.value, 10));
	});
	factionPageElement.insertBefore(stakeoutContainer, factionPageElement.firstChild);
}

function initialFactionLoad(factionID) {
	if (!isApiKeySet()) {
		currentDisplayableMemberStatuses = []; // Ensure cache is clear
		if (document.getElementById(DISPLAY_CONTAINER_ID)) {
			updateFactionDisplayDOM([], factionID);
		} else {
			const tempDisplay = createStyledElement("div", {}, { id: DISPLAY_CONTAINER_ID });
			const tempContent = createStyledElement("div", {}, { id: CONTENT_WRAPPER_ID });
			tempDisplay.appendChild(tempContent);
			const targetElement = document.querySelector(FACTION_STATUS_SELECTOR);
			if (targetElement) {
				const allControlsContainer = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
				if (allControlsContainer && allControlsContainer.parentNode === targetElement) {
					if (allControlsContainer.nextSibling) targetElement.insertBefore(tempDisplay, allControlsContainer.nextSibling);
					else targetElement.appendChild(tempDisplay);
				} else targetElement.insertBefore(tempDisplay, targetElement.firstChild);
			}
			updateFactionDisplayDOM([], factionID);
		}
		return;
	}
	(async () => {
		try {
			const url = `https://api.torn.com/faction/${factionID}?key=${currentApiKey}&selections=basic`;
			const response = await fetch(url);
			const data = await response.json();
			if (data?.error) {
				console.error("API Error:", data.error.error);
				return;
			}
			if (data && data.members) {
				const memberStatusesFromAPI = Object.entries(data.members).map(([userID, memberData]) => ({
					userID,
					name: memberData.name,
					status: memberData.status.state,
					description: memberData.status.description,
				}));
				currentDisplayableMemberStatuses = memberStatusesFromAPI;
				updateFactionDisplayDOM(currentDisplayableMemberStatuses, factionID);
			}
		} catch (e) {
			console.error("Error in initial faction display: ", e);
		}
	})();
}

function observe() {
	if (window.StakeOutInterval) clearInterval(window.StakeOutInterval);
	window.StakeOutInterval = setInterval(() => {
		const profileStatusElement = document.querySelector(PROFILE_STATUS_SELECTOR);
		if (profileStatusElement && !document.getElementById("stakeoutCheckbox")) {
			addStakeoutElements(profileStatusElement);
		}
		const factionProfileElement = document.querySelector(FACTION_STATUS_SELECTOR);
		if (factionProfileElement) {
			if (!document.getElementById(FACTION_CONTROLS_CONTAINER_ID)) {
				const factionID = new URLSearchParams(window.location.search).get("ID");
				if (factionID) {
					addFactionStakeoutElements(factionProfileElement, factionID);
					if (!document.getElementById(DISPLAY_CONTAINER_ID)) {
						initialFactionLoad(factionID);
					}
				}
			}
		}
		if ((profileStatusElement && document.getElementById("stakeoutCheckbox")) || (factionProfileElement && document.getElementById(FACTION_CONTROLS_CONTAINER_ID))) {
			clearInterval(window.StakeOutInterval);
		}
	}, 500);
}

window.addEventListener("hashchange", () => {
	const userStakeout = document.getElementById("stakeoutCheckbox")?.parentNode;
	if (userStakeout) userStakeout.remove();
	const factionControls = document.getElementById(FACTION_CONTROLS_CONTAINER_ID);
	if (factionControls) {
		clearAllIndividualMonitors();
		const display = document.getElementById(DISPLAY_CONTAINER_ID);
		if (display) display.remove();
		factionControls.remove();
		currentDisplayableMemberStatuses = []; // Clear cache on navigation
	}
	observe();
});
observe();
