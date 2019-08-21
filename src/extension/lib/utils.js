import browser from "webextension-polyfill";
import io from "socket.io-client";

export function isFirefox() {
	return !!browser.runtime.getURL("/").match(/^moz/);
}

export function isChrome() {
	return !!browser.runtime.getURL("/").match(/^chrome/);
}

function bootstrapInfo(url) {
	let regex = /^(?:http|https):\/\/(?:127\.0\.0\.1|localhost):\d+\/?\?atrica-extension=true(?:&?(.*))?$/;
	let res = (url || "").match(regex);
	if (res) {
		let paramStr = res[1] || "";
		let paramsArr = paramStr.split("&").map(x => x.split("="));
		let params = {};
		for (let [key, val] of paramsArr) {
			params[key] = val;
		}
		res = { port: params.port || 3000, bid: params.bid || 1 };
	}
	return res;
}

/**
 * Wait for tab to visit matching url
 * @example
 * `http://127.0.0.1:3000?atrica-extension=true&port=3000`
 */
export async function bootstrap() {
	let tabs = await browser.tabs.query({ currentWindow: true });
	for (let tab of tabs) {
		let info = bootstrapInfo(tab.url);
		if (info) return { tab, ...info };
	}

	return await new Promise(resolve => {
		const listener = (_, __, tab) => {
			let info = bootstrapInfo(tab.url);
			if (info) {
				browser.tabs.onUpdated.removeListener(listener);
				resolve({ tab, ...info });
			}
		};
		browser.tabs.onUpdated.addListener(listener);
	});
}


export async function connectToServer(port) {
	return io("http://127.0.0.1:" + port);
}

/**
 * Execute a the script {script} in the tab identified by {tabId}
 * @param {number} tabId
 * @param {string} script
 * @returns {Promise} - A promise for the result of the script,
 * 	resolved once the script has finished
 */
export async function executeScript(tabId, script) {
	return await browser.tabs.executeScript(tabId, { code: script });
}

/**
 * Wait until the tab identified by targetId has finished loading
 * @param {number} targetTabId - The id of the tab to await
 * @param {('document_idle'|'complete')} event - the event you want to await:
 * 	- document_idle : The Document has finished loading, but some resources (images, script)
 * 			are still loading
 * 	- complete : The Document has finished loading and the the other resources too.
 * @returns {Promise} - A promised resolved once the page has finished loading
 */
export function pageDoneLoading(targetTabId, event = "document_idle") {
	return new Promise(resolve => {
		function messageHandler(msg, sender) {
			if (sender.tab.id == targetTabId && msg && msg.status === event) {
				browser.runtime.onMessage.removeListener(messageHandler);
				resolve();
			}
		}
		browser.runtime.onMessage.addListener(messageHandler);
	});
}

/**
 * Sleep for {ms} milliseconds
 * @param {number} ms
 * @returns {Promise} - resolve after {ms} milliseconds
 */
export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns an http address if the url is not
 * @param {string} url
 * @returns {string} an http url
 * @example
 * normalizeUrl('google.com') === 'http://google.com';
 * normalizeUrl('http://wikipedia.org') === 'http://wikipedia.org';
 */
export function normalizeUrl(url) {
	if (!url) return url;
	if (url.match(/^http/)) {
		return url;
	} else {
		return "http://" + url;
	}
}

/**
 * Returns the current active tab in the current active window
 * @returns {Promise<Tab>} - A promise for the current active tab
 */
export function getCurrentTab() {
	return new Promise(resolve => {
		chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
			resolve(tabs[0]);
		});
	});
}

/**
 * Returns current active window
 * @returns {Promise} - A promise for the active window
 */
export function getCurrentWindow() {
	return new Promise(resolve => {
		chrome.windows.getCurrent({}, resolve);
	});
}

/**
 * Make the tab identified by {tabId} the current active tab
 * @param {number} tabId
 */
export function gotoTab(tabId) {
	return new Promise(resolve => {
		chrome.tabs.update(tabId, { active: true }, resolve);
	});
}

/**
 * Takes a screenshot of the viewport of the current active tab
 * @param {number} windowId
 * @returns {Promise} - A promise for the resulting image
 */
export async function captureCurrentTab(windowId = null) {
	return await browser.tabs.captureVisibleTab(windowId, {
		format: "png",
		quality: 100
	});
}

/**
 * Take several screenshots of the space, trying to cover the whole page
 * or at leats until reaching maxHeight. Work taking a screenshot, scrolling,
 * then taking an other screenshot and so on
 * @param {number} tabId - Id of the tab to capture. Will go to the tab if not active
 * @param {number} windowId - The id of the window to capture. null ==> current window
 * @param {maxHeight} maxHeight - Will stop scrolling at maxHeight if
 * @returns {Promise<Array>} - An array containing all the screenshot in the right order
 * (begining of array == begining of page)
 */
export async function captureFullPage(tabId, windowId, maxHeight = 6000) {
	const windowHeight = parseInt(
		await executeScript(tabId, "window.innerHeight")
	);
	let scrollHeight = await executeScript(
		tabId,
		`
		Math.max(
			parseInt(window.document.body.scrollHeight) || 0,
			parseInt(window.document.documentElement.scrollHeight) || 0
		)`
	);
	scrollHeight = Math.max(windowHeight, scrollHeight);
	let height;

	if (maxHeight) height = Math.min(scrollHeight, maxHeight);
	else height = scrollHeight;

	let captures = [];
	const numberOfCaptures = Math.ceil(height / windowHeight);

	let savedHeight;
	if (height > windowHeight) {
		const idealHeight = windowHeight * numberOfCaptures;
		savedHeight = await executeScript(tabId, "document.body.style.height");
		await executeScript(
			tabId,
			`document.body.style.height = "${idealHeight}px"`
		);
	}

	for (let i = 0; i < numberOfCaptures; i++) {
		let scrollTop = i * windowHeight;
		await executeScript(tabId, `window.scrollTo(0, ${scrollTop})`);
		let capture = await captureTab(tabId, windowId);
		captures.push(capture);
	}

	if (height > windowHeight) {
		await executeScript(
			tabId,
			`document.body.style.height = "${savedHeight}"`
		);
	}

	return captures;
}

/**
 * Capture the tab identified by {tabId} in {windowId}
 * @param {number} tabId - The id of the tab
 * @
 */
export async function captureTab(tabId, windowId) {
	let saveTab = await getCurrentTab();
	await gotoTab(tabId);
	let image = await captureCurrentTab(windowId);
	await gotoTab(saveTab.id);
	return image;
}
