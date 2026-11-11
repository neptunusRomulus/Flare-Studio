#!/usr/bin/env node
/**
 * Build a key/section schema from flare-engine C++ source.
 *
 * Primary source: in-source `// @ATTR` documentation (see
 * flare-engine/docs/gen/attribute-reference.md for the type syntax).
 * Secondary source: `infile.key == "..."` / `key == "..."` comparisons,
 * so a key the engine reads but forgot to document is still captured.
 *
 * Usage:
 *   node tools/extract-engine-schema.cjs [--engine <path>] [--out <file>]
 *
 * Engine path (first match wins): --engine, $FLARE_ENGINE, $FLARE_ENGINE_SRC,
 * then ../flare-engine and ../../flare-engine relative to the repo root.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function findEngine(cliPath) {
  const candidates = [
    cliPath,
    process.env.FLARE_ENGINE,
    process.env.FLARE_ENGINE_SRC,
    path.resolve(repoRoot(), "../flare-engine"),
    path.resolve(repoRoot(), "../../flare-engine"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const root = path.resolve(candidate);
    if (fs.existsSync(path.join(root, "src/NPC.cpp")) && fs.existsSync(path.join(root, "src/Version.cpp"))) {
      return root;
    }
  }
  return null;
}

function readEngineMeta(engineRoot) {
  const versionText = fs.readFileSync(path.join(engineRoot, "src/Version.cpp"), "utf8");
  const versionMatch = versionText.match(/VersionInfo::ENGINE\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/);
  const version = versionMatch ? `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}` : "unknown";
  let commit = null;
  try {
    const head = fs.readFileSync(path.join(engineRoot, ".git/HEAD"), "utf8").trim();
    if (head.startsWith("ref:")) {
      const ref = head.slice(4).trim();
      commit = fs.readFileSync(path.join(engineRoot, ".git", ref), "utf8").trim();
    } else {
      commit = head;
    }
  } catch {
    commit = null;
  }
  return { version, commit };
}

function splitTypeAndLabels(rawType) {
  let depth = 0;
  for (let i = 0; i < rawType.length; i += 1) {
    const ch = rawType[i];
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === ":" && depth === 0) {
      return { type: rawType.slice(0, i).trim(), labels: rawType.slice(i + 1).trim() };
    }
  }
  return { type: rawType.trim(), labels: "" };
}

function tokenizeTypes(typeText) {
  const tokens = [];
  let current = "";
  let depth = 0;
  for (const ch of typeText) {
    if (ch === "(" || ch === "[") {
      depth += 1;
      current += ch;
    } else if (ch === ")" || ch === "]") {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === "," && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parseTypeSpec(rawType) {
  const { type, labels } = splitTypeAndLabels(rawType || "");
  const repeatable = /\brepeatable\s*\(/.test(type);
  const list = /\blist\s*\(/.test(type);
  const inner = type
    .replace(/^\s*repeatable\s*\(/, "")
    .replace(/^\s*list\s*\(/, "")
    .replace(/\)\s*$/, "")
    .replace(/\brepeatable\s*\(/g, "")
    .replace(/\blist\s*\(/g, "")
    .replace(/\)/g, "");
  const tokens = tokenizeTypes(type.replace(/\brepeatable\s*\(|\blist\s*\(/g, "").replace(/\)/g, ""));
  const primitive = [];
  for (const token of tokens) {
    const union = token.match(/^\[(.*)\]$/);
    if (union) {
      primitive.push({ union: union[1].split(",").map((part) => part.trim().replace(/^"|"$/g, "")) });
    } else {
      primitive.push(token);
    }
  }
  return {
    rawType: (rawType || "").trim(),
    labels,
    repeatable,
    list,
    shape: primitive.length ? primitive : [inner || "string"],
  };
}

function parseAttrPath(name) {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return { section: "", key: trimmed };
  return { section: trimmed.slice(0, dot), key: trimmed.slice(dot + 1) };
}

const ATTR_RE = /@ATTR\s+(\S+)\s*\|\s*([^|]*)\|\s*(.*)$/;
const CLASS_RE = /@CLASS\s+([^|]+)\|\s*(.*)$/;
const KEY_EQ_RE = /(?:infile\.)?key\s*==\s*"([^"]+)"/g;
const SECTION_EQ_RE = /(?:infile\.)?section\s*==\s*"([^"]+)"/g;

const DEFAULT_SECTION_BY_FILE = {
  "NPC.cpp": "npc",
  "EventManager.cpp": "event",
  "QuestLog.cpp": "quest",
  "ItemManager.cpp": "item",
  "PowerManager.cpp": "power",
  "StatBlock.cpp": "stats",
  "LootManager.cpp": "loot",
  "Map.cpp": "map.header",
  "EngineSettings.cpp": "engine",
  "TileSet.cpp": "tileset",
  "FogOfWar.cpp": "fow.header",
  "MapParallax.cpp": "parallax",
  "GameStateCutscene.cpp": "cutscene",
  "EnemyGroupManager.cpp": "enemygroup",
  "ModManager.cpp": "mod",
};

const DEFAULT_SECTION_BY_FUNCTION = {
  "Map::loadHeader": "map.header",
  "Map::loadLayer": "layer",
  "Map::loadEnemyGroup": "enemygroup",
  "Map::loadNPC": "map.npc",
  "Map::procGenFillArea": "settings",
  "NPC::load": "npc",
  "ItemManager::loadItems": "item",
  "ItemManager::loadTypes": "type",
  "ItemManager::loadQualities": "quality",
  "ItemManager::loadSets": "set",
  "ItemManager::loadRandomizerDef": "option",
  "PowerManager::loadEffects": "effect",
  "PowerManager::loadPowers": "power",
  "StatBlock::loadCoreStat": "stats",
  "StatBlock::loadSfxStat": "stats",
  "StatBlock::loadRenderLayerStat": "render_layers",
  "StatBlock::loadAnimationSlotStat": "animation_slots",
  "StatBlock::load": "stats",
  "StatBlock::loadHeroStats": "stats",
  "QuestLog::load": "quest",
  "EventManager::loadEvent": "event",
  "EventManager::loadEventComponentString": "event",
  "EventManager::getRandomMapFromFile": "event",
  "LootManager::loadLootTables": "loot",
  "EngineSettings::load": "engine",
  "FogOfWar::load": "fow.header",
  "MapParallax::load": "parallax",
  "TileSet::load": "tileset",
  "ModManager::loadModList": "mod",
  "GameStateCutscene::load": "cutscene",
};

const SECTION_RENAME_BY_FILE = {
  "Map.cpp": { npc: "map.npc" },
  "FogOfWar.cpp": { header: "fow.header", bits: "fow.bits", tiles: "fow.tiles", mask: "fow.mask" },
  "MapParallax.cpp": { layer: "parallax" },
  "ItemManager.cpp": { settings: "item.settings" },
};

/** Key comparisons here are "this belongs to another loader", not real StatBlock keys. */
/**
 * Keys the engine clearly accumulates but @ATTR forgot to wrap in repeatable().
 * Verified against the loaders (push_back or per-type slot assignment).
 */
const IMPLIED_REPEATABLE = {
  item: ["dmg", "dmg_min", "dmg_max", "abs", "abs_min", "abs_max"],
  stats: ["stat", "stat_per_level", "stat_per_primary", "power", "loot"],
  power: ["post_effect", "post_effect_src"],
  loot: ["loot", "status_loot"],
  "fow.header": ["bit"],
  bits: ["bit"],
  "fow.bits": ["bit"],
};

const SKIP_KEY_COMPARE_IN = new Set(["StatBlock::isNPCStat"]);

const FUNCTION_RE = /^[\w:<>*& ]+\s+([A-Za-z_]\w*)::([A-Za-z_]\w*)\s*\(/;
const SECTION_IF_RE = /\b(?:else\s+)?if\s*\(\s*(?:infile\.|infile->)?section\s*==\s*"([^"]+)"\s*\)/;

function resolveSection(rel, section) {
  const renamed = (SECTION_RENAME_BY_FILE[rel] || {})[section];
  return renamed || section;
}

function ensureSection(schema, section, source) {
  if (!schema.sections[section]) {
    schema.sections[section] = { source: [], keys: {} };
  }
  if (source && !schema.sections[section].source.includes(source)) {
    schema.sections[section].source.push(source);
  }
  return schema.sections[section];
}

function addKey(schema, section, key, fields, source) {
  const bucket = ensureSection(schema, section, source);
  const existing = bucket.keys[key];
  if (!existing) {
    bucket.keys[key] = { ...fields, sources: source ? [source] : [] };
    return;
  }
  existing.repeatable = existing.repeatable || !!fields.repeatable;
  existing.list = existing.list || !!fields.list;
  existing.ignored = existing.ignored || !!fields.ignored;
  existing.deprecated = existing.deprecated || !!fields.deprecated;
  if (fields.doc && !existing.doc) existing.doc = fields.doc;
  if (fields.rawType && !existing.rawType) existing.rawType = fields.rawType;
  if (fields.shape && (!existing.shape || existing.shape.length === 0)) existing.shape = fields.shape;
  if (source && !existing.sources.includes(source)) existing.sources.push(source);
  if (fields.fromAttr) existing.fromAttr = true;
  if (fields.fromKeyCompare) existing.fromKeyCompare = true;
}

function braceDelta(line) {
  let delta = 0;
  let inString = false;
  let quote = "";
  let escape = false;
  for (const ch of line) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
    } else if (ch === "{") delta += 1;
    else if (ch === "}") delta -= 1;
  }
  return delta;
}

function extractFromFile(schema, filePath, rel) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\n/);
  const fileDefault = DEFAULT_SECTION_BY_FILE[path.basename(filePath)] || "";
  let currentClass = "";
  let currentFunction = "";
  let functionDefault = fileDefault;
  let braceDepth = 0;
  const sectionAtDepth = [];
  const classes = [];

  const activeSection = () => {
    for (let i = sectionAtDepth.length - 1; i >= 0; i -= 1) {
      if (sectionAtDepth[i]) return sectionAtDepth[i];
    }
    return functionDefault || fileDefault || currentClass || "";
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fnMatch = line.match(FUNCTION_RE);
    if (fnMatch && braceDepth <= 1) {
      currentFunction = `${fnMatch[1]}::${fnMatch[2]}`;
      functionDefault = DEFAULT_SECTION_BY_FUNCTION[currentFunction] || fileDefault;
    }

    const classMatch = line.match(CLASS_RE);
    if (classMatch) {
      currentClass = classMatch[1].trim();
      classes.push({ name: currentClass, description: classMatch[2].trim(), file: rel });
    }

    const sectionIf = line.match(SECTION_IF_RE);
    const delta = braceDelta(line);
    if (sectionIf) {
      const sameLineBlock = /\)\s*\{/.test(line);
      const sameLineStmt = /\)\s*[^;{]+;/.test(line) || /\)\s*$/.test(line.trim()) === false && /;/.test(line);
      // Single-statement dispatch (`if (section == "header") loadHeader();`) must not leak.
      const rest = line.slice(line.indexOf(")") + 1).trim();
      if (rest.startsWith("{") || sameLineBlock) {
        sectionAtDepth[braceDepth + 1] = sectionIf[1];
      } else if (!rest || rest.startsWith("//")) {
        // Opening brace may be on the next line.
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === "") j += 1;
        if (j < lines.length && lines[j].trim().startsWith("{")) {
          sectionAtDepth[braceDepth + 1] = sectionIf[1];
        }
      }
    }

    const attrMatch = line.match(ATTR_RE);
    if (attrMatch) {
      const { section, key } = parseAttrPath(attrMatch[1]);
      const resolvedSection = resolveSection(rel, section || activeSection());
      const type = parseTypeSpec(attrMatch[2]);
      const doc = attrMatch[3].trim();
      const ignored = /\(IGNORED BY ENGINE\)/i.test(doc) || /Unused by engine/i.test(doc);
      const deprecated = /deprecated/i.test(doc);
      addKey(
        schema,
        resolvedSection,
        key,
        {
          ...type,
          doc,
          ignored,
          deprecated,
          fromAttr: true,
          attrPath: attrMatch[1].trim(),
          loader: currentFunction || rel,
        },
        rel,
      );
    }

    KEY_EQ_RE.lastIndex = 0;
    let keyMatch;
    while ((keyMatch = KEY_EQ_RE.exec(line))) {
      if (SKIP_KEY_COMPARE_IN.has(currentFunction)) continue;
      addKey(
        schema,
        resolveSection(rel, activeSection()),
        keyMatch[1],
        {
          rawType: "",
          labels: "",
          repeatable: false,
          list: false,
          shape: [],
          fromKeyCompare: true,
          loader: currentFunction || rel,
        },
        rel,
      );
    }

    braceDepth += delta;
    if (delta < 0) {
      for (let d = sectionAtDepth.length - 1; d > braceDepth; d -= 1) {
        sectionAtDepth[d] = undefined;
      }
    }
  }

  if (classes.length) schema.classes.push(...classes);
}

function applyImpliedRepeatable(schema) {
  for (const [section, keys] of Object.entries(IMPLIED_REPEATABLE)) {
    const bucket = schema.sections[section];
    if (!bucket) continue;
    for (const key of keys) {
      if (bucket.keys[key]) bucket.keys[key].repeatable = true;
    }
  }
}

function sortSchema(schema) {
  const sections = {};
  for (const name of Object.keys(schema.sections).sort()) {
    const section = schema.sections[name];
    const keys = {};
    for (const key of Object.keys(section.keys).sort()) {
      const entry = section.keys[key];
      if (Array.isArray(entry.sources)) entry.sources.sort();
      keys[key] = entry;
    }
    section.source.sort();
    sections[name] = { source: section.source, keys };
  }
  schema.sections = sections;
  schema.classes.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
}

function extractSchema(engineRoot) {
  const meta = readEngineMeta(engineRoot);
  const schema = {
    engine: {
      commit: meta.commit,
      version: meta.version,
    },
    notes: [
      "Derived from flare-engine src/ // @ATTR comments and key-string comparisons.",
      "Type syntax follows docs/gen/attribute-reference.md: list(...) is one-line repetition, repeatable(...) is multi-line.",
      "Map files use a [enemy] section; the engine documents those keys as enemygroup.*.",
      "Map [npc] keys are stored under map.npc; NPC files use npc, dialog and visual_effect.",
      "Map header keys are under map.header (tilewidth/tileheight/orientation are Tiled fields; tilewidth/height are unused by the engine).",
    ],
    classes: [],
    sections: {},
  };
  const srcDir = path.join(engineRoot, "src");
  const files = fs.readdirSync(srcDir).filter((name) => name.endsWith(".cpp")).sort();
  for (const name of files) {
    extractFromFile(schema, path.join(srcDir, name), name);
  }
  applyImpliedRepeatable(schema);
  sortSchema(schema);
  schema.stats = {
    sections: Object.keys(schema.sections).length,
    keys: Object.values(schema.sections).reduce((sum, section) => sum + Object.keys(section.keys).length, 0),
    attrKeys: Object.values(schema.sections).reduce(
      (sum, section) => sum + Object.values(section.keys).filter((key) => key.fromAttr).length,
      0,
    ),
    compareOnlyKeys: Object.values(schema.sections).reduce(
      (sum, section) => sum + Object.values(section.keys).filter((key) => key.fromKeyCompare && !key.fromAttr).length,
      0,
    ),
  };
  return schema;
}

function parseArgs(argv) {
  const out = { engine: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--engine") out.engine = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node tools/extract-engine-schema.cjs [--engine <path>] [--out <file>]");
    process.exit(0);
  }
  const engine = findEngine(args.engine);
  if (!engine) {
    console.error("extract-engine-schema: flare-engine source not found. Pass --engine or set FLARE_ENGINE.");
    process.exit(2);
  }
  const schema = extractSchema(engine);
  const json = `${JSON.stringify(schema, null, 2)}\n`;
  if (args.out) {
    const dest = path.resolve(args.out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, json);
    console.log(`Wrote ${dest} (${schema.stats.keys} keys in ${schema.stats.sections} sections) from ${engine}`);
  } else {
    process.stdout.write(json);
  }
}

module.exports = {
  findEngine,
  extractSchema,
  parseTypeSpec,
  repoRoot,
};

if (require.main === module) {
  main();
}
