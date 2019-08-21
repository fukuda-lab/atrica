const Logger = require('./logger');

/**
 * @typedef {import('./logger')} Logger
 */

/**
 * @typedef LoggerContext
 * @property {import('./session')} session
 * @property {import('puppeteer').Page} page
 * @property {Record<string, typeof import('sequelize').Model>} models
 * @property {Logger} logger
 */

/**
	@typedef {Object} ModelDescription
	@property {(sequelize: typeof import('sequelize')) => Record<string, any>} schema

	@property {(
		model: typeof import('sequelize').Model,
		models: Record<string, typeof import('sequelize').Model>
		) => Record<String, any>
	} relations
	
	@property {(
		values: Record<string, string|number|boolean>,
 		session: import('./session'):
		) => any
	} onSession

	@property {(
		values: Record<string, string|number|boolean>,
		request: import('puppeteer').Request,
		context: LoggerContext
		) => any
	} onPage

	@property {(
		values: Record<string, string|number|boolean>,
		request: import('puppeteer').Request,
		context: LoggerContext
		) => any
	} onRequest

	@property {(
		values: Record<string, string|number|boolean>,
		response: import('puppeteer').Response,
		context: LoggerContext
		) => any
	} onResponse

	@property {(
		body: Buffer | string,
		values: Record<string, string|number|boolean>,
		response: import('puppeteer').Response,
		context: LoggerContext
		) => any
	} onResponseBody
 */

/**
 * This function will create a logger that will listen and record to requests and responses
 * and let you access to the browsers cookies.
 * In order
 * @param {object} browser
 * @param {string} resultPath
 * @param {Record<String, ModelDescription>} [models]
 * @returns {Logger}
 * @example
 * let profile = await atrica.profile({browser: "firefox"});
 * let browser = await atrica.launch(profile);
 * let logger = await atrica.logger(browser, {resultPath: "./results"});
 * let session = await logger.makeSession
 * let page = await browser.newPage();
 *
 */
async function logger(browser, resultPath, models = {}) {
	const logger = new Logger(browser, resultPath);
	await logger.init(models);
	return logger;
}

module.exports = logger;
