import * as utils from "./utils";
import browser from "webextension-polyfill";

/**
 * Returns all tabs in currentWindow
 * @param {object} _
 * @param {object} context - The context
 * @param {object} context.window - The default window
 */
export async function getAllPages(_, { window }) {
	return await browser.tabs.query({ windowId: window.id }).map(tab => tab.id);
}

/**
 * Open a tab and return the id
 * @param {object} _
 * @param {object} context - The context of the instruction
 * @param {object} context.window - The default window
 * @returns {Promise<number>} A promise for the new tab's id
 */
export async function newPage(_, { window }) {
	let tab = await browser.tabs.create({ windowId: window.id });
	return tab.id;
}

/**
 * Close tab {tabId}
 * @param {object} params - Parameters for the instruction
 * @param {number} params.tabId - Id of the tab to close
 * @returns {Promise} - Promised resolved once tab closed
 */
export async function closePage({ tabId }) {
	return await browser.tabs.remove(tabId);
}

/**
 * Load page {url} in tab {tabId}
 * @param {object} params
 * @param {string} params.url
 * @param {number} params.tabId
 * @param {object} context - The context of the promise
 * @param {object} context.defaultTab
 * @returns {Promise} Promise resolved when the DOM
 * (more precisely )
 */
export async function goto({ url, tabId }, { defaultTab }) {
	tabId = tabId || defaultTab.id;
	url = utils.normalizeUrl(url);
	await browser.tabs.update(tabId, { url });
}

/**
 * Get the cookies
 * @returns {Promise<Array>} list of the cookies
 */
export async function getCookies({ firstPartyDomain }) {
	let options = {};
	if (firstPartyDomain) options.firstPartyDomain = firstPartyDomain;
	return await browser.cookies.getAll(options);
}

/**
 * Set the cookies in the current browsing context
 * @param {object} params
 * @param {object} params.cookies - the cookies to set
 * @returns {Promise} resolved when all cookies are set
 */
export async function setCookies({ cookies }) {
	cookies = [cookies].flat();
	for (let cookie of cookies) {
		await browser.cookies.set(cookie);
	}
}

/**
 * Clear browsing data as requested in {dataTypes}
 * @param {object} params - Parameters of the instruction
 * @param {object} params.options - the options. See utils.clearBrowsingData
 * @param {object} params.dataTypes - the types of data to clear (cookies, localStorage, etc...)
 *   See utils.clearBrowsingData
 * @returns {Promise}
 */
export async function clearBrowsingData({ dataTypes, options }) {
	let { appcache, cacheStorage, fileSystems, webSQL, ...others } = dataTypes;
	dataTypes = utils.isFirefox() ? others : dataTypes;
	await browser.browsingData.remove(options, dataTypes);
}

/**
 * Execute a script in tab {tabId} and returns the result
 * @param {object} params - Parameters of the instruction
 * @param {string} params.code - The code of the function to execute
 * @param {Array<any>} params.args - The arguments of the function to execute
 * @param {number} params.tabId - The id of the tab
 * @param {object} context - The context of the instruction
 * @param {object} context.defaultTab - The defaultTab
 * @returns {Promise} a promise for the result of the script
 */
export async function evaluate({ code, args, tabId }, { defaultTab }) {
	tabId = tabId || defaultTab.id;
	let script = `(${code})(...${JSON.stringify(args)})`;
	return await utils.executeScript(tabId, script);
}

/**
 * Take a screenshot of tab {tabId} and returns it as an array of images
 * @param {object} params - Parameters of the instruction
 * @param {number} params.tabId - the id of the tab
 * @param {number} params.maxHeight - max height
 * @param {boolean} params.fullpage - should screenshot to fullpage ?
 * @param {object} context - The context of the instruction
 * @param {object} context.defaultTab - The defaultTab
 * @param {object} context.window - The window
 * @returns {Promise<Array>} an array of images
 */
export async function screenshot(
	{ tabId, fullpage, maxHeight = 20000 },
	{ defaultTab, window }
) {
	let images = [];
	tabId = tabId || defaultTab.id;

	if (fullpage) {
		images = await utils.captureFullPage(tabId, window.id, maxHeight);
	} else {
		images = [await utils.captureTab(tabId, targetWindow.id)];
	}

	console.log("SENDING SCREENSHOT!!!", images);
	return images;
}

export async function globalEvaluate({ code, args }) {
	let func = new Function("return (" + code + ")")();
	if (typeof func === "function") {
		return await func(...args);
	} else {
		return func;
	}
}
