/**
 * Class for rendering vector graphics in mfllpX mode.
 */
class VectorX {
	/**
	 * Renders a vector graphic on the PDF document.
	 * @param {Object} vector - The vector graphic to be rendered.
	 * @param {Object} pdfKitDoc - The PDF document object.
	 */
	static render(vector, pdfKitDoc) {
		switch (vector.type) {
			case 'x-saveContext':
				pdfKitDoc.save();
				break;

			case 'x-restoreContext':
				pdfKitDoc.restore();
				break;

			case 'x-rotateContext':
				VectorX.xVecRotateContext(vector, pdfKitDoc);
				break;

			case 'x-translateContext':
				VectorX.xVecTranslateContext(vector, pdfKitDoc);
				break;

			case 'x-scaleContext':
				VectorX.xVecScaleContext(vector, pdfKitDoc);
				break;

			case 'x-lineStyle':
				VectorX.xVecLineStyle(vector, pdfKitDoc);
				break;

			case 'x-strokeColor':
				VectorX.xVecStrokeColor(vector, pdfKitDoc);
				break;

			case 'x-fillColor':
				VectorX.xVecFillColor(vector, pdfKitDoc);
				break;

			case 'x-strokePath':
				VectorX.xVecStrokePath(vector, pdfKitDoc);
				break;

			case 'x-fillPath':
				VectorX.xVecFillPath(vector, pdfKitDoc);
				break;

			case 'x-fillAndStrokePath':
				VectorX.xVecFillAndStrokePath(vector, pdfKitDoc);
				break;

			case 'x-moveTo':
				VectorX.xVecMoveTo(vector, pdfKitDoc);
				break;

			case 'x-lineTo':
				VectorX.xVecLineTo(vector, pdfKitDoc);
				break;

			case 'x-line':
				VectorX.xVecLine(vector, pdfKitDoc);
				break;

			case 'x-rect':
				VectorX.xVecRect(vector, pdfKitDoc);
				break;

			case 'x-ellipse':
				VectorX.xVecEllipse(vector, pdfKitDoc);
				break;

			case 'x-quadraticCurve':
				VectorX.xVecQuadraticCurve(vector, pdfKitDoc);
				break;

			case 'x-bezierCurve':
				VectorX.xVecBezierCurve(vector, pdfKitDoc);
				break;

			case 'x-closePath':
				pdfKitDoc.closePath();
				break;

			case 'x-clipToRect':
				VectorX.xVecClipToRect(vector, pdfKitDoc);
				break;
		}
	}

	static xVecRotateContext(vector, pdfKitDoc) {
		var angle = (vector.angle * -1).toFixed(2);

		if (vector.origin !== undefined) {
			pdfKitDoc.rotate(angle, {
				origin: [vector.origin.x, vector.origin.y]
			});
		} else {
			pdfKitDoc.rotate(angle);
		}
	}

	static xVecTranslateContext(vector, pdfKitDoc) {
		pdfKitDoc.translate(vector.x, vector.y);
	}

	static xVecScaleContext(vector, pdfKitDoc) {
		var scale = vector.scale;

		if (vector.origin !== undefined) {
			pdfKitDoc.scale(scale, {
				origin: [vector.origin.x, vector.origin.y]
			});
		} else {
			pdfKitDoc.scale(scale);
		}
	}

	static xVecLineStyle(vector, pdfKitDoc) {
		pdfKitDoc.lineWidth(vector.lineWidth || 1);
		if (vector.dash) {
			pdfKitDoc.dash(vector.dash.length, {
				space: vector.dash.space || vector.dash.length
			});
		} else {
			pdfKitDoc.undash();
		}
	}

	static xVecStrokeColor(vector, pdfKitDoc) {
		if (vector.strokeOpacity) {
			pdfKitDoc.strokeColor(vector.strokeColor, vector.strokeOpacity);
		} else {
			pdfKitDoc.strokeColor(vector.strokeColor);
		}
	}

	static xVecFillColor(vector, pdfKitDoc) {
		if (vector.fillOpacity) {
			pdfKitDoc.fillColor(vector.fillColor, vector.fillOpacity);
		} else {
			pdfKitDoc.fillColor(vector.fillColor);
		}
	}

	static xVecStrokePath(vector, pdfKitDoc) {
		if (vector.strokeColor !== undefined) {
			pdfKitDoc.stroke(vector.strokeColor);
		} else {
			pdfKitDoc.stroke();
		}
	}

	static xVecFillPath(vector, pdfKitDoc) {
		if (vector.fillColor !== undefined) {
			pdfKitDoc.fill(vector.fillColor);
		} else {
			pdfKitDoc.fill();
		}
	}

	static xVecFillAndStrokePath(vector, pdfKitDoc) {
		if ((vector.strokeColor !== undefined) && (vector.fillColor !== undefined)) {
			pdfKitDoc.fillAndStroke(vector.fillColor, vector.strokeColor);
		} else {
			pdfKitDoc.fillAndStroke();
		}
	}

	static xVecMoveTo(vector, pdfKitDoc) {
		pdfKitDoc.moveTo(vector.x, vector.y);
	}

	static xVecLineTo(vector, pdfKitDoc) {
		pdfKitDoc.lineTo(vector.x, vector.y);
	}

	static xVecLine(vector, pdfKitDoc) {
		pdfKitDoc.moveTo(vector.x1, vector.y1);
		pdfKitDoc.lineTo(vector.x2, vector.y2);
	}

	static xVecRect(vector, pdfKitDoc) {
		pdfKitDoc.rect(vector.x, vector.y, vector.width, vector.height);
	}

	static xVecEllipse(vector, pdfKitDoc) {
		pdfKitDoc.ellipse(vector.cx, vector.cy, vector.rx, vector.ry);
	}

	static xVecQuadraticCurve(vector, pdfKitDoc) {
		if ((vector.x1 !== undefined) && (vector.y1 !== undefined)) {
			pdfKitDoc.moveTo(vector.x1, vector.y1);
		}
		pdfKitDoc.quadraticCurveTo(vector.cpx, vector.cpy, vector.x2, vector.y2);
	}

	static xVecBezierCurve(vector, pdfKitDoc) {
		if ((vector.x1 !== undefined) && (vector.y1 !== undefined)) {
			pdfKitDoc.moveTo(vector.x1, vector.y1);
		}
		pdfKitDoc.bezierCurveTo(vector.cpx1, vector.cpy1, vector.cpx2, vector.cpy2, vector.x2, vector.y2);
	}

	static xVecClipToRect(vector, pdfKitDoc) {
		pdfKitDoc.rect(vector.x, vector.y, vector.width, vector.height);
		pdfKitDoc.clip();
	}
}

module.exports = VectorX;
