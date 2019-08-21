const { EventEmitter } = require("events");
const engine = require("engine.io");
const Request = require("./request");
const Response = require("./response");
const Cache = require("./cache");
const BrowserPage = require("./page");

class BrowserEvents extends EventEmitter {
	/**
	 * Construct a BrowserPage
	 * @param {engine.Socket} socket - the browser puppeteer controlling the browser
	 */
	constructor(socket) {
		super();
		/** @private */
		this._requestsCache = new Cache(120000);

		/** @private */
		this._responseCache = new Cache(120000);

		/** @private */
		this._$socket = socket;

		socket.on("event", event => {
			let { type, params } = event;
			switch (type) {
				case "targetcreated": {
					this.emit("targetcreated", {
						type: () => "page",
						page: async () => {
							return (
								this._pages[params.id] ||
								new BrowserPage(this, params.id)
							);
						}
					});
					break;
				}
				case "request": {
					this._handle_request_event(params);
					break;
				}
				case "response": {
					this._handle_response_event(params);
					break;
				}
				case "document_start": {
					this.emit(`page(${params.tabId}).document_start`)
					break;
				}
				case "document_end": {
					this.emit(`page(${params.tabId}).document_end`)
					break;
				}
				case "document_idle": {
					this.emit(`page(${params.tabId}).document_idle`)
					break;
				}
				case "document_load": {
					this.emit(`page(${params.tabId}).document_load`)
					break;
				}
				default: {
					this.emit(type, params);
					console.error(`Unknown event of type '${type}'`, params);
				}
			}
		});
	}

	/**
	 * @private
	 */
	_handle_request_event(params) {
		if (params.tabId < 0) return;

		let request = new Request(params);
		if(this._requestsCache.has(request.id)) {
			let previousRequest = this._requestsCache.get(request.id);
			previousRequest._redirectChain.push(previousRequest);
			request._redirectChain = previousRequest._redirectChain;
		}
		this._requestsCache.set(request.id, request);
		this.emit(`page(${params.tabId}).request`, request);

		if (this._responseCache.has(request.id)) {
			this._handle_response_event(this._responseCache.get(request.id));
			this._responseCache.del(request.id);
		}
	}

	/**
	 * @private
	 */
	_handle_response_event(params) {
		if (params.tabId < 0) return;

		let { requestId, tabId } = params;
		if (this._requestsCache.has(requestId)) {
			let request = this._requestsCache.get(requestId);
			let response = new Response(params, request, this._$socket);
			request.emit(`response`, response);
			this.emit(`page(${tabId}).response`, response);
			this._requestsCache.del(request.id);
		} else {
			this._responseCache.set(requestId, params);
		}
	}
}

module.exports = BrowserEvents;
