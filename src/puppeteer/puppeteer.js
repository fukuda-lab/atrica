const engine = require("engine.io");
const TaskDispatcher = require("./task-dispatcher");
const BrowserPage = require("./page");
const $ = require("./instructions");
const BrowserEvents = require("./events");

const clearBrowserDataOptions = {
	//appcache: true,
	cache: true,
	cacheStorage: true,
	cookies: true,
	//downloads: true,
	//fileSystems: true,
	//formData: true,
	//history: true,
	indexedDB: true,
	localStorage: true,
	pluginData: false,
	//passwords: true,
	serviceWorkers: true,
	webSQL: true
};

/**
 * @typedef Instruction - Represent an instruction
 * @property {number} id - The ID of the instruction
 * @property {string} type - The type/name of the instruction
 * @property {object} [params] - The parameters of the instruction
 */

/**
 * @typedef InstructionResult - Represent the result of an instruction
 * @property {number} id - The ID of the instruction
 * @property {object} [result] - The result of the instruction
 */

/**
 * @typedef ClearBrowserOptions
 * @property {boolean} [appcache]
 * @property {boolean} [cache]
 * @property {boolean} [cacheStorage]
 * @property {boolean} [cookies]
 * @property {boolean} [downloads]
 * @property {boolean} [fileSystems]
 * @property {boolean} [formData]
 * @property {boolean} [history]
 * @property {boolean} [indexedDB]
 * @property {boolean} [localStorage]
 * @property {boolean} [pluginData]
 * @property {boolean} [passwords]
 * @property {boolean} [serviceWorkers]
 * @property {boolean} [webSQL]
 */

/**
 * @typedef Response
 * @property {object} headers - The headers of the response
 * @property {number} bodySize - The size of the body
 * @property {boolean} [base64Encoded] - Is the body encoded as base64 string ?
 * @property {string} [body] - The content of the request body
 */

/**
 * @typedef Request
 * @property {string} url - the url of the request
 * @property {string} type - (script|image|...) the type of the request
 * @property {number} requestId - The unique ID of the request
 * @property {string} method - (GET|POST|PUT|DELETE|...)
 * @property {object} body - Body of the request (POST parameters for instance)
 * @property {object} headers - headers of the request
 * @property {Response} [response] - the response to the request
 */

/**
 * @typedef {Puppeteer} TBrowserPuppeteer
 */

/**
 * Class to remotely control a browser
 */
class Puppeteer extends BrowserEvents {
	/**
	 * Construct a browser puppeteer to control a browser
	 * @param {engine.Socket} socket - A socket toward the browser to control
	 */
	constructor(socket) {
		super(socket);
		this.socket = socket;
		this.dispatcher = new TaskDispatcher(socket);
		/** @private */
		this._pages = {};

		socket.addListener("event", ({ type, params }) => {});
	}

	/**
	 * Return a list of the pages
	 * @returns {Promise<Array<BrowserPage>>}
	 */
	async pages() {
		let pagesId = await this.dispatcher.execute($.page.pages);
		let pages = pagesId.map(pageId => {
			if (this._pages[pageId]) {
				return this._pages[pageId];
			} else {
				let page = new BrowserPage(this, pageId);
				this._pages[pageId] = page;
				return page;
			}
		});
		return pages;
	}

	/**
	 * Opens a new page
	 * @returns {Promise<BrowserPage>} - The default tab
	 */
	async newPage() {
		let pageId = await this.dispatcher.execute($.page.newPage);
		let page = new BrowserPage(this, pageId);
		return page;
	}

	/**
	 * If cookies is null, returns all the cookies from the browser
	 * Else, if cookies is not null, is set the cookies
	 * @param {Array<object>} cookies
	 * @param {string} firstPartyDomain - necessary for Tor
	 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#First-party_isolation
	 * @returns {Promise}
	 */
	async cookies(cookies, firstPartyDomain) {
		if (cookies) {
			return await this.dispatcher.execute($.setCookies, { cookies });
		} else {
			return await this.dispatcher.execute($.getCookies, {
				firstPartyDomain
			});
		}
	}

	/**
	 * Allow to clear various browsing data.
	 * Check the link for more information about the params:
	 * https://developer.chrome.com/extensions/browsingData
	 * @param {ClearBrowserOptions} dataTypes - describe the types of data to clear
	 * @param {object} options
	 * @param {number} options.since
	 * @returns {Promise}
	 */
	async clearBrowsingData(dataTypes, options = { since: 0 }) {
		return await this.dispatcher.execute($.clearBrowsingData, {
			options,
			dataTypes
		});
	}

	/**
	 * Clear ALL browsing data
	 * @returns {Promise} - No result
	 */
	async clearAllBrowsingData() {
		const options = { since: 0 };
		return await this.clearBrowsingData(clearBrowserDataOptions, options);
	}

	/**
	 *	Will evaluate the given function with the given arguments in the browser,
	 * in the extension with access to the WebExtension API
	 * @param {string|Function} code
	 * @param {Array<any>} args
	 */
	async evaluate(code, args = []) {
		return await this.dispatcher.execute($.evaluate, {
			code: code.toString(),
			args
		});
	}
}

module.exports = Puppeteer;
