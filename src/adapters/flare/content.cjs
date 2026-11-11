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
  if (Array.isArray(source.includes)) {
    for (const include of source.includes) {
      if (include) lines.push(`INCLUDE ${include}`);
    }
  }

  const appendLootEntry = (entry) => {
    const rawStatusLoot = safeString(entry.status_loot);
    if (rawStatusLoot) {
      lines.push(`status_loot=${rawStatusLoot}`);
      lines.push("");
      return;
    }
    const shorthand = safeString(entry.loot);
    if (shorthand) {
      lines.push(`loot=${shorthand}`);
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
    if (line.toUpperCase().startsWith("INCLUDE ")) {
      if (!Array.isArray(data.includes)) data.includes = [];
      data.includes.push(line.slice(8).trim());
      continue;
    }
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
      else if (key === "loot") lootEntries.push({ loot: value });
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
  "show_status",
];

function itemRequirementList(requirements, type) {
  return (Array.isArray(requirements) ? requirements : [])
    .filter((entry) => entry && entry.type === type && entry.itemId)
    .map((entry) => {
      const qty = Number(entry.itemQuantity);
      return qty > 1 ? `${entry.itemId}:${qty}` : String(entry.itemId);
    });
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

function itemRequirementsFromStep(step) {
  const list = [];
  for (const type of ["requires_item", "requires_not_item"]) {
    const raw = safeString(step && step[type]);
    for (const token of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
      list.push(parseRequirementToken(token, type));
    }
  }
  return list;
}

function stepKeyValue(step, key) {
  if (!step) return "";
  if (key === "requires_item") {
    const fromList = itemRequirementList(step.itemRequirements, "requires_item");
    if (fromList.length) return fromList.join(",");
  }
  if (key === "requires_not_item") {
    const fromList = itemRequirementList(step.itemRequirements, "requires_not_item");
    if (fromList.length) return fromList.join(",");
  }
  return safeString(step[key]);
}

function emptyQuestStepFields() {
  const step = {};
  for (const key of QUEST_STEP_KEYS) step[key] = "";
  return step;
}

function parseQuestSections(content) {
  const header = {};
  const steps = [];
  let current = null;
  let blockIndex = -1;
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.toLowerCase() === "[quest]") {
      if (current) steps.push(current);
      blockIndex += 1;
      current = { ...emptyQuestStepFields(), blockIndex };
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      if (current) {
        steps.push(current);
        current = null;
      }
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!current) {
      if (key === "name" || key === "complete_status") {
        header[key] = header[key] ? `${header[key]},${value}` : value;
      }
      continue;
    }
    if (QUEST_STEP_KEYS.includes(key)) {
      current[key] = current[key] ? `${current[key]},${value}` : value;
    }
  }
  if (current) steps.push(current);
  return { header, steps };
}

function flattenFirstStep(quest, step) {
  if (!step) return quest;
  for (const key of QUEST_STEP_KEYS) {
    if (quest[key] === undefined) quest[key] = safeString(step[key]);
  }
  if (!Array.isArray(quest.itemRequirements) || !quest.itemRequirements.length) {
    quest.itemRequirements = itemRequirementsFromStep(step);
  }
  return quest;
}

function normalizeQuestSteps(quest) {
  const source = quest || {};
  if (Array.isArray(source.steps)) {
    return source.steps.map((step, index) => {
      const next = { ...emptyQuestStepFields(), ...(step || {}) };
      if (!Number.isInteger(next.blockIndex)) {
        if (Number.isInteger(step && step.blockIndex)) next.blockIndex = step.blockIndex;
        else next.blockIndex = index;
      }
      return next;
    });
  }
  const hasFlat = QUEST_STEP_KEYS.some((key) => safeString(source[key]))
    || (Array.isArray(source.itemRequirements) && source.itemRequirements.length);
  if (!hasFlat) return [];
  return [{ ...emptyQuestStepFields(), ...source, blockIndex: 0 }];
}

function writeQuestStepLines(lines, step) {
  lines.push("[quest]");
  for (const key of QUEST_STEP_KEYS) {
    const value = stepKeyValue(step, key);
    if (value) lines.push(`${key}=${value}`);
  }
}

function exportQuestFile(quest) {
  const source = quest || {};
  const lines = [];
  if (source.name) lines.push(`name=${source.name}`);
  if (source.complete_status) lines.push(`complete_status=${source.complete_status}`);
  const steps = normalizeQuestSteps(source);
  if (steps.length) lines.push("");
  steps.forEach((step, index) => {
    if (index > 0) lines.push("");
    writeQuestStepLines(lines, step);
  });
  return finish(lines);
}

function importQuestText(content) {
  const parsed = parseQuestSections(content);
  const quest = {
    name: parsed.header.name || "",
    complete_status: parsed.header.complete_status || "",
    itemRequirements: [],
    steps: parsed.steps,
  };
  return flattenFirstStep(quest, parsed.steps[0]);
}

/** Index range of a [section] inside an importEngineText document (start = section line, end = next section). */
function sectionRange(doc, sectionName) {
  const start = doc.findIndex((entry) => entry && entry.kind === "section" && String(entry.name).toLowerCase() === sectionName);
  if (start < 0) return null;
  let end = start + 1;
  while (end < doc.length && !(doc[end] && doc[end].kind === "section")) end += 1;
  return { start, end };
}

function headerEnd(doc) {
  const firstSection = doc.findIndex((entry) => entry && entry.kind === "section");
  return firstSection < 0 ? doc.length : firstSection;
}

/** Update a key in a range, or insert it after the last key of that range. Empty values leave the file untouched unless removeIfEmpty. */
function setDocKey(doc, start, end, key, value, removeIfEmpty) {
  if (!value) {
    if (removeIfEmpty) {
      const at = doc.findIndex((entry, i) => i >= start && i < end && entry && entry.kind === "key" && entry.key === key);
      if (at >= 0) doc.splice(at, 1);
    }
    return;
  }
  let lastKey = -1;
  for (let i = start; i < end; i += 1) {
    const entry = doc[i];
    if (!entry || entry.kind !== "key") continue;
    if (entry.key === key) {
      entry.value = value;
      return;
    }
    lastKey = i;
  }
  doc.splice(lastKey >= 0 ? lastKey + 1 : start, 0, { kind: "key", key, value });
}

const QUEST_LIST_KEYS = new Set([
  "requires_status",
  "requires_not_status",
  "requires_item",
  "requires_not_item",
  "requires_class",
  "requires_not_class",
  "complete_status",
]);

function splitListValue(value) {
  return safeString(value).split(",").map((part) => part.trim()).filter(Boolean);
}

function listValuesEqual(left, right) {
  const a = splitListValue(left);
  const b = splitListValue(right);
  return a.length === b.length && a.every((part, i) => part === b[i]);
}

function existingListValue(doc, start, end, key) {
  const parts = [];
  for (let i = start; i < end; i += 1) {
    const entry = doc[i];
    if (entry && entry.kind === "key" && entry.key === key) parts.push(entry.value);
  }
  return parts.join(",");
}

/** Update a list-valued key. Repeated lines stay if the joined values already match. */
function setDocListKey(doc, start, end, key, value, removeIfEmpty) {
  const wanted = splitListValue(value);
  if (!wanted.length) {
    if (removeIfEmpty) {
      for (let i = end - 1; i >= start; i -= 1) {
        if (doc[i] && doc[i].kind === "key" && doc[i].key === key) doc.splice(i, 1);
      }
    }
    return;
  }
  if (listValuesEqual(existingListValue(doc, start, end, key), value)) return;
  const indices = [];
  for (let i = start; i < end; i += 1) {
    if (doc[i] && doc[i].kind === "key" && doc[i].key === key) indices.push(i);
  }
  if (!indices.length) {
    setDocKey(doc, start, end, key, wanted.join(","));
    return;
  }
  if (indices.length === 1) {
    doc[indices[0]].value = wanted.join(",");
    return;
  }
  doc[indices[0]] = { kind: "key", key, value: wanted[0] };
  for (let j = indices.length - 1; j >= 1; j -= 1) doc.splice(indices[j], 1);
  for (let j = 1; j < wanted.length; j += 1) {
    doc.splice(indices[0] + j, 0, { kind: "key", key, value: wanted[j] });
  }
}

function collectQuestBlocks(doc) {
  const first = doc.findIndex((entry) => entry && entry.kind === "section" && String(entry.name).toLowerCase() === "quest");
  if (first < 0) return { header: doc.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry)), blocks: [] };
  const header = doc.slice(0, first).map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry));
  const starts = [];
  for (let i = first; i < doc.length; i += 1) {
    if (doc[i] && doc[i].kind === "section" && String(doc[i].name).toLowerCase() === "quest") starts.push(i);
  }
  const blocks = starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : doc.length;
    return doc.slice(start, end).map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry));
  });
  return { header, blocks };
}

function applyStepToBlock(block, step) {
  const next = block && block.length ? block.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry)) : [{ kind: "section", name: "quest" }];
  if (!next[0] || next[0].kind !== "section") next.unshift({ kind: "section", name: "quest" });
  for (const key of QUEST_STEP_KEYS) {
    const value = stepKeyValue(step, key);
    if (QUEST_LIST_KEYS.has(key)) setDocListKey(next, 1, next.length, key, value, true);
    else setDocKey(next, 1, next.length, key, value, true);
  }
  return next;
}

function newQuestBlock(step) {
  const block = [{ kind: "section", name: "quest" }];
  for (const key of QUEST_STEP_KEYS) {
    const value = stepKeyValue(step, key);
    if (value) block.push({ kind: "key", key, value });
  }
  block.push({ kind: "blank" });
  return block;
}

function mergeQuestSteps(doc, source) {
  const { header, blocks } = collectQuestBlocks(doc);
  let headerStart = 0;
  const endOfHeader = header.length;
  while (headerStart < endOfHeader && !(header[headerStart] && header[headerStart].kind === "key")) headerStart += 1;
  setDocKey(header, headerStart, header.length, "name", safeString(source.name));
  setDocListKey(header, headerStart, header.length, "complete_status", safeString(source.complete_status));

  const steps = normalizeQuestSteps(source);
  const used = new Set();
  const outBlocks = steps.map((step, index) => {
    const claimed = Number.isInteger(step.blockIndex) ? step.blockIndex : index;
    if (claimed >= 0 && claimed < blocks.length && !used.has(claimed)) {
      used.add(claimed);
      return applyStepToBlock(blocks[claimed], step);
    }
    return newQuestBlock(step);
  });

  const out = header.slice();
  if (outBlocks.length && out.length && out[out.length - 1] && out[out.length - 1].kind !== "blank") {
    // keep original header spacing when it already had a blank before the first [quest]
  }
  for (let i = 0; i < outBlocks.length; i += 1) {
    const block = outBlocks[i];
    if (i > 0 && block[0] && block[0].kind !== "blank" && out.length && out[out.length - 1] && out[out.length - 1].kind !== "blank") {
      // original blocks already include a trailing blank when the source file had one
    }
    out.push(...block);
  }
  return out;
}

/**
 * Merge quest journal fields into an existing quests/<id>.txt.
 * Keeps comments, unknown keys, repeats and later [quest] blocks. When `quest.steps`
 * is provided, every [quest] block is updated (or reordered) to match; otherwise only
 * the header and the first [quest] section are updated.
 */
function mergeQuestText(existingText, quest) {
  const source = quest || {};
  const text = String(existingText || "");
  if (!text.trim()) return exportQuestFile(source);

  const doc = importEngineText(text);
  if (Array.isArray(source.steps)) {
    return exportEngineText(mergeQuestSteps(doc, source));
  }

  let headerStart = 0;
  const endOfHeader = headerEnd(doc);
  while (headerStart < endOfHeader && !(doc[headerStart] && doc[headerStart].kind === "key")) headerStart += 1;
  setDocKey(doc, headerStart, headerEnd(doc), "name", safeString(source.name));
  setDocListKey(doc, headerStart, headerEnd(doc), "complete_status", safeString(source.complete_status));

  const range = sectionRange(doc, "quest");
  const hasStep = QUEST_STEP_KEYS.some((key) => safeString(source[key]));
  if (range) {
    for (const key of QUEST_STEP_KEYS) {
      const provided = source[key] !== undefined;
      const value = safeString(source[key]);
      const canClear = key !== "requires_status" && key !== "quest_text";
      if (!provided && (canClear || !value)) continue;
      if (QUEST_LIST_KEYS.has(key)) setDocListKey(doc, range.start + 1, range.end, key, value, canClear && provided);
      else setDocKey(doc, range.start + 1, range.end, key, value, canClear && provided);
    }
  } else if (hasStep) {
    doc.push({ kind: "blank" });
    doc.push({ kind: "section", name: "quest" });
    for (const key of QUEST_STEP_KEYS) {
      const value = safeString(source[key]);
      if (value) doc.push({ kind: "key", key, value });
    }
  }

  return exportEngineText(doc);
}

/** Keys of the first [quest] section only. */
function firstQuestStep(content) {
  const parsed = parseQuestSections(content);
  const step = parsed.steps[0] || emptyQuestStepFields();
  return {
    name: parsed.header.name || "",
    complete_status: parsed.header.complete_status || "",
    ...step,
  };
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

function copyDocEntries(entries) {
  return (entries || []).map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry));
}

function blockHasValue(block, start, key, value) {
  for (let i = start; i < block.length; i += 1) {
    const entry = block[i];
    if (entry && entry.kind === "key" && entry.key === key && String(entry.value) === value) return true;
  }
  return false;
}

/** Update provided keys in a [power]/[effect] block. Unknown keys, comments and repeated lines stay put. */
function applySectionItemToBlock(block, sectionName, keys, item) {
  const next = copyDocEntries(block && block.length ? block : [{ kind: "section", name: sectionName }]);
  if (!next[0] || next[0].kind !== "section") next.unshift({ kind: "section", name: sectionName });
  const source = item || {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const raw = source[key];
    const value = Array.isArray(raw) ? raw.join(",") : raw === true ? "true" : raw == null ? "" : String(raw);
    if (!value) continue;
    const joined = existingListValue(next, 1, next.length, key);
    if (joined === value || blockHasValue(next, 1, key, value)) continue;
    if (Array.isArray(raw)) setDocListKey(next, 1, next.length, key, value, false);
    else setDocKey(next, 1, next.length, key, value, false);
  }
  return next;
}

function newSectionBlock(sectionName, keys, item) {
  const block = [{ kind: "section", name: sectionName }];
  const source = item || {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const raw = source[key];
    if (raw == null || raw === "" || raw === false) continue;
    const value = Array.isArray(raw) ? raw.join(",") : raw === true ? "true" : String(raw);
    if (value) block.push({ kind: "key", key, value });
  }
  block.push({ kind: "blank" });
  return block;
}

function mergeNamedSectionText(existingText, sectionName, items, keys, emptyExport) {
  const text = String(existingText || "").replace(/\r/g, "");
  const list = (items || []).filter((item) => item && safeString(item.id));
  if (!text.trim()) return emptyExport(list);
  if (!list.length) return text.endsWith("\n") ? text : `${text}\n`;
  const doc = importEngineText(text);
  const { header, blocks } = collectNamedBlocks(doc, sectionName);
  const pending = new Map();
  for (const item of list) pending.set(safeString(item.id), item);
  const outBlocks = blocks.map((block) => {
    const id = blockId(block);
    const update = pending.get(id);
    if (!update) return block;
    pending.delete(id);
    return applySectionItemToBlock(block, sectionName, keys, update);
  });
  let appended = false;
  for (const item of list) {
    if (!pending.has(safeString(item.id))) continue;
    if (!appended) {
      const last = outBlocks[outBlocks.length - 1];
      if (last && last.length && last[last.length - 1].kind !== "blank") last.push({ kind: "blank" });
      appended = true;
    }
    outBlocks.push(newSectionBlock(sectionName, keys, item));
  }
  const out = header.slice();
  for (const block of outBlocks) out.push(...block);
  return exportEngineText(out);
}

function mergePowerText(existingText, powers) {
  const { POWER_KEYS } = require("./attributeKeys.cjs");
  return mergeNamedSectionText(existingText, "power", powers, POWER_KEYS, (list) => serializers.exportPowerFile(list));
}

function mergeEffectText(existingText, effects) {
  return mergeNamedSectionText(existingText, "effect", effects, new Set(EFFECT_KEYS), (list) => exportEffectFile(list));
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
  // No tile_size means the base mod (fantasycore) value applies.
  const tile = { width: 192, height: 96, orientation: "isometric" };
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

function updateExistingDocKey(doc, start, end, key, value) {
  const at = doc.findIndex((entry, i) => i >= start && i < end && entry && entry.kind === "key" && entry.key === key);
  if (at >= 0) doc[at].value = value == null ? "" : String(value);
}

function mergeLootText(existingText, data) {
  const text = String(existingText || "").replace(/\r/g, "");
  if (!text.trim()) return exportLootFile(data || {});
  const doc = importEngineText(text);
  const source = data || {};
  const end = headerEnd(doc);
  if (source.id != null && String(source.id).trim() !== "") updateExistingDocKey(doc, 0, end, "id", source.id);
  if (source.name != null && String(source.name).trim() !== "") updateExistingDocKey(doc, 0, end, "name", source.name);
  if (source.description !== undefined) updateExistingDocKey(doc, 0, end, "description", source.description);
  if (Array.isArray(source.includes)) {
    const paths = source.includes.map((item) => String(item || "").trim()).filter(Boolean);
    const existing = [];
    for (const entry of doc) {
      if (entry && entry.kind === "raw" && String(entry.text || "").toUpperCase().startsWith("INCLUDE ")) {
        existing.push(String(entry.text).slice(8).trim());
      }
    }
    const same = existing.length === paths.length && existing.every((path, i) => path === paths[i]);
    if (!same) {
      const first = doc.findIndex((entry) => entry && entry.kind === "raw" && String(entry.text || "").toUpperCase().startsWith("INCLUDE "));
      const without = doc.filter((entry) => !(entry && entry.kind === "raw" && String(entry.text || "").toUpperCase().startsWith("INCLUDE ")));
      const inc = paths.map((path) => ({ kind: "raw", text: `INCLUDE ${path}` }));
      const at = first < 0 ? without.length : without.findIndex((_, i) => i === first - (doc.length - without.length - inc.length + paths.length));
      const insertAt = first < 0 ? without.length : Math.max(0, first - (doc.filter((entry, i) => i < first && entry && entry.kind === "raw" && String(entry.text || "").toUpperCase().startsWith("INCLUDE ")).length));
      without.splice(insertAt, 0, ...inc);
      return exportEngineText(without);
    }
  }
  return exportEngineText(doc);
}

function collectNamedBlocks(doc, sectionName) {
  const name = String(sectionName).toLowerCase();
  const first = doc.findIndex((entry) => entry && entry.kind === "section" && String(entry.name).toLowerCase() === name);
  if (first < 0) {
    return { header: doc.map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry)), blocks: [] };
  }
  const header = doc.slice(0, first).map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry));
  const starts = [];
  for (let i = first; i < doc.length; i += 1) {
    if (doc[i] && doc[i].kind === "section" && String(doc[i].name).toLowerCase() === name) starts.push(i);
  }
  const blocks = starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : doc.length;
    return doc.slice(start, end).map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry));
  });
  return { header, blocks };
}

function blockId(block) {
  for (const entry of block || []) {
    if (entry && entry.kind === "key" && entry.key === "id") return String(entry.value);
  }
  return "";
}

function applyItemToBlock(block, item) {
  const { ITEM_KEYS } = require("./attributeKeys.cjs");
  const next = (block && block.length ? block : [{ kind: "section", name: "item" }]).map((entry) => (entry && typeof entry === "object" ? { ...entry } : entry));
  if (!next[0] || next[0].kind !== "section") next.unshift({ kind: "section", name: "item" });
  const source = item || {};
  for (const key of ITEM_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const raw = source[key];
    if (Array.isArray(raw)) setDocListKey(next, 1, next.length, key, raw.join(","), true);
    else setDocKey(next, 1, next.length, key, raw === true ? "true" : raw == null ? "" : String(raw), true);
  }
  return next;
}

function newItemBlock(item) {
  const { ITEM_KEYS } = require("./attributeKeys.cjs");
  const block = [{ kind: "section", name: "item" }];
  const source = item || {};
  for (const key of ITEM_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const raw = source[key];
    if (raw == null || raw === "" || raw === false) continue;
    const value = Array.isArray(raw) ? raw.join(",") : raw === true ? "true" : String(raw);
    if (value) block.push({ kind: "key", key, value });
  }
  block.push({ kind: "blank" });
  return block;
}

function mergeItemText(existingText, item) {
  const text = String(existingText || "").replace(/\r/g, "");
  const source = item || {};
  if (!text.trim()) return serializers.exportItemFile([source], { append: true }).text;
  const doc = importEngineText(text);
  const { header, blocks } = collectNamedBlocks(doc, "item");
  const id = source.id != null ? String(source.id) : "";
  let found = false;
  const outBlocks = blocks.map((block) => {
    if (found || !id || blockId(block) !== id) return block;
    found = true;
    return applyItemToBlock(block, source);
  });
  if (!found && id) outBlocks.push(newItemBlock(source));
  const out = header.slice();
  for (const block of outBlocks) out.push(...block);
  return exportEngineText(out);
}

module.exports = {
  exportLootFile,
  importLootText,
  mergeLootText,
  exportQuestFile,
  importQuestText,
  mergeQuestText,
  mergeItemText,
  firstQuestStep,
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
