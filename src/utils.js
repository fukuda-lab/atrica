const fs = require("fs");
const path = require("path");
const request = require("request");
const requestProgress = require("request-progress");
const progressBar = require("cli-progress");
const $ = require("colors/safe");
const { isBinaryFile } = require("isbinaryfile");
const { promisify } = require("util");

const utils = {
	/**
	 * @returns {string} string with the following format:
	 * `${year}-${month}-${day}::${hours}:${minutes}:${seconds}`
	 */
	now() {
		const pad2 = x => x.toString().padStart(2, "0");
		const now = new Date();
		let year = now.getFullYear();
		let month = pad2(now.getMonth() + 1);
		let day = pad2(now.getDate());
		let hours = pad2(now.getHours());
		let minutes = pad2(now.getMinutes());
		let seconds = pad2(now.getSeconds());
		return `${year}-${month}-${day}::${hours}:${minutes}:${seconds}`;
	},

	/**
	 * Raise exception if cond is false
	 * @param {boolean} cond
	 * @param {string} message
	 */
	assert(cond, message) {
		if (!cond) {
			throw new Error(message);
		}
	},

	/**
	 * Raise exception if cond is true
	 * @param {boolean} cond
	 * @param {string} message
	 */
	assertNot(cond, message) {
		if (!cond) {
			throw new Error(message);
		}
	},

	/**
	 * Replace all character not matching [a-zA-Z0-9] by `character` and return lowerCase result
	 * @param {string} str
	 * @param {string} character - character used as replacement (default = "_")
	 */
	az09(str, charater = "_") {
		return str.replace(/\W/g, charater).toLowerCase();
	},

	/**
	 * Sleep {ms} milliseconds
	 * @param {number} ms
	 * @returns {Promise}
	 */
	msleep(ms) {
		return new Promise(resolve =>
			setTimeout(() => resolve(null), Math.round(ms))
		);
	},

	/**
	 * Sleep {s} seconds
	 * @param {number} s
	 * @returns {Promise}
	 */
	async sleep(s) {
		await utils.msleep(s * 1000);
	},

	/**
	 * Throw an error after {s} seconds
	 * @param {number} s - time to wait before throwing error
	 * @returns {Promise.<T>} A promise that gets rejected after {s} seconds
	 * @template T
	 */
	async timeout(s) {
		await utils.sleep(s);
		throw new Error(`Error: timed-out after ${s} seconds`);
	},

	/**
	 * Is equivalent to calling Promise.race
	 * @param {Array<Promises>} promises
	 */
	race(...promises) {
		return Promise.race(promises.flat(2));
	},

	/**
	 * Write {data} in {filePath}
	 * @param {string} filePath - The path of the file to write.
	 * 	The function will create the path if it doesn't exists
	 * @param {(object|string)} data  - The data to write. Will convert objects to JSON
	 * @param {object} options  - See fs.writeFile options
	 * @returns {Promise}
	 */
	async writeFile(filePath, data, options) {
		if (typeof data === "object") data = JSON.stringify(data, null, 3);
		let parentPath = path.dirname(filePath);
		await fs.promises.mkdir(parentPath, { recursive: true });
		await fs.promises.writeFile(filePath, data, options);
	},

	/**
	 * Create path if it doesn't exist
	 * @param {string} path - The folder path to create
	 * @returns {Promise}
	 */
	async makePath(path) {
		await fs.promises.mkdir(path, { recursive: true });
	},

	/**
	 * Will read a file and return its content
	 * @param {string} filePath - Path of the file to read
	 * @returns {Promise<string>} - The content of the file
	 */
	async readFile(filePath) {
		return await fs.promises.readFile(filePath, "utf8");
	},

	/**
	 * awaitMost will wait until minCount promises are resolved, then will wait
	 * 	until either all the promises are resolved, or will resolve after a timeout
	 * @param {Array<Promise>} promises  - The promises to await
	 * @param {number} minCount - The minimum number of promise that has to be resolved
	 * @param {number} timeout - Time to wait after minCount successful promise resolved
	 */
	awaitMost(promises, minCount, timeout = 1000) {
		minCount = minCount || promises.length;
		return new Promise(resolve => {
			let count = 0;
			let timeoutId = null;

			for (let promise of promises) {
				promise.then(() => {
					count++;
					if (count >= promises.length) {
						clearTimeout(timeoutId);
						resolve();
						return;
					} else if (count >= minCount && !timeoutId) {
						setTimeout(resolve, timeout);
					}
				});
			}
		});
	},
	/**
	 * Will extract parameters from an url
	 * @param {string} url - The url
	 * @returns {object} - The params
	 */
	paramsForUrl(url) {
		let params = {};
		(url.split("?")[1] || "")
			.split("&")
			.map(v => v.split("="))
			.forEach(v => (params[v[0]] = v[1]));
		return params;
	},

	/**
	 * Will format a number of bytes in human readable format
	 * @param {number} value
	 */
	formatSize(value) {
		let str = "";
		if (value >= 1000000 && value < 1000000000) {
			str = (value / 1000000.0).toFixed(2) + "MB";
		} else if (value >= 1000) {
			str = (value / 1000.0).toFixed(2) + "kB";
		} else if (value < 1000) {
			str = value + " bytes";
		} else {
			str = (value / 1000000000.0).toFixed(2) + "GB";
		}

		return str;
	},

	timeFormats: [
		{ unit: "day", symbol: "d", duration: 24 * 60 * 60 * 1000 },
		{ unit: "hour", symbol: "h", duration: 60 * 60 * 1000 },
		{ unit: "minute", symbol: "m", duration: 60 * 1000 },
		{ unit: "second", symbol: "s", duration: 1000 },
		{ unit: "millisecond", symbol: "ms", duration: 1 }
	],

	/**
	 * Will format a number of milliseconds in days, hours, minutes, seconds
	 * @param {number} value - the number of milliseconds
	 * @param {string} lastUnit - the last unit (ex: if "minute", will round the duration to minutes)
	 */
	formatMilliseconds(value, lastUnit = "second") {
		let str = "";
		value = Math.round(value);
		for (let { unit, symbol, duration } of utils.timeFormats) {
			if (value >= duration || (unit == lastUnit && str === "")) {
				str = str + " " + Math.floor(value / duration) + symbol;
				value = value % duration;
				if (unit == lastUnit) break;
			}
		}
		return str.trim();
	},

	/**
	 * Will format a number of seconds in days, hours, minutes, seconds
	 * @param {number} value - the number of seconds
	 * @param {string} lastUnit - the last unit (ex: if "minutes", will round the duration to minutes)
	 */
	formatSeconds(value, lastUnit) {
		return utils.formatMilliseconds(value * 1000, lastUnit);
	},

	/**
	 * Returns an array of size {n} with the values [1, 2, ..., n - 1]
	 * @returns {Array} - The array
	 */
	range(n) {
		return [...Array(n).keys()];
	},

	streamToString(stream, encoding) {
		return new Promise((resolve, reject) => {
			const chunks = [];

			stream.on("data", function(chunk) {
				chunks.push(chunk);
			});

			stream.on("error", function(error) {
				reject(error);
			});

			stream.on("end", function() {
				let fullBuffer = Buffer.concat(chunks);
				resolve(fullBuffer.toString(encoding));
			});
		});
	},

	/**
	 * find all text files in folderPath
	 * @param {string} folderPath
	 */
	async findTextFiles(folderPath) {
		let files = await promisify(fs.readdir)(folderPath);
		let paths = await Promise.all(
			files.map(async filename => {
				let filepath = path.join(folderPath, filename);
				try {
					let stat = await promisify(fs.stat)(filepath);
					if (stat.isDirectory())
						return await utils.findTextFiles(filepath);
					else if (!(await isBinaryFile(filepath)) && stat.size !== 0)
						return filepath;
				} catch (error) {
					// In case of broken symbolic link for instance
					return undefined;
				}
			})
		);
		return paths.filter(path => path !== undefined).flat();
	},

	/**
	 * Replace {pattern} by {str} in file at filepath
	 * @param {string} filepath
	 * @param {string} pattern
	 * @param {string} str
	 */
	async replaceInFile(filepath, pattern, str) {
		let content = await promisify(fs.readFile)(filepath);
		content = content.toString();
		let newContent = content.replace(pattern, str);
		await promisify(fs.writeFile)(filepath, newContent);
	},

	/**
	 * Replace {pattern} by {str} in files
	 * @param {Array<string>} files
	 * @param {string} pattern
	 * @param {string} str
	 */
	async replaceInFiles(files, pattern, str) {
		await Promise.all(
			files.map(file => utils.replaceInFile(file, pattern, str))
		);
	},

	/**
	 * Replace pattern by str in all text files contained in folderPath, and its subfolders
	 * @param {string} folderPath
	 * @param {string} pattern
	 * @param {string} str
	 */
	async replaceInFolder(folderPath, pattern, str) {
		let files = await utils.findTextFiles(folderPath);
		await utils.replaceInFiles(files, pattern, str);
	},

	/**
	 * Download the file at {url} and save it to {folder}/{filename}
	 * @param {string} url
	 * @param {string} folder
	 * @param {string} filename
	 * @param {boolean} verbose - Display progress bar ?
	 */
	download(url, folder, filename, verbose = true) {
		return new Promise(async (resolve, reject) => {
			const pb = new progressBar.Bar(
				{
					format:
						" {bar} {percentage}% | {transferred} / {totalSize} - {speed} | {elapsed} - {remaining}",
					stream: process.stdout
				},
				progressBar.Presets.shades_grey
			);
			if (verbose) {
				pb.start(100, 0, {
					speed: "0 bytes/s",
					totalSize: "0 bytes",
					transferred: "0 bytes",
					elapsed: "0s",
					remaining: "0s"
				});
			}

			await utils.makePath(folder);
			let filepath = path.resolve(folder, filename);
			const file = fs.createWriteStream(filepath);

			requestProgress(request(url))
				.on("progress", state => {
					if (verbose) {
						let {
							size: { total = 0, transferred = 0 } = {},
							time: { elapsed = 0, remaining = 0 } = {},
							speed = 0,
							percent = 0
						} = state;

						pb.update(percent * 100, {
							speed: `${utils.formatSize(speed || 0)}/s`,
							totalSize: utils.formatSize(total || 0),
							transferred: utils.formatSize(transferred),
							elapsed: utils.formatSeconds(elapsed),
							remaining: utils.formatSeconds(remaining)
						});
					}
				})
				.on("error", reject)
				.on("end", () => {
					if (verbose) {
						pb.update(100, {
							transferred: utils.formatSize(fs.statSync(filepath).size),
							remaining: "0s"
						});
					}
					pb.stop();
					setTimeout(resolve, 100);
				})
				.pipe(file);
		});
	}
};

module.exports = utils;
