/**
 * Class for rendering images in mfllpX mode.
 */
class ImageX {
	/**
	 * Renders an image on the PDF document.
	 * @param {object} image - The image to be rendered.
	 * @param {object} pdfKitDoc - The PDF document object.
	 */
	static render(image, pdfKitDoc) {
		pdfKitDoc.save();
		if (image.rotation !== 0) {
			ImageX.docTransformRotate(image.rotation, image.rotationOrigin, pdfKitDoc);
		}

		if (image.xImageFlipV || image.xImageFlipH) {
			pdfKitDoc.scale(
				image.xImageFlipH ? -1 : 1,
				image.xImageFlipV ? -1 : 1,
				{
					origin: [image.x + image._width / 2, image.y + image._height / 2]
				}
			);
		}

		pdfKitDoc.image(image.image, image.x, image.y, {
			width: image._width,
			height: image._height
		});
		pdfKitDoc.restore();
	}

	/**
	 * Applies a rotation transformation to the PDF document.
	 * @param {number} angle - The rotation angle in degrees.
	 * @param {object} origin - The origin point for the rotation.
	 * @param {object} pdfKitDoc - The PDF document object.
	 */
	static docTransformRotate(angle, origin, pdfKitDoc) {
		var fixedAngle = (angle * -1).toFixed(2);

		if ((origin !== null) && (origin !== undefined)) {
			pdfKitDoc.rotate(fixedAngle, {
				origin: [origin.x, origin.y]
			});
		} else {
			pdfKitDoc.rotate(fixedAngle);
		}
	}
}

module.exports = ImageX;
