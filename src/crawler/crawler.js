const utils = require("../utils");
const colors = require("colors/safe");

/**
 * @template Task
 * @template Context
 */
class Crawler {
	constructor(urls) {
		/** @private */
		this._tasks = urls;

		/** @private */
		this._concurrency = 1;

		/** @private */
		this._setup = null;

		/** @private */
		this._timeout = 120;

		/** @private */
		this._pageTimeout = 35;

		/** @private */
		this._worker = null;

		/** @private */
		this._verbose = true;

		/** @private */
		this._cleanup = null;

		/** @private */
		this._after = null;

		/** @private */
		this._progressbar = null;

		/** @private */
		this._skipAfter = 1000;
	}

	/**
	 * Set the tasks for the crawler.
	 * A task is just data passed as an argument to the worker function.
	 * The tasks can be anything, such as a array of urls.
	 * @param {Array<Task>} tasks 
	 * @returns {Crawler} return crawler to chain method calls
	 */
	tasks(tasks) {
		this._tasks = tasks;
		return this;
	}

	/**
	 * Set the number of worker for the crawler.
	 * Can be used to launch several browsers.
	 * @param {number} nb
	 * @returns {Crawler} return crawler to chain method calls
	 */
	concurrency(nb) {
		this._concurrency = nb;
		return this;
	}

	/**
	 * Set a callback called after a worker has finished processing all its tasks
	 * @param {() => any} callback a function executed after a
	 * worker has executed all its tasks
	 * @returns {Crawler} return crawler to chain method calls
	 */
	after(callback) {
		this._after = callback;
		return this;
	}

	/**
	 * The function passed as an argument will be used to set the context,
	 * (ie launch the browser, start the logger, etc...)
	 * The first parameter is a boolean true if setup is called to restart
	 * the browser after a crash, and false if it's the first time
	 * @param {(boolean, number) => Context} func
	 * @returns {Crawler} return crawler to chain method calls
	 */
	setup(func) {
		this._setup = func;
		return this;
	}

	/**
	 * The function given as parameter will be called if the browser crash,
	 * before calling setup again
	 * @param {(task: Task, context: Context, workerId: number) => any} func
	 * @returns {Crawler} return crawler to chain method calls
	 */
	cleanup(func) {
		this._cleanup = func;
		return this;
	}

	/**
	 * Give to the crawler the function that will be executed by a worker to process a task.
	 * @param {(Task, Context) => any} func 
	 * @returns {Crawler} return crawler to chain method calls
	 */
	worker(func) {
		this._worker = func;
		return this;
	}

	/**
	 * Set the max time a task should take. If the task takes more than 
	 * this then the browser will be considered unresponsive and will be
	 * restarted.
	 * @param {number} duration - number of seconds allotted for a task
	 */
	timeout(duration) {
		this._timeout = duration;
		return this;
	}

	/**
	 * By default the crawler will display a progressbar.
	 * If you don't want to display it, then: crawler.verbose(false)
	 * @param {boolean} bool 
	 * @returns {Crawler} return crawler to chain method calls
	 */
	verbose(bool) {
		this._verbose = bool;
		return this;
	}

	pageTimeout(nb) {
		this._pageTimeout = nb;
		return this;
	}

	/**
	 * Indicate how many times a worker should try to run a task before skipping it,
	 * if the task keep failing (ie: the browser keep crashing)
	 * @param {number} nb 
	 * @returns {Crawler} return crawler to chain method calls
	 */
	skipAfter(nb) {
		this._skipAfter = nb;
		return this;
	}

	/**
	 * Start crawling. This is an async operation, don't forget to await it!
	 * @returns {Promise}
	 */
	async crawl() {
		if (!this._setup)
			throw new Error(
				"You need to set the setup function (see crawler.setup(func))"
			);

		if(!this._tasks)
			throw new Error(
				"You need to give a list of 'tasks' (urls to crawl) using crawler.tasks(tasks)"
			);

		const tasks = this._tasks;
		const worker = this._worker || defaultWorker;
		const progressbar = new Progressbar(this._tasks.length);

		function* tasksForWorker(id) {
			while (tasks.length > 0) {
				yield tasks.shift();
			}
		}

		progressbar.start();

		let workersPromises = utils.range(this._concurrency).map(async id => {
			let tasks = tasksForWorker(id);
			let context = await this._setup(false, id);

			for (let task of tasks) {
				let done = false;
				let attemps = 0;
				while (!done && attemps < this._skipAfter) {
					try {
						await Promise.race([
							worker(task, context, id),
							utils.timeout(this._timeout)
						]);
						done = true;
						progressbar.progress(1);
					} catch (error) {
						console.error(
							colors.red.bold(` /!\\ An error has occured :`)
						);
						console.error(
							colors.red(error)
						);
						console.error(
							colors.red.bold(`Restarting browser`)
						);
						
						try {
							if (this._cleanup) await this._cleanup(task, context, id);
						} catch(error) {
							console.error(error);
						}
						context = await this._setup(true, id);
						attemps++;
					}
				}
			}
		});

		await Promise.all(workersPromises);
		progressbar.finsh();
	}
}

class Progressbar {
	constructor(total) {
		this._total = total;
		this._done = 0;
		this._start = null;
		this._interval_id = null;
	}

	start() {
		this._start = new Date().getTime();
		this.print();
		this._interval_id = setInterval(this.print.bind(this), 1000);
	}

	progress(nb) {
		this._done += nb;
		this.print();
	}

	finsh() {
		this._done = this._total;
		this.print();
		clearInterval(this._interval_id);
	}

	render() {
		const total = this._total;
		const done = this._done;
		const left = total - done;
		const percent = Math.round((100 * done) / total);
		const timeElapsed = (new Date().getTime() - this._start) / 1000;
		const speed = done / timeElapsed;
		const timeLeft = left / speed !== Infinity ? left / speed : "∞";

		return (
			`[${done} / ${total} - ${left} left (${percent}% done)] - ` +
			`[${speed.toFixed(2)} t/s - ${(1 / speed).toFixed(2)} s/t] - ` +
			`[${utils.formatSeconds(timeElapsed)} elapsed - ${utils.formatSeconds(
				timeLeft
			)} left]`
		);
	}

	print() {
		process.stdout.write(this.render() + " \r");
	}
}

async function defaultWorker(url, { browser, logger }, workerId) {
	const page = await browser.newPage();

	await logger.deleteSession(url);
	const session = await logger.makeSession(url, {
		requestBody: true,
		saveBody: false
	});
	session.listenPage(page);

	try {
		await page.goto(url, { timeout: this._pageTimeout * 1000 });
		await page.waitFor(100);
	} catch (error) {
		console.error(`Error for visiting ${url} with worker ${workerId}`);
		console.error(error);
	}

	await page.close();
	await msleep(100);

	await session.saveCookies();
	session.close();
	await browser.clearAllBrowsingData();
}

module.exports = Crawler;
