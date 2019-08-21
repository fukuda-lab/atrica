const { existsSync: exists } = require("fs");
const path = require("path");
const Profile = require("../profile/profile");
const puppeteer = require("puppeteer");
const fpuppeteer = require("puppeteer-firefox");
const foxr = require("foxr").default;
const BrowserPuppeteer = require("../puppeteer");
const AtricaServer = require("../puppeteer/server");
const { sleep, assert } = require("../utils");
const { spawn } = require("child_process");
const uniqid = require("uniqid");
const getPort = require("get-port");
const fs = require("fs");

let mfirstPort = 2850;

/**
 * @typedef {
   	(import('puppeteer').Browser | import('foxr').TBrowser)
   	& import('../puppeteer').TPuppteer
   	& {profile:Puppeteer}
   } TPuppeteer
 */

/**
 * Launch the browser
 * @param {Profile} profile
 * @param {object} options
 * @returns {Promise<TPuppeteer>} the browser
 */
async function launch(profile, { atrica: withAtrica = true } = {}) {
	let browser;
	let atrica;
	// FIREFOX
	if (profile.browser === "firefox") {
		[browser, atrica] = await launchWithFoxr(profile);
		browser.profile = profile;
		browser = enrichBrowserAPI(browser, atrica);
	}
	// CHROMIUM
	else if (profile.browser === "chromium") {
		[browser, atrica] = await launchWithChromiumPuppeteer(
			profile,
			withAtrica
		);
		browser.profile = profile;
		if (withAtrica) {
			browser = enrichBrowserAPI(browser, atrica);
		}
	}
	// ERROR : NOT VALID BROWSER
	else {
		throw new Error('Profile.browser must be either "chromium" or "firefox"');
	}

	return browser;
}

/* ------------------------------------------------------------------------------- *
 *                                UTIL FUNCTIONS                                   *
 * ------------------------------------------------------------------------------- */
const distPath = path.resolve(__dirname, "../..", "dist");
const chromeExtensionPath = path.join(distPath, "atrica-extension");
const firefoxExtensionPath = path.join(distPath, "atrica-extension.xpi");
const DIS_EXT = "--disable-extensions";

const filterOutArguments = (args, blacklist) => {
	return args.filter(e => !blacklist.find(a => e.split("=")[0] === a));
};

/* ------------------------------------------------------------------------------- *
 *                                  FOXR LAUNCH                                    *
 * ------------------------------------------------------------------------------- */
async function launchWithFoxr(profile) {
	let binary = profile.binary;
	assert(binary && exists(binary), "Binary file does not exists");

	let options = {
		args: [],
		headless: false,
		defaultViewport: { width: 1366, height: 768 },
		...profile.options
	};

	let marionettePort = await getPort({ port: [mfirstPort] });
	mfirstPort += 50;

	let defaultArgs = ["-marionette", "-no-remote"];
	if (options.headless) defaultArgs.push("-headless");
	let args = [...defaultArgs, ...options.args, "-profile", profile.path];
	profile.env = profile.env || {};

	let fprefs = `
		user_pref("marionette.defaultPrefs.port", ${marionettePort});
		user_pref("marionette.port", ${marionettePort});
	`;

	let prefsPath = path.resolve(profile.path, "prefs.js");
	let oldPrefs = "";
	try {
		oldPrefs = await fs.promises.readFile(prefsPath, "utf-8");
	} catch (error) {}

	let newPrefs = oldPrefs.replace(/^.*marionette\./gm, "") + fprefs;
	await fs.promises.writeFile(prefsPath, newPrefs);

	const [url, bid] = await setupAtrica();

	args.push(url);

	console.log(`Launching ${binary} ${args.join(" ")}`);
	let proc = spawn(binary, args, { env: { ...process.env, ...profile.env } });

	let browser = await connectToMarionette(marionettePort, options);
	await browser.install(firefoxExtensionPath, true);

	let atrica = await connectToBrowser(bid);

	for (let extension of profile.extensions) {
		await browser.install(extension, true);
	}

	browser.close = () => proc.kill();
	return [browser, atrica];
}

async function connectToMarionette(port, options) {
	let browser = null;
	let nb_attempt = 0;
	while (!browser) {
		if (nb_attempt <= 100) {
			await sleep(0.1);
		} else {
			await sleep(4);
		}
		try {
			browser = await foxr.connect({ ...options, port });
			console.log("Connected to browser!");
		} catch (error) {
			if (nb_attempt > 100)
				console.log(
					`Failed to connect to firefox on port ${port}. Retrying in 4 seconds.`
				);
			browser = null;
			nb_attempt++;
		}
	}
	return browser;
}

/* ------------------------------------------------------------------------------- *
 *                               PUPPETEER LAUNCH                                  *
 * ------------------------------------------------------------------------------- */
async function puppeteerOptions(profile, ddefaultArgs, ddisabledArgs, pup) {
	let {
		args: customArgs = [],
		disabledArgs = ddisabledArgs,
		...otherOptions
	} = profile.options;

	// Filter out the default args
	options = {
		headless: false,
		defaultViewport: { width: 1366, height: 768 },
		...otherOptions,
		ignoreDefaultArgs: true,
		userDataDir: profile.path,
		executablePath: profile.binary
	};

	let defaultArgs = filterOutArguments(
		[...ddefaultArgs, ...pup.defaultArgs(options)],
		disabledArgs
	);
	options.args = [...defaultArgs, ...customArgs];
	return options;
}

/**
 * @returns {import('puppeteer').Browser}
 */
async function launchWithChromiumPuppeteer(profile, withAtrica = true) {
	let [url, bid] = await setupAtrica();
	let extensions = profile.extensions || [];
	if (withAtrica) extensions.push(chromeExtensionPath);
	let args =
		extensions.length > 0
			? [`--load-extension=${extensions.join(",")}`, url]
			: [url];
	const options = await puppeteerOptions(profile, args, [DIS_EXT], puppeteer);
	if (options.headless && extensions.length)
		throw new Error(
			"Chromium does not support headless mode with extensions." +
				"You must disable atrica and remove all extensions."
		);
	const browser = await puppeteer.launch(options);
	let atrica = await connectToBrowser(bid);
	return [browser, atrica];
}

/**
 * @returns {import('puppeteer').Browser}
 */
async function launchWithFirefoxPuppeteer(profile, atrica = true) {
	const options = puppeteerOptions(profile, ["-marionette"], [], fpuppeteer);
	const browser = await fpuppeteer.launch(options);
	let fbrowser = await foxr.connect();
	browser.install = fbrowser.install.bind(fbrowser);
	return browser;
}

/* ------------------------------------------------------------------------------- *
 *                                   ATRICA                                        *
 * ------------------------------------------------------------------------------- */

const atricaServer = new AtricaServer();
/**
 * @param {import('puppeteer').Browser} browser
 */
async function setupAtrica() {
	const bid = uniqid();
	await atricaServer.run();
	const port = atricaServer.getPort();
	let url = `http://127.0.0.1:${port}?atrica-extension=true&port=${port}&bid=${bid}`;
	return [url, bid];
}

async function connectToBrowser(bid) {
	const socket = await atricaServer.browserConnection(bid);
	const atrica = new BrowserPuppeteer(socket);
	return atrica;
}

/**
 * @param {import('puppeteer').Browser & {profile:Profile}} browser
 * @param {Puppeteer} atrica
 */
function enrichBrowserAPI(browser, atrica) {
	let result = browser;
	if (browser.profile.browser === "firefox") {
		// Launched with foxr
		if (browser.profile.binary) {
			result = atrica;
			result.close = browser.close.bind(browser);
			result.install = browser.install.bind(browser);
		} else {
			// Until firefox puppeteer is stable
			result = atrica;
			result.close = browser.close.bind(browser);
			result.install = browser.install.bind(browser);
		}
		browser.atrica = atrica;
	}

	if (result !== atrica) {
		browser.cookies = atrica.cookies.bind(atrica);
		browser.evaluate = atrica.evaluate.bind(atrica);
		browser.clearAllBrowsingData = atrica.clearAllBrowsingData.bind(atrica);
		browser.clearBrowsingData = atrica.clearBrowsingData.bind(atrica);
	}

	return result;
}

module.exports = launch;
