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
  if (map.fogofwar != null && map.fogofwar !== "") lines.push(`fogofwar=${map.fogofwar}`);
  if (map.save_fogofwar != null && map.save_fogofwar !== "") lines.push(`save_fogofwar=${map.save_fogofwar}`);
  if (map.procgen_type) lines.push(`procgen_type=${map.procgen_type}`);
  if (map.procgen_unique_status) lines.push(`procgen_unique_status=${map.procgen_unique_status}`);
  if (map.procgen_reset_status) lines.push(`procgen_reset_status=${map.procgen_reset_status}`);
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

/**
 * Enemy file as saved from Studio's enemy editor: written back line by line, so INCLUDE/APPEND
 * lines, repeated keys (stat=, power=, sfx_*=), unknown keys and sections all survive.
 * Only fixes: gfx -> animations, bare render layer ids -> "0,id", and keys that are not
 * StatBlock keys (gold, wander_radius, waypoints, script) are dropped with a warning.
 */
function normalizeEnemyText(content) {
  const warnings = [];
  const out = [];
  let section = "";
  for (const raw of String(content || "").replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line === "APPEND" || line.startsWith("INCLUDE ")) { out.push(line); continue; }
    const m = line.match(/^\[([^\]]+)\]$/);
    if (m) { section = m[1].trim(); out.push(line); continue; }
    const eq = line.indexOf("=");
    if (eq <= 0) { out.push(line); continue; }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!section) {
      if (key === "gfx") { out.push(`animations=${value}`); warnings.push("Replaced deprecated gfx with animations."); continue; }
      if (["gold", "wander_radius", "waypoints", "script"].includes(key)) {
        if (value) warnings.push(`Dropped ${key} from the enemy file; it is not a StatBlock key.`);
        continue;
      }
    }
    if (section === "render_layers" && key === "layer" && !value.includes(",")) { out.push(`layer=0,${value}`); continue; }
    out.push(`${key}=${value}`);
  }
  return { text: `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`, warnings };
}

const REQ_TYPE_BY_KEY = {
  requires_status: "status", requires_not_status: "not_status",
  requires_item: "item", requires_not_item: "not_item",
  requires_level: "level", requires_not_level: "not_level",
  requires_currency: "currency", requires_not_currency: "not_currency",
  requires_class: "class", requires_not_class: "not_class",
  requires_tile: "tile", requires_not_tile: "not_tile",
};
const REWARD_TYPE_BY_KEY = {
  reward_xp: "xp", reward_currency: "gold", remove_currency: "remove_gold",
  reward_item: "item", remove_item: "remove_item", restore: "restore", msg: "msg",
  reward_loot: "loot",
};
const EFFECT_TYPE_BY_KEY = {
  set_status: "set_status", unset_status: "unset_status", intermap: "teleport",
  spawn: "spawn", cutscene: "cutscene", soundfx: "sound", npc: "npc",
  intramap: "intramap", music: "music", stash: "stash", book: "book",
  respec: "respec", save_game: "save_game", script: "script", visual_effect: "visual_effect",
  intermap_id: "intermap_id", intermap_random: "intermap_random",
  mapmod: "mapmod", mapmod_toggle: "mapmod_toggle", loot: "loot", shakycam: "shakycam",
  power: "power", power_path: "power_path", power_damage: "power_damage",
  power_stats: "power_stats", power_level: "power_level",
  spawn_level: "spawn_level", chance_exec: "chance_exec",
  random_status: "random_status", repeat: "repeat", tooltip: "tooltip",
  show_on_minimap: "show_on_minimap", parallax_layers: "parallax_layers",
  procgen_filename: "procgen_filename", procgen_link: "procgen_link",
  procgen_door_level: "procgen_door_level",
};
const DIALOG_META_KEYS = ["id", "topic", "group", "response_only"];
const LINE_PREFIX_KEYS = new Set(["voice", "portrait_him", "portrait_her", "portrait_you", "portrait"]);
const LINE_KEYS = new Set(["him", "her", "you"]);

function dialogCategory(key) {
  if (DIALOG_META_KEYS.includes(key)) return "meta";
  if (REQ_TYPE_BY_KEY[key]) return "req";
  if (key === "response") return "response";
  if (LINE_PREFIX_KEYS.has(key)) return "prefix";
  if (LINE_KEYS.has(key)) return "line";
  if (REWARD_TYPE_BY_KEY[key]) return "reward";
  if (EFFECT_TYPE_BY_KEY[key]) return "effect";
  return "pass";
}

/** Flare value(s) of a field: true -> "true", false/empty -> [], arrays and newline lists -> one value per line. */
function fieldValues(value) {
  if (value == null || value === false || value === "") return [];
  if (value === true) return ["true"];
  return linesOf(value).flatMap((v) => String(v).split("\n")).map((v) => v.trim()).filter(Boolean);
}

function dialogLineEntries(line) {
  const out = [];
  if (!line || (!line.text && !line.keepEmpty)) return out;
  if (line.voice) out.push(`voice=${line.voice}`);
  if (line.portrait) {
    const key = line.portraitKey || (line.speaker === "player" ? "portrait_you" : "portrait_him");
    out.push(`${key}=${line.portrait}`);
  }
  const textKey = line.speaker === "player" ? "you" : (line.key === "her" ? "her" : "him");
  out.push(`${textKey}=${line.text}`);
  return out;
}

function dialogItemEntries(category, item) {
  if (!item) return [];
  if (category === "req") {
    if (!item.value) return [];
    const key = requirementKey(item.type);
    return key ? [`${key}=${key.includes("currency") && item.raw !== item.value ? formatCurrency(item.value) : item.value}`] : [];
  }
  if (category === "response") return item ? [`response=${item}`] : [];
  if (category === "effect") {
    if (!item.value) return [];
    const key = worldEffectKey(item.type);
    return key ? [`${key}=${item.value}`] : [];
  }
  if (category === "reward") {
    const r = item;
    const cur = (v) => (r.raw !== undefined && r.raw === v ? r.raw : formatCurrency(v));
    if (r.type === "xp" && r.value) return [`reward_xp=${cur(r.value)}`];
    if (r.type === "gold" && r.value) return [`reward_currency=${cur(r.value)}`];
    if (r.type === "remove_gold" && r.value) return [`remove_currency=${cur(r.value)}`];
    if (r.type === "item" && r.value) {
      const value = String(r.value);
      if (r.raw !== undefined && r.raw === r.value) return [`reward_item=${r.raw}`];
      return [value.includes(":") || value.includes(",") ? `reward_item=${value}` : `reward_item=${value}:${r.quantity || 1}`];
    }
    if (r.type === "remove_item" && r.value) return [`remove_item=${r.value}`];
    if (r.type === "restore") return [`restore=${r.value || "all"}`];
    if (r.type === "msg" && r.value) return [`msg=${r.value}`];
    if (r.type === "loot" && r.value) return [`reward_loot=${r.value}`];
    return [];
  }
  if (category === "pass") {
    if (!item || !item.key || item.value == null || item.value === "") return [];
    return [`${item.key}=${item.value}`];
  }
  return [];
}

function dialogMetaValue(tree, key) {
  if (key === "id") return tree.dialogueId || tree.id || "";
  if (key === "topic") return tree.topic || "";
  if (key === "group") return tree.group || "";
  if (key === "response_only") return tree.responseOnly ? "true" : "";
  return "";
}

const LIST_OF = {
  req: (t) => t.requirements || [],
  response: (t) => t.responses || [],
  line: (t) => t.dialogues || [],
  reward: (t) => t.rewards || [],
  effect: (t) => t.worldEffects || [],
  pass: (t) => t.passthrough || [],
};

/**
 * One [dialog] block. With `components` (the original entries, in file order) every
 * item is written back at its original position, so Flare's in-order execution of
 * lines, portraits, statuses and rewards is unchanged; new items are added at the end
 * (requirements/meta first, responses before the first line).
 */
function exportDialogBlock(tree) {
  const out = []; // { cat, lines }
  const used = { req: 0, response: 0, line: 0, reward: 0, effect: 0, pass: 0 };
  const metaDone = new Set();
  const prefixDone = { voice: false, portrait: false };
  for (const c of tree.components || []) {
    if (c.raw) { out.push({ cat: "raw", lines: [c.raw] }); continue; }
    const cat = dialogCategory(c.key);
    if (cat === "prefix") {
      // voice/portrait belong to the next line: write them where they were
      const next = LIST_OF.line(tree)[used.line];
      if (!next) continue;
      if (c.key === "voice" && next.voice && !prefixDone.voice) { out.push({ cat, lines: [`voice=${next.voice}`] }); prefixDone.voice = true; }
      else if (c.key !== "voice" && next.portrait && !prefixDone.portrait) {
        out.push({ cat, lines: [`${next.portraitKey || c.key}=${next.portrait}`] });
        prefixDone.portrait = true;
      }
      continue;
    }
    if (cat === "meta") {
      if (metaDone.has(c.key)) continue;
      metaDone.add(c.key);
      const v = dialogMetaValue(tree, c.key);
      if (v) out.push({ cat, lines: [`${c.key}=${v}`] });
      continue;
    }
    const item = LIST_OF[cat](tree)[used[cat]++];
    let lines;
    if (cat === "line") {
      lines = dialogLineEntries(item && { ...item, voice: prefixDone.voice ? undefined : item.voice, portrait: prefixDone.portrait ? undefined : item.portrait });
      prefixDone.voice = false;
      prefixDone.portrait = false;
    } else lines = dialogItemEntries(cat, item);
    if (lines.length) out.push({ cat, lines });
  }
  const head = [];
  for (const key of DIALOG_META_KEYS) {
    if (metaDone.has(key)) continue;
    const v = dialogMetaValue(tree, key);
    if (v) head.push({ cat: "meta", lines: [`${key}=${v}`] });
  }
  for (const r of LIST_OF.req(tree).slice(used.req)) head.push({ cat: "req", lines: dialogItemEntries("req", r) });
  const responses = LIST_OF.response(tree).slice(used.response).map((r) => ({ cat: "response", lines: dialogItemEntries("response", r) }));
  const firstLine = out.findIndex((e) => e.cat === "line");
  if (firstLine >= 0) out.splice(firstLine, 0, ...responses); else out.push(...responses);
  for (const l of LIST_OF.line(tree).slice(used.line)) out.push({ cat: "line", lines: dialogLineEntries(l) });
  for (const cat of ["effect", "reward", "pass"]) {
    for (const it of LIST_OF[cat](tree).slice(used[cat])) out.push({ cat, lines: dialogItemEntries(cat, it) });
  }
  const body = [...head, ...out].flatMap((e) => e.lines).filter(Boolean);
  return body.length ? ["[dialog]", ...body].join("\n") : "";
}

function exportDialogueTrees(trees) {
  return (trees || []).map(exportDialogBlock).filter(Boolean).join("\n\n");
}

function exportNpcFile(npc) {
  const source = npc || {};
  const lines = [];
  const fields = { ...source, ...(source.customProperties || {}) };
  for (const k of ["customProperties", "dialogueTrees", "waypoints", "wander_radius", "sourcePath", "raw", "_rawMain", "_rawSections", "npc_includes", "status_stock_entries", "npc_stats", "npc_visual_effects", "tilesetPath", "portraitPath", "npcFilename"]) delete fields[k];
  if (fields.status_stock === undefined && fields.status_stock_entries) {
    const stocks = statusStockFromEntries(fields.status_stock_entries);
    if (stocks.length) fields.status_stock = stocks;
  }
  delete fields.status_stock_entries;
  if (fields.gfx && !fields.animations) fields.animations = fields.gfx;
  delete fields.gfx;
  const valuesOf = (key) => {
    const vals = fieldValues(fields[key]);
    return key.includes("currency") ? vals.map((v) => formatCurrency(v)).filter(Boolean) : vals;
  };
  const rawMain = Array.isArray(source._rawMain) ? source._rawMain : null;
  const done = new Set();
  if (rawMain) {
    // Original main section, in order; a key is rewritten only when Studio changed its value.
    const rawJoined = {};
    // gfx is the old name of animations: compare and rewrite it as animations
    const fieldKey = (k) => (k === "gfx" ? "animations" : k);
    for (const e of rawMain) if (!e.raw) (rawJoined[fieldKey(e.key)] = rawJoined[fieldKey(e.key)] || []).push(e.value);
    for (const e of rawMain) {
      if (e.raw) { lines.push(e.raw); continue; }
      const k = fieldKey(e.key);
      if (done.has(k)) continue;
      const changed = k in fields && fieldValues(fields[k]).join("\n") !== rawJoined[k].join("\n");
      if (changed) {
        for (const v of valuesOf(k)) lines.push(`${k}=${v}`);
        done.add(k);
      } else {
        lines.push(`${e.key}=${e.value}`);
      }
    }
    for (const k of Object.keys(rawJoined)) done.add(k);
  }
  for (const key of NPC_KEYS) {
    if (done.has(key)) continue;
    if (key === "portrait") continue;
    for (const v of valuesOf(key)) lines.push(`${key}=${v}`);
  }
  if (!done.has("portrait") && fields.portrait) pushKey(lines, "portrait", fields.portrait);
  for (const section of source._rawSections || []) {
    lines.push("", `[${section.name}]`, ...section.entries.map((e) => e.raw || `${e.key}=${e.value}`));
  }
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
    tile: "requires_tile",
    not_tile: "requires_not_tile",
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
    intramap: "intramap",
    music: "music",
    stash: "stash",
    book: "book",
    respec: "respec",
    save_game: "save_game",
    script: "script",
    visual_effect: "visual_effect",
    intermap_id: "intermap_id",
    intermap_random: "intermap_random",
    mapmod: "mapmod",
    mapmod_toggle: "mapmod_toggle",
    loot: "loot",
    shakycam: "shakycam",
    power: "power",
    power_path: "power_path",
    power_damage: "power_damage",
    power_stats: "power_stats",
    power_level: "power_level",
    spawn_level: "spawn_level",
    chance_exec: "chance_exec",
    random_status: "random_status",
    repeat: "repeat",
    tooltip: "tooltip",
    show_on_minimap: "show_on_minimap",
    parallax_layers: "parallax_layers",
    procgen_filename: "procgen_filename",
    procgen_link: "procgen_link",
    procgen_door_level: "procgen_door_level",
  };
  return map[type] || "";
}

function importDialogTree(entries) {
  const tree = { dialogues: [], requirements: [], responses: [], rewards: [], worldEffects: [], passthrough: [], components: [] };
  let pendingVoice = "";
  let pending = null; // { key, value }
  for (const entry of entries) {
    tree.components.push(entry.raw ? { raw: entry.raw } : { key: entry.key, value: entry.value });
    if (entry.raw) continue;
    const cat = dialogCategory(entry.key);
    if (entry.key === "id") tree.dialogueId = entry.value;
    else if (entry.key === "topic") tree.topic = entry.value;
    else if (entry.key === "group") tree.group = entry.value;
    else if (entry.key === "response_only") tree.responseOnly = entry.value === "true";
    else if (cat === "response") tree.responses.push(entry.value);
    else if (entry.key === "voice") pendingVoice = entry.value;
    else if (cat === "prefix") pending = { key: entry.key, value: entry.value };
    else if (cat === "line") {
      tree.dialogues.push({
        speaker: entry.key === "you" ? "player" : "npc",
        ...(entry.key === "her" ? { key: "her" } : {}),
        text: entry.value,
        ...(entry.value ? {} : { keepEmpty: true }),
        ...(pendingVoice ? { voice: pendingVoice } : {}),
        ...(pending ? { portrait: pending.value, portraitKey: pending.key } : {}),
      });
      pendingVoice = "";
      pending = null;
    } else if (cat === "req") tree.requirements.push({ type: REQ_TYPE_BY_KEY[entry.key], value: entry.value, raw: entry.value });
    else if (cat === "reward") tree.rewards.push({ type: REWARD_TYPE_BY_KEY[entry.key], value: entry.value, raw: entry.value });
    else if (cat === "effect") tree.worldEffects.push({ type: EFFECT_TYPE_BY_KEY[entry.key], value: entry.value });
    else tree.passthrough.push({ key: entry.key, value: entry.value });
  }
  // A voice/portrait with no following line stays as raw data at the end.
  if (pendingVoice) tree.passthrough.push({ key: "voice", value: pendingVoice });
  if (pending) tree.passthrough.push(pending);
  return tree;
}

/**
 * NPC file -> object. Every main-section key is kept (repeated keys as newline lists),
 * plus the original order (_rawMain), INCLUDE/APPEND lines, other sections ([stats],
 * [visual_effect]) as raw data, and each [dialog]'s entries in order (components).
 */
function importNpcText(content) {
  const npc = { customProperties: {}, _rawMain: [], _rawSections: [] };
  // Own pass (not parseDocument) so INCLUDE/APPEND lines keep their position.
  const sections = [{ name: "", entries: [] }];
  for (const raw of String(content || "").replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // Comments ride along as raw entries so a merge keeps them in place
    if (line.startsWith("#")) { sections[sections.length - 1].entries.push({ raw: line }); continue; }
    if (line === "APPEND" || line.startsWith("INCLUDE ")) { sections[sections.length - 1].entries.push({ raw: line }); continue; }
    const m = line.match(/^\[([^\]]+)\]$/);
    if (m) { sections.push({ name: m[1].trim(), entries: [] }); continue; }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    sections[sections.length - 1].entries.push({ key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() });
  }
  const trees = [];
  for (const section of sections) {
    if (section.name === "dialog") {
      trees.push(importDialogTree(section.entries));
      continue;
    }
    if (!section.name || section.name === "npc") {
      for (const entry of section.entries) {
        npc._rawMain.push(entry);
        if (entry.raw || entry.key === "waypoints" || entry.key === "wander_radius") continue;
        npc[entry.key] = npc[entry.key] === undefined ? entry.value : `${npc[entry.key]}\n${entry.value}`;
      }
      continue;
    }
    npc._rawSections.push({ name: section.name, entries: section.entries });
  }
  if (!npc._rawSections.length) delete npc._rawSections;
  if (trees.length) npc.customProperties.dialogueTrees = trees;
  return npc;
}

/**
 * Write Studio's NPC fields into an existing NPC file without losing anything Studio
 * does not model. `fields`: authoritative values ("" removes the key). `dialogueTrees`:
 * Studio's trees (undefined keeps the file's dialogs as they are).
 */
function mergeNpcFile(existingText, update) {
  const base = importNpcText(existingText || "");
  const fields = (update && update.fields) || {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    base[key] = value;
  }
  // sections: { name: [[{key, value}], ...] } replaces every section of that name (in place of the first);
  // raw lines (comments/INCLUDE) of the replaced sections are kept at the top of the first one.
  for (const [name, list] of Object.entries((update && update.sections) || {})) {
    if (!Array.isArray(list)) continue;
    const all = base._rawSections || [];
    const at = all.findIndex((sec) => sec.name === name);
    const raws = all.filter((sec) => sec.name === name).flatMap((sec) => sec.entries.filter((e) => e.raw));
    const fresh = list
      .map((entries) => (entries || []).filter((e) => e && e.key && String(e.key).trim()).map((e) => ({ key: String(e.key).trim(), value: String(e.value == null ? "" : e.value).trim() })))
      .filter((entries) => entries.length)
      .map((entries, i) => ({ name, entries: i === 0 ? [...raws, ...entries] : entries }));
    if (!fresh.length && raws.length) fresh.push({ name, entries: raws });
    const rest = all.filter((sec) => sec.name !== name);
    const insertAt = at < 0 ? rest.length : all.slice(0, at).filter((sec) => sec.name !== name).length;
    rest.splice(insertAt, 0, ...fresh);
    base._rawSections = rest;
  }
  // includes: authoritative list of INCLUDE paths (empty removes them). Positions of the first INCLUDE are kept.
  if (update && update.includes !== undefined) {
    const paths = (update.includes || []).map((p) => String(p || "").trim()).filter(Boolean);
    const raw = base._rawMain || [];
    const first = raw.findIndex((e) => e.raw && String(e.raw).startsWith("INCLUDE "));
    const without = raw.filter((e) => !(e.raw && String(e.raw).startsWith("INCLUDE ")));
    const inc = paths.map((path) => ({ raw: `INCLUDE ${path}` }));
    const at = first < 0 ? 0 : raw.slice(0, first).filter((e) => !(e.raw && String(e.raw).startsWith("INCLUDE "))).length;
    without.splice(at, 0, ...inc);
    base._rawMain = without;
  }
  if (update && update.dialogueTrees !== undefined) {
    const old = base.customProperties.dialogueTrees || [];
    const trees = (update.dialogueTrees || []).map((tree, index) => {
      if (!tree || tree.components) return tree;
      const id = tree.dialogueId || tree.id;
      const match = id ? old.find((t) => t.dialogueId === id) : (old[index] && !old[index].dialogueId ? old[index] : null);
      return match ? { ...tree, components: match.components } : tree;
    });
    base.customProperties.dialogueTrees = trees;
  }
  return exportNpcFile(base);
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
      else if (key === "fogofwar") map.fogofwar = value;
      else if (key === "save_fogofwar") map.save_fogofwar = value;
      else if (key === "procgen_type") map.procgen_type = value;
      else if (key === "procgen_unique_status") map.procgen_unique_status = value;
      else if (key === "procgen_reset_status") map.procgen_reset_status = value;
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
  mergeNpcFile,
  statusStockFromEntries,
  importMapText,
  formatCurrency,
  tilePixelOffset,
};
