import browser from "webextension-polyfill";
import Pipe from "../../puppeteer/pipe";

export default function network(server) {
	const filter = { urls: ["<all_urls>"] };
	const respHeaders = ["responseHeaders"];
	const reqHeaders = ["requestHeaders"];
	const reqBody = ["requestBody"];
	const blocking = ["blocking"];
	const requests = {};

	Pipe.handleInactivePipes(server);

	// BEFORE REQUEST
	browser.webRequest.onBeforeRequest.addListener(
		function onBodyAvailable({ requestId, requestBody, tabId, type, ...details }) {
			requests[requestId] = Object.assign({}, requests[requestId], {
				id: requestId,
				body: requestBody,
				tabId: tabId,
				type,
				...details
			});
		},
		filter,
		reqBody
	);

	// BEFORE SENDING REQUEST'S HEADERS
	browser.webRequest.onBeforeSendHeaders.addListener(
		async function onHeaderAvailable(details) {
			let headers = {};
			let {
				url,
				type,
				requestId,
				requestHeaders,
				method,
				tabId,
				frameId,
			} = details;

			for (let header of requestHeaders)
				headers[header.name.toLowerCase()] = header.value;

			let frames = [];
			try {
				if (tabId >= 0) {
					frames = await browser.webNavigation.getAllFrames({ tabId });
				}
			} catch (error) {
				console.error("Error: getAllFrames", error);
			}
			frames = frames.map(({ url, frameId, parentFrameId }) => ({
				url,
				frameId,
				parentFrameId
			}));

			requests[requestId] = Object.assign({}, requests[requestId], {
				id: requestId,
				url,
				type,
				headers,
				method,
				tabId,
				frameId,
				frames
			});

			console.log("SENDING REQUEST");
			server.emit("event", {
				type: "request",
				params: requests[requestId]
			});

			delete requests[requestId];
		},
		filter,
		reqHeaders
	);

	// WHEN REQUEST COMPLETED
	browser.webRequest.onCompleted.addListener(
		function onCompleted(details) {
			let {
				requestId,
				responseHeaders,
				tabId,
				statusCode: status,
				fromCache,
				...others
			} = details;
			let headers = {};

			if(responseHeaders) {
				for (let header of responseHeaders)
					headers[header.name.toLowerCase()] = header.value;
			}

			let response = {
				requestId: requestId,
				tabId: tabId,
				headers,
				status,
				fromCache,
				...others
			};

			server.emit("event", { type: "response", params: response });
		},
		filter,
		respHeaders
	);

	// RECORDING REQUEST'S BODY
	if (browser.webRequest && browser.webRequest.filterResponseData) {
		function listener({ requestId }) {
			let pipe = new Pipe(server, requestId, 5000);
			let filter = browser.webRequest.filterResponseData(requestId);

			filter.ondata = function onFilterData(event) {
				filter.write(event.data);
				pipe.write(event.data);
			};

			filter.onstop = () => {
				pipe.end();
				filter.disconnect();
			};

			return {};
		}

		browser.webRequest.onBeforeRequest.addListener(
			listener,
			filter,
			blocking
		);
	}
}

