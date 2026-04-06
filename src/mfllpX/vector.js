export default class VectorX {
	static render(vector, pdfDocument) {
		switch (vector.type) {
			case 'x-saveContext':
				pdfDocument.save();
				break;
			case 'x-restoreContext':
				pdfDocument.restore();
				break;
			case 'x-rotateContext':
				VectorX.xVecRotateContext(vector, pdfDocument);
				break;
			case 'x-translateContext':
				pdfDocument.translate(vector.x, vector.y);
				break;
			case 'x-scaleContext':
				VectorX.xVecScaleContext(vector, pdfDocument);
				break;
			case 'x-lineStyle':
				VectorX.xVecLineStyle(vector, pdfDocument);
				break;
			case 'x-strokeColor':
				VectorX.xVecStrokeColor(vector, pdfDocument);
				break;
			case 'x-fillColor':
				VectorX.xVecFillColor(vector, pdfDocument);
				break;
			case 'x-strokePath':
				vector.strokeColor !== undefined ? pdfDocument.stroke(vector.strokeColor) : pdfDocument.stroke();
				break;
			case 'x-fillPath':
				vector.fillColor !== undefined ? pdfDocument.fill(vector.fillColor) : pdfDocument.fill();
				break;
			case 'x-fillAndStrokePath':
				(vector.strokeColor !== undefined && vector.fillColor !== undefined)
					? pdfDocument.fillAndStroke(vector.fillColor, vector.strokeColor)
					: pdfDocument.fillAndStroke();
				break;
			case 'x-moveTo':
				pdfDocument.moveTo(vector.x, vector.y);
				break;
			case 'x-lineTo':
				pdfDocument.lineTo(vector.x, vector.y);
				break;
			case 'x-line':
				pdfDocument.moveTo(vector.x1, vector.y1);
				pdfDocument.lineTo(vector.x2, vector.y2);
				break;
			case 'x-rect':
				pdfDocument.rect(vector.x, vector.y, vector.width, vector.height);
				break;
			case 'x-ellipse':
				pdfDocument.ellipse(vector.cx, vector.cy, vector.rx, vector.ry);
				break;
			case 'x-quadraticCurve':
				if (vector.x1 !== undefined && vector.y1 !== undefined) {
					pdfDocument.moveTo(vector.x1, vector.y1);
				}
				pdfDocument.quadraticCurveTo(vector.cpx, vector.cpy, vector.x2, vector.y2);
				break;
			case 'x-bezierCurve':
				if (vector.x1 !== undefined && vector.y1 !== undefined) {
					pdfDocument.moveTo(vector.x1, vector.y1);
				}
				pdfDocument.bezierCurveTo(vector.cpx1, vector.cpy1, vector.cpx2, vector.cpy2, vector.x2, vector.y2);
				break;
			case 'x-closePath':
				pdfDocument.closePath();
				break;
			case 'x-clipToRect':
				pdfDocument.rect(vector.x, vector.y, vector.width, vector.height);
				pdfDocument.clip();
				break;
		}
	}

	static xVecRotateContext(vector, pdfDocument) {
		const angle = (vector.angle * -1).toFixed(2);
		if (vector.origin !== undefined) {
			pdfDocument.rotate(angle, { origin: [vector.origin.x, vector.origin.y] });
		} else {
			pdfDocument.rotate(angle);
		}
	}

	static xVecScaleContext(vector, pdfDocument) {
		if (vector.origin !== undefined) {
			pdfDocument.scale(vector.scale, { origin: [vector.origin.x, vector.origin.y] });
		} else {
			pdfDocument.scale(vector.scale);
		}
	}

	static xVecLineStyle(vector, pdfDocument) {
		pdfDocument.lineWidth(vector.lineWidth || 1);
		if (vector.dash) {
			pdfDocument.dash(vector.dash.length, { space: vector.dash.space || vector.dash.length });
		} else {
			pdfDocument.undash();
		}
	}

	static xVecStrokeColor(vector, pdfDocument) {
		if (vector.strokeOpacity) {
			pdfDocument.strokeColor(vector.strokeColor, vector.strokeOpacity);
		} else {
			pdfDocument.strokeColor(vector.strokeColor);
		}
	}

	static xVecFillColor(vector, pdfDocument) {
		if (vector.fillOpacity) {
			pdfDocument.fillColor(vector.fillColor, vector.fillOpacity);
		} else {
			pdfDocument.fillColor(vector.fillColor);
		}
	}
}
