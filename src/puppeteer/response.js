const Request = require("./request");
const Pipe = require('./pipe');

class Response {
	/**
	 * @param {object} params
	 * @param {Request} request
	 */
	constructor({ headers, status, fromCache, url }, request, socket) {
		this._headers = headers;
		this._status = status;
		this._request = request;
		this._fromCache = fromCache;
		this._socket = socket;
		this._url = url;
	}

	/**
	 * Return the response headers
	 * @returns {Record<string, string>}
	 */
	headers() {
		return this._headers;
	}

	status() {
		return this._status;
	}

	request() {
		return this._request;
	}

	fromCache() {
		return this._fromCache;
	}

	ok() {
		return 200 <= this._status && this._status < 300;
	}

	url() {
		return this._url;
	}

	async buffer() {
		let pipe = new Pipe(this._socket, this._request.id);
		return await pipe.buffer();
	}
}

module.exports = Response;
