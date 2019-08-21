const engine = require("engine.io");

class TaskDispatcher {
	/**
	 * Construct a browser puppeteer to control a browser
	 * @param {engine.Socket} socket - A socket toward the browser to control
	 */
	constructor(socket, defaultParams = {}) {
		this.socket = socket;
		this.defaultParams = defaultParams;
		this.instructionCount = 0;
	}

	/**
	 * Execute an instruction and returns the result
	 * @param {string} type
	 * @param {object} params
	 * @returns {Promise<any>} the result of the instruction
	 */
	execute(type, params) {
		const id = this.instructionCount++;
		params = { ...this.defaultParams, ...params };
		const instruction = { id, type, params };

		return new Promise((resolve, reject) => {
			const clean = () => {
				this.socket.removeListener("instruction-error", onExecError);
				this.socket.removeListener("instruction-done", onExecSuccess);
			};

			function onExecSuccess(result) {
				if (result.id === instruction.id) {
					clean();
					resolve(result.result);
				}
			}

			function onExecError(error) {
				if (error.id == instruction.id) {
					clean();
					reject(error.error);
				}
			}

			this.socket.emit("instruction", instruction);
			this.socket.on("instruction-error", onExecError);
			this.socket.on("instruction-done", onExecSuccess);
		});
	}
}

module.exports = TaskDispatcher;
