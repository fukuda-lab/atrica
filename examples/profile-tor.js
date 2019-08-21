const atrica = require("../src/index");
const path = require("path");

async function main(torPath) {
	const binaryPath = path.resolve(torPath, "Browser/firefox.real");

	const defaultProfilePath = path.resolve(
		torPath,
		"Browser/TorBrowser/Data/Browser/profile.default"
	);

	let profile = await (await atrica.profile({
		browser: "firefox",
		path: defaultProfilePath,
		binary: binaryPath,
		env: { TOR_TRANSPROXY: "1" },
		//options: { headless: true }
	})).copy();

	let browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	for(let domain of domains) {
		const url = `https://${domain}`;
		const page = await browser.newPage();
		await page.goto(url);
		await atrica.utils.sleep(1);
		await page.close();
	}

	await browser.close();
	process.exit();
}

main("/home/user/TorBrowser");
