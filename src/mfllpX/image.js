export default class ImageX {
	static render(image, pdfDocument) {
		pdfDocument.save();
		if (image.rotation !== 0) {
			ImageX.docTransformRotate(image.rotation, image.rotationOrigin, pdfDocument);
		}

		if (image.xImageFlipV || image.xImageFlipH) {
			pdfDocument.scale(
				image.xImageFlipH ? -1 : 1,
				image.xImageFlipV ? -1 : 1,
				{
					origin: [image.x + image._width / 2, image.y + image._height / 2]
				}
			);
		}

		pdfDocument.image(image.image, image.x, image.y, {
			width: image._width,
			height: image._height
		});
		pdfDocument.restore();
	}

	static docTransformRotate(angle, origin, pdfDocument) {
		const fixedAngle = (angle * -1).toFixed(2);

		if (origin !== null && origin !== undefined) {
			pdfDocument.rotate(fixedAngle, { origin: [origin.x, origin.y] });
		} else {
			pdfDocument.rotate(fixedAngle);
		}
	}
}
