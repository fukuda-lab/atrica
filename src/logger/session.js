const { EventEmitter } = require("events");
const requestHandler = require("./handler");

class Session extends EventEmitter {
	/**
	 * @param {string} name
	 * @param {import('./logger')} logger
	 * @param {Object} options
	 */
	constructor(name, logger, options = {}) {
		super();
		this.name = name;
		/**
		 * @type {import('./logger')}
		 */
		this.logger = logger;
		this.closed = false;
		this.pages = [];
		this.options = options;

		if (this.options.listenNewPages) {
			const targetCreatedHandler = async target => {
				if (target.type() === "page") {
					let page = await target.page();
					thislistenPage(page);
				}
			};

			this.logger.browser.on("targetcreated", targetCreatedHandler);
			this.newPageHandler = targetCreatedHandler;
		}
	}

	async init() {
		const { Session } = this.logger.models;
		const values = { name: this.name };
		for (let [_, model] of Object.entries(this.logger.models)) {
			if (model.info && typeof model.info.onSession === "function") {
				model.info.onSession(values, this);
			}
		}
		this.model = await Session.create(values);
	}

	/**
	 * Will listen all requests and responses on {page}
	 * @param {import('puppeteer').Page} page
	 */
	async listen(page) {
		let [onreq, onres, onseclose] = requestHandler(page, this);
		page.on("request", onreq);
		page.on("response", onres);
		this.pages.push([page, onreq, onres, onseclose]);
	}

	/**
	 * Will save all the current cookies in the browser
	 * @param {string} [firstPartyDomain]
	 */
	async saveCookies(firstPartyDomain) {
		const { Cookie } = this.logger.models;
		let cookies = await this.logger.browser.cookies(null, firstPartyDomain);
		cookies = cookies.map(({ session: isSession, ...others }) => ({
			...others,
			isSession,
			sessionId: this.model.id
		}));
		await Cookie.bulkCreate(cookies);
	}

	/**
	 * Close the session
	 */
	close() {
		for (let [page, onrequest, onresponse, onseclose] of this.pages) {
			page.removeListener("request", onrequest);
			page.removeListener("response", onresponse);
			onseclose();
		}
		this.pages = [];

		if (this.newPageHandler) {
			this.logger.browser.removeListener(
				"targetcreated",
				this.newPageHandler
			);
		}
		this.emit("close");
	}

	/**
	 * Delete this session in the database
	 */
	async delete() {
		await this.logger.deleteSession(this.name);
	}
}

module.exports = Session;
