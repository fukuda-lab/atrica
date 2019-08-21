const sharp = require("sharp");
const SharpType = sharp();

/**
 * ImageCollection
 */
class ImageCollection {
	/**
	 * Reprensent a collection of images
	 * @param {Array<Buffer>} images
	 */
	constructor(images) {
		this.images = images.map(image => sharp(image));
	}

	/**
	 * An array of sharp objects
	 * @returns {Array<SharpType>}
	 */
	asArray() {
		return [...this.images];
	}

	/**
	 * Merge the images vertically
	 * @returns {Promise<SharpType>} - The merged images
	 */
	async verticalJoin() {
		let metadatas = await Promise.all(
			this.images.map(async image => {
				let { width, height } = await image.metadata();
				return { width, height };
			})
		);

		let buffers = await Promise.all(
			this.images.map(async image => await image.toBuffer())
		);

		let widths = metadatas.map(meta => meta.width);
		let heights = metadatas.map(meta => meta.height);

		let width = Math.max(...widths);
		let height = heights.reduce((a, b) => a + b, 0);

		let newImage = await sharp({
			create: {
				width,
				height,
				channels: 3,
				background: { r: 0, g: 0, b: 0 }
			}
		}).png();

		let composition = [];
		let cumulativeHeight = 0;

		for (let i = 0; i < buffers.length; i++) {
			composition.push({
				input: buffers[i],
				left: 0,
				top: cumulativeHeight
			});
			cumulativeHeight += heights[0];
		}

		return newImage.composite(composition);
	}
}

module.exports = ImageCollection;