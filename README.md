# Atrica
Atrica is a set of tools, built on top of google-chrome pupeteer API, meant to help you write crawlers, especially for web privacy measurement. It lets you start, control, and gather data from many popular browsers (Chrome, Opera, (and other chromium-based browsers such as the next version of Edge), Firefox, TorBrowser, etc...). 

This project features:
- **Puppeteer's API** for chrome, and a part of that API for WebExtension-compatible browsers.
- This **API is enriched** with other functionalities such as browser.cookies() that returns a list of all the cookies,
  browser.clearAllBrowsingData() that remove cookies, localstore, cache, etc...
  and browser.evaluate() that lets you execute a function with access to the WebExtension API. 
- A simple **profile manager** that lets you start a clean browsing session, install extensions into it,
  save it, clone it, delete it.
- A **flexible logger** that can save requests and response in a sqlite database.
  You can customize the schemas and create your own tables.
- A **crawler builder** that helps you create a reliable crawler that lets you start several browsers concurrently and restart them if they crash or become unresponsive.

**This repository is looking for a maintainer.**

Table of contents
- [Atrica](#atrica)
- [Installation](#installation)
- [Documentation](#documentation)
- [Guide](#guide)
	- [Basic example](#basic-example)
	- [Profiles](#profiles)
		- [Browser binary path](#browser-binary-path)
		- [Reusing profiles](#reusing-profiles)
		- [Extensions](#extensions)
			- [Downloading extensions](#downloading-extensions)
			- [Installing extensions](#installing-extensions)
			- [Manual extension installation and configuration](#manual-extension-installation-and-configuration)
		- [Cleaning a profile](#cleaning-a-profile)
		- [Headless mode and other puppeteer's options](#headless-mode-and-other-puppeteers-options)
			- [Puppeteer's options](#puppeteers-options)
			- [Headless mode](#headless-mode)
		- [TorBrowser](#torbrowser)
			- [TorBrowser with Tor Proxy](#torbrowser-with-tor-proxy)
			- [TorBrowser without Tor Proxy](#torbrowser-without-tor-proxy)
	- [Logger](#logger)
		- [Logger Basic example](#logger-basic-example)
		- [Database structure](#database-structure)
		- [Custom data models](#custom-data-models)
	- [Crawler](#crawler)
	- [Advanced](#advanced)
		- [Executing scripts](#executing-scripts)
		- [Using DevTools protocol with chromium-based browsers](#using-devtools-protocol-with-chromium-based-browsers)

# Installation
1. Install the last version of [nodejs](https://nodejs.org/en/) (atrica has not been tested with node < 12.x)
2. Create a new folder and run 
   ```bash
   npm init
   npm install atrica
   ```
**Warning** this project depends on puppeteer which will automatically download chromium-browser.
It's about 100Mo so it might that a while on slow connections.

# Documentation
The documentation can be found here: [https://fukuda-lab.github.io/atrica/](https://fukuda-lab.github.io/atrica/)

# Guide
This is a step by step guide with code and explainations.
The full codes can be found in the `examples` folder.  

**Warning**: Puppeteer and atrica heavily rely on javascript's await/async feature.  
You should first learn [how to use it](https://alligator.io/js/async-functions/).

## Basic example
In this example we create a very simple crawler, launching chrome and have it visit
wikipedia and other wikimedia websites.

Hopefully the following code is self explainaroty, but here are a few remarks:
- In the first line of the main function, we create a new profile. The 'browser' can take two values: 
  - "chromium" will create a profile for a chromium-based browser (so it will also work with chrome, opera, vivaldi, Edge, etc...)
  - "firefox" will create a profile for a Firefox-based browser (will work with TorBrowser, etc...)
  - See next subsection for more details on profiles
- In puppeteer, a 'page' is actually a browser tab, so browser.newPage create a new tab. 

```javascript
// examples/basic.js
const atrica = require("atrica");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	for(let domain of domains) {
		const url = `https://${domain}`;
		const page = await browser.newPage();
		await page.goto(url);
		await atrica.utils.sleep(1);
		await page.close();
	}
}

main();
```

## Profiles
All the code in this subsection is an extract from `examples/profiles.js`.
You are encouraged to read this file after reading this subsection.

### Browser binary path
If you create a profile with the minimum options like this: 
```javascript
	const profile = await atrica.profile({ browser: "chromium" });
```
then atrica will use the chromium version downloaded with puppeteer.
If you want to use firefox, or a different chromium-based browser, you can
use the `binary` option, which expect the full path to the browser binary file:

```javascript
	const operaProfile = await atrica.profile({
		browser: "chromium",
		binary: "/snap/bin/opera",
	});
```

### Reusing profiles
By default, the profiles are saved in your OS temporary folder (/tmp for linux)
You can use the `path` option to choose where the profile will be saved:
```javascript
	const trainingProfile = await atrica.profile({
		browser: "firefox",
		binary: "/usr/bin/firefox",
		path: "./privacy-badger-profile"
	});
```

Then later in an other script you can load that profile.
**However keep in mind that if you launch a browser with a profile, that profile
will be modified by the browser. Therefore you should copy the profile first if you
don't want to modify the original profile.**

```javascript
	// Loading the trained profile.
	const trainedProfile = await atrica.profile({
		browser: "firefox",
		binary: "/usr/bin/firefox",
		path: "./privacy-badger-profile"
	});

	// We don't want to modifiy trainedProfile, we might need it later
	// so we make a copy of it (stored in /tmp/xxxxxx)
	const trainedProfileCopy = await trainedProfile.copy();
```

### Extensions
#### Downloading extensions
Atrica has utility functions to automatically download extensions and put them in a cache.
To use those functions you need the id of the extension, but you can easily extract it from the url of 
the extension in the chrom web store:

```javascript
	// For example if you find ublock origin in the webstore at the following url:
	let url = "https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm?hl=en";
	// Then the id is:
	let id = "ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm";

	// For mozilla addons store, if you find pribacy-badger at the follow url:
	let url2 = "https://addons.mozilla.org/en-US/firefox/addon/privacy-badger17/";
	// Then the id is:
	let id = "privacy-badger17";
```

Then you can download the extension with:
```javascript
	// Chromium-based browsers
	const ublockPath = await atrica.profile.getChromeExtension({
		id: "ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm"
	});

	// Firefox-based browsers
	const privacyBadger = await atrica.profile.getFirefoxExtension({
		id: "privacy-badger17",
		name: "privacy-badger" //Optional
	});
```

#### Installing extensions 
Once you have downloaded the extensions you can install them in the profile.
** However with this method you can only install them TEMPORARLY (except for Firefox)**
This means that all the data and configuration related to the extension will be lost if the browser restart.
```javascript
	const operaProfile = await atrica.profile({
		browser: "chromium",
		binary: "/snap/bin/opera",
		// Works with both firefox and chromium
		extensions: [ublockPath]
	});
```

However with Firefox (or TorBrowser) you can install the extensions permanently, like this:
```javascript
	const firefox = await atrica.launch(trainingProfile);
	// Firefox-based browsers only
	firefox.install(privacyBadger);
```
Unfortunately, to my knowledge, chromium does not offer any way to install an extension permanently.
However you can quickly and easily do it manually (see next paragraph)

#### Manual extension installation and configuration
Atrica does not offer any API to automatically configure an extension.
However you can do it manually, like this:

```bash
# For firefox : create a profile at /home/user/firefox-manual-profile
# Then you can use firefox graphical user interface to install and configure
# all the extensions you want, and it will be saved in the firefox-manual-profile folder 
firefox -no-remote -profile=/home/user/firefox-manual-profile

# Same thing for chromium-based browsers 
chromium-browser --user-data-dir=/home/user/chromim-manual-profile
```

**WARNING : the profiles (especially firefox's profiles) contains hard-coded absolute paths,
so simply copying a profile folder from a machine to another might not work**
you can maybe replace the old paths with the new one with tools like sed,
however, for better portabilty you should probably use Docker and its virtual file system.

### Cleaning a profile
If you want to keep an extension configuration but remove traces of
previous browsing in the profile (cookies, localstorage, cache, etc...) 
you can use the following methods:

```javascript
	// Remove cookies, localStorage, cache
	await browser.clearAllBrowsingData();

	// Remove only what you specify in the options
	// See documentation for more information
	await browser.clearBrowsingData(/* options */)
```

### Headless mode and other puppeteer's options
#### Puppeteer's options
You can set puppeteer options using the `options` attribute in the profile's options :
```javascript
	const profile = await atrica.profile({
		browser: "chromium",
		// Works for both chromium and firefox
		options: {
			defaultViewport: {
				width: 1920,
				height: 1080
			}
		}
	});
	const browser = await atrica.launch(profile);
```

The availables options for chromium are documented [here](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions) and those for firefox are documented [here](https://github.com/deepsweet/foxr#connect)

#### Headless mode
By default, atrica do not launch the browser in headless mode.
That is because **chromium do not support headless mode with extensions**.
Moreover Atrica is using an extension in the background for firefox support and to enrich puppeteer API.
If you are using firefox only, then there is no problem, firefox support headless mode with extension.

However if you are using chrome you have three options :
- Using chrome without headless mode with atrica enabled and other extensions
- Using chrome with headless mode with atrica disabled. In that case:
  - You cannot use the enriched API (browser.clearAllBrowsingData, browser.cookies, browser.evaluate)
  - You cannot load extensions
- **On linux you can install `xvfb`, which creates a virtual screen and run chromium inside it with atrica and extensions enabled**. Very usefull if you are on a linux server. In that case you can just start your script like this:
  ```bash
	# Launch crawler in a virtual screen
	xvfb-run -a node crawler.js
  ```

You can enable headless mode like this:
```javascript
	// For chromium
	const profile = await atrica.profile({
		browser: "chromium",
		options: { headless: true }
	});
	// You then need to disable atrica extension
	const browser = await atrica.launch(profile, {atrica: false});

	// For firefox
	const fprofile = await atrica.profile({
		browser: "firefox",
		options: { headless: true }
	});
	// You don't need to disable atrica for firefox
	const firefox = await atrica.launch(fprofile);
```

### TorBrowser
If you want to use Atrica with TorBrowser you must be aware of a few things:
TorBrowser is a modified version of Firefox that comes together with a default profile.
This default profile has a few extensions installed by default:
- HTTPS everywhere
- NoScript
- TorButton
- TorLauncher: That last extension is what helps you configure the tor proxy before launching firefox

That profile is located at `/path-to-tor-browser/Browser/TorBrowser/Data/Browser/profile.default`.
We are going to use this profile as a starting point.

#### TorBrowser with Tor Proxy
If you want to use TorBrowser with the tor proxy and atrica you will have to change the default profile.
You might want to make a copy of the default profile first.
By default, all network traffic go through the Tor proxy.
However we want the atrica extension installed in TorBrowser to be able communicate with
the atrica server in the nodejs process. Only then can we control the browser.
So we have to add an exception to the proxy rules for localhost.

1. Launch TorBrowser
2. Open the Preferences and type "proxy" in the search bar
3. Click on "Settings..."
4. In the "No proxy for" (the textarea at the bottom) type "127.0.0.1"

You can now use with atrica.
**You have an example in `examples/tor-profile.js`, but you need to remove `env: { TOR_TRANSPROXY: "1" }`**

#### TorBrowser without Tor Proxy
The Tor proxy considerably slows down the crawling, so if you're only interested in the TorBrowser's privacy
performance 

1. You need to disable TorLauncher extension in the default profile
   1. Launch tor browser
   2. about:addons in url bar
   3. disable TorLauncher
2. You need to set an environment variable `TOR_TRANSPROXY=1` when launching tor
	You can do that with the `env` option in atrica.profile:
	```javascript
		let profile = await (await atrica.profile({
			browser: "firefox",
			path: defaultProfilePath,
			binary: binaryPath,
			env: { TOR_TRANSPROXY: "1" },
		})).copy();
	```
**You have an example in `examples/tor-profile.js`**

## Logger
Atrica has a logger tool that helps you save the requests, responses and cookies for targetted tabs.

### Logger Basic example
Here is a basic example of how to use the logger API:

```javascript
// examples/basic-logger.js
const atrica = require("atrica");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];
	// Create the logger, saves results in './crawl-results'
	const logger = await atrica.logger(browser, './crawl-results');

	for(let domain of domains) {
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
```

First we create the logger, which will save the resulst in the "./crawl-results" folder.
```javascript
	const logger = await atrica.logger(browser, './crawl-results');
```
The folder has the following structure:
- database.sqlite : a sqlite database, containing the requests, responses, cookies, etc...
- files : a folder containing the files

Then we create a session. Sessions allow you to group requests, responses and cookies.
In the example above, we create one session per domain.
```javascript
	const session = await logger.newSession(sessionName);
```

Then we need to tell the session which page should be listened. The session will only
log requests, responses, etc... from pages who are being 'listened' :

```javascript
	session.listen(page);
```

Then you can save all the cookies in the browser in the session with:
```javascript
	await session.saveCookies();
```

**You need to call session.close() to make sure all requests and responses are properly saved in the database**
```javascript
	await session.close();
```

### Database structure
- **sessions** : a table containing the session
|  id   |  name  |
| :---: | :----: |
|  int  | string |

- **pages** : everytime the main frame of a tab change location, a new row is added in this table
|  id   |  url   | sessionId | requestId |
| :---: | :----: | :-------: | :-------: |
|  int  | string |    int    |    int    |

- **requests** : represent an HTTP request sent by the browser
|  id   |  url   | method |   headers    |       resourceType       | pageId | prevId | nextId | sourceId |
| :---: | :----: | :----: | :----------: | :----------------------: | :----: | :----: | :----: | :------: |
|  int  | string | string | string(json) | string(image,script,...) |  int   |  int   |  int   |   int    |

	The prevId, nextId and sourceId are used to represent a redirection chain.
	sourceId is the id of the first request in the chain, while prevId and nextId are the ids
	of the previous and next requests.

- **responses** : represent the responses to an HTTP request
|  id   | status |    headers    |     bodySize     |        bodyLocation        | requestId |
| :---: | :----: | :-----------: | :--------------: | :------------------------: | :-------: |
|  int  |  int   | string (json) | int (# of bytes) | string (in `files` folder) |    int    |

- **cookies** : represent the cookies in the session
|  id   |  name  | value  | domain | hostOnly |  path  | secure | httpOnly | sameSite | isSession | expirationDate | storeId | sessionId |
| :---: | :----: | :----: | :----: | :------: | :----: | :----: | :------: | :------: | :-------: | :------------: | :-----: | :-------: |
|  int  | string | string | string |   bool   | string |  bool  |   bool   |  string  |  string   |     string     |   int   |    int    |
	See [MDN cookie documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies/Cookie) for more details


### Custom data models
Atrica uses [sequelize](https://sequelize.org/) as an [ORM](https://en.wikipedia.org/wiki/Object-relational_mapping) to communicate with sqlite, and use it to let you easily customize the database schema.
The default models are : `Request`, `Response`, `Session`, `Page`, `Cookie`
You can customize those models, or create your own.
Here is an example :

```javascript
	// from examples/logger-custom.js
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
```

The third parameter of logger must have the following structure:
```javascript
	{
		Model1: {
			schema: (Sequelize) => ({attr1: Sequelize.STRING(100), ...})
			relations: (Model1, models) => {Model1.belongsTo(models.?); Model1.hasMany(...)}
			onSession: (values, session) => {...},
			onPage: (values, request, context) => {},
			onRequest: (values, request, context) => {...},
			onResponse: (values, response, context) => {...},
			onResponseBody: (body, values, response, context) => {...}
		},
		Model2: {...},
		...
	}
```

The schema function must describe the schema of the table.
If the model already exists, then the property returned by the function will be added to the schema, otherwise it will create a new table with the schema returned.
So in our example above, we are adding a `frameType` column of type STRING to our table.
Then in the `onRequest` we are adding `frameType` to the values that will be sent to the database.
So in `onSession` the `values` parameter are the values that will be sent to the database to create a new row in the `sessions` table, in `onPage` it's for the `pages` table, in `onRequest` for the `requests` table, in `onResponse` for the `responses` table and in `onResponseBody` also for the `responses` table. 
In our example above, we are also creating a new `scripts` table which, for each session, count
the number of first-party scripts, and third-party scripts.
Then we are creating a foreign-key in the `scripts` table to associate it to the `sessions` table.
Javascript is a flexible script language and lets you add attributes to any object at any time.
Therefore, in onSession we are adding a custom_props attribute to keep our scripts counters.
Then we use the session's `close` event to create a new row in the `scripts`.
You are responsible for inserting new rows in your custom tables, with Model.create or Model.bulkCreate.
Note that a large number of insertion in the database may afect the performance of the crawler, so you are
encouraged to use Model.bulkCreate when you can.
Read the documentation of [sequelize](https://sequelize.org/) for more information on how to create models.

## Crawler
In the previous examples we used a simple loop in order to crawl the different urls.
But when crawling the web, we may stumble upon some poorly designed or malicious website that might
make the browser crash or make it unresponsive. 
We might also want to use several browsers at once in order to speed-up the crawling.
Atrica has a Crawler class in order to make it easier to handle those issues.

```javascript
const atrica = require("atrica");

// tasks
const domains = [
	"wikipedia.org",
	"wiktionary.org",
	"wikiquote.org",
	"wikibooks.org"
];

async function setup(isRestarting, workerId) {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const logger = await atrica.logger(browser, "./crawling-result");
	// return context
	return [browser, logger];
}

//             worker(task,   context)
async function worker(domain, [browser, logger]) {
	const url = `https://${domain}`;
	const sessionName = domain;
	const session = await logger.newSession(sessionName);
	const page = await browser.newPage();
	session.listen(page);
	// Max time 
	await page.goto(url, { timeout: 30000 }).catch(console.error);
	await page.close();
	await session.close();
}

async function cleanup(domain, [browser, logger]) {
	await browser.close();
	// If the brower failed during this session, we delete it
	await logger.deleteSession(domain);
}

async function main() {
	const crawler = await atrica.crawler();
	crawler.setup(setup);
	crawler.tasks(domains);
	crawler.worker(worker);
	crawler.timeout(40)
	crawler.concurrency(2); // Launching 2 browsers
	crawler.cleanup(cleanup);

	await crawler.crawl();
	process.exit();
}

main();

```

First we define a `setup` function. Its role will be to setup a worker or in other words,
launching the browser and creating a logger. It must return a `context` object, that
will be passed as argument to the `worker` function.

In this example we set concurrency to `2`. This will create `2` workers.
Each worker will call the `setup` function with their own `workerId`, and thus, two browsers will be launched.
Then each worker will take a task on the task stack, and call `worker` with that task and the context returned by the `setup` function as parameters. Each worker will repeat this process until there is no task left on the stack.

If there is an error during the execution of the `worker` function, or if it takes more than a certain time (set with `crawler.timeout(duration)`), then we call the `cleanup` function followed by the `setup` function again to restart the browser. Finally we call the `worker` function for the same task and with the new context created by `setup`. 

## Advanced
### Executing scripts
Puppeteer lets you execute scripts in a given page with the `page.evaluate` method (see puppeteer's documentation for more details).
Atrica enrich puppeteer API and provide a `browser.evaulate` method, working in a similar way,
but that execute the provided function inside atrica's extension, giving you access to
[Chrome Extensions APIs](https://developer.chrome.com/extensions/api_index) and [Firefox WebExtension APIs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) (similar to Chrome Extensions APIs but with a few changes)

Here is an example:
```javascript
// examples/evaluate.js
const atrica = require("atrica");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	const getHistory = () => {
		return new Promise(resolve => {
			chrome.history.search({ text: "" }, resolve);
		});
	};

	for (let domain of domains) {
		const url = `https://${domain}`;
		const page = await browser.newPage();
		await page.goto(url);
		// Native puppeteer feature
		let title = await page.evaluate(() => window.document.title);
		console.log(title);
		await page.close();
	}

	// Using atrica browser.evaluate method to access Chrome Extensions API
	let history = await browser.evaluate(getHistory);
	console.log(history);

	await browser.close();
	process.exit();
}

main();
```

### Using DevTools protocol with chromium-based browsers
Puppeteer lets us use the Chrome Devtools Protocol directly, allowing us to do advanced stuff.
Here is a [tutorial](https://medium.com/@jsoverson/using-chrome-devtools-protocol-with-puppeteer-737a1300bac0) explaining
how to do that.
A detailed documentation of the Devtools protocol is available [here](https://chromedevtools.github.io/devtools-protocol/)
Here is an example with atrica:

```javascript
// examples/devtools-protocol.js
const atrica = require("atrica");

async function main() {
	const profile = await atrica.profile({ browser: "chromium" });
	const browser = await atrica.launch(profile);
	const domains = ["wikipedia.org", "wiktionary.org", "wikiquote.org"];

	for (let domain of domains) {
		const url = `https://${domain}`;
		const page = await browser.newPage();
		// Chrome Devtools Protocol client
		const client = await page.target().createCDPSession();
		await client.send("Network.enable");

		let wsTransferedBytes = 0;
		client.on(
			"Network.webSocketFrameReceived",
			({ response: { opcode, mask, payloadData } }) => {
				if (opcode == 1) wsTransferedBytes += payloadData.length;
				else wsTransferedBytes += Math.floor(payloadData.length * (6 / 8));
			}
		);

		await page.goto(url);
		await atrica.utils.sleep(1);

		// An alternative way to get the cookies on chrome if you
		// want to disable atrica's extension to enable headless mode
		let { cookies } = await client.send("Network.getAllCookies");
		console.log(`After visiting ${domain}:`);
		console.log(` - Cookies: ${cookies.length}`);
		console.log(` - Bytes transfered using websockets: ${wsTransferedBytes}`);
		console.log();

		// Removing all cookies from browser
		await client.send("Network.clearBrowserCookies");
		await page.close();
	}

	await browser.close();
	process.exit();
}

main();
```

In this example we create a client for each tab (page) and we use it to get 
all the cookies in the browser and then to delete them.
We also use the event `Network.webSocketFrameReceived` to calculate the amount
of data transfered during the browsing.