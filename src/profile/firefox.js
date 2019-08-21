const path = require("path");
const fs = require("fs");
const utils = require("../utils");
const https = require("https");

function unescapeUnicode(str) {
	return str.replace(/\\u([a-fA-F0-9]{4})/g, function(g, m1) {
		return String.fromCharCode(parseInt(m1, 16));
	});
}

async function getExtension({ id, name, cache, verbose = true }) {
	cache = cache || path.resolve("./.cache/firefox");
	if (!id) throw new Error("getFirefoxExtension need the id parameter");

	let filename = name ? `${name}.xpi` : id + ".xpi";
	let filepath = path.resolve(cache, filename);

	if (fs.existsSync(filepath)) {
		if (verbose) console.log(`${filename} found in cache.`);
		return filepath;
	}

	let addonPageUrl = `https://addons.mozilla.org/en-US/firefox/addon/${id}/`;
	let pageContent = await new Promise((resolve, reject) => {
		https.get(addonPageUrl, resp => {
			if (200 <= resp.statusCode && resp.statusCode < 300) {
				utils
					.streamToString(resp, "utf-8")
					.then(resolve)
					.catch(reject);
			} else {
				reject(
					new Error(
						`Could not load extension page (code ${
							resp.statusCode
						}). Are you sure the id is correct ?`
					)
				);
			}
		});
	});

	pageContent = unescapeUnicode(pageContent);

	let matches = pageContent.match(
		/"(https:[^"]*file\/[0-9]+\/[^"]*\.xpi[^"]*)"/
	);
	if (!matches)
		throw new Error("Could not extract xpi file url from extension page...");

	url = matches[1];

	if (verbose) console.log(`Downloading ${filename} ...`);
	await utils.download(url, cache, filename, verbose);
	if (verbose) console.log(`Done!`);
	return filepath;
}

module.exports = getExtension;
