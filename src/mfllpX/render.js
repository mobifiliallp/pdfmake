var ImageX = require('./image.js');
var VectorX = require('./vector.js');

/**
 * RenderX is responsible for rendering X-type items (images and vectors) on the PDF document.
 * It checks the type of the item and delegates the rendering to the appropriate class
 * (ImageX for images and VectorX for vectors). If the item is rendered successfully,
 * it returns true; otherwise, it returns false, allowing the caller to handle
 * non-X items as needed.
 */
class RenderX {
	/**
	 * Renders an X-type item (image or vector) on the PDF document.
	 * @param {Object} item - The item to be rendered.
	 * @param {Object} pdfKitDoc - The PDF document object.
	 * @returns {boolean} - Returns true if the item was rendered, false otherwise.
	 */
	static render(item, pdfKitDoc) {
		if (item.type == 'image' && item.xImage) {
			ImageX.renderImage(item, pdfKitDoc);
			return true;
		} else if (item.type == 'vector' && item.item.type.startsWith('x-')) {
			VectorX.renderXVector(item.item, pdfKitDoc);
			return true;
		}
		return false;
	}
}

module.exports = RenderX;
