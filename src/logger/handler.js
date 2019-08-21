/**
 * @param {import('puppeteer').Page} tab
 * @param {import('./session')} session
 */
const requestHandler = (tab, session) => {
	const logger = session.logger;
	const requestId = session.logger.requestId.bind(logger);
	const requestInfo = requestInfoGenerator(requestId);

	const allModels = Object.entries(session.logger.models).filter(
		([_, model]) => model.info
	);

	let page = { page: {}, requests: {}, responses: {}, requestUpdates: {} };

	const savePage = () => {
		let { Page, Request, Response } = logger.models;
		if (page.page.id) {
			createOrUpdate(Page, [page.page]).catch(error => {
				console.error(error);
				console.error(firstLines(new Error(), 3));
			});
		}

		let requests = Object.values(page.requests);
		let responses = Object.values(page.responses);
		let requestUpdates = Object.values(page.requestUpdates);

		if (requests.length > 0) {
			createOrUpdate(Request, requests).catch(error => {
				console.error(error);
				console.error(firstLines(new Error(), 3));
			});
		}

		if (responses.length > 0) {
			createOrUpdate(Response, responses).catch(error => {
				console.error(error);
				console.error(firstLines(new Error(), 3));
			});
		}

		if (requestUpdates.length > 0) {
			createOrUpdate(Request, requestUpdates, ["id", "responseId"]).catch(
				error => {
					console.error(error);
					console.error(firstLines(new Error(), 3));
				}
			);
		}
	};

	const context = {
		session,
		logger: session.logger,
		page: tab,
		models: session.logger.models
	};

	/**
	 * @param {import('puppeteer').Request} request
	 */
	const onRequestHandler = request => {
		let rid = requestId(request);
		if (isPageChange(request, tab)) {
			savePage(); // Save previous page asynchroniously
			page = {
				page: {
					id: rid,
					url: request.url(),
					requestId: rid,
					sessionId: session.model.id
				},
				requests: {},
				responses: {},
				requestUpdates: {}
			};

			for (let [_, model] of allModels) {
				if (typeof model.info.onPage === "function") {
					model.info.onPage(page.page, request, context);
				}
			}
		}

		page.requests[rid] = page.requests[rid] || {};
		Object.assign(page.requests[rid], requestInfo(request, page));
		for (let [_, model] of allModels) {
			if (typeof model.info.onRequest === "function") {
				model.info.onRequest(page.requests[rid], request, context);
			}
		}

		// REDIRECTIONS
		const redirectChain = request.redirectChain();
		if (redirectChain.length > 0) {
			let index = redirectChain.indexOf(request);
			index = index === -1 ? redirectChain.length : index;
			let firstRequest = redirectChain[0];
			let prevRequest = redirectChain[index - 1];
			let prid = requestId(prevRequest);
			page.requests[rid].prevId = prid;
			page.requests[rid].sourceId = requestId(firstRequest);
			if (!page.requests[prid])
				page.requests[prid] = requestInfo(request, page);
			page.requests[prid].nextId = rid;
		}
	};

	const onReponseHandler = async response => {
		let body, fileName;
		let request = response.request();
		let rid = requestId(request);

		let { requestBody, saveBody, filesTypes } = session.options;
		if (requestBody || saveBody) {
			try {
				if (shouldRequestResponseBody(response)) {
					body = await response.buffer();
					if (saveBody && shouldSaveResponseBody(request, filesTypes)) {
						fileName = body ? await logger.saveFile(body) : null;
					}
				}
			} catch (error) {
				console.error(
					` >> Failed to get body for request: ${request.url()}`
				);
			}
		}

		page.responses[rid] = {
			id: rid,
			status: response.status(),
			headers: JSON.stringify(response.headers(), null, 3),
			requestId: rid,
			bodySize: body ? body.length || 0 : 0,
			bodyLocation: fileName
		};

		for (let [_, model] of allModels) {
			if (typeof model.info.onResponse === "function") {
				model.info.onResponse(page.responses[rid], response, context);
			}
			if (typeof model.info.onResponseBody === "function") {
				model.info.onResponseBody(body || null, page.responses[rid], response, context);
			}
		}

		if (page.requests[rid]) page.requests[rid].responseId = rid;
		else page.requestUpdates[rid] = { id: rid, responseId: rid };
	};

	const onSessionCloseHandler = savePage;

	return [onRequestHandler, onReponseHandler, onSessionCloseHandler];
};

// ================================================================================
//                               UTILITY FUNCTIONS
// ================================================================================

const requestInfoGenerator = requestId => (request, page) => ({
	id: requestId(request),
	url: request.url(),
	method: request.method().toUpperCase(),
	pageId: page.page.id,
	headers: JSON.stringify(request.headers(), null, 3),
	resourceType: request.resourceType(),
	sourceId: requestId(request)
});

function shouldRequestResponseBody(response) {
	return !(300 <= response.status() && response.status() <= 399);
}

function shouldSaveResponseBody(request, allowedFileTypes) {
	return (
		[undefined, null, "all", "*"].includes(allowedFileTypes) ||
		(Array.isArray(allowedFileTypes) &&
			allowedFileTypes.includes(request.resourceType()))
	);
}

function isPageChange(request, tab) {
	return request.isNavigationRequest() && tab.mainFrame() === request.frame();
}

/**
 *
 * @param {import('sequelize').Model} Model
 * @param {*} objects
 * @param {*} fields
 */
async function createOrUpdate(Model, objects, fields) {
	const attrs = Model.rawAttributes;
	const attrNames = fields || Object.keys(attrs);
	const tableName = Model.getTableName();
	const attrNamesList = attrNames.join(",");
	let query = `REPLACE INTO ${tableName} (${attrNamesList}) VALUES`;

	let row =
		"(" +
		Array(attrNames.length)
			.fill("?")
			.join(",") +
		")";

	let rows = Array(objects.length)
		.fill(row)
		.join(",");
	let values = [];

	for (let object of objects) {
		for (let attr of attrNames) {
			values.push(object[attr] || null);
		}
	}

	query = query + rows + ";";
	// console.log( `QUERY FOR ${objects.length} ${tableName}. QUERY LENGTH : ${query.length}`);
	await Model.sequelize.query(query, { replacements: values });
}

function firstLines(error, n) {
	return error.stack
		.split("\n")
		.slice(0, n)
		.join("\n");
}

module.exports = requestHandler;
