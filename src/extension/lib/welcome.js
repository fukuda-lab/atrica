import { executeScript } from './utils';

export default async function displayWelcomePage(tabId, port, bid) {
	console.log("Displaying welcome message...");
	let msg =
		`<h1>Extension successfully connected to the worker on port ${port} with browserId ${bid} !</h1>
		<p>
			Please don't close this tab! <br/>
			This will be the default tab for executing all the instructions
		</p>`;
	msg = msg.replace(/(\r\n|\n|\r)/gm, "");
	await executeScript(tabId, `document.body.innerHTML = "${msg}"`);
}