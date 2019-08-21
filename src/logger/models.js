const Sequelize = require("sequelize");
const { STRING, INTEGER, TEXT, BOOLEAN } = Sequelize;

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
async function getModels(sequelize, customModels = {}) {
	/// UTILITY FUNCTIONS
	const define = (modelName, schemaFunc, defAttrs = {}, optionsFunc) => {
		let schema =
			typeof schemaFunc === "function" ? schemaFunc(Sequelize) : {};
		let options =
			typeof optionsFunc === "function" ? optionsFunc(Sequelize) : {};

		return sequelize.define(
			modelName.toLowerCase(),
			{ ...defAttrs, ...schema },
			{ timestamps: false, ...options }
		);
	};

	const schemaFor = name =>
		(customModels[name] && customModels[name].schema) || null;

	const hasOne = (Source, Target, as, foreignKey, options) =>
		Source.hasOne(Target, { as, foreignKey, ...options });

	const hasMany = (Source, Target, as, foreignKey, options) =>
		Source.hasMany(Target, { as, foreignKey, ...options });

	const belongsTo = (Source, Target, as, foreignKey, options) =>
		Source.belongsTo(Target, { as, foreignKey, ...options });

	// =============================================================================
	//                              DATABASE SCHEMA
	// =============================================================================

	let Session = define("session", schemaFor("Session"), {
		name: STRING
	});

	let Page = define("page", schemaFor("Page"), {
		url: STRING
	});

	let Request = define("request", schemaFor("Request"), {
		url: TEXT,
		method: STRING,
		headers: TEXT,
		resourceType: STRING
	});

	let Response = define("response", schemaFor("Response"), {
		status: INTEGER,
		headers: TEXT,
		bodySize: INTEGER,
		bodyLocation: STRING
	});

	let Cookie = define("cookie", schemaFor("Cookie"), {
		name: STRING(1000),
		value: TEXT,
		domain: STRING(1000),
		hostOnly: BOOLEAN,
		path: TEXT,
		secure: BOOLEAN,
		httpOnly: BOOLEAN,
		sameSite: STRING(1000),
		isSession: BOOLEAN,
		expirationDate: STRING(1000),
		storeId: STRING(1000)
	});

	const models = { Session, Page, Request, Response, Cookie };
	const defModNames = Object.keys(models);

	for (let [name, model] of Object.entries(customModels)) {
		if (defModNames.includes(name)) continue;
		models[name] = define(name, model.schema);
	}

	//-------------------------------- RELATIONS ---------------------------------

	const options = { allowNull: true, defaultValue: null };
	const cascadeDelete = { ...options, onDelete: "cascade" };
	const noConstraints = { ...options, constraints: false };

	hasMany(Session, Page, "pages", "sessionId", cascadeDelete);
	belongsTo(Page, Session, "session", "sessionId", options);

	hasMany(Session, Cookie, "cookies", "sessionId", cascadeDelete);
	belongsTo(Cookie, Session, "session", "sessionId", options);

	hasMany(Page, Request, "requests", "pageId", cascadeDelete);
	belongsTo(Request, Page, "page", "pageId", options);
	belongsTo(Page, Request, "request", "requestId", noConstraints);

	hasOne(Request, Response, "response", "requestId", cascadeDelete);
	belongsTo(Response, Request, "request", "requestId", options);

	// Redirection chain
	belongsTo(Request, Request, "next", "nextId", options);
	belongsTo(Request, Request, "previous", "prevId", options);
	belongsTo(Request, Request, "source", "sourceId", options);

	for (let [name, model] of Object.entries(customModels)) {
		if (typeof model.relations === "function")
			model.relations(models[name], models);
		models[name].info = customModels[name];
	}

	// Creating tables if they don't exist
	await sequelize.sync();
	return models;
}

module.exports = getModels;
