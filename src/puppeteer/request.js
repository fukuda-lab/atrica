const Frame = require("./frame");
const EvenEmitter = require("events").EventEmitter;

class Request extends EvenEmitter {
	constructor({
		id,
		tabId,
		type,
		url,
		headers,
		method,
		body,
		frameId,
		frames
	}) {
		super();
		this.id = id;

		/** @private */
		this._tabId = tabId;

		/** @private */
		this._url = url;

		/** @private */
		this._headers = headers;

		/** @private */
		this._method = method;

		/** @private */
		this._body = body;

		/** @private */
		this._type = type;

		/** @private */
		this._frameId = frameId;

		/** @private */
		this._frames = {};

		/** @private */
		this._redirectChain = [];

		for (let frame of frames) {
			let { frameId: id, parentFrameId, url } = frame;
			this._frames[id] = new Frame({ id, parentFrameId, url }, this._frames);
		}
	}

	/**
	 * Returns the url of the request
	 * @returns {string}
	 */
	url() {
		return this._url;
	}

	/**
	 * Returns the headers of the request
	 * @returns {Record<string, string>}
	 */
	headers() {
		return this._headers;
	}

	/**
	 * Returns the method of the request
	 * @returns {string}
	 */
	method() {
		return this._method;
	}

	/**
	 * Return request's body
	 * @returns {any}
	 */
	postData() {
		return this._body;
	}

	/**
	 * Returns the frame triggering the request
	 * @returns {frame}
	 */
	frame() {
		return this._frames[this._frameId] || null;
	}

	isNavigationRequest() {
		return this._type === "main_frame";
	}

	/**
	 * Return the list of all the redirections leading
	 * to this request
	 * @returns {Array<Request>}
	 */
	redirectChain() {
		return [...this._redirectChain];
	}

	/**
	 * Return the type of resource requested by the browser
	 */
	resourceType() {
		let type = resources_types[this._type] || this._type;
		return type;
	}
}

const resources_types = {
	main_frame: "document",
	sub_frame: "document"
};

module.exports = Request;
