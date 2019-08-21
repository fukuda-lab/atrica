import displayWelcomeMessage from "./lib/welcome";
import { isChrome, isFirefox, getCurrentWindow, bootstrap, connectToServer } from "./lib/utils";
import * as actions from "./lib/actions";
import network from "./lib/network";
import $ from "../puppeteer/instructions";
import browser from "webextension-polyfill";

const log = msg => console.log(msg);

async function main() {
	/* =======================================================================
	 * ========================= Bootstraping atrica =========================
	 * ======================================================================= */
	log("Waiting for external bootstrap...");
	let { tab: defaultTab, port, bid } = await bootstrap();
	log(`Default tab id is '${defaultTab.id}' .`);

	log("Bootstrap connection to worker...");
	let server = await connectToServer(port);

	log("Acquiring current window...");
	const targetWindow = await getCurrentWindow();
	log(`Window id is '${targetWindow.id}' .`);

	log("Acquiring current tab...");

	log("Initialising network events...");
	if (isFirefox()) network(server);

	// For debug
	browser.tabs.onUpdated.addListener(function(tabId, info, tab) {
		log(`======>[${tabId}][${info.status}][${tab.url}]`, info);
	});

	/* =======================================================================
	 * =============================== EVENTS ================================
	 * ======================================================================= */
	// Tab creation event
	browser.tabs.onCreated.addListener(({ id }) => {
		server.emit("event", { type: "targetcreated", params: { id } });
	});

	// Page loading events
	const loadEvents = [
		"document_start",
		"document_end",
		"document_idle",
		"document_load"
	];
	browser.runtime.onMessage.addListener((msg = {}, { tab }) => {
		console.log(` >>> MESSAGE : ${msg.status} : ${tab.id}`);
		const { status } = msg;
		const { id: tabId } = tab;
		if (loadEvents.includes(status)) {
			console.log(` >>> FOO : ${msg.status} : ${tab.id}`);
			console.log("");
			server.emit("event", { type: status, params: { tabId } });
		}
	});

	/* =======================================================================
	 * ========================== Server connection ==========================
	 * ======================================================================= */
	server.on("connect", async function onConnectToWorker() {
		await displayWelcomeMessage(defaultTab.id, port, bid);
		log("Notifying the worker that browser is ready...");
		server.emit("browser-ready", { bid });
	});

	/* =======================================================================
	 * =========================== INSTRUCTIONS ==============================
	 * ======================================================================= */
	// Handle instruction
	server.on("instruction", async function onInstruction(instruction) {
		let { id, type, params = {} } = instruction;
		let context = { defaultTab, window: targetWindow };

		let handlers = {
			[$.page.goto]: actions.goto,
			[$.clearBrowsingData]: actions.clearBrowsingData,
			[$.page.evaluate]: actions.evaluate,
			[$.page.screenshot]: actions.screenshot,
			[$.page.newPage]: actions.newPage,
			[$.page.close]: actions.closePage,
			[$.getCookies]: actions.getCookies,
			[$.setCookies]: actions.setCookies,
			[$.page.pages]: actions.getAllPages,
			[$.evaluate]: actions.globalEvaluate
		};

		// Instruction success
		try {
			log(`==> [${type}] ${Object.values(params).join(" ")}`);
			if (!handlers[type])
				throw new Error(`Instruction of type [${type}] not supported`);
			let handler = handlers[type];
			let result = await handler(params, context);
			server.emit("instruction-done", { id, result });
		} catch (error) {
			//Instruction error
			console.error(instruction);
			console.error(error);
			server.emit("instruction-error", {
				id: id,
				error: `Attrica-extension :: ${error.name} : ${error.message}\n ${error.stack}`
			});
		}
	});
}

main();
