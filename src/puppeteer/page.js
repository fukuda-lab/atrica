const ImageCollection = require("./image-collection");
const TaskDispatcher = require("./task-dispatcher");
const $ = require("./instructions");
const EventEmitter = require("events").EventEmitter;
const Frame = require("./frame");
const utils = require("../utils");

/**
 * Represent a tab in the browser
 */
class Page extends EventEmitter {
	/**
	 * Construct a Page
	 * @param {import('./index').TBrowserPuppeteer} puppeteer - the browser puppeteer controlling the browser
	 * @param {number} tabId - the tabId of the tab in the browser
	 */
	constructor(puppeteer, tabId) {
		super();
		this.id = tabId;
		this.open = true;
		this._main_frame = null;
		this._url = null;
		this.dispatcher = new TaskDispatcher(puppeteer.socket, {
			tabId: tabId
		});

		puppeteer.on(`page(${this.id}).request`, request => {
			if (request._type === "main_frame") {
				this._url = request.url();
			}

			if (!request._frames[0]) {
				request._frames[0] = new Frame({
					id: 0,
					url: this._url,
					parentFrameId: -1
				});
			}
			this._main_frame = request._frames[0] || null;
			this.emit("request", request);
		});

		puppeteer.on(`page(${this.id}).response`, response =>
			this.emit("response", response)
		);

		// Page loading events
		puppeteer.on(`page(${this.id}).document_start`, () => this.emit("start"));
		puppeteer.on(`page(${this.id}).document_end`, () =>
			this.emit("domcontentloaded")
		);
		puppeteer.on(`page(${this.id}).document_load`, () => this.emit("load"));
	}

	/**
	 * Return the main frame
	 */
	mainFrame() {
		return this._main_frame || null;
	}

	/**
	 * The browser will visit the url {url} on tab with the id {tabId}
	 * If tabId is not defined then the tab used will be the default tab
	 * (the tab used to etablish the connection with the worker)
	 * @param {string} url - The url to visit
	 * @param {string} [event] - When the page load should be considered finished
	 * 	event == "start" : before any script is loaded
	 * 	event == "domcontentloaded" : When DOM has finished loading
	 * 	event == "load" : everything has finished loading (images and scripts too)
	 * @returns {Promise} - Promise resolved when the page has finished loading
	 */
	async goto(url, { waitUntil = "load", timeout = 30000 } = {}) {
		await this.dispatcher.execute($.page.goto, { url });
		await this.waitForEvent(waitUntil, timeout);
	}

	/**
	 * Take a screenshot of the tab
	 * @param {object} options
	 * @param {string} path - where the image will be save (if not null)
	 * @param {boolean} fullPage - Capture the visible part or the fullpage ?
	 * @returns {Promise<Buffer>} - Buffer containing the image
	 */
	async screenshot({ path = null, fullPage = false }) {
		let params = { fullpage: fullPage };
		let dataURIs = await this.dispatcher.execute($.page.screenshot, params);
		let b64strs = dataURIs.map(data => data.split(",")[1]);
		let buffers = b64strs.map(data => Buffer.from(data, "base64"));
		let imageCollection = new ImageCollection(buffers);
		let mergedImage = await imageCollection.verticalJoin();

		if (path) {
			await mergedImage.toFile(path);
		} else {
			return await mergedImage.toBuffer();
		}
	}

	/**
	 * Execute a function in the page
	 * @param {string|function} func
	 * @param {Array<any>} args -
	 * @returns {Promise} - Result of the script execution
	 */
	async evaluate(func, ...args) {
		let code = func.toString();
		let res =
			(await this.dispatcher.execute($.page.evaluate, { code, args })) || [];
		return res[0];
	}

	/**
	 * Close the tab
	 * @returns {Promise} - No result
	 */
	async close() {
		let open = true;
		const EXPIRED = Symbol();

		while (open) {
			let result = await Promise.race([
				this.dispatcher.execute($.page.close),
				(async () => {
					await utils.sleep(1);
					return EXPIRED;
				})()
			]);
			open = false;
		}
		if (this.puppeteer && this.puppeteer._pages)
			delete this.puppeteer._pages[this.id];
	}

	/**
	 * Return the current url of the page
	 * @private
	 */
	url() {
		return this._url;
	}

	/**
	 * Promised resolved after ${ms} milliseconds
	 * @returns {Promise}
	 */
	async waitFor(ms) {
		await utils.msleep(ms);
	}

	async waitForEvent(name, timeout = 0) {
		let promises = [];
		let eventPromise = new Promise(res => this.once(name, arg => res(arg)));
		let timeoutPromise = new Promise((_, rej) =>
			setTimeout(
				() =>
					rej(
						new Error(`Timeout for event ${name} : ${timeout}ms elapsed`)
					),
				timeout
			)
		);

		promises.push(eventPromise);
		if (timeout && timeout > 0) promises.push(timeoutPromise);

		return await Promise.race(promises);
	}
}

module.exports = Page;
