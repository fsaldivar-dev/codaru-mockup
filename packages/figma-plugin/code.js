// Codaru Mockup export for Figma. Runs inside Figma, reads the selection or the current page and
// hands the UI one JSON document to save. It sends nothing over the network.
// Kept to plain ES2017 on purpose: no optional chaining, no object spread, no build step.
figma.showUI(__html__, { width: 340, height: 420 });

var MIXED = figma.mixed;
var VECTOR_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'LINE'];
var MAX_NODES = 3000;
var MAX_IMAGE_BYTES = 3000000;

function plain(value, fallback) { return value === MIXED || value === undefined ? fallback : value; }

function paints(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function (paint) {
    var out = { type: paint.type, visible: paint.visible !== false, opacity: paint.opacity === undefined ? 1 : paint.opacity };
    if (paint.type === 'SOLID') out.color = paint.color;
    if (paint.gradientStops) { out.gradientStops = paint.gradientStops; out.gradientTransform = paint.gradientTransform; }
    if (paint.type === 'IMAGE') out.imageHash = paint.imageHash;
    return out;
  });
}

function mime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[8] === 0x57) return 'image/webp';
  return '';
}

async function imageOf(fills, state) {
  var hash = null;
  for (var i = fills.length - 1; i >= 0; i--) if (fills[i].type === 'IMAGE' && fills[i].visible !== false && fills[i].imageHash) { hash = fills[i].imageHash; break; }
  if (!hash) return undefined;
  try {
    var image = figma.getImageByHash(hash);
    if (!image) return undefined;
    var bytes = await image.getBytesAsync(), type = mime(bytes);
    if (!type || bytes.length > MAX_IMAGE_BYTES) { state.skippedImages++; return undefined; }
    return 'data:' + type + ';base64,' + figma.base64Encode(bytes);
  } catch (error) { state.skippedImages++; return undefined; }
}

async function serialize(node, origin, state) {
  if (state.count >= MAX_NODES) { state.truncated = true; return null; }
  state.count++;
  var box = node.absoluteBoundingBox || { x: origin.x, y: origin.y, width: node.width || 1, height: node.height || 1 };
  var out = {
    id: node.id, name: node.name, type: node.type, visible: node.visible !== false, locked: node.locked === true,
    x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height,
    rotation: 'rotation' in node ? node.rotation : 0, opacity: 'opacity' in node ? node.opacity : 1
  };
  if (!out.visible) return out;
  if ('fills' in node) out.fills = paints(plain(node.fills, []));
  if ('strokes' in node) { out.strokes = paints(node.strokes); out.strokeWeight = plain(node.strokeWeight, 1); }
  if ('cornerRadius' in node) {
    var radius = node.cornerRadius;
    out.radius = radius === MIXED ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius] : [radius, radius, radius, radius];
  }
  if ('effects' in node && node.effects.length) out.effects = node.effects.map(function (effect) { return { type: effect.type, visible: effect.visible !== false }; });
  if ('fillStyleId' in node && typeof node.fillStyleId === 'string' && node.fillStyleId) out.fillStyle = node.fillStyleId;
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    out.layout = { mode: node.layoutMode, gap: node.itemSpacing, padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
      primaryAlign: node.primaryAxisAlignItems, counterAlign: node.counterAxisAlignItems, wrap: node.layoutWrap === 'WRAP' };
  }
  if ('layoutGrow' in node) out.grow = node.layoutGrow;

  if (node.type === 'TEXT') {
    var mixed = node.fontSize === MIXED || node.fontName === MIXED || node.fills === MIXED;
    var font = node.fontName === MIXED ? node.getRangeFontName(0, 1) : node.fontName;
    var lineHeight = node.lineHeight === MIXED ? node.getRangeLineHeight(0, 1) : node.lineHeight;
    out.text = {
      characters: node.characters, fontSize: node.fontSize === MIXED ? node.getRangeFontSize(0, 1) : node.fontSize,
      fontFamily: font.family, fontStyle: font.style, fontWeight: plain(node.fontWeight, undefined),
      lineHeight: lineHeight, align: node.textAlignHorizontal, mixed: mixed
    };
    if (node.fills === MIXED) out.fills = paints(node.getRangeFills(0, 1));
    if (typeof node.textStyleId === 'string' && node.textStyleId) out.textStyle = node.textStyleId;
    return out;
  }
  if (VECTOR_TYPES.indexOf(node.type) >= 0) {
    try { out.svg = await node.exportAsync({ format: 'SVG_STRING' }); } catch (error) { state.skippedVectors++; }
    return out;
  }
  if (out.fills) { var image = await imageOf(out.fills, state); if (image) out.image = image; }
  if ('children' in node) {
    out.children = [];
    for (var i = 0; i < node.children.length; i++) {
      var child = await serialize(node.children[i], { x: box.x, y: box.y }, state);
      if (child) out.children.push(child);
    }
  }
  return out;
}

async function exportDocument(scope) {
  var roots = scope === 'selection' ? figma.currentPage.selection : figma.currentPage.children;
  if (!roots.length) throw new Error(scope === 'selection' ? 'Selecciona al menos una capa o un marco.' : 'La página está vacía.');
  var state = { count: 0, truncated: false, skippedImages: 0, skippedVectors: 0 }, nodes = [];
  for (var i = 0; i < roots.length; i++) {
    var node = await serialize(roots[i], { x: 0, y: 0 }, state);
    if (node) nodes.push(node);
  }
  var paintStyles = await figma.getLocalPaintStylesAsync(), textStyles = await figma.getLocalTextStylesAsync();
  return {
    summary: state,
    document: {
      format: 'codaru-figma-export', version: 1, file: figma.root.name, page: figma.currentPage.name,
      styles: {
        paints: paintStyles.map(function (style) { return { id: style.id, name: style.name, paints: paints(style.paints) }; }),
        texts: textStyles.map(function (style) { return { id: style.id, name: style.name, fontFamily: style.fontName.family, fontStyle: style.fontName.style, fontSize: style.fontSize, lineHeight: style.lineHeight }; })
      },
      nodes: nodes
    }
  };
}

figma.ui.onmessage = function (message) {
  if (message.type === 'close') { figma.closePlugin(); return; }
  if (message.type !== 'export') return;
  exportDocument(message.scope).then(function (result) {
    figma.ui.postMessage({ type: 'done', name: figma.root.name, summary: result.summary, json: JSON.stringify(result.document) });
  }).catch(function (error) {
    figma.ui.postMessage({ type: 'error', message: error && error.message ? error.message : String(error) });
  });
};
