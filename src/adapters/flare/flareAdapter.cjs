/**
 * FlareAdapter — the only place that turns a canonical project into Flare .txt.
 * Pure: no filesystem. Electron writes the returned files.
 */

const { slugFileName, legacyMapFileName } = require("./slug.cjs");
const { parseDocument, validateLayerRows, toIntFlare } = require("./fileParser.cjs");
const { keysFor, allowedSections } = require("./attributeKeys.cjs");
const serializers = require("./serializers.cjs");
const content = require("./content.cjs");

const SCHEMA_VERSION = 1;
const ID = "flare";

function issue(level, message, path) {
  return path ? { level, message, path } : { level, message };
}

function emptyProject(name) {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name: name || "Project",
      description: name || "Project",
      version: "1.0",
      game: "flare-game",
      requires: [],
      engineVersionMin: "1.13.01",
    },
    tile: { width: 64, height: 32, orientation: "isometric" },
    maps: [],
    items: [],
    enemies: [],
    npcs: [],
    powers: [],
    quests: [],
    loot: [],
    effects: [],
  };
}

function editorSession(extra) {
  return {
    schemaVersion: SCHEMA_VERSION,
    layerVisibility: (extra && extra.layerVisibility) || {},
    notes: (extra && extra.notes) || "",
  };
}

function settingsText(meta) {
  const source = meta || {};
  const lines = [];
  if (source.description || source.name) lines.push(`description=${source.description || source.name}`);
  if (source.version) lines.push(`version=${source.version}`);
  if (source.game) lines.push(`game=${source.game}`);
  if (source.requires && source.requires.length) lines.push(`requires=${source.requires.join(",")}`);
  if (source.engineVersionMin) lines.push(`engine_version_min=${source.engineVersionMin}`);
  return `${lines.join("\n")}\n`;
}

function validateText(category, content, filePath) {
  const errors = [];
  if (category === "maps") {
    const map = serializers.importMapText(content);
    for (const layer of map.layers || []) {
      for (const message of validateLayerRows(map.width, map.height, layer.rows)) {
        errors.push(issue("error", `${layer.type}: ${message}`, filePath));
      }
    }
  }
  const sections = parseDocument(content);
  const knownSections = allowedSections(category);
  for (const section of sections) {
    const sectionName = section.name || "";
    if (knownSections && sectionName && !knownSections.has(sectionName)) {
      errors.push(issue("error", `Unknown section [${sectionName}].`, filePath));
      continue;
    }
    const allowed = keysFor(category, sectionName);
    if (!allowed || allowed.size === 0) continue;
    for (const entry of section.entries) {
      if (!allowed.has(entry.key)) {
        errors.push(issue("error", `Line ${entry.line}: '${entry.key}' is not a valid key.`, filePath));
      }
    }
  }
  return errors;
}

function exportProject(project) {
  const source = project || emptyProject("Project");
  const errors = [];
  const warnings = [];
  const files = [];
  if (source.schemaVersion !== SCHEMA_VERSION) {
    errors.push(issue("error", `Unsupported schemaVersion ${source.schemaVersion}.`));
  }

  const meta = { ...(source.meta || emptyProject("Project").meta) };
  delete meta._settingsText;
  const index = {
    schemaVersion: SCHEMA_VERSION,
    meta,
    tile: source.tile || emptyProject().tile,
    maps: [],
    items: [],
    enemies: [],
    npcs: [],
    powers: [],
    quests: [],
    loot: [],
    effects: [],
  };

  files.push({
    path: ".editor/session.json",
    content: `${JSON.stringify(editorSession(source.editor), null, 2)}\n`,
  });

  for (const map of source.maps || []) {
    const id = slugFileName(map.id || map.title || "map");
    index.maps.push(id);
    const mapPath = map.sourcePath || `maps/${id}.txt`;
    files.push({ path: `content/maps/${id}.json`, content: `${JSON.stringify({ ...map, id }, null, 2)}\n` });
    const exported = serializers.exportMapText(map);
    for (const message of exported.errors) errors.push(issue("error", message, mapPath));
    const checked = validateText("maps", exported.text, mapPath);
    errors.push(...checked);
    files.push({ path: mapPath, content: exported.text });
    if (map.tilesetDef) {
      files.push({ path: `tilesetdefs/tileset_${id}.txt`, content: serializers.exportTilesetText(map.tilesetDef) });
    }
  }

  const itemExport = serializers.exportItemFile(source.items || [], { append: true });
  if ((source.items || []).length > 0) {
    files.push({ path: "items/items.txt", content: itemExport.text });
    errors.push(...validateText("items", itemExport.text, "items/items.txt"));
    source.items.forEach((item) => {
      const id = slugFileName(item.name || item.id || "item");
      index.items.push(id);
      files.push({ path: `content/items/${id}.json`, content: `${JSON.stringify(item, null, 2)}\n` });
    });
  }
  if (itemExport.powers.length > 0 || (source.powers || []).length > 0) {
    const powers = [...(source.powers || []), ...itemExport.powers];
    const powerText = serializers.exportPowerFile(powers);
    files.push({ path: "powers/powers.txt", content: powerText });
    errors.push(...validateText("powers", powerText, "powers/powers.txt"));
    powers.forEach((power) => {
      const id = slugFileName(power.name || power.id || "power");
      index.powers.push(id);
      files.push({ path: `content/powers/${id}.json`, content: `${JSON.stringify(power, null, 2)}\n` });
    });
  }

  for (const enemy of source.enemies || []) {
    const id = slugFileName(enemy.name || "enemy");
    index.enemies.push(id);
    const enemyPath = enemy.sourcePath || `enemies/${id}.txt`;
    const exported = serializers.exportEnemyFile(enemy);
    for (const message of exported.warnings) warnings.push(issue("warning", message, enemyPath));
    files.push({ path: enemyPath, content: exported.text });
    files.push({ path: `content/enemies/${id}.json`, content: `${JSON.stringify(enemy, null, 2)}\n` });
    errors.push(...validateText("enemies", exported.text, enemyPath));
  }

  for (const npc of source.npcs || []) {
    const id = slugFileName(npc.name || npc.id || "npc");
    index.npcs.push(id);
    const npcPath = npc.sourcePath || `npcs/${id}.txt`;
    const text = serializers.exportNpcFile(npc);
    files.push({ path: npcPath, content: text });
    files.push({ path: `content/npcs/${id}.json`, content: `${JSON.stringify(npc, null, 2)}\n` });
    errors.push(...validateText("npcs", text, npcPath));
  }

  for (const quest of source.quests || []) {
    const id = slugFileName(quest.id || quest.name || "quest");
    index.quests.push(id);
    const questPath = `quests/${id}.txt`;
    const text = content.exportQuestFile(quest);
    files.push({ path: questPath, content: text });
    files.push({ path: `content/quests/${id}.json`, content: `${JSON.stringify({ ...quest, id }, null, 2)}\n` });
    errors.push(...validateText("quests", text, questPath));
  }

  for (const table of source.loot || []) {
    const id = slugFileName(table.id || table.name || "loot");
    index.loot.push(id);
    const lootPath = `loot/${id}.txt`;
    const text = content.exportLootFile({ ...table, id });
    files.push({ path: lootPath, content: text });
    files.push({ path: `content/loot/${id}.json`, content: `${JSON.stringify({ ...table, id }, null, 2)}\n` });
    errors.push(...validateText("loot", text, lootPath));
  }

  if ((source.effects || []).length > 0) {
    const effectText = content.exportEffectFile(source.effects);
    files.push({ path: "powers/effects.txt", content: effectText });
    errors.push(...validateText("effects", effectText, "powers/effects.txt"));
    source.effects.forEach((effect) => {
      const id = slugFileName(effect.name || effect.id || "effect");
      index.effects.push(id);
      files.push({ path: `content/effects/${id}.json`, content: `${JSON.stringify(effect, null, 2)}\n` });
    });
  }

  const tilesetConfig = source.tileConfigText || serializers.exportTilesetConfig(source.tile);
  files.push({
    path: "engine/tileset_config.txt",
    content: String(tilesetConfig).endsWith("\n") ? String(tilesetConfig) : `${tilesetConfig}\n`,
  });
  const settingsBody = source.meta && source.meta._settingsText ? String(source.meta._settingsText) : settingsText(source.meta);
  files.push({ path: "settings.txt", content: settingsBody.endsWith("\n") ? settingsBody : `${settingsBody}\n` });
  files.unshift({ path: "project.json", content: `${JSON.stringify(index, null, 2)}\n` });

  return {
    files: errors.length > 0 ? [] : files,
    errors,
    warnings,
  };
}

function validate(project) {
  return exportProject(project).errors;
}

function launchPlan(project, options = {}) {
  const meta = (project && project.meta) || {};
  const name = slugFileName(meta.name || "project");
  const mods = [];
  for (const entry of meta.requires || []) {
    const mod = String(entry).split(":")[0].trim();
    if (!mod || mod === "default" || mod === name || mods.includes(mod)) continue;
    mods.push(mod);
  }
  if (!mods.includes(name)) mods.push(name);
  const args = [];
  if (mods.length > 0) args.push(`--mods=${mods.join(",")}`);
  if (options.loadSlot != null && options.loadSlot !== "") args.push(`--load-slot=${options.loadSlot}`);
  return { args, mods, loadSlot: options.loadSlot };
}

function parseSettings(text) {
  const meta = {};
  for (const section of parseDocument(text)) {
    for (const entry of section.entries) meta[entry.key] = entry.value;
  }
  return {
    name: meta.description || "Project",
    description: meta.description || "Project",
    version: meta.version || "1.0",
    game: meta.game || "flare-game",
    requires: meta.requires ? meta.requires.split(/[,;]/).map((part) => part.trim()).filter(Boolean) : [],
    engineVersionMin: meta.engine_version_min || "1.13.01",
  };
}

function importProject(files) {
  const source = files || {};
  if (source["project.json"]) {
    try {
      const index = JSON.parse(source["project.json"]);
      const project = emptyProject(index.meta && index.meta.name);
      project.meta = { ...project.meta, ...(index.meta || {}) };
      project.tile = index.tile || project.tile;
      for (const [path, content] of Object.entries(source)) {
        if (path.startsWith("content/maps/") && path.endsWith(".json")) project.maps.push(JSON.parse(content));
        if (path.startsWith("content/items/") && path.endsWith(".json")) project.items.push(JSON.parse(content));
        if (path.startsWith("content/enemies/") && path.endsWith(".json")) project.enemies.push(JSON.parse(content));
        if (path.startsWith("content/npcs/") && path.endsWith(".json")) project.npcs.push(JSON.parse(content));
        if (path.startsWith("content/powers/") && path.endsWith(".json")) project.powers.push(JSON.parse(content));
        if (path.startsWith("content/quests/") && path.endsWith(".json")) project.quests.push(JSON.parse(content));
        if (path.startsWith("content/loot/") && path.endsWith(".json")) project.loot.push(JSON.parse(content));
        if (path.startsWith("content/effects/") && path.endsWith(".json")) project.effects.push(JSON.parse(content));
      }
      if (
        project.maps.length ||
        project.items.length ||
        project.npcs.length ||
        project.quests.length ||
        project.loot.length ||
        project.effects.length
      ) return project;
    } catch {
      /* fall through to txt import */
    }
  }
  return migrateFiles(source).project;
}

function migrateFiles(files, projectName) {
  const project = emptyProject(projectName || "Project");
  const backup = [];
  for (const [path, fileText] of Object.entries(files || {})) {
    const normalized = path.replace(/\\/g, "/");
    if (normalized.startsWith(".editor/migration-backup/")) continue;
    if (/\.(txt|json)$/i.test(normalized)) backup.push(normalized);
    if (normalized === "settings.txt") {
      project.meta = {
        ...project.meta,
        ...parseSettings(fileText),
        _settingsText: fileText.endsWith("\n") ? fileText : `${fileText}\n`,
      };
    }
    if (normalized === "engine/tileset_config.txt") {
      project.tileConfigText = fileText.endsWith("\n") ? fileText : `${fileText}\n`;
    }
    if (normalized.startsWith("maps/") && normalized.endsWith(".txt") && !normalized.endsWith("/spawn.txt")) {
      const imported = serializers.importMapText(fileText);
      const base = normalized.split("/").pop().replace(/\.txt$/i, "");
      imported.id = slugFileName(base);
      imported.sourcePath = normalized;
      project.maps.push(imported);
    }
    if (normalized.startsWith("enemies/") && normalized.endsWith(".txt")) {
      const base = normalized.split("/").pop().replace(/\.txt$/i, "");
      const enemy = { name: base, sourcePath: normalized };
      const render = [];
      const slots = [];
      for (const section of parseDocument(fileText)) {
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
      project.enemies.push(enemy);
    }
    if (normalized.startsWith("npcs/") && normalized.endsWith(".txt")) {
      const npc = serializers.importNpcText(fileText);
      const base = normalized.split("/").pop().replace(/\.txt$/i, "");
      if (!npc.name) npc.name = base;
      npc.sourcePath = normalized;
      project.npcs.push(npc);
    }
    const isLootTable = normalized.endsWith(".txt") && (normalized.startsWith("loot/") || normalized.includes("/loot/")) && !normalized.endsWith("/loot.txt") && !normalized.includes("engine/");
    if (isLootTable) {
      const imported = content.importLootText(fileText);
      const base = normalized.split("/").pop().replace(/\.txt$/i, "");
      imported.id = imported.id || slugFileName(base);
      if (!imported.name) imported.name = base;
      project.loot.push(imported);
    }
    if (normalized.startsWith("quests/") && normalized.endsWith(".txt")) {
      const imported = content.importQuestText(fileText);
      const base = normalized.split("/").pop().replace(/\.txt$/i, "");
      imported.id = slugFileName(imported.name || base);
      project.quests.push(imported);
    }
    if (normalized === "powers/powers.txt") project.powers.push(...content.importPowerText(fileText));
    if (normalized === "powers/effects.txt") project.effects.push(...content.importEffectText(fileText));
  }
  if (projectName) project.meta.name = projectName;
  const exported = exportProject(project);
  return { project, backup, files: exported.files, errors: exported.errors, warnings: exported.warnings };
}

module.exports = {
  id: ID,
  SCHEMA_VERSION,
  emptyProject,
  editorSession,
  exportProject,
  importProject,
  validate,
  validateText,
  launchPlan,
  migrateFiles,
  settingsText,
  slugFileName,
  legacyMapFileName,
  toIntFlare,
  EDITOR_LAYER_TYPES: serializers.EDITOR_LAYER_TYPES,
  exportMapText: serializers.exportMapText,
  exportEventLines: serializers.exportEventLines,
  exportTilesetText: serializers.exportTilesetText,
  exportTilesetConfig: serializers.exportTilesetConfig,
  withAppend: serializers.withAppend,
  exportItemFile: serializers.exportItemFile,
  exportPowerFile: serializers.exportPowerFile,
  exportEnemyFile: serializers.exportEnemyFile,
  normalizeEnemyText: serializers.normalizeEnemyText,
  exportNpcFile: serializers.exportNpcFile,
  exportDialogueTrees: serializers.exportDialogueTrees,
  importNpcText: serializers.importNpcText,
  importMapText: serializers.importMapText,
  formatCurrency: serializers.formatCurrency,
  tilePixelOffset: serializers.tilePixelOffset,
  exportLootFile: content.exportLootFile,
  importLootText: content.importLootText,
  exportQuestFile: content.exportQuestFile,
  importQuestText: content.importQuestText,
  exportEffectFile: content.exportEffectFile,
  importEffectText: content.importEffectText,
  mergeEffectText: content.mergeEffectText,
  importPowerText: content.importPowerText,
  mergePowerText: content.mergePowerText,
  listPowerIds: content.listPowerIds,
  importEngineText: content.importEngineText,
  exportEngineText: content.exportEngineText,
  sectionsFromEngineText: content.sectionsFromEngineText,
  engineTextFromSections: content.engineTextFromSections,
  tileFromTilesetConfig: content.tileFromTilesetConfig,
  applyTileToProjectIndex: content.applyTileToProjectIndex,
  exportItemTypesFile: content.exportItemTypesFile,
  exportItemQualitiesFile: content.exportItemQualitiesFile,
  exportItemSetsFile: content.exportItemSetsFile,
  exportCutsceneFile: content.exportCutsceneFile,
  exportLanguagePot: content.exportLanguagePot,
  exportParallaxFile: content.exportParallaxFile,
  exportFogMask: content.exportFogMask,
  exportProcgenRules: content.exportProcgenRules,
  canonicalJson: content.canonicalJson,
  contentSlug: content.contentSlug,
  EFFECT_KEYS: content.EFFECT_KEYS,
  QUEST_STEP_KEYS: content.QUEST_STEP_KEYS,
};
