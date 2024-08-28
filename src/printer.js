/*eslint no-unused-vars: ["error", {"args": "none"}]*/
'use strict';

var PdfKitEngine = require('./pdfKitEngine');
var FontProvider = require('./fontProvider');
var LayoutBuilder = require('./layoutBuilder');
var sizes = require('./standardPageSizes');
var ImageMeasure = require('./imageMeasure');
var SVGMeasure = require('./svgMeasure');
var textDecorator = require('./textDecorator');
var TextTools = require('./textTools');
var isFunction = require('./helpers').isFunction;
var isString = require('./helpers').isString;
var isNumber = require('./helpers').isNumber;
var isBoolean = require('./helpers').isBoolean;
var isArray = require('./helpers').isArray;
var isUndefined = require('./helpers').isUndefined;
var isPattern = require('./helpers').isPattern;
var getPattern = require('./helpers').getPattern;
var SVGtoPDF = require('./3rd-party/svg-to-pdfkit');

var findFont = function (fonts, requiredFonts, defaultFont) {
	for (var i = 0; i < requiredFonts.length; i++) {
		var requiredFont = requiredFonts[i].toLowerCase();

		for (var font in fonts) {
			if (font.toLowerCase() === requiredFont) {
				return font;
			}
		}
	}

	return defaultFont;
};

////////////////////////////////////////
// PdfPrinter

/**
 * @class Creates an instance of a PdfPrinter which turns document definition into a pdf
 *
 * @param {Object} fontDescriptors font definition dictionary
 *
 * @example
 * var fontDescriptors = {
 *	Roboto: {
 *		normal: 'fonts/Roboto-Regular.ttf',
 *		bold: 'fonts/Roboto-Medium.ttf',
 *		italics: 'fonts/Roboto-Italic.ttf',
 *		bolditalics: 'fonts/Roboto-MediumItalic.ttf'
 *	}
 * };
 *
 * var printer = new PdfPrinter(fontDescriptors);
 */
function PdfPrinter(fontDescriptors) {
	this.fontDescriptors = fontDescriptors;
}

/**
 * Executes layout engine for the specified document and renders it into a pdfkit document
 * ready to be saved.
 *
 * @param {Object} docDefinition document definition
 * @param {Object} docDefinition.content an array describing the pdf structure (for more information take a look at the examples in the /examples folder)
 * @param {Object} [docDefinition.defaultStyle] default (implicit) style definition
 * @param {Object} [docDefinition.styles] dictionary defining all styles which can be used in the document
 * @param {Object} [docDefinition.pageSize] page size (pdfkit units, A4 dimensions by default)
 * @param {Number} docDefinition.pageSize.width width
 * @param {Number} docDefinition.pageSize.height height
 * @param {Object} [docDefinition.pageMargins] page margins (pdfkit units)
 * @param {Number} docDefinition.maxPagesNumber maximum number of pages to render
 *
 * @example
 *
 * var docDefinition = {
 * 	info: {
 *		title: 'awesome Document',
 *		author: 'john doe',
 *		subject: 'subject of document',
 *		keywords: 'keywords for document',
 * 	},
 *	content: [
 *		'First paragraph',
 *		'Second paragraph, this time a little bit longer',
 *		{ text: 'Third paragraph, slightly bigger font size', fontSize: 20 },
 *		{ text: 'Another paragraph using a named style', style: 'header' },
 *		{ text: ['playing with ', 'inlines' ] },
 *		{ text: ['and ', { text: 'restyling ', bold: true }, 'them'] },
 *	],
 *	styles: {
 *		header: { fontSize: 30, bold: true }
 *	},
 *	patterns: {
 *		stripe45d: {
 *			boundingBox: [1, 1, 4, 4],
 *			xStep: 3,
 *			yStep: 3,
 *			pattern: '1 w 0 1 m 4 5 l s 2 0 m 5 3 l s'
 *		}
 *	}
 * };
 *
 * var pdfKitDoc = printer.createPdfKitDocument(docDefinition);
 *
 * pdfKitDoc.pipe(fs.createWriteStream('sample.pdf'));
 * pdfKitDoc.end();
 *
 * @return {Object} a pdfKit document object which can be saved or encode to data-url
 */
PdfPrinter.prototype.createPdfKitDocument = function (docDefinition, options) {
	options = options || {};

	docDefinition.version = docDefinition.version || '1.3';
	docDefinition.compress = isBoolean(docDefinition.compress) ? docDefinition.compress : true;
	docDefinition.images = docDefinition.images || {};
	docDefinition.pageMargins = ((docDefinition.pageMargins !== undefined) && (docDefinition.pageMargins !== null)) ? docDefinition.pageMargins : 40;

	var pageSize = fixPageSize(docDefinition.pageSize, docDefinition.pageOrientation);

	var pdfOptions = {
		size: [pageSize.width, pageSize.height],
		pdfVersion: docDefinition.version,
		compress: docDefinition.compress,
		userPassword: docDefinition.userPassword,
		ownerPassword: docDefinition.ownerPassword,
		permissions: docDefinition.permissions,
        lang: docDefinition.language,
		fontLayoutCache: isBoolean(options.fontLayoutCache) ? options.fontLayoutCache : true,
		bufferPages: options.bufferPages || false,
		autoFirstPage: false,
		info: createMetadata(docDefinition),
		font: null
	};

	this.pdfKitDoc = PdfKitEngine.createPdfDocument(pdfOptions);

	this.fontProvider = new FontProvider(this.fontDescriptors, this.pdfKitDoc);

	var builder = new LayoutBuilder(pageSize, fixPageMargins(docDefinition.pageMargins), new ImageMeasure(this.pdfKitDoc, docDefinition.images), new SVGMeasure());

	registerDefaultTableLayouts(builder);
	if (options.tableLayouts) {
		builder.registerTableLayouts(options.tableLayouts);
	}

	var pages = builder.layoutDocument(docDefinition.content, this.fontProvider, docDefinition.styles || {}, docDefinition.defaultStyle || {
		fontSize: 12,
		font: 'Roboto'
	}, docDefinition.background, docDefinition.header, docDefinition.footer, docDefinition.images, docDefinition.watermark, docDefinition.pageBreakBefore);
	var maxNumberPages = docDefinition.maxPagesNumber || -1;
	if (isNumber(maxNumberPages) && maxNumberPages > -1) {
		pages = pages.slice(0, maxNumberPages);
	}

	// if pageSize.height is set to Infinity, calculate the actual height of the page that
	// was laid out using the height of each of the items in the page.
	if (pageSize.height === Infinity) {
		var pageHeight = calculatePageHeight(pages, docDefinition.pageMargins);
		this.pdfKitDoc.options.size = [pageSize.width, pageHeight];
	}

	var patterns = createPatterns(docDefinition.patterns || {}, this.pdfKitDoc);

	renderPages(pages, this.fontProvider, this.pdfKitDoc, patterns, options.progressCallback);

	if (options.autoPrint) {
		var printActionRef = this.pdfKitDoc.ref({
			Type: 'Action',
			S: 'Named',
			N: 'Print'
		});
		this.pdfKitDoc._root.data.OpenAction = printActionRef;
		printActionRef.end();
	}
	return this.pdfKitDoc;
};

function createMetadata(docDefinition) {
	// PDF standard has these properties reserved: Title, Author, Subject, Keywords,
	// Creator, Producer, CreationDate, ModDate, Trapped.
	// To keep the pdfmake api consistent, the info field are defined lowercase.
	// Custom properties don't contain a space.
	function standardizePropertyKey(key) {
		var standardProperties = ['Title', 'Author', 'Subject', 'Keywords',
			'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'];
		var standardizedKey = key.charAt(0).toUpperCase() + key.slice(1);
		if (standardProperties.indexOf(standardizedKey) !== -1) {
			return standardizedKey;
		}

		return key.replace(/\s+/g, '');
	}

	var info = {
		Producer: 'pdfmake',
		Creator: 'pdfmake'
	};

	if (docDefinition.info) {
		for (var key in docDefinition.info) {
			var value = docDefinition.info[key];
			if (value) {
				key = standardizePropertyKey(key);
				info[key] = value;
			}
		}
	}
	return info;
}

function calculatePageHeight(pages, margins) {
	function getItemHeight(item) {
		if (isFunction(item.item.getHeight)) {
			return item.item.getHeight();
		} else if (item.item._height) {
			return item.item._height;
		} else if (item.type === 'vector') {
			if (typeof item.item.y1 !== 'undefined') {
				return item.item.y1 > item.item.y2 ? item.item.y1 : item.item.y2;
			} else {
				return item.item.h;
			}
		} else {
			// TODO: add support for next item types
			return 0;
		}
	}

	function getBottomPosition(item) {
		var top = item.item.y || 0;
		var height = getItemHeight(item);
		return top + height;
	}

	var fixedMargins = fixPageMargins(margins || 40);
	var height = fixedMargins.top;

	pages.forEach(function (page) {
		page.items.forEach(function (item) {
			var bottomPosition = getBottomPosition(item);
			if (bottomPosition > height) {
				height = bottomPosition;
			}
		});
	});

	height += fixedMargins.bottom;

	return height;
}

function fixPageSize(pageSize, pageOrientation) {
	function isNeedSwapPageSizes(pageOrientation) {
		if (isString(pageOrientation)) {
			pageOrientation = pageOrientation.toLowerCase();
			return ((pageOrientation === 'portrait') && (size.width > size.height)) ||
				((pageOrientation === 'landscape') && (size.width < size.height));
		}
		return false;
	}

	// if pageSize.height is set to auto, set the height to infinity so there are no page breaks.
	if (pageSize && pageSize.height === 'auto') {
		pageSize.height = Infinity;
	}

	var size = pageSize2widthAndHeight(pageSize || 'A4');
	if (isNeedSwapPageSizes(pageOrientation)) { // swap page sizes
		size = { width: size.height, height: size.width };
	}
	size.orientation = size.width > size.height ? 'landscape' : 'portrait';
	return size;
}

// mf-x-swa: added helper to calculate layout without generating the PDF
PdfPrinter.prototype.computeDocumentLayout = function(docDefinition, options) {
	options = options || {};

	var pageSize = fixPageSize(docDefinition.pageSize, docDefinition.pageOrientation);
	var compressPdf = isBoolean(docDefinition.compress) ? docDefinition.compress : true;
	var bufferPages = options.bufferPages || false;

	this.pdfKitDoc = PdfKitEngine.createPdfDocument({size: [pageSize.width, pageSize.height], bufferPages: bufferPages, autoFirstPage: false, compress: compressPdf});
	setMetadata(docDefinition, this.pdfKitDoc);

	this.fontProvider = new FontProvider(this.fontDescriptors, this.pdfKitDoc);

	docDefinition.images = docDefinition.images || {};

	var builder = new LayoutBuilder(pageSize, fixPageMargins(docDefinition.pageMargins || 40), new ImageMeasure(this.pdfKitDoc, docDefinition.images));

	registerDefaultTableLayouts(builder);
	if (options.tableLayouts) {
		builder.registerTableLayouts(options.tableLayouts);
	}

	builder.layoutDocument(docDefinition.content, this.fontProvider, docDefinition.styles || {}, docDefinition.defaultStyle || {fontSize: 12, font: 'Roboto'}, docDefinition.background, docDefinition.header, docDefinition.footer, docDefinition.images, docDefinition.watermark, docDefinition.pageBreakBefore);

	return builder.writer.context();
};

function fixPageMargins(margin) {
	if (isNumber(margin)) {
		margin = { left: margin, right: margin, top: margin, bottom: margin };
	} else if (isArray(margin)) {
		if (margin.length === 2) {
			margin = { left: margin[0], top: margin[1], right: margin[0], bottom: margin[1] };
		} else if (margin.length === 4) {
			margin = { left: margin[0], top: margin[1], right: margin[2], bottom: margin[3] };
		} else {
			throw 'Invalid pageMargins definition';
		}
	}

	return margin;
}

function registerDefaultTableLayouts(layoutBuilder) {
	layoutBuilder.registerTableLayouts({
		noBorders: {
			hLineWidth: function (i) {
				return 0;
			},
			vLineWidth: function (i) {
				return 0;
			},
			paddingLeft: function (i) {
				return i && 4 || 0;
			},
			paddingRight: function (i, node) {
				return (i < node.table.widths.length - 1) ? 4 : 0;
			}
		},
		headerLineOnly: {
			hLineWidth: function (i, node) {
				if (i === 0 || i === node.table.body.length) {
					return 0;
				}
				return (i === node.table.headerRows) ? 2 : 0;
			},
			vLineWidth: function (i) {
				return 0;
			},
			paddingLeft: function (i) {
				return i === 0 ? 0 : 8;
			},
			paddingRight: function (i, node) {
				return (i === node.table.widths.length - 1) ? 0 : 8;
			}
		},
		lightHorizontalLines: {
			hLineWidth: function (i, node) {
				if (i === 0 || i === node.table.body.length) {
					return 0;
				}
				return (i === node.table.headerRows) ? 2 : 1;
			},
			vLineWidth: function (i) {
				return 0;
			},
			hLineColor: function (i) {
				return i === 1 ? 'black' : '#aaa';
			},
			paddingLeft: function (i) {
				return i === 0 ? 0 : 8;
			},
			paddingRight: function (i, node) {
				return (i === node.table.widths.length - 1) ? 0 : 8;
			}
		}
	});
}

function pageSize2widthAndHeight(pageSize) {
	if (isString(pageSize)) {
		var size = sizes[pageSize.toUpperCase()];
		if (!size) {
			throw 'Page size ' + pageSize + ' not recognized';
		}
		return { width: size[0], height: size[1] };
	}

	return pageSize;
}

function updatePageOrientationInOptions(currentPage, pdfKitDoc) {
	var previousPageOrientation = pdfKitDoc.options.size[0] > pdfKitDoc.options.size[1] ? 'landscape' : 'portrait';

	if (currentPage.pageSize.orientation !== previousPageOrientation) {
		var width = pdfKitDoc.options.size[0];
		var height = pdfKitDoc.options.size[1];
		pdfKitDoc.options.size = [height, width];
	}
}

function renderPages(pages, fontProvider, pdfKitDoc, patterns, progressCallback) {
	pdfKitDoc._pdfMakePages = pages;
	pdfKitDoc.addPage();

	var totalItems = 0;
	if (progressCallback) {
		pages.forEach(function (page) {
			totalItems += page.items.length;
		});
	}

	var renderedItems = 0;
	progressCallback = progressCallback || function () {
	};

	for (var i = 0; i < pages.length; i++) {
		if (i > 0) {
			updatePageOrientationInOptions(pages[i], pdfKitDoc);
			pdfKitDoc.addPage(pdfKitDoc.options);
		}

		var page = pages[i];
		for (var ii = 0, il = page.items.length; ii < il; ii++) {
			var item = page.items[ii];
			switch (item.type) {
				case 'vector':
					renderVector(item.item, patterns, pdfKitDoc);
					break;
				case 'line':
					renderLine(item.item, item.item.x, item.item.y, patterns, pdfKitDoc);
					break;
				case 'image':
					renderImage(item.item, item.item.x, item.item.y, pdfKitDoc);
					break;
				case 'svg':
					renderSVG(item.item, item.item.x, item.item.y, pdfKitDoc, fontProvider);
					break;
				case 'beginClip':
					beginClip(item.item, pdfKitDoc);
					break;
				case 'endClip':
					endClip(pdfKitDoc);
					break;
			}
			renderedItems++;
			progressCallback(renderedItems / totalItems);
		}
		if (page.watermark) {
			renderWatermark(page, pdfKitDoc);
		}
	}
}

/**
 * Shift the "y" height of the text baseline up or down (superscript or subscript,
 * respectively). The exact shift can / should be changed according to standard
 * conventions.
 *
 * @param {number} y
 * @param {any} inline
 */
function offsetText(y, inline) {
	var newY = y;
	if (inline.sup) {
		newY -= inline.fontSize * 0.75;
	}
	if (inline.sub) {
		newY += inline.fontSize * 0.35;
	}
	return newY;
}

function renderLine(line, x, y, patterns, pdfKitDoc) {
	function preparePageNodeRefLine(_pageNodeRef, inline) {
		var newWidth;
		var diffWidth;
		var textTools = new TextTools(null);

		if (isUndefined(_pageNodeRef.positions)) {
			throw 'Page reference id not found';
		}

		var pageNumber = _pageNodeRef.positions[0].pageNumber.toString();

		inline.text = pageNumber;
		newWidth = textTools.widthOfString(inline.text, inline.font, inline.fontSize, inline.characterSpacing, inline.fontFeatures);
		diffWidth = inline.width - newWidth;
		inline.width = newWidth;

		switch (inline.alignment) {
			case 'right':
				inline.x += diffWidth;
				break;
			case 'center':
				inline.x += diffWidth / 2;
				break;
		}
	}

	if (line._pageNodeRef) {
		preparePageNodeRefLine(line._pageNodeRef, line.inlines[0]);
	}

	x = x || 0;
	y = y || 0;

	var lineHeight = line.getHeight();
	var ascenderHeight = line.getAscenderHeight();
	var descent = lineHeight - ascenderHeight;

	textDecorator.drawBackground(line, x, y, patterns, pdfKitDoc);

	//TODO: line.optimizeInlines();
	for (var i = 0, l = line.inlines.length; i < l; i++) {
		var inline = line.inlines[i];
		var shiftToBaseline = lineHeight - ((inline.font.ascender / 1000) * inline.fontSize) - descent;

		if (inline._pageNodeRef) {
			preparePageNodeRefLine(inline._pageNodeRef, inline);
		}

		var options = {
			lineBreak: false,
			textWidth: inline.width,
			characterSpacing: inline.characterSpacing,
			wordCount: 1,
			link: inline.link
		};

		if (inline.linkToDestination) {
			options.goTo = inline.linkToDestination;
		}

		if (line.id && i === 0) {
			options.destination = line.id;
		}

		if (inline.fontFeatures) {
			options.features = inline.fontFeatures;
		}

		var opacity = isNumber(inline.opacity) ? inline.opacity : 1;
		pdfKitDoc.opacity(opacity);
		pdfKitDoc.fill(inline.color || 'black');

		pdfKitDoc._font = inline.font;
		pdfKitDoc.fontSize(inline.fontSize);

		var shiftedY = offsetText(y + shiftToBaseline, inline);
		pdfKitDoc.text(inline.text, x + inline.x, shiftedY, options);

		if (inline.linkToPage) {
			var _ref = pdfKitDoc.ref({ Type: 'Action', S: 'GoTo', D: [inline.linkToPage, 0, 0] }).end();
			pdfKitDoc.annotate(x + inline.x, shiftedY, inline.width, inline.height, {
				Subtype: 'Link',
				Dest: [inline.linkToPage - 1, 'XYZ', null, null, null]
			});
		}

	}
	// Decorations won't draw correctly for superscript
	textDecorator.drawDecorations(line, x, y, pdfKitDoc);
}

function renderWatermark(page, pdfKitDoc) {
	var watermark = page.watermark;

	pdfKitDoc.fill(watermark.color);
	pdfKitDoc.opacity(watermark.opacity);

	pdfKitDoc.save();

	pdfKitDoc.rotate(watermark.angle, { origin: [pdfKitDoc.page.width / 2, pdfKitDoc.page.height / 2] });

	var x = pdfKitDoc.page.width / 2 - watermark._size.size.width / 2;
	var y = pdfKitDoc.page.height / 2 - watermark._size.size.height / 2;

	pdfKitDoc._font = watermark.font;
	pdfKitDoc.fontSize(watermark.fontSize);
	pdfKitDoc.text(watermark.text, x, y, { lineBreak: false });

	pdfKitDoc.restore();
}

function renderVector(vector, patterns, pdfKitDoc) {
	// mf-x-swa: check extended vector support
	if (vector.type.startsWith('x-')) {
		return renderXVector(vector, pdfKitDoc);
	}

	//TODO: pdf optimization (there's no need to write all properties everytime)
	pdfKitDoc.lineWidth(vector.lineWidth || 1);
	if (vector.dash) {
		pdfKitDoc.dash(vector.dash.length, { space: vector.dash.space || vector.dash.length, phase: vector.dash.phase || 0 });
	} else {
		pdfKitDoc.undash();
	}
	pdfKitDoc.lineJoin(vector.lineJoin || 'miter');
	pdfKitDoc.lineCap(vector.lineCap || 'butt');

	//TODO: clipping

	var gradient = null;

	switch (vector.type) {
		case 'ellipse':
			pdfKitDoc.ellipse(vector.x, vector.y, vector.r1, vector.r2);

			if (vector.linearGradient) {
				gradient = pdfKitDoc.linearGradient(vector.x - vector.r1, vector.y, vector.x + vector.r1, vector.y);
			}
			break;
		case 'rect':
			if (vector.r) {
				pdfKitDoc.roundedRect(vector.x, vector.y, vector.w, vector.h, vector.r);
			} else {
				pdfKitDoc.rect(vector.x, vector.y, vector.w, vector.h);
			}

			if (vector.linearGradient) {
				gradient = pdfKitDoc.linearGradient(vector.x, vector.y, vector.x + vector.w, vector.y);
			}
			break;
		case 'line':
			pdfKitDoc.moveTo(vector.x1, vector.y1);
			pdfKitDoc.lineTo(vector.x2, vector.y2);
			break;
		case 'polyline':
			if (vector.points.length === 0) {
				break;
			}

			pdfKitDoc.moveTo(vector.points[0].x, vector.points[0].y);
			for (var i = 1, l = vector.points.length; i < l; i++) {
				pdfKitDoc.lineTo(vector.points[i].x, vector.points[i].y);
			}

			if (vector.points.length > 1) {
				var p1 = vector.points[0];
				var pn = vector.points[vector.points.length - 1];

				if (vector.closePath || p1.x === pn.x && p1.y === pn.y) {
					pdfKitDoc.closePath();
				}
			}
			break;
		case 'path':
			pdfKitDoc.path(vector.d);
			break;
	}

	if (vector.linearGradient && gradient) {
		var step = 1 / (vector.linearGradient.length - 1);

		for (var i = 0; i < vector.linearGradient.length; i++) {
			gradient.stop(i * step, vector.linearGradient[i]);
		}

		vector.color = gradient;
	}

	if (isPattern(vector.color)) {
		vector.color = getPattern(vector.color, patterns);
	}

	var fillOpacity = isNumber(vector.fillOpacity) ? vector.fillOpacity : 1;
	var strokeOpacity = isNumber(vector.strokeOpacity) ? vector.strokeOpacity : 1;

	if (vector.color && vector.lineColor) {
		pdfKitDoc.fillColor(vector.color, fillOpacity);
		pdfKitDoc.strokeColor(vector.lineColor, strokeOpacity);
		pdfKitDoc.fillAndStroke();
	} else if (vector.color) {
		pdfKitDoc.fillColor(vector.color, fillOpacity);
		pdfKitDoc.fill();
	} else {
		pdfKitDoc.strokeColor(vector.lineColor || 'black', strokeOpacity);
		pdfKitDoc.stroke();
	}
}

function renderImage(image, x, y, pdfKitDoc) {
	var opacity = isNumber(image.opacity) ? image.opacity : 1;
	pdfKitDoc.opacity(opacity);
	// mf-x-swa: extended image check
	if (image.xImage) {
		renderXImage(image, pdfKitDoc);
	} else if (image.cover) {
		var align = image.cover.align || 'center';
		var valign = image.cover.valign || 'center';
		var width = image.cover.width ? image.cover.width : image.width;
		var height = image.cover.height ? image.cover.height : image.height;
		pdfKitDoc.save();
		pdfKitDoc.rect(image.x, image.y, width, height).clip();
		pdfKitDoc.image(image.image, image.x, image.y, { cover: [width, height], align: align, valign: valign });
		pdfKitDoc.restore();
	} else {
		pdfKitDoc.image(image.image, image.x, image.y, { width: image._width, height: image._height });
	}
	if (image.link) {
		pdfKitDoc.link(image.x, image.y, image._width, image._height, image.link);
	}
	if (image.linkToPage) {
		pdfKitDoc.ref({ Type: 'Action', S: 'GoTo', D: [image.linkToPage, 0, 0] }).end();
		pdfKitDoc.annotate(image.x, image.y, image._width, image._height, { Subtype: 'Link', Dest: [image.linkToPage - 1, 'XYZ', null, null, null] });
	}
	if (image.linkToDestination) {
		pdfKitDoc.goTo(image.x, image.y, image._width, image._height, image.linkToDestination);
	}
}

function renderSVG(svg, x, y, pdfKitDoc, fontProvider) {
	var options = Object.assign({ width: svg._width, height: svg._height, assumePt: true }, svg.options);
	options.fontCallback = function (family, bold, italic) {
		var fontsFamily = family.split(',').map(function (f) { return f.trim().replace(/('|")/g, ''); });
		var font = findFont(fontProvider.fonts, fontsFamily, svg.font || 'Roboto');

		var fontFile = fontProvider.getFontFile(font, bold, italic);
		if (fontFile === null) {
			var type = fontProvider.getFontType(bold, italic);
			throw new Error('Font \'' + font + '\' in style \'' + type + '\' is not defined in the font section of the document definition.');
		}

		return fontFile;
	};

	SVGtoPDF(pdfKitDoc, svg.svg, svg.x, svg.y, options);
}

function beginClip(rect, pdfKitDoc) {
	pdfKitDoc.save();
	pdfKitDoc.addContent('' + rect.x + ' ' + rect.y + ' ' + rect.width + ' ' + rect.height + ' re');
	pdfKitDoc.clip();
}

function endClip(pdfKitDoc) {
	pdfKitDoc.restore();
}

function createPatterns(patternDefinitions, pdfKitDoc) {
	var patterns = {};
	Object.keys(patternDefinitions).forEach(function (p) {
		var pattern = patternDefinitions[p];
		patterns[p] = pdfKitDoc.pattern(pattern.boundingBox, pattern.xStep, pattern.yStep, pattern.pattern, pattern.colored);
	});
	return patterns;
}

/*
 * mf-x-swa: Extended features handlers
 */
function renderXImage(image, pdfKitDoc) {
	pdfKitDoc.save();
	if (image.rotation !== 0) {
		docTransformRotate(image.rotation, image.rotationOrigin, pdfKitDoc);
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

function docTransformRotate(angle, origin, pdfKitDoc) {
	var fixedAngle = (angle * -1).toFixed(2);

	if ((origin !== null) && (origin !== undefined)) {
		pdfKitDoc.rotate(fixedAngle, {
			origin: [origin.x, origin.y]
		});
	} else {
		pdfKitDoc.rotate(fixedAngle);
	}
}

function renderXVector(vector, pdfKitDoc) {
	switch (vector.type) {
		case 'x-saveContext':
			pdfKitDoc.save();
			break;

		case 'x-restoreContext':
			pdfKitDoc.restore();
			break;

		case 'x-rotateContext':
			xVecRotateContext(vector, pdfKitDoc);
			break;

		case 'x-translateContext':
			xVecTranslateContext(vector, pdfKitDoc);
			break;

		case 'x-scaleContext':
			xVecScaleContext(vector, pdfKitDoc);
			break;

			case 'x-lineStyle':
			xVecLineStyle(vector, pdfKitDoc);
			break;

		case 'x-strokeColor':
			xVecStrokeColor(vector, pdfKitDoc);
			break;

		case 'x-fillColor':
			xVecFillColor(vector, pdfKitDoc);
			break;

		case 'x-strokePath':
			xVecStrokePath(vector, pdfKitDoc);
			break;

		case 'x-fillPath':
			xVecFillPath(vector, pdfKitDoc);
			break;

		case 'x-fillAndStrokePath':
			xVecFillAndStrokePath(vector, pdfKitDoc);
			break;

		case 'x-moveTo':
			xVecMoveTo(vector, pdfKitDoc);
			break;

		case 'x-lineTo':
			xVecLineTo(vector, pdfKitDoc);
			break;

		case 'x-line':
			xVecLine(vector, pdfKitDoc);
			break;

		case 'x-rect':
			xVecRect(vector, pdfKitDoc);
			break;

		case 'x-ellipse':
			xVecElipse(vector, pdfKitDoc);
			break;

		case 'x-quadraticCurve':
			xVecQuadraticCurve(vector, pdfKitDoc);
			break;

		case 'x-bezierCurve':
			xVecBezierCurve(vector, pdfKitDoc);
			break;

		case 'x-closePath':
			pdfKitDoc.closePath();
			break;

		case 'x-clipToRect':
			xVecClipToRect(vector, pdfKitDoc);
			break;
	}
}

function xVecRotateContext(vector, pdfKitDoc) {
	var angle = (vector.angle * -1).toFixed(2);

	if (vector.origin !== undefined) {
		pdfKitDoc.rotate(angle, {
			origin: [vector.origin.x, vector.origin.y]
		});
	} else {
		pdfKitDoc.rotate(angle);
	}
}

function xVecTranslateContext(vector, pdfKitDoc) {
	pdfKitDoc.translate(vector.x, vector.y);
}

function xVecScaleContext(vector, pdfKitDoc) {
	var scale = vector.scale;

	if (vector.origin !== undefined) {
		pdfKitDoc.scale(scale, {
			origin: [vector.origin.x, vector.origin.y]
		});
	} else {
		pdfKitDoc.scale(scale);
	}
}

function xVecLineStyle(vector, pdfKitDoc) {
	pdfKitDoc.lineWidth(vector.lineWidth || 1);
	if (vector.dash) {
		pdfKitDoc.dash(vector.dash.length, {
			space: vector.dash.space || vector.dash.length
		});
	} else {
		pdfKitDoc.undash();
	}
}

function xVecStrokeColor(vector, pdfKitDoc) {
	if (vector.strokeOpacity) {
		pdfKitDoc.strokeColor(vector.strokeColor, vector.strokeOpacity);
	} else {
		pdfKitDoc.strokeColor(vector.strokeColor);
	}
}

function xVecFillColor(vector, pdfKitDoc) {
	if (vector.fillOpacity) {
		pdfKitDoc.fillColor(vector.fillColor, vector.fillOpacity);
	} else {
		pdfKitDoc.fillColor(vector.fillColor);
	}
}

function xVecStrokePath(vector, pdfKitDoc) {
	if (vector.strokeColor !== undefined) {
		pdfKitDoc.stroke(vector.strokeColor);
	} else {
		pdfKitDoc.stroke();
	}
}

function xVecFillPath(vector, pdfKitDoc) {
	if (vector.fillColor !== undefined) {
		pdfKitDoc.fill(vector.fillColor);
	} else {
		pdfKitDoc.fill();
	}
}

function xVecFillAndStrokePath(vector, pdfKitDoc) {
	if ((vector.strokeColor !== undefined) && (vector.fillColor !== undefined)) {
		pdfKitDoc.fillAndStroke(vector.fillColor, vector.strokeColor);
	} else {
		pdfKitDoc.fillAndStroke();
	}
}

function xVecMoveTo(vector, pdfKitDoc) {
	pdfKitDoc.moveTo(vector.x, vector.y);
}

function xVecLineTo(vector, pdfKitDoc) {
	pdfKitDoc.lineTo(vector.x, vector.y);
}

function xVecLine(vector, pdfKitDoc) {
	pdfKitDoc.moveTo(vector.x1, vector.y1);
	pdfKitDoc.lineTo(vector.x2, vector.y2);
}

function xVecRect(vector, pdfKitDoc) {
	pdfKitDoc.rect(vector.x, vector.y, vector.width, vector.height);
}

function xVecElipse(vector, pdfKitDoc) {
	pdfKitDoc.ellipse(vector.cx, vector.cy, vector.rx, vector.ry);
}

function xVecQuadraticCurve(vector, pdfKitDoc) {
	if ((vector.x1 !== undefined) && (vector.y1 !== undefined)) {
		pdfKitDoc.moveTo(vector.x1, vector.y1);
	}
	pdfKitDoc.quadraticCurveTo(vector.cpx, vector.cpy, vector.x2, vector.y2);
}

function xVecBezierCurve(vector, pdfKitDoc) {
	if ((vector.x1 !== undefined) && (vector.y1 !== undefined)) {
		pdfKitDoc.moveTo(vector.x1, vector.y1);
	}
	pdfKitDoc.bezierCurveTo(vector.cpx1, vector.cpy1, vector.cpx2, vector.cpy2, vector.x2, vector.y2);
}

function xVecClipToRect(vector, pdfKitDoc) {
	pdfKitDoc.rect(vector.x, vector.y, vector.width, vector.height);
	pdfKitDoc.clip();
}

module.exports = PdfPrinter;
