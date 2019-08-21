const atrica = require("../src/index");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	const getHistory = () => {
		return new Promise(resolve => {
			chrome.history.search({ text: "" }, resolve);
		});
	};

	for (let domain of domains) {
		const url = `https://${domain}`;
		const page = await browser.newPage();
		await page.goto(url);
		// Native puppeteer feature
		let title = await page.evaluate(() => window.document.title);
		console.log(title);
		await page.close();
	}

	// Using atrica browser.evaluate method to access Chrome Extensions API
	let history = await browser.evaluate(getHistory);
	console.log(history);

	await browser.close();
	process.exit();
}

main();
