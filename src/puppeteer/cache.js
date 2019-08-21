class Cache {
	constructor(timeout = 0) {
		this.cache = {};
		this.timeout = timeout;
	}

	get(id) {
		return this.cache[id];
	}

	set(id, val) {
		this.cache[id] = val;
		if (this.timeout) {
			setTimeout(() => this.del(id), this.timeout);
		}
	}

	has(id) {
		return typeof this.cache[id] !== "undefined";
	}

	del(id) {
		delete this.cache[id];
	}

	size() {
		return Object.keys(this.cache).length;
	}
}

module.exports = Cache;