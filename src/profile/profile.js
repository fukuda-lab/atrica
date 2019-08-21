const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const { promisify } = require("util");
const utils = require("../utils");
const { assert } = utils;
const crypto = require("crypto");
const os = require("os");
const get_chrome_extension = require("./chrome");
const get_firefox_extension = require("./firefox");

/**
 * @typedef {object} ProfileOptions
 * @property {('firefox'|'chromium')} browser
 * @property {Array<string>} extensions - paths of the extensions to load
 * 	Please note that the extensions will only be loaded temporarly
 * 	and will NOT be installed in the profile. This is only possible for firefox
 * 	with `browser.install`, since chromium do not provide an API for this
 * @property {string} path - path where the profile will be created or loaded from
 * @property {string} name - name of the profile
 * @property {string} binary - browser's binary path
 * @property {object} options - puppteer options
 * @property {object} env - Environment variables
 */

/**
 * Allow to manipulate a browser session
 */
class Profile {
	/**
	 *	Create a Profile
	 * @param {ProfileOptions} options
	 */
	constructor({
		browser,
		name,
		path,
		tmp = false,
		extensions = [],
		binary,
		env,
		options
	}) {
		this.tmp = !name || tmp;

		if (this.tmp) {
			let uuid = crypto.randomBytes(12).toString("hex");
			name = `${browser}_${uuid}`;
		}

		assert(
			Profile.validBrowser(browser),
			`'${browser}' is not a valid browser name! 'firefox' or 'chromium' accepted`
		);

		this.browser = browser;
		this.name = name;
		this.path = path || Profile.path(browser, name, this.tmp);
		this.fullname = this.browser + "/" + this.name;
		this.binary = binary;
		this.options = { ...options };
		this.extensions = [...extensions];
		this.env = env;

		if (!name && !tmp) {
			console.error(
				`Warning : Profile : tmp = false but name undefined.` +
					`Creating a temporary profile at ${this.path}`
			);
		}
	}

	/**
	 * Return true if profile exists in file system
	 * @returns {Promise<boolean>}
	 */
	async exists() {
		return await Profile.exists(this.path);
	}

	/**
	 * Init the profile - ie create a folder for the profile
	 */
	async init() {
		if (await this.exists())
			throw new Error(
				`The profile '${this.fullname}' already exists in file system!`
			);

		await promisify(fs.mkdir)(this.path, { recursive: true });
	}

	/**
	 * Rename the profile
	 * @param {string} newName
	 */
	async rename({ name, path } = {}) {
		assert(await this.exists(), "Profile does not exists!");
		let newProfileOptions = {
			tmp,
			path,
			name,
			browser: this.browser,
			extensions: this.extensions,
			binary: this.binary,
			options: this.options
		};
		let newProfile = new Profile(newProfileOptions);
		assertNot(await newProfile.exists(), "Profile already exists!");
		await newProfile.assertDoesntExists();

		await fse.move(this.path, newProfile.path);
		await utils.replaceInFolder(newProfile.path, this.path, newProfile.path);

		this.name = newProfile.name;
		this.path = newProfile.path;
		this.fullname = newProfile.fullname;
	}

	/**
	 * copy the profile
	 * @param {string} newName
	 */
	async copy({ path, name } = {}) {
		assert(await this.exists(), "Profile does not exists!");
		let newProfileOptions = {
			path,
			name,
			env: this.env,
			browser: this.browser,
			extensions: this.extensions,
			binary: this.binary,
			options: this.options
		};
		let newProfile = new Profile(newProfileOptions);
		assert(!(await newProfile.exists()), "Profile already exists!");

		await fse.copy(this.path, newProfile.path);
		await utils.replaceInFolder(newProfile.path, this.path, newProfile.path);
		return newProfile;
	}

	/**
	 * Remove the profile
	 */
	async remove() {
		await fse.remove(this.path);
	}

	/**
	 * Clear the profile : delete it if exist, then init it
	 */
	async clear() {
		await this.remove();
		await this.init();
	}

	/**
	 * Throw an error if the profile doesnt exist
	 */
	async assertExists() {
		if (!(await this.exists()))
			throw new Error(`Profile '${this.fullname}' does not exist !`);
	}

	/**
	 * Throw an error if the profile exists
	 */
	async assertDoesntExists() {
		if (!(await this.exists()))
			throw new Error(`Profile '${this.fullname}' already exist.`);
	}

	/**
	 * Path of the profile on the file system
	 * @param {('firefox'|'chromium')} browser - the browser type:
	 * @param {*} name - name of the profile
	 * @returns {string} the path of the profile
	 */
	static path(browser, name, tmp = false) {
		if (tmp) {
			return path.resolve(os.tmpdir(), name);
		} else {
			return path.resolve(__dirname, "../profiles", browser, name);
		}
	}

	/**
	 * Path of the profile on the file system
	 * @param {string} path - path of the profile
	 * @returns {Promise<boolean>} true is profile exists
	 */
	static async exists(path) {
		return await promisify(fs.exists)(path);
	}

	/**
	 * Return true if {browser} is a valid browser name
	 * @param {string} browser - The type/name of the browser
	 */
	static validBrowser(browser) {
		return ["firefox", "chromium"].includes(browser);
	}

	/**
	 * throw an exception if {browser} is not valid
	 * @param {string} browser
	 */
	static assertValidBrowser(browser) {
		if (!Profile.validBrowser(browser))
			throw new Error(
				`Browser '${browser}' is not a valid Browser.` +
					` Browser must be either 'firefox' or 'chromium'`
			);
	}

	/**
	 * Load a profile or create it if it doesn't exist
	 * @param {ProfileOptions} options
	 * @returns {Promise<Profile>}
	 */
	static async profile(options) {
		Profile.assertValidBrowser(options.browser);

		let profile = new Profile({
			...options,
			tmp: typeof options.tmp === "undefined" ? !options.name : options.tmp
		});

		if (!(await profile.exists())) {
			await profile.init();
		}

		return profile;
	}

	/**
	 * Get extension for chrome from url and save it to {cache}
	 * @param {string} params.id - the id of the chrome extension you can also use the {url} param (see examples)
	 * @param {string} params.url - the url of the chrome extension (see examples)
	 * @param {string} params.name - the name of the extension. Will be used as foldername of the extension,
	 * 	so avoid special characters, especially "/" !
	 * @param {string} params.cache - path of the cache folder where the extension will be stored (created if don't exist)
	 * @param {boolean} params.verbose - should the function display debug info ? (download progress bar, etc...)
	 * @returns {Promise<String>} - Return a promise of the path of the extension
	 * @example
	 * let extensionPath = await Profile.getChromeExtension({
	 * 	// This is the url of the extension on google Webstore
	 * 	url: "https://chrome.google.com/webstore/detail/ublock/epcnnfbjfcgphgdmggkamkmgojdagdnn?hl=en",
	 * 	name: "ublock",
	 * 	cache: "./.cache", //default value
	 * 	verbose: true
	 * });
	 * // You can make it shorter by extracting the extension id from the url:
	 * let extensionPath = await Chrome.getExtension({
	 * 	// https://..../detail/ublock/{id}?hl=en
	 * 	id: "epcnnfbjfcgphgdmggkamkmgojdagdnn",
	 * 	name: "ublock",
	 * 	verbose: true
	 * });
	 * // You can also put the name before the id like this:
	 * let extensionPath = await Chrome.getExtension({
	 * 	id: "ublock/epcnnfbjfcgphgdmggkamkmgojdagdnn",
	 * 	verbose: true
	 * });
	 */
	static async getChromeExtension(params) {
		return await get_chrome_extension(params);
	}

	static async getFirefoxExtension(params) {
		return await get_firefox_extension(params);
	}
}

module.exports = Profile;
