/**
 * A small mirror of flare-engine FileParser / UtilsParsing, enough to
 * check the text we write and to import maps we previously exported.
 *
 * Rules (UtilsParsing.cpp, Map.cpp loadLayer):
 * - trim, drop CR
 * - blank or a line whose first non-space is '#' is a comment
 * - no inline comments: "key=val # note" keeps "# note" in the value
 * - [section] up to the first ']'
 * - key=value splits on the first '='
 * - int is the first integer; "1,500" is 1
 * - a layer row that does not end with ',' gets one appended, then the
 *   comma count must equal the map width
 */

function toIntFlare(value) {
  const match = String(value ?? "").match(/^\s*([+-]?\d+)/);
  if (!match) return 0;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isComment(line) {
  return line.trim().startsWith("#");
}

/**
 * Currency written by the old NPC serializer was "1,<amount>".
 * Parse::toInt stops at the comma, so the engine awarded 1.
 * A single number is that amount. Two numbers whose first is 1 keep the second.
 */
function formatCurrency(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parts = text.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  const nums = parts
    .map((part) => {
      const match = part.match(/^[+-]?\d+/);
      return match ? parseInt(match[0], 10) : null;
    })
    .filter((num) => num != null && Number.isFinite(num));
  if (nums.length === 0) return "";
  if (nums.length >= 2 && nums[0] === 1) return String(nums[nums.length - 1]);
  return String(nums[0]);
}

function parseDocument(content) {
  const lines = String(content || "").replace(/\r/g, "").split("\n");
  const sections = [];
  let current = { name: "", line: 1, entries: [] };
  sections.push(current);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line || isComment(line)) continue;
    if (line === "APPEND" || line.startsWith("INCLUDE ")) continue;
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      current = { name: section[1].trim(), line: index + 1, entries: [] };
      sections.push(current);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    current.entries.push({
      key: line.slice(0, eq).trim(),
      value: line.slice(eq + 1).trim(),
      line: index + 1,
    });
  }
  return sections;
}

/**
 * Engine: dest = centerTile(mapToScreen) - offset, and centerTile adds tile_h/2
 * on the isometric Y axis (MapRenderer.cpp centerTile). The editor anchors the
 * sprite's bottom-center on the diamond's bottom, which is another tile_h/2
 * below that center. So offset_y = originY - tileSizeY/2.
 * A 64x32 ground tile with origin (32, 32) exports as 32,16.
 * Not verified in-game.
 */
function tilePixelOffset(originX, originY, tileSizeY) {
  const ox = Number.isFinite(originX) ? originX : 0;
  const oy = Number.isFinite(originY) ? originY : 0;
  const half = Math.floor((Number(tileSizeY) || 0) / 2);
  return {
    offsetX: Math.floor(ox),
    offsetY: Math.floor(oy - half),
  };
}

function layerRowCommaCount(row, width) {
  let text = String(row ?? "").trim();
  if (!text.endsWith(",")) text += ",";
  let commas = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === ",") commas += 1;
  }
  return { text, commas, ok: commas === width };
}

function validateLayerRows(width, height, rows) {
  const errors = [];
  if (!Array.isArray(rows) || rows.length !== height) {
    errors.push(`Layer data has ${rows ? rows.length : 0} rows; the map height is ${height}.`);
    return errors;
  }
  rows.forEach((row, index) => {
    const cells = Array.isArray(row) ? row : String(row).split(",");
    const meaningful = cells.map((cell) => String(cell).trim()).filter((cell, cellIndex) => cell !== "" || cellIndex < cells.length - 1);
    const numeric = (Array.isArray(row) ? row : String(row).replace(/,\s*$/, "").split(",")).filter((cell) => String(cell).trim() !== "");
    if (numeric.length !== width) {
      errors.push(`Layer row ${index + 1} has ${numeric.length} tiles; the map width is ${width}.`);
    }
    const rendered = numeric.join(",");
    const checked = layerRowCommaCount(rendered, width);
    if (!checked.ok) {
      errors.push(`Layer row ${index + 1} would make the engine delete mods.txt (comma count ${checked.commas}, width ${width}).`);
    }
    void meaningful;
  });
  return errors;
}

module.exports = {
  toIntFlare,
  formatCurrency,
  parseDocument,
  tilePixelOffset,
  layerRowCommaCount,
  validateLayerRows,
};
