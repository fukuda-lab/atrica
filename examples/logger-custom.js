const atrica = require("../src/index");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	// Not a reliable function, just here for the example
	function isFirstParty(url, domain) {
		let hostname = new URL(url).hostname;
		return hostname.match(domain + "$");
	}

	// Create the logger, saves results in './custom-crawl-results'
	const logger = await atrica.logger(browser, "./custom-crawl-results", {
		Request: {
			schema: ({ STRING }) => ({
				frameType: STRING
			}),
			onRequest: (values, request, context) => {
				// the session name is the domain in this example (see below)
				const domain = context.session.name;
				if (request.frame() === context.page.mainFrame()) {
					values.frameType = "main";
				} else if (isFirstParty(request.frame().url(), domain)) {
					values.frameType = "1st_party_iframe";
				} else {
					values.frameType = "3rd_party_iframe";
				}
			}
		},
		Script: {
			schema: Sequelize => ({
				first_party_scripts: Sequelize.INTEGER,
				third_party_scripts: Sequelize.INTEGER
			}),
			relations: (Script, models) => {
				let Session = models.Session;
				Session.hasMany(Script, { as: "scripts", foreignKey: "sessionId" });
				Script.belongsTo(Session, {
					as: "session",
					foreignKey: "sessionId"
				});
			},
			onSession: (values, session) => {
				session.custom_props = {
					first_party_scripts: 0,
					third_party_scripts: 0
				};
				session.on("close", async () => {
					session.custom_props.sessionId = session.model.id;
					await session.logger.models.Script.create(session.custom_props);
				});
			},
			onRequest: (values, request, context) => {
				const session = context.session;
				const domain = context.session.name;
				if (request.resourceType() === "script") {
					if (isFirstParty(request.url(), domain)) {
						session.custom_props.first_party_scripts++;
					} else {
						session.custom_props.third_party_scripts++;
					}
				}
			}
		}
	});

	for (let domain of domains) {
		const sessionName = domain;
		const session = await logger.newSession(sessionName);

		const url = `https://${domain}`;
		const page = await browser.newPage();

		session.listen(page);

		await page.goto(url);
		await atrica.utils.sleep(1);
		await page.close();

		await session.saveCookies();
		await session.close();
		await browser.clearAllBrowsingData();
	}

	await browser.close();
	process.exit();
}

main();
