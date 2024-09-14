// ==UserScript==
// @name         NoConfirm (Item Market) for PDA
// @namespace    http://tampermonkey.net/
// @version      v1.0
// @description  ported from torntools for PDA
// @author       Titanic_
// @match        https://www.torn.com/imarket.php
// @grant        none
// ==/UserScript==

"use strict";

(async () => {
	const VIEW_TYPES = {
		UNKNOWN: "unknown",
		BROWSE: "browse_view",
		ITEM: "item_view",
	};

	function initialise() {
		new MutationObserver(async (mutations) => {

			if (getViewType() === VIEW_TYPES.UNKNOWN) return;

			// Filter out changes where the main body doesn't get added.
			if (
				![...[...mutations].find((mutation) => mutation.addedNodes.length).addedNodes]
					.filter((node) => node.nodeType === Node.ELEMENT_NODE)
					.some((node) => node.classList.contains("main-market-page") || node.classList.contains("shop-market-page"))
			) return;

			startFeature();
		}).observe($(document).find("#item-market-main-wrap").get(0), { childList: true });
	}

	function startFeature() {
		switch (getViewType()) {
			case VIEW_TYPES.ITEM:
				requireElement(".buy .buy-link").then(() => removeConfirmation());
				break;
			case VIEW_TYPES.BROWSE:
				for (const list of $(document).find(".m-items-list").get()) {
					new MutationObserver(() => removeConfirmation(list)).observe(list, { childList: true, subtree: true });
				}
				break;
		}
	}

	function removeConfirmation(source = document) {
		const isItemView = getViewType() === VIEW_TYPES.ITEM;

		for (const item of $(source).find(".items > li:not(.clear):not(.private-bazaar)").get()) {
			const icon = $(item).find(".buy .buy-link").get(0);
			if (!icon) continue;

			icon.dataset.action = "buyItemConfirm";
			icon.classList.add("yes-buy", "tt-modified");

			if (isItemView) icon.dataset.price = item.find(".cost").textContent.getNumber();
		}
	}

	function getViewType() {
		if (!location.hash) return VIEW_TYPES.BROWSE;
		const page = getHashParameters().get("p");

		if (page === "shop") return VIEW_TYPES.ITEM;
		else if (page === "market") return VIEW_TYPES.BROWSE;

		return VIEW_TYPES.UNKNOWN;
	}

    initialise()
})();

function getHashParameters(hash) {
	if (!hash) hash = location.hash;

	if (hash.startsWith("#/")) hash = hash.substring(2);
	else if (hash.startsWith("#") || hash.startsWith("/")) hash = hash.substring(1);

	if (!hash.startsWith("!")) hash = "?" + hash;

	return new URLSearchParams(hash);
}

function requireCondition(condition, options = {}) {
	options = {
		delay: 50,
		maxCycles: 1000,
		...options,
	};

	// Preserve stack for throwing later when needed.
	const error = new Error("Maximum cycles reached.");

	return new Promise((resolve, reject) => {
		if (checkCondition()) return;

		let counter = 0;
		const checker = setInterval(() => {
			if (checkCounter(counter++) || checkCondition()) return clearInterval(checker);
		}, options.delay);

		function checkCondition() {
			const response = condition();
			if (!response) return false;

			if (typeof response === "boolean") {
				if (response) resolve();
				else reject();
			} else if (typeof response === "object") {
				if (response.hasOwnProperty("success")) {
					if (response.success === true) resolve(response.value);
					else reject(response.value);
				} else {
					resolve(response);
				}
			}
			return true;
		}

		function checkCounter(count) {
			if (options.maxCycles <= 0) return false;

			if (count > options.maxCycles) {
				reject(error);
				console.trace();
				return true;
			}
			return false;
		}
	});
}

function requireElement(selector, attributes) {
	attributes = {
		invert: false,
		parent: document,
		...attributes,
	};
	if (attributes.invert) {
		return requireCondition(() => !attributes.parent.find(selector), attributes);
	} else {
		return requireCondition(() => attributes.parent.find(selector), attributes);
	}
}
