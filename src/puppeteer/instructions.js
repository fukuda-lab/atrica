const instructions = {
	getCookies: "get-cookies",
	setCookies: "set-cookies",
	clearBrowsingData: "clear-browsing-data",
	evaluate: "browser.evaluate",
	page: {
		newPage: "page.new-page",
		close: "page.close",
		goto: "page.goto",
		evaluate: "page.evaluate",
		screenshot: "page.screenshot",
		pages: "page.get-pages"
	}
}

module.exports = instructions;