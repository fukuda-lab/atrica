const atrica = require("../src/index");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
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

main();
