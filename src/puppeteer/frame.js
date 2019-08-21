class Frame {
	constructor({ id, url, parentFrameId }, frames = {}) {
		this.id = id;
		this._url = url;
		this._frames = frames;
		this._parentFrameId = parentFrameId;
	}

	url() {
		return this._url;
	}

	parentFrame() {
		return this._frames[this._parentFrameId] || null;
	}
}

module.exports = Frame;
