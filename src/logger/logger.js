const fs = require("fs-extra");
const path = require("path");
const getModels = require("./models");
const Sequelize = require("sequelize");
const uniqid = require("uniqid");
const Session = require("./session");

class Logger {
	constructor(browser, resultPath) {
		this.sequelize = null;
		this.browser = browser;
		this.requestCounter = 1;

		if (resultPath) {
			this.resultPath = resultPath;
			this.filesPath = path.resolve(resultPath, "files");
			fs.mkdirSync(resultPath, { recursive: true });
			fs.mkdirSync(this.filesPath, { recursive: true });

			this.sequelize = new Sequelize({
				dialect: "sqlite",
				storage: path.resolve(resultPath, "database.sqlite"),
				logging: false
			});
		} else {
			this.sequelize = new Sequelize({
				dialect: "sqlite",
				logging: false
			});
		}
	}

	async init(modelsInfo = {}) {
		this.modelsInfo = modelsInfo;
		this.models = await getModels(this.sequelize, modelsInfo);
		this.requestCounter = (await this.models.Request.max("id")) || 1;
	}

	requestId(request) {
		if (!request) return null;
		request.__id = request.__id || this.requestCounter++;
		return parseInt(request.__id);
	}

	/**
	 * Make a session
	 * @param {string} name
	 * @param {object} options
	 * @param {boolean} options.requestBody - If true request body and calculate size
	 * @param {boolean} options.saveBody - Should the response body be saved in a file ?
	 * @param {Array<string>} options.filesTypes - e types that should be saved
	 * @returns {Promise<Session>}
	 */
	async newSession(name = `no_name`, options = {}) {
		let {
			requestBody = true,
			filesTypes = ["image", "script", "stylesheet"],
			...others
		} = options;
		let session = new Session(name, this, { requestBody, filesTypes, ...others });
		await session.init();
		return session;
	}

	/**
	 * Delete the session with name {name} and all the requests, responses, pages, and cookies associated.
	 * @param {string} name - name of the session to delete
	 */
	async deleteSession(name) {
		let count = await this.models.Session.destroy({ where: { name } });
		return count;
		/*if (name) {
			let count = await this.models.Session.count({ where: { name } });
			if (count > 0) {
				await this.sequelize.query(
					`DELETE FROM responses WHERE responses.id IN (SELECT responses.id FROM responses INNER JOIN requests ON requests.responseId = responses.id INNER JOIN pages ON pages.id = requests.pageId INNER JOIN  sessions ON sessions.id = pages.sessionId WHERE sessions.name = :sname);`,
					{ replacements: { sname: name, logging: console.log } }
				);
				await this.sequelize.query(
					`DELETE FROM requests WHERE requests.id IN (SELECT requests.id FROM requests INNER JOIN pages ON pages.id = requests.pageId INNER JOIN  sessions ON sessions.id = pages.sessionId WHERE sessions.name = :sname);`,
					{ replacements: { sname: name, logging: console.log } }
				);
				await this.sequelize.query(
					`DELETE FROM pages WHERE pages.id IN (SELECT pages.id FROM pages INNER JOIN  sessions ON sessions.id = pages.sessionId WHERE sessions.name = :sname);`,
					{ replacements: { sname: name, logging: console.log } }
				);
				await this.sequelize.query(
					`DELETE FROM cookies WHERE cookies.id IN (SELECT cookies.id FROM cookies INNER JOIN  sessions ON sessions.id = cookies.sessionId WHERE sessions.name = :sname);`,
					{ replacements: { sname: name, logging: console.log } }
				);
				await this.sequelize.query(
					`DELETE FROM sessions WHERE sessions.name = :sname;`,
					{ replacements: { sname: name, logging: console.log } }
				);
			}
		}*/
	}

	async saveFile(buffer) {
		if (this.filesPath) {
			let fileName = uniqid();
			let filePath = path.resolve(this.filesPath, fileName);
			await fs.writeFile(filePath, buffer, "binary");
			return fileName;
		} else {
			throw new Error("The option 'resultPath' is needed to save files!");
		}
	}
}

module.exports = Logger;
