const atrica = require("../src/index");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];
	// Create the logger, saves results in './crawl-results'
	const logger = await atrica.logger(browser, "./crawl-results");

	for (let domain of domains) {
		const sessionName = domain;
		const session = await logger.newSession(sessionName);

		const url = `https://${domain}`;
		const page = await browser.newPage();

		session.listen(page);

		await page.goto(url);
		await atrica.utils.sleep(1);
		await page.close();

		await session.saveCookies();
		await session.close();
		await browser.clearAllBrowsingData();
	}

	await browser.close();
	process.exit();
}

main();
