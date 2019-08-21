const Crawler = require('./crawler');

/**
 * @typedef {import('./crawler')} Crawler
 */

/**
 * Utility that helps creating a crawler
 * @returns {Crawler} crawler
 */
function crawler() {
	return new Crawler();
}
module.exports = () => new Crawler();