const { EventEmitter } = require("events");

const activePipes = {};

class Pipe extends EventEmitter {
	constructor(socket, id, timeout = 20000) {
		super();
		this.id = id;
		this.socket = socket;
		this.chunksToSend = [];
		this.receivedChunks = [];
		this.connected = false;
		this.finished = false;
		this.timeout = timeout;
		this.listeners = [];

		activePipes[this.id] = true;

		this.socketEmit("connection");
		this.socket.emit("pipe.connection", { id });

		this.socketOn("connection", () => {
			this.connected = true;
			this.socketEmit("data", this.chunksToSend);
			if (this.finished) this.end();
		});

		this.socketOn("data", chunks => {
			for (let chunk of chunks) {
				this.receivedChunks.push(chunk);
			}
		});

		this.socketOn("error", error => {
			this.emit("error", error);
		});

		this.socketOn("end", () => {
			try {
				let buffer = Buffer.concat(this.receivedChunks);
				this.emit("finish", buffer);
			} catch (error) {
				console.error(error);
				console.log(this.receivedChunks);
			}
		});
	}

	/** @private */
	socketEmit(name, ...args) {
		this.socket.emit(`pipe(${this.id}).${name}`, ...args);
	}

	/** @private */
	socketOn(name, listener) {
		this.listeners.push([name, listener]);
		this.socket.on(`pipe(${this.id}).${name}`, listener);
	}

	/** @private */
	socketClean() {
		for (let [name, listener] of this.listeners) {
			this.socket.removeListener(`pipie(${this.id}).${name}`, listener);
		}
	}

	write(chunk) {
		if (this.connected) {
			this.socket.emit(`pipe(${this.id}).data`, [chunk]);
		} else {
			this.chunksToSend.push(chunk);
		}
	}

	end() {
		if (this.connected) {
			this.socketEmit(`end`);
			this.clean();
		} else {
			this.finished = true;
		}

		setTimeout(this.clean.bind(this), this.timeout);
	}

	buffer() {
		return new Promise((resolve, reject) => {
			this.once("finish", resolve);
			this.once("error", reject);
		});
	}

	clean() {
		this.chunksToSend = [];
		this.socketClean();
		delete activePipes[this.id];
	}

	static handleInactivePipes(socket) {
		socket.on("pipe.connection", ({ id }) => {
			if (!activePipes[id]) {
				socket.emit(`pipe(${id}).error`, `No pipe of ID ${id}`);
			}
		});
	}
}

module.exports = Pipe;
