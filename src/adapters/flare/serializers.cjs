const { slugFileName } = require("./slug.cjs");
const { formatCurrency, tilePixelOffset, validateLayerRows } = require("./fileParser.cjs");
const {
  EVENT_KEYS,
  MAP_ENEMY_KEYS,
  MAP_NPC_KEYS,
  ITEM_KEYS,
  POWER_KEYS,
  ENEMY_FILE_KEYS,
  NPC_KEYS,
  DIALOG_KEYS,
  POWER_ONLY_ITEM_FIELDS,
} = require("./attributeKeys.cjs");

const EDITOR_LAYER_TYPES = new Set([
  "rules",
  "status",
  "actions",
  "items",
  "npc",
  "enemy",
  "event",
  "gamesettings",
]);

function linesOf(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter((item) => item.trim());
  return [String(value)];
}

function pushKey(lines, key, value) {
  for (const item of linesOf(value)) {
    if (item.trim()) lines.push(`${key}=${item.trim()}`);
  }
}

function ensureObjectAndCollision(layers) {
  const list = (layers || []).filter((layer) => layer && layer.type && !EDITOR_LAYER_TYPES.has(String(layer.type).toLowerCase()));
  const types = new Set(list.map((layer) => layer.type));
  if (!types.has("object")) list.push({ type: "object", rows: [] });
  if (!types.has("collision")) list.push({ type: "collision", rows: [] });
  const rank = (type) => {
    if (type === "background") return 0;
    if (type === "object") return 2;
    if (type === "collision") return 3;
    return 1;
  };
  return list.sort((a, b) => rank(a.type) - rank(b.type));
}

function blankRows(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
}

function normalizeRows(rows, width, height) {
  if (!Array.isArray(rows) || rows.length === 0) return blankRows(width, height);
  return rows.map((row) => {
    const cells = Array.isArray(row) ? row : String(row).replace(/,\s*$/, "").split(",");
    const nums = cells.map((cell) => {
      const text = String(cell).trim();
      if (!text) return 0;
      const parsed = parseInt(text, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
    while (nums.length < width) nums.push(0);
    return nums.slice(0, width);
  }).concat(blankRows(width, Math.max(0, height - rows.length))).slice(0, height);
}

function exportMapText(map) {
  const width = Math.max(1, Number(map.width) || 1);
  const height = Math.max(1, Number(map.height) || 1);
  const lines = ["[header]", `width=${width}`, `height=${height}`];
  if (map.tileset) lines.push(`tileset=${map.tileset}`);
  if (map.music) lines.push(`music=${map.music}`);
  lines.push(`hero_pos=${Number(map.heroX) || 0},${Number(map.heroY) || 0}`);
  if (map.title) lines.push(`title=${map.title}`);
  if (map.parallax) lines.push(`parallax_layers=${map.parallax}`);
  if (map.backgroundColor) lines.push(`background_color=${map.backgroundColor}`);
  lines.push("");

  if (Array.isArray(map.tilesetImages) && map.tilesetImages.length > 0) {
    lines.push("[tilesets]");
    for (const tileset of map.tilesetImages) {
      if (!tileset || !tileset.file) continue;
      lines.push(
        `tileset=${tileset.file},${tileset.tileWidth || 64},${tileset.tileHeight || 32},${tileset.spacing || 0},${tileset.margin || 0}`
      );
    }
    lines.push("");
  }

  const errors = [];
  for (const layer of ensureObjectAndCollision(map.layers)) {
    if (Array.isArray(layer.rows) && layer.rows.length > 0) {
      errors.push(...validateLayerRows(width, height, layer.rows).map((message) => `${layer.type}: ${message}`));
    }
    const rows = normalizeRows(layer.rows, width, height);
    lines.push("[layer]");
    lines.push(`type=${layer.type}`);
    lines.push("format=dec");
    lines.push("data=");
    for (const row of rows) lines.push(row.join(","));
    lines.push("");
  }

  for (const event of map.events || []) {
    lines.push(...exportEventLines(event));
    lines.push("");
  }
  for (const enemy of map.enemies || []) {
    lines.push(...exportMapEnemyLines(enemy, map.knownEnemyCategories));
    lines.push("");
  }
  for (const npc of map.npcs || []) {
    lines.push(...exportMapNpcLines(npc));
    lines.push("");
  }
  return { text: `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`, errors };
}

function exportEventLines(event) {
  const lines = ["[event]"];
  const source = event || {};
  const tooltip = source.tooltip;
  const skipTooltip = !tooltip || String(tooltip).trim().toLowerCase() === "event";
  for (const key of EVENT_KEYS) {
    if (key === "tooltip" && skipTooltip) continue;
    if (key === "type") continue;
    let value = source[key];
    if (value == null || value === "") continue;
    if (key === "reward_currency" || key === "remove_currency" || key === "requires_currency" || key === "requires_not_currency") {
      value = formatCurrency(Array.isArray(value) ? value[0] : value);
      if (!value) continue;
    }
    pushKey(lines, key, value);
  }
  return lines;
}

function exportMapEnemyLines(enemy, knownCategories) {
  const lines = ["[enemy]"];
  const source = { ...(enemy || {}) };
  const known = (knownCategories || []).filter(Boolean);
  if (source.category === "enemy" && known.length > 0 && !known.includes("enemy")) {
    source.category = known[0];
  }
  if (source.category === "enemy" && known.length === 0) delete source.category;
  for (const key of MAP_ENEMY_KEYS) {
    if (key === "type") continue;
    if (source[key] != null && source[key] !== "") pushKey(lines, key, source[key]);
  }
  return lines;
}

function exportMapNpcLines(npc) {
  const lines = ["[npc]"];
  const source = npc || {};
  for (const key of MAP_NPC_KEYS) {
    if (source[key] != null && source[key] !== "") pushKey(lines, key, source[key]);
  }
  return lines;
}

function exportTilesetText(def) {
  const tileSizeY = Number(def.tileSizeY) || 32;
  const lines = [];
  for (const tileset of def.tilesets || []) {
    if (!tileset || !tileset.fileName) continue;
    lines.push("[tileset]");
    lines.push(`img=${tileset.img || `images/tilesets/${tileset.fileName}`}`);
    for (const tile of tileset.tiles || []) {
      const originX = tile.originX != null ? tile.originX : Math.floor((tile.width || 0) / 2);
      const originY = tile.originY != null ? tile.originY : tile.height || 0;
      const offset = tilePixelOffset(originX, originY, tileSizeY);
      lines.push(
        `tile=${tile.id},${tile.x},${tile.y},${tile.width},${tile.height},${offset.offsetX},${offset.offsetY}`
      );
    }
    lines.push("");
  }
  if (lines.length === 0) return "# No tilesets found - please load tilesets before exporting\n";
  return `${lines.join("\n").trim()}\n`;
}

function exportTilesetConfig(tile) {
  const width = Number(tile && tile.width) || 64;
  const height = Number(tile && tile.height) || 32;
  const orientation = tile && tile.orientation === "orthogonal" ? "orthogonal" : "isometric";
  return `APPEND\ntile_size=${width},${height}\norientation=${orientation}\n`;
}

function withAppend(content) {
  const text = String(content || "").replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("#"));
  if (first === "APPEND") return text.endsWith("\n") ? text : `${text}\n`;
  return `APPEND\n\n${text.trim()}\n`;
}

function statusStockFromEntries(raw) {
  let entries = raw;
  if (typeof raw === "string") {
    try {
      entries = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(entries)) return [];
  const lines = [];
  for (const entry of entries) {
    if (!entry || !entry.requirement || !entry.items) continue;
    const stock = Object.entries(entry.items)
      .filter(([, qty]) => Number(qty) > 0)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([id, qty]) => `${id}:${qty}`)
      .join(",");
    if (stock) lines.push(`${entry.requirement},${stock}`);
  }
  return lines;
}

function renderItem(item) {
  const source = { ...(item || {}) };
  const power = {};
  let moved = false;
  for (const key of POWER_ONLY_ITEM_FIELDS) {
    if (source[key] == null || source[key] === "" || source[key] === false) continue;
    if (ITEM_KEYS.has(key)) continue;
    power[key] = source[key];
    delete source[key];
    moved = true;
  }
  if (moved) {
    const id = source.power || source.id || "1";
    power.id = power.id || id;
    if (!power.name && source.name) power.name = source.name;
    if (!source.power) source.power = power.id;
  }
  const lines = ["[item]"];
  if (source._role) lines.push(`# role=${source._role}`);
  if (source._resourceSubtype) lines.push(`# resource_subtype=${source._resourceSubtype}`);
  for (const key of ITEM_KEYS) {
    if (source[key] == null || source[key] === "" || source[key] === false) continue;
    let value = source[key];
    if (value === true) value = "true";
    pushKey(lines, key, value);
  }
  return { lines, power: moved ? power : null };
}

function exportItemFile(items, options = {}) {
  const blocks = [];
  const powers = [];
  for (const item of items || []) {
    const rendered = renderItem(item);
    blocks.push(rendered.lines.join("\n"));
    if (rendered.power) powers.push(rendered.power);
  }
  let text = blocks.join("\n\n");
  if (options.includes && options.includes.length) {
    const includeLines = options.includes.map((file) => `INCLUDE ${file}`);
    text = [text, ...includeLines].filter(Boolean).join("\n");
  }
  if (options.append !== false) text = withAppend(text);
  else if (text && !text.endsWith("\n")) text += "\n";
  return { text: text.endsWith("\n") ? text : `${text}\n`, powers };
}

function exportPowerFile(powers) {
  const lines = ["APPEND", ""];
  for (const power of powers || []) {
    lines.push("[power]");
    for (const key of POWER_KEYS) {
      if (power[key] == null || power[key] === "") continue;
      const value = power[key] === true ? "true" : power[key];
      pushKey(lines, key, value);
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

function exportEnemyFile(enemy) {
  const warnings = [];
  const source = { ...(enemy || {}) };
  if (source.gfx && !source.animations) {
    source.animations = source.gfx;
    warnings.push("Replaced deprecated gfx with animations.");
  }
  delete source.gfx;
  const renderLayers = source.render_layers || source.renderLayers;
  const animationSlots = source.animation_slots || source.animationSlots;
  delete source.render_layers;
  delete source.renderLayers;
  delete source.animation_slots;
  delete source.animationSlots;
  for (const dropped of ["gold", "wander_radius", "waypoints", "script"]) {
    if (source[dropped] != null && source[dropped] !== "") {
      warnings.push(`Dropped ${dropped} from the enemy file; it is not a StatBlock key.`);
      delete source[dropped];
    }
  }
  const lines = [];
  for (const key of ENEMY_FILE_KEYS) {
    if (source[key] == null || source[key] === "" || source[key] === false) continue;
    const value = source[key] === true ? "true" : source[key];
    pushKey(lines, key, value);
  }
  if (renderLayers) {
    lines.push("", "[render_layers]");
    for (const layer of linesOf(renderLayers)) {
      const value = layer.includes(",") ? layer : `0,${layer}`;
      lines.push(`layer=${value}`);
    }
  }
  if (animationSlots) {
    lines.push("", "[animation_slots]");
    for (const slot of linesOf(animationSlots)) lines.push(`slot=${slot}`);
  }
  lines.push("");
  return { text: `${lines.join("\n").trim()}\n`, warnings };
}

function normalizeEnemyText(content) {
  const { parseDocument } = require("./fileParser.cjs");
  const sections = parseDocument(content);
  const enemy = {};
  const render = [];
  const slots = [];
  for (const section of sections) {
    if (section.name === "render_layers") {
      for (const entry of section.entries) if (entry.key === "layer") render.push(entry.value);
      continue;
    }
    if (section.name === "animation_slots") {
      for (const entry of section.entries) if (entry.key === "slot") slots.push(entry.value);
      continue;
    }
    for (const entry of section.entries) {
      if (entry.key === "render_layers") render.push(entry.value);
      else if (entry.key === "animation_slots") slots.push(entry.value);
      else enemy[entry.key] = entry.value;
    }
  }
  if (render.length) enemy.render_layers = render;
  if (slots.length) enemy.animation_slots = slots;
  return exportEnemyFile(enemy);
}

function exportNpcFile(npc) {
  const source = npc || {};
  const lines = [];
  const fields = { ...source, ...(source.customProperties || {}) };
  delete fields.customProperties;
  delete fields.dialogueTrees;
  delete fields.waypoints;
  delete fields.wander_radius;
  delete fields.sourcePath;
  delete fields.raw;
  if (!fields.status_stock && fields.status_stock_entries) {
    const stocks = statusStockFromEntries(fields.status_stock_entries);
    if (stocks.length) fields.status_stock = stocks;
  }
  delete fields.status_stock_entries;
  if (fields.gfx && !fields.animations) fields.animations = fields.gfx;
  delete fields.gfx;
  for (const key of NPC_KEYS) {
    if (key === "portrait") continue;
    if (fields[key] == null || fields[key] === "" || fields[key] === false) continue;
    let value = fields[key] === true ? "true" : fields[key];
    if (key.includes("currency")) {
      value = formatCurrency(value);
      if (!value) continue;
    }
    pushKey(lines, key, value);
  }
  if (fields.portrait) pushKey(lines, "portrait", fields.portrait);
  const trees = readDialogueTrees(source);
  if (trees.length) {
    lines.push("");
    lines.push(exportDialogueTrees(trees));
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function readDialogueTrees(npc) {
  const raw = npc && npc.customProperties && npc.customProperties.dialogueTrees;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function exportDialogueTrees(trees) {
  const blocks = [];
  for (const tree of trees) {
    const dialog = ["[dialog]"];
    if (tree.dialogueId || tree.id) dialog.push(`id=${tree.dialogueId || tree.id}`);
    if (tree.topic) dialog.push(`topic=${tree.topic}`);
    if (tree.group) dialog.push(`group=${tree.group}`);
    if (tree.responseOnly) dialog.push(`response_only=true`);
    for (const req of tree.requirements || []) {
      if (!req || !req.value) continue;
      const key = requirementKey(req.type);
      if (key) pushKey(dialog, key, key.includes("currency") ? formatCurrency(req.value) : req.value);
    }
    for (const responseId of tree.responses || []) {
      if (responseId) dialog.push(`response=${responseId}`);
    }
    for (const line of tree.dialogues || []) {
      if (!line || !line.text) continue;
      if (line.voice) dialog.push(`voice=${line.voice}`);
      if (line.portrait) dialog.push(`portrait_him=${line.portrait}`);
      dialog.push(`${line.speaker === "npc" ? "him" : "you"}=${line.text}`);
    }
    for (const effect of tree.worldEffects || []) {
      if (!effect || !effect.value) continue;
      const key = worldEffectKey(effect.type);
      if (key) dialog.push(`${key}=${effect.value}`);
    }
    for (const reward of tree.rewards || []) {
      if (!reward) continue;
      if (reward.type === "xp" && reward.value) dialog.push(`reward_xp=${formatCurrency(reward.value)}`);
      if (reward.type === "gold" && reward.value) dialog.push(`reward_currency=${formatCurrency(reward.value)}`);
      if (reward.type === "remove_gold" && reward.value) dialog.push(`remove_currency=${formatCurrency(reward.value)}`);
      if (reward.type === "item" && reward.value) {
        const value = String(reward.value);
        dialog.push(
          value.includes(":") || value.includes(",")
            ? `reward_item=${value}`
            : `reward_item=${value}:${reward.quantity || 1}`
        );
      }
      if (reward.type === "remove_item" && reward.value) dialog.push(`remove_item=${reward.value}`);
      if (reward.type === "restore") dialog.push(`restore=${reward.value || "all"}`);
      if (reward.type === "msg" && reward.value) dialog.push(`msg=${reward.value}`);
    }
    for (const entry of tree.passthrough || []) {
      if (!entry || !entry.key || entry.value == null || entry.value === "") continue;
      if (DIALOG_KEYS.has(entry.key) || EVENT_KEYS.has(entry.key)) pushKey(dialog, entry.key, entry.value);
    }
    if (dialog.length > 1) blocks.push(dialog.join("\n"));
  }
  return blocks.join("\n\n");
}

function requirementKey(type) {
  const map = {
    status: "requires_status",
    not_status: "requires_not_status",
    item: "requires_item",
    not_item: "requires_not_item",
    level: "requires_level",
    not_level: "requires_not_level",
    currency: "requires_currency",
    not_currency: "requires_not_currency",
    class: "requires_class",
    not_class: "requires_not_class",
  };
  return map[type] || (DIALOG_KEYS.has(type) ? type : "");
}

function worldEffectKey(type) {
  const map = {
    set_status: "set_status",
    unset_status: "unset_status",
    teleport: "intermap",
    spawn: "spawn",
    cutscene: "cutscene",
    sound: "soundfx",
    npc: "npc",
  };
  return map[type] || "";
}

function importNpcText(content) {
  const { parseDocument } = require("./fileParser.cjs");
  const npc = { customProperties: {} };
  const trees = [];
  for (const section of parseDocument(content)) {
    if (section.name === "dialog") {
      const tree = {
        dialogues: [],
        requirements: [],
        responses: [],
        rewards: [],
        worldEffects: [],
        passthrough: [],
      };
      let pendingVoice = "";
      let pendingPortrait = "";
      for (const entry of section.entries) {
        if (entry.key === "id") tree.dialogueId = entry.value;
        else if (entry.key === "topic") tree.topic = entry.value;
        else if (entry.key === "group") tree.group = entry.value;
        else if (entry.key === "response_only") tree.responseOnly = entry.value === "true";
        else if (entry.key === "response") tree.responses.push(entry.value);
        else if (entry.key === "voice") pendingVoice = entry.value;
        else if (entry.key === "portrait_him" || entry.key === "portrait") pendingPortrait = entry.value;
        else if (entry.key === "him" || entry.key === "her" || entry.key === "you") {
          tree.dialogues.push({
            speaker: entry.key === "you" ? "player" : "npc",
            text: entry.value,
            ...(pendingVoice ? { voice: pendingVoice } : {}),
            ...(pendingPortrait ? { portrait: pendingPortrait } : {}),
          });
          pendingVoice = "";
          pendingPortrait = "";
        } else if (entry.key === "reward_currency") tree.rewards.push({ type: "gold", value: entry.value });
        else if (entry.key === "reward_xp") tree.rewards.push({ type: "xp", value: entry.value });
        else if (entry.key === "remove_currency") tree.rewards.push({ type: "remove_gold", value: entry.value });
        else if (entry.key === "reward_item") tree.rewards.push({ type: "item", value: entry.value });
        else if (entry.key === "remove_item") tree.rewards.push({ type: "remove_item", value: entry.value });
        else if (entry.key === "restore") tree.rewards.push({ type: "restore", value: entry.value });
        else if (entry.key === "msg") tree.rewards.push({ type: "msg", value: entry.value });
        else tree.passthrough.push({ key: entry.key, value: entry.value });
      }
      trees.push(tree);
      continue;
    }
    if (!section.name || section.name === "npc") {
      for (const entry of section.entries) {
        if (entry.key === "waypoints" || entry.key === "wander_radius") continue;
        npc[entry.key] = entry.value;
      }
    }
  }
  if (trees.length) npc.customProperties.dialogueTrees = trees;
  return npc;
}

function importMapText(content) {
  const { parseDocument } = require("./fileParser.cjs");
  const rawLines = String(content || "").replace(/\r/g, "").split("\n");
  const map = {
    id: "map",
    width: 1,
    height: 1,
    heroX: 0,
    heroY: 0,
    layers: [],
    events: [],
    enemies: [],
    npcs: [],
    tilesetImages: [],
  };
  let section = "";
  let event = null;
  let enemy = null;
  let npc = null;
  let layer = null;
  let dataLeft = 0;
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      dataLeft = 0;
      if (section === "event") {
        event = {};
        map.events.push(event);
      } else if (section === "enemy") {
        enemy = {};
        map.enemies.push(enemy);
      } else if (section === "npc") {
        npc = {};
        map.npcs.push(npc);
      } else if (section === "layer") {
        layer = { type: "layer", rows: [] };
        map.layers.push(layer);
      }
      continue;
    }
    if (dataLeft > 0 && layer) {
      const cells = line.replace(/,\s*$/, "").split(",").filter((cell) => cell.trim() !== "");
      layer.rows.push(cells.map((cell) => parseInt(cell, 10) || 0));
      dataLeft -= 1;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (section === "header") {
      if (key === "width") map.width = parseInt(value, 10) || 1;
      else if (key === "height") map.height = parseInt(value, 10) || 1;
      else if (key === "hero_pos") {
        const [x, y] = value.split(",");
        map.heroX = parseInt(x, 10) || 0;
        map.heroY = parseInt(y, 10) || 0;
      } else if (key === "title") map.title = value;
      else if (key === "music") map.music = value;
      else if (key === "tileset") map.tileset = value;
      else if (key === "parallax_layers") map.parallax = value;
      else if (key === "background_color") map.backgroundColor = value;
    } else if (section === "tilesets" && key === "tileset") {
      const [file, tileWidth, tileHeight, spacing, margin] = value.split(",");
      map.tilesetImages.push({
        file,
        tileWidth: parseInt(tileWidth, 10) || 0,
        tileHeight: parseInt(tileHeight, 10) || 0,
        spacing: parseInt(spacing, 10) || 0,
        margin: parseInt(margin, 10) || 0,
      });
    } else if (section === "layer" && layer) {
      if (key === "type") layer.type = value;
      if (key === "data") dataLeft = map.height;
    } else if (section === "event" && event) {
      if (event[key] == null) event[key] = value;
      else if (Array.isArray(event[key])) event[key].push(value);
      else event[key] = [event[key], value];
    } else if (section === "enemy" && enemy) enemy[key] = value;
    else if (section === "npc" && npc) npc[key] = value;
  }
  map.id = slugFileName(map.title || "map");
  return map;
}

module.exports = {
  EDITOR_LAYER_TYPES,
  exportMapText,
  exportEventLines,
  exportTilesetText,
  exportTilesetConfig,
  withAppend,
  exportItemFile,
  exportPowerFile,
  exportEnemyFile,
  normalizeEnemyText,
  exportNpcFile,
  exportDialogueTrees,
  importNpcText,
  importMapText,
  formatCurrency,
  tilePixelOffset,
};
