const path = require('path');
const fs = require('fs');
const utils = require('../utils');
const crxUnzip = require('unzip-crx-3');

async function getExtension({ id, url, name, cache, verbose = true }) {
	cache = cache || path.resolve("./.cache/chrome");

	const extensionId = (id || url)
		// ".../" + "blur/epanfjkfahimkgomnigadpkobaefekcd?hl=en"
		.split("/")
		// [..., "blur", "epanfjkfahimkgomnigadpkobaefekcd?hl=en"]
		.pop() // "epanfjkfahimkgomnigadpkobaefekcd?hl=en"
		.split("?") // ["epanfjkfahimkgomnigadpkobaefekcd", "hl=en"]
		.shift(); // "epanfjkfahimkgomnigadpkobaefekcd"

	name =
		name ||
		(id || url)
			// ".../" + "blur/epanfjkfahimkgomnigadpkobaefekcd?hl=en"
			.split("/")
			// [..., "blur", "epanfjkfahimkgomnigadpkobaefekcd?hl=en"]
			.slice(-2) // ["blur", "epanfjkfahimkgomnigadpkobaefekcd?hl=en"]
			.shift(); // "blur"

	let folder = path.resolve(cache);
	let filename = name + ".crx";
	let filepath = path.resolve(folder, filename);
	let extensionPath = path.resolve(folder, name);

	if (fs.existsSync(extensionPath)) {
		if (verbose) console.log(`Extension ${name} found in cache (${folder})`);
	} else {
		const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=49.0&acceptformat=crx3&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;

		if (!fs.existsSync(cache)) {
			await fs.promises.mkdir(cache, {recursive: true});
		}

		if (verbose) {
			console.log(`Extension ${name} not found in cache.`);
			console.log(`Downloading ${name}...`);
		}

		await utils.download(crxUrl, folder, filename, verbose);
		if (verbose) console.log(`Unzipping '${filepath}'...`);
		await crxUnzip(filepath);
		if (verbose) console.log("Done!");
	}
	return extensionPath;
}

module.exports = getExtension;