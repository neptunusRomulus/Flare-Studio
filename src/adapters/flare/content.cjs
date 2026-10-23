/**
 * Content editors (loot, quests, powers/effects, engine documents).
 * Pure: no filesystem. Callers write the returned strings.
 */

const { slugFileName } = require("./slug.cjs");
const serializers = require("./serializers.cjs");

function safeString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function formatList(value) {
  if (Array.isArray(value)) return value.map(safeString).filter(Boolean).join(",");
  return safeString(value);
}

function finish(lines) {
  return `${lines.join("\n").trim()}\n`;
}

function exportLootFile(data) {
  const source = data || {};
  const lines = [];
  const id = safeString(source.id ?? source.name);
  const name = safeString(source.name);
  const description = safeString(source.description);
  const manualLootEntries = Array.isArray(source.loot)
    ? source.loot
    : source.loot
      ? [source.loot]
      : [];
  const lootContents = source.loot_contents;
  const globalChance = safeString(source.loot_chance_value);
  const globalFixed = source.loot_chance_fixed === true;
  const globalRequiresStatus = safeString(source.requires_status);
  const globalRequiresLevel = safeString(source.requires_level);
  const globalQuantityPerLevel = safeString(source.quantity_per_level);

  if (id) lines.push(`id=${id}`);
  if (name) lines.push(`name=${name}`);
  // Studio-only. The engine ignores it; the editor round-trips it.
  if (description) lines.push(`description=${description}`);

  const appendLootEntry = (entry) => {
    const rawStatusLoot = safeString(entry.status_loot);
    if (rawStatusLoot) {
      lines.push(`status_loot=${rawStatusLoot}`);
      lines.push("");
      return;
    }
    const lootId = safeString(entry["loot.id"]);
    if (!lootId) return;
    lines.push("[loot]");
    lines.push(`id=${lootId}`);
    const chance = safeString(entry["loot.chance"] ?? (globalFixed ? "fixed" : globalChance));
    if (chance) lines.push(`chance=${chance}`);
    const quantity = formatList(entry["loot.quantity"]);
    if (quantity) lines.push(`quantity=${quantity}`);
    const requiresStatus = safeString(entry["loot.requires_status"] ?? globalRequiresStatus);
    if (requiresStatus) lines.push(`requires_status=${requiresStatus}`);
    const requiresLevel = formatList(entry["loot.requires_level"] ?? globalRequiresLevel);
    if (requiresLevel) lines.push(`requires_level=${requiresLevel}`);
    const quantityPerLevel = formatList(entry["loot.quantity_per_level"] ?? globalQuantityPerLevel);
    if (quantityPerLevel) lines.push(`quantity_per_level=${quantityPerLevel}`);
    lines.push("");
  };

  manualLootEntries.forEach(appendLootEntry);
  if (lootContents && typeof lootContents === "object") {
    for (const [itemId, quantity] of Object.entries(lootContents)) {
      appendLootEntry({ "loot.id": itemId, "loot.quantity": quantity });
    }
  }
  return finish(lines);
}

function importLootText(content) {
  const data = {};
  const lootEntries = [];
  let currentEntry = null;
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    if (line.toLowerCase() === "[loot]") {
      currentEntry = {};
      lootEntries.push(currentEntry);
      continue;
    }
    const eqIndex = line.indexOf("=");
    if (eqIndex < 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!currentEntry) {
      if (key === "name" || key === "id" || key === "description") data[key] = value;
      else if (key === "status_loot") lootEntries.push({ status_loot: value });
      continue;
    }
    if (key === "id") currentEntry["loot.id"] = value;
    else if (key === "chance") currentEntry["loot.chance"] = value;
    else if (key === "quantity") currentEntry["loot.quantity"] = value;
    else if (key === "requires_status") currentEntry["loot.requires_status"] = value;
    else if (key === "requires_level") currentEntry["loot.requires_level"] = value;
    else if (key === "quantity_per_level") currentEntry["loot.quantity_per_level"] = value;
    else if (key === "status_loot") currentEntry.status_loot = value;
  }
  if (lootEntries.length) data.loot = lootEntries;
  return data;
}

const QUEST_STEP_KEYS = [
  "requires_status",
  "requires_not_status",
  "requires_level",
  "requires_not_level",
  "requires_currency",
  "requires_not_currency",
  "requires_item",
  "requires_not_item",
  "requires_class",
  "requires_not_class",
  "quest_text",
];

function itemRequirementList(requirements, type) {
  return (Array.isArray(requirements) ? requirements : [])
    .filter((entry) => entry && entry.type === type && entry.itemId)
    .map((entry) => {
      const qty = Number(entry.itemQuantity);
      return qty > 1 ? `${entry.itemId}:${qty}` : String(entry.itemId);
    });
}

function exportQuestFile(quest) {
  const source = quest || {};
  const lines = [];
  if (source.name) lines.push(`name=${source.name}`);
  if (source.complete_status) lines.push(`complete_status=${source.complete_status}`);
  lines.push("");
  lines.push("[quest]");
  const requirements = source.itemRequirements;
  const needs = itemRequirementList(requirements, "requires_item");
  const blocked = itemRequirementList(requirements, "requires_not_item");
  for (const key of QUEST_STEP_KEYS) {
    if (key === "requires_item") {
      const value = needs.length ? needs.join(",") : safeString(source.requires_item);
      if (value) lines.push(`requires_item=${value}`);
      continue;
    }
    if (key === "requires_not_item") {
      const value = blocked.length ? blocked.join(",") : safeString(source.requires_not_item);
      if (value) lines.push(`requires_not_item=${value}`);
      continue;
    }
    const value = safeString(source[key]);
    if (value) lines.push(`${key}=${value}`);
  }
  return finish(lines);
}

function parseRequirementToken(token, type) {
  const [itemId, qty] = String(token).split(":");
  return {
    id: `${type}_${itemId}`,
    type,
    itemId,
    itemQuantity: qty ? Number(qty) || 1 : 1,
  };
}

function importQuestText(content) {
  const quest = { itemRequirements: [] };
  let inStep = false;
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.toLowerCase() === "[quest]") {
      inStep = true;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!inStep) {
      if (key === "name" || key === "complete_status") quest[key] = value;
      continue;
    }
    if (key === "requires_item" || key === "requires_not_item") {
      const type = key;
      for (const token of value.split(",").map((part) => part.trim()).filter(Boolean)) {
        quest.itemRequirements.push(parseRequirementToken(token, type));
      }
      continue;
    }
    if (QUEST_STEP_KEYS.includes(key)) quest[key] = value;
  }
  return quest;
}

const EFFECT_KEYS = [
  "id",
  "type",
  "name",
  "icon",
  "animation",
  "can_stack",
  "max_stacks",
  "group_stack",
  "render_above",
  "color_mod",
  "alpha_mod",
  "attack_speed_anim",
  "ignore_resist",
  "damage_type",
];

function exportEffectFile(effects) {
  const lines = ["APPEND", ""];
  for (const effect of effects || []) {
    lines.push("[effect]");
    for (const key of EFFECT_KEYS) {
      if (effect[key] == null || effect[key] === "") continue;
      const value = effect[key] === true ? "true" : effect[key];
      lines.push(`${key}=${value}`);
    }
    lines.push("");
  }
  return finish(lines);
}

function importSectionBlocks(content, sectionName, keys) {
  const blocks = [];
  let current = null;
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.toLowerCase() === `[${sectionName}]`) {
      current = {};
      blocks.push(current);
      continue;
    }
    if (!current || line === "APPEND") continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (keys && !keys.has(key)) continue;
    current[key] = line.slice(eq + 1).trim();
  }
  return blocks;
}

function importEffectText(content) {
  return importSectionBlocks(content, "effect", new Set(EFFECT_KEYS));
}

function importPowerText(content) {
  const { POWER_KEYS } = require("./attributeKeys.cjs");
  return importSectionBlocks(content, "power", POWER_KEYS);
}

function blockWithoutAppend(text) {
  return String(text || "").replace(/^APPEND\n+/, "").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOrAppendBlock(existingText, sectionName, id, blockBody) {
  const text = String(existingText || "").replace(/\r/g, "");
  const base = text.trim() ? text : "APPEND\n";
  const chunks = new RegExp(`\\[${sectionName}\\][\\s\\S]*?(?=\\n\\[${sectionName}\\]|$)`, "g");
  const idPattern = new RegExp(`(^|\\n)id=${escapeRegExp(id)}(\\n|$)`);
  let replaced = false;
  const next = base.replace(chunks, (chunk) => {
    if (replaced || !idPattern.test(chunk)) return chunk;
    replaced = true;
    return `${blockBody.trim()}\n`;
  });
  const withHeader = /(^|\n)APPEND(\n|$)/.test(next) ? next : `APPEND\n\n${next.trim()}\n`;
  const body = replaced ? withHeader : `${withHeader.replace(/\s*$/, "")}\n\n${blockBody.trim()}\n`;
  return body.endsWith("\n") ? body : `${body}\n`;
}

function mergePowerText(existingText, powers) {
  let text = existingText || "";
  for (const power of powers || []) {
    const id = safeString(power.id);
    if (!id) continue;
    text = replaceOrAppendBlock(text, "power", id, blockWithoutAppend(serializers.exportPowerFile([power])));
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

function mergeEffectText(existingText, effects) {
  let text = existingText || "";
  for (const effect of effects || []) {
    const id = safeString(effect.id);
    if (!id) continue;
    text = replaceOrAppendBlock(text, "effect", id, blockWithoutAppend(exportEffectFile([effect])));
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

function listPowerIds(content) {
  return importPowerText(content).map((power) => safeString(power.id)).filter(Boolean);
}

function importEngineText(content) {
  const lines = String(content || "").replace(/\r/g, "").split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const doc = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") doc.push({ kind: "blank" });
    else if (trimmed.startsWith("#")) doc.push({ kind: "comment", text: trimmed });
    else if (trimmed.startsWith("[") && trimmed.endsWith("]") && !trimmed.includes("=")) {
      doc.push({ kind: "section", name: trimmed.slice(1, -1) });
    } else if (trimmed.includes("=") && !trimmed.startsWith("INCLUDE")) {
      const eq = trimmed.indexOf("=");
      doc.push({ kind: "key", key: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1).trim() });
    } else {
      doc.push({ kind: "raw", text: trimmed });
    }
  }
  return doc;
}

function exportEngineText(doc) {
  const lines = [];
  for (const entry of doc || []) {
    if (!entry) continue;
    if (entry.kind === "blank") lines.push("");
    else if (entry.kind === "comment") lines.push(entry.text || "");
    else if (entry.kind === "section") {
      if (entry.name) lines.push(`[${entry.name}]`);
    } else if (entry.kind === "key") lines.push(`${entry.key}=${entry.value == null ? "" : entry.value}`);
    else if (entry.kind === "raw") lines.push(entry.text || "");
  }
  return `${lines.join("\n")}\n`;
}

function sectionsFromEngineText(content) {
  const sections = [];
  let current = { type: "", fields: [] };
  const push = () => {
    if (current.type || current.fields.length) sections.push(current);
  };
  for (const entry of importEngineText(content)) {
    if (entry.kind === "section") {
      push();
      current = { type: entry.name, fields: [] };
    } else if (entry.kind === "blank") {
      current.fields.push({ key: "", value: "", comment: "" });
    } else if (entry.kind === "comment") {
      current.fields.push({ key: "", value: "", comment: entry.text });
    } else if (entry.kind === "key") {
      current.fields.push({ key: entry.key, value: entry.value });
    } else if (entry.kind === "raw") {
      current.fields.push({ key: "", value: "", comment: entry.text });
    }
  }
  push();
  return sections;
}

function engineTextFromSections(sections) {
  const doc = [];
  for (const section of sections || []) {
    if (section.type) doc.push({ kind: "section", name: section.type });
    for (const field of section.fields || []) {
      if (field.comment !== undefined && !field.key) {
        doc.push(field.comment === "" ? { kind: "blank" } : field.comment.startsWith("#") ? { kind: "comment", text: field.comment } : { kind: "raw", text: field.comment });
      } else if (field.key) {
        doc.push({ kind: "key", key: field.key, value: field.value == null ? "" : field.value });
      }
    }
  }
  return exportEngineText(doc);
}

function tileFromTilesetConfig(content) {
  const tile = { width: 64, height: 32, orientation: "isometric" };
  for (const entry of importEngineText(content)) {
    if (entry.kind !== "key") continue;
    if (entry.key === "tile_size") {
      const [width, height] = String(entry.value).split(",");
      const parsedWidth = parseInt(width, 10);
      const parsedHeight = parseInt(height, 10);
      if (parsedWidth > 0) tile.width = parsedWidth;
      if (parsedHeight > 0) tile.height = parsedHeight;
    }
    if (entry.key === "orientation" && (entry.value === "isometric" || entry.value === "orthogonal")) {
      tile.orientation = entry.value;
    }
  }
  return tile;
}

function applyTileToProjectIndex(indexText, tile) {
  const index = JSON.parse(indexText || "{}");
  index.schemaVersion = index.schemaVersion || 1;
  index.tile = { ...(index.tile || {}), ...tile };
  return `${JSON.stringify(index, null, 2)}\n`;
}

function pushKnown(lines, source, keys) {
  for (const key of keys) {
    if (source[key] == null || source[key] === "") continue;
    const value = source[key] === true ? "true" : source[key];
    lines.push(`${key}=${value}`);
  }
}

function exportItemTypesFile(doc) {
  const source = doc || {};
  const lines = [];
  if (source.sortOrder) {
    lines.push("[settings]", `sort_order=${source.sortOrder}`, "");
  }
  for (const type of source.types || []) {
    lines.push("[type]");
    pushKnown(lines, type, ["id", "name", "auto_pickup", "auto_actionbar"]);
    lines.push("");
  }
  return serializers.withAppend(finish(lines));
}

function exportItemQualitiesFile(doc) {
  const source = doc || {};
  const lines = [];
  if (source.sortOrder) {
    lines.push("[settings]", `sort_order=${source.sortOrder}`, "");
  }
  for (const quality of source.qualities || []) {
    lines.push("[quality]");
    pushKnown(lines, quality, ["id", "name", "color", "overlay_icon"]);
    lines.push("");
  }
  return serializers.withAppend(finish(lines));
}

function exportItemSetsFile(sets) {
  const lines = [];
  for (const set of sets || []) {
    pushKnown(lines, set, ["id", "name", "items", "color"]);
    const bonuses = Array.isArray(set.bonus) ? set.bonus : set.bonus ? [set.bonus] : [];
    for (const bonus of bonuses) if (bonus) lines.push(`bonus=${bonus}`);
    const levels = Array.isArray(set.bonus_power_level) ? set.bonus_power_level : set.bonus_power_level ? [set.bonus_power_level] : [];
    for (const level of levels) if (level) lines.push(`bonus_power_level=${level}`);
    lines.push("");
  }
  return serializers.withAppend(finish(lines));
}

function exportCutsceneFile(cutscene) {
  const source = cutscene || {};
  const lines = [];
  pushKnown(lines, source, ["caption_margins", "caption_background", "vscroll_speed", "menu_backgrounds", "music"]);
  lines.push("");
  for (const scene of source.scenes || []) {
    lines.push("[scene]");
    pushKnown(lines, scene, ["caption", "image", "pause", "soundfx"]);
    lines.push("");
  }
  for (const scroll of source.vscroll || []) {
    lines.push("[vscroll]");
    pushKnown(lines, scroll, ["text", "image", "separator"]);
    lines.push("");
  }
  return finish(lines);
}

function exportLanguagePot(entries) {
  const seen = new Set();
  const lines = [
    'msgid ""',
    'msgstr ""',
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    "",
  ];
  for (const entry of entries || []) {
    const text = safeString(entry).replace(/\r/g, "");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
    lines.push(`msgid "${escaped}"`, 'msgstr ""', "");
  }
  return `${lines.join("\n").trim()}\n`;
}

function exportParallaxFile(layers) {
  const lines = [];
  for (const layer of layers || []) {
    lines.push("[layer]");
    pushKnown(lines, layer, ["image", "speed", "fixed_speed", "map_layer"]);
    lines.push("");
  }
  return finish(lines);
}

function exportFogMask(mask) {
  const source = mask || {};
  const lines = ["[header]"];
  pushKnown(lines, source, ["radius", "bits_per_tile", "color_dark", "color_fog", "tileset_dark", "tileset_fog"]);
  lines.push("");
  if (Array.isArray(source.bits) && source.bits.length) {
    lines.push("[bits]");
    for (const bit of source.bits) lines.push(`bit=${bit}`);
    lines.push("");
  }
  if (Array.isArray(source.tiles) && source.tiles.length) {
    lines.push("[tiles]");
    for (const tile of source.tiles) lines.push(`tile=${tile}`);
    lines.push("");
  }
  if (source.data) {
    lines.push("[mask]", "data=", String(source.data).replace(/\r/g, "").trimEnd(), "");
  }
  return finish(lines);
}

function exportProcgenRules(rules) {
  const source = rules || {};
  const lines = ["[settings]"];
  pushKnown(lines, source, [
    "doors_max",
    "main_path_length_min",
    "main_path_length_max",
    "main_path_attempts_max",
    "branch_length_min",
    "branch_length_max",
    "branches_per_door_level_max",
    "door_spacing_min",
  ]);
  lines.push("");
  const chunks = Array.isArray(source.chunks) ? source.chunks : [];
  if (chunks.length) {
    lines.push("[chunks]");
    for (const chunk of chunks) if (chunk) lines.push(`filename=${chunk}`);
    lines.push("");
  }
  return finish(lines);
}

function canonicalJson(kind, data) {
  return `${JSON.stringify({ schemaVersion: 1, kind, ...data }, null, 2)}\n`;
}

function contentSlug(value, fallback) {
  return slugFileName(safeString(value) || fallback || "entry");
}

module.exports = {
  exportLootFile,
  importLootText,
  exportQuestFile,
  importQuestText,
  exportEffectFile,
  importEffectText,
  mergeEffectText,
  importPowerText,
  mergePowerText,
  listPowerIds,
  importEngineText,
  exportEngineText,
  sectionsFromEngineText,
  engineTextFromSections,
  tileFromTilesetConfig,
  applyTileToProjectIndex,
  exportItemTypesFile,
  exportItemQualitiesFile,
  exportItemSetsFile,
  exportCutsceneFile,
  exportLanguagePot,
  exportParallaxFile,
  exportFogMask,
  exportProcgenRules,
  canonicalJson,
  contentSlug,
  EFFECT_KEYS,
  QUEST_STEP_KEYS,
};
