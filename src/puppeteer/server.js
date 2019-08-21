const SocketIoServer = require("socket.io");
const http = require("http");
const getPort = require("get-port");
const { paramsForUrl } = require("../utils");
const { Socket } = require("engine.io");

/**
 * This class is a socket.io server which will listen for browser connections
 * whith the atrica-extension plugin and will create a socket through which
 * the worker can communicate with the browser.
 */
class Server {
	/**
	 * Create a WorkerServer instance
	 * @param {number} port - The port on which the socket.io server should listen.
	 * 	If the port is busy, then will try port + 1, then port + 2, etc...
	 */
	constructor(port = 3000) {
		this.preferedPort = port;
		// Create an http server returning a simple html page
		this.httpServer = http.createServer(requestHandler);

		// Create the socket.io server and listen for connections
		/**
		 * @type {SocketIoServer} socket.io server
		 */
		this.server = SocketIoServer(this.httpServer);
		this._is_running = false;
	}

	/**
	 * Start the socket.io server
	 * @param {function} [listener] - Function executed for listening.
	 * 	Mostly usefull for printing messages when server start
	 * @returns {Promise}
	 */
	async run(listener) {
		if(this._is_running) return;
		// Try to launch the server on one of the following port or random port otherwise
		this.port = await getPort({
			port: [0, 1, 2, 3].map(v => v + this.preferedPort)
		});

		listener = listener || (() => {});
		this.httpServer.listen(this.port, listener);
		this._is_running = true;
	}

	/**
	 * @returns {number} - The port where the socket.io server is running
	 */
	getPort() {
		return this.port;
	}

	/**
	 * Returns a promise resolved when the browser with browserId connects to the server.
	 * The promise returns a socket toward the browser once resolved.
	 * @param {number} browserId - The ID of the browser to await
	 * @returns {Promise<Socket>} - Promise for the socket toward the browser
	 */
	browserConnection(browserId) {
		return new Promise((resolve, reject) => {
			const onBrowserConnection = browser => {
				const onBrowserReady = ({ bid }) => {
					if (bid == browserId) {
						this.server.removeListener("connect", onBrowserConnection);
						browser.removeListener("browser-ready", onBrowserReady);
						resolve(browser);
					} else {
						browser.removeListener("browser-ready", onBrowserReady);
					}
				};
				browser.on("browser-ready", onBrowserReady);
			};
			this.server.on("connect", onBrowserConnection);
		});
	}
}

/*
 * Handle the requests and return a simple html page containing the informations
 * necessary to bootstrap the atrica-extension and etablish connection
 */
function requestHandler(req, res) {
	let params = paramsForUrl(req.url);

	// USED BY ATRICA EXTENSION TO GET INFORMATIONS
	let title = `atrica::${params.port}::${params.bid}`;

	res.writeHead(200, { "Content-Type": "text/html" });
	res.write(
		`<html>
			<head>
				<title>${title}</title>
			</head>
			<body>${title}</body>
		</html>`
	);
	res.end();
}

module.exports = Server;
