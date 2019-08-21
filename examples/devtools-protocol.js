const atrica = require("../src/index");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	for (let domain of domains) {
		const url = `https://${domain}`;
		const page = await browser.newPage();
		// Chrome Devtools Protocol client
		const client = await page.target().createCDPSession();
		await client.send("Network.enable");

		let wsTransferedBytes = 0;
		client.on(
			"Network.webSocketFrameReceived",
			({ response: { opcode, mask, payloadData } }) => {
				if (opcode == 1) wsTransferedBytes += payloadData.length;
				else wsTransferedBytes += Math.floor(payloadData.length * (6 / 8));
			}
		);

		await page.goto(url);
		await atrica.utils.sleep(1);

		// An alternative way to get the cookies on chrome if you
		// want to disable atrica's extension to enable headless mode
		let { cookies } = await client.send("Network.getAllCookies");
		console.log(`After visiting ${domain}:`);
		console.log(` - Cookies: ${cookies.length}`);
		console.log(` - Bytes transfered using websockets: ${wsTransferedBytes}`);
		console.log();

		// Removing all cookies from browser
		await client.send("Network.clearBrowserCookies");
		await page.close();
	}

	await browser.close();
	process.exit();
}

main();
