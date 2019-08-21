const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

const extSourcePath = path.resolve(__dirname, "src/extension");
const distPath = path.resolve(__dirname, "dist/atrica-extension");
const xpiFilePath = path.resolve(__dirname, "dist/atrica-extension.xpi");

class AtricaSetup {
	apply(compiler) {
		compiler.hooks.done.tapPromise("Setup atrica", async () => {
			try {

				console.log("Copying events files");
				const events = ["document_start", "document_end", "document_idle"];
				await Promise.all(
					events.map(async event => {
						await fs.promises.copyFile(
							path.resolve(extSourcePath, `${event}.js`),
							path.resolve(distPath, `${event}.js`)
						);
					})
				);

				console.log("Copying manifest.json");
				// Loading manifest
				let manifestJson = await fs.promises.readFile(
					path.join(extSourcePath, "manifest.json"),
					{ encoding: "utf8" }
				);

				// Chaging version
				let manifest = JSON.parse(manifestJson);
				let ms = new Date().getTime().toString();
				let dec = ms.slice.bind(ms);
				let version = `${dec(0, 4)}.1${dec(4, 7)}.1${dec(7, 10)}`;
				manifest.version = version;

				//Manifest for chrome
				await fs.promises.writeFile(
					path.join(distPath, "manifest.json"),
					JSON.stringify(manifest, null, 3)
				);

				//Manifest for firefox
				manifest.permissions = manifest.permissions.filter(
					p => !["debugger"].includes(p)
				);

				console.log("Generating XPI file...");
				let output = fs.createWriteStream(xpiFilePath);
				let archive = archiver("zip", { zlib: { level: 9 } });

				archive.pipe(output);
				archive.glob("!(manifest.json)", { cwd: distPath });
				archive.append(JSON.stringify(manifest, null, 3), {
					name: "manifest.json"
				});
				archive.finalize();

				return await new Promise((resolve, reject) => {
					archive.on("finish", () => {
						console.log("Done!");
						resolve();
					});
					archive.on("error", error => {
						console.log("Error");
						reject(error);
					});
				});
			} catch (error) {
				console.log(error);
			}
		});
	}
}

module.exports = (env, argv) => ({
	watch: argv.mode === "development",
	entry: {
		background: path.resolve(extSourcePath, "background.js")
	},
	output: {
		filename: "[name].js",
		path: distPath
	},
	devtool: "source-map",
	optimization: {
		minimize: false
	},
	plugins: [new AtricaSetup()],
	performance: {
		hints: false,
		maxEntrypointSize: 512000,
		maxAssetSize: 512000
	}
});
