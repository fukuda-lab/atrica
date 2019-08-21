const atrica = require("../src/index");

const domains = [
	"wikipedia.org",
	"wiktionary.org",
	"wikiquote.org",
	"wikibooks.org"
];

async function setup(isRestarting, workerId) {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const logger = await atrica.logger(browser, "./crawling-result");
	return [browser, logger];
}

async function worker(domain, [browser, logger]) {
	const url = `https://${domain}`;
	const sessionName = domain;
	const session = await logger.newSession(sessionName);
	const page = await browser.newPage();
	session.listen(page);
	// Max time 
	await page.goto(url, { timeout: 30000 }).catch(console.error);
	await page.close();
	await session.close();
}

async function cleanup(domain, [browser, logger]) {
	await browser.close();
	// If the brower failed during this session, we delete it
	logger.deleteSession(domain);
}

async function main() {
	const crawler = await atrica.crawler();
	crawler.setup(setup);
	crawler.tasks(domains);
	crawler.worker(worker);
	crawler.concurrency(2); // Launching 2 browsers
	crawler.cleanup(cleanup);
	crawler.timeout(40)

	await crawler.crawl();
	process.exit();
}

main();
