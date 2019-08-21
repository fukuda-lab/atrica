chrome.runtime.sendMessage({ status: "document_start" });

let sendComplete = false;

if (document.readyState == "complete") {
	chrome.runtime.sendMessage({ status: "document_load" });
	sendComplete = true;
} else {
	window.addEventListener("load", function() {
		if (!sendComplete) {
			chrome.runtime.sendMessage({ status: "document_load" });
			sendComplete = true;
		}
	});
}
