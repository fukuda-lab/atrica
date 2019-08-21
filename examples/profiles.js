const atrica = require("../src/index");

async function main() {
	/*
	const ublockPath = await atrica.profile.getChromeExtension({
		// Extracted from url in webstore
		id: "ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm"
	});

	const operaProfile = await atrica.profile({
		browser: "chromium",
		binary: "/snap/bin/opera",
		extensions: [ublockPath]
	});

	const opera = await atrica.launch(operaProfile);
	const page = await opera.newPage();
	await page.goto("https://wikipedia.org");
	await atrica.utils.sleep(5);
	await page.close();
	await opera.close();
	*/

	// =============================================================
	// Example of training privacy badger and then evaluating its
	// performances on a few domains
	// =============================================================

	// ====================  TRAINING PIVACY BADGER ================
	const privacyBadger = await atrica.profile.getFirefoxExtension({
		id: "privacy-badger17",
		name: "privacy-badger"
	});
	const trainingProfile = await atrica.profile({
		browser: "firefox",
		binary: "/usr/bin/firefox",
		path: "./privacy-badger-profile"
		// temporary install, not what we want
		// extensions: [privacyBadgerPath]
	});

	const firefox = await atrica.launch(trainingProfile);
	// Firefox-based browsers only
	firefox.install(privacyBadger);
	const trainingDomains = ["google.com", "facebook.com", "amazon.com"];

	for (let domain of trainingDomains) {
		const url = `https://${domain}`;
		const page = await firefox.newPage();
		await page.goto(url);
		await atrica.utils.sleep(2);
		await page.close();
	}

	await firefox.clearAllBrowsingData();
	await firefox.close();

	//============== MEASURING PRIVACY BADGER EFFECTS ================
	// Loading the trained profile.
	// Probably in a separate script, but we could call trainingProfile.copy() directly here
	const trainedProfile = await atrica.profile({
		browser: "firefox",
		binary: "/usr/bin/firefox",
		path: "./privacy-badger-profile"
	});

	// We don't want to modifiy trainedProfile, we might need it later
	// so we make a copy of it (stored in /tmp/xxxxxx)
	const trainedProfileCopy = await trainedProfile.copy();
	const pbfirefox = await atrica.launch(trainedProfileCopy);

	const samplingDomains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	for (let domain of samplingDomains) {
		const url = `https://${domain}`;
		const page = await pbfirefox.newPage();
		await page.goto(url);
		await atrica.utils.sleep(2);
		await page.close();
	}
	
	await firefox.close();

}

main();
