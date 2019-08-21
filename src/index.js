const path = require("path");
const profile = require("./profile");
const launch = require("./launch");
const logger = require("./logger");
const crawler = require("./crawler");
const utils = require("./utils");
const models = require("./logger/models");
const Sequelize = require("sequelize").Sequelize;

/**
 * @typedef {import('./logger').Logger} Logger
 * @typedef {import('./logger').LoggerContext} LoggerContext
 * @typedef {import('./crawler').Crawler} Crawler
 * @typedef {import('./launch').Puppeteer} Puppeteer
 */

module.exports = {
	launch,
	profile,
	crawler,
	utils,
	logger,
	models: resultPath => {
		let sequelize = new Sequelize({
			dialect: "sqlite",
			storage: path.resolve(resultPath, "database.sqlite"),
			logging: false
		});
		return models(sequelize);
	}
};
