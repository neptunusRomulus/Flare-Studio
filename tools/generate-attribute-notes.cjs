#!/usr/bin/env node
/**
 * Render the Obsidian attribute reference (flare-studio-notes) from the engine schema
 * that Studio itself uses.
 *
 *   engine src/*.cpp  --(tools/extract-engine-schema.cjs)-->  src/schema/attribute-reference.json
 *                                                                 |
 *                                          tools/generate-attribute-notes.cjs
 *                                                                 v
 *                            ../flare-studio-notes/Agent/Referans/Attribute Referansı/
 *
 * The notes are output, not source: hand edits to the tables are lost on the next run.
 * Hand-written Obsidian callouts (`> [!warning] ...`) in a page are carried over
 * verbatim, so annotations survive regeneration.
 *
 * Usage:
 *   node tools/generate-attribute-notes.cjs                 # write every page
 *   node tools/generate-attribute-notes.cjs --only "Map"    # one page
 *   node tools/generate-attribute-notes.cjs --check         # exit 1 if out of date
 *   node tools/generate-attribute-notes.cjs --out <dir>
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA = path.join(ROOT, "src/schema/attribute-reference.json");
const DEFAULT_OUT = path.resolve(ROOT, "../flare-studio-notes/Agent/Referans/Attribute Referansı");
const TARGET_TS = path.join(ROOT, "src/flare/engineTarget.ts");

// Group order of the index page. A class missing here fails the run, so a new engine
// class forces a decision instead of silently disappearing from the index.
const GROUPS = [
  {
    title: "Aktörler / Quest / Animasyon",
    classes: [
      "AnimationSet",
      "EnemyGroupManager",
      "NPC",
      "QuestLog",
      "StatBlock - Core stats",
      "StatBlock - Sound effects",
      "StatBlock - Render layers",
      "StatBlock - Animation slots",
      "StatBlock - Enemies",
      "StatBlock - Hero stats",
      "Subtitles",
      "XPScaling",
    ],
  },
  {
    title: "Arayüz / Menü / Sistem",
    classes: [
      "CombatText",
      "CursorManager",
      "FontEngine - Font colors",
      "GameStateLoad",
      "GameStateNew - Layout",
      "GameStateNew - Hero options",
      "GameStatePlay - Titles",
      "GameStateTitle",
      "GameSwitcher - Default music",
      "GameSwitcher - Background images",
      "GameSwitcher - FPS counter",
      "IconManager",
      "InputState - Default Keybindings",
      "MenuActionBar",
      "MenuActiveEffects",
      "MenuBook",
      "MenuCharacter",
      "MenuConfig",
      "MenuConfirm",
      "Menu",
      "MenuDevConsole",
      "MenuEnemy",
      "MenuGameOver",
      "MenuHUDLog",
      "MenuInventory",
      "MenuLog",
      "MenuMiniMap",
      "MenuNumPicker",
      "MenuPowers - Menu layout",
      "MenuPowers - Power tree layout",
      "MenuRegionTitle",
      "MenuStash",
      "MenuStatBar",
      "MenuTalker",
      "MenuVendor",
      "SDLFontEngine - Font settings",
    ],
  },
  { title: "Diğer", classes: ["ModManager"] },
  {
    title: "Harita / Tileset / Olay",
    classes: [
      "EventManager",
      "EventManager - Random Map List",
      "FogOfWar",
      "Cutscene",
      "Map",
      "Map - Procedural generation rules",
      "MapParallax",
      "TileSet",
    ],
  },
  {
    title: "Item / Loot / Power / Stat",
    classes: [
      "Avatar - Step sounds",
      "ItemManager - Items",
      "ItemManager - Types",
      "ItemManager - Qualities",
      "ItemManager - Sets",
      "ItemManager - Randomizer Definition",
      "LootManger",
      "PowerManager - Effects",
      "PowerManager - Powers",
      "EffectManager",
      "ItemManager",
      "Stats",
    ],
  },
  {
    title: "Motor ayarları (engine/)",
    classes: [
      "EngineSettings - Misc",
      "EngineSettings - Resolution",
      "EngineSettings - Gameplay",
      "EngineSettings - Combat",
      "EngineSettings - Equip flags",
      "EngineSettings - Primary Stats",
      "EngineSettings - Classes",
      "EngineSettings - Damage Types",
      "EngineSettings - Elements",
      "EngineSettings - Death penalty",
      "EngineSettings - Tooltips",
      "EngineSettings - Loot",
      "EngineSettings - Tileset config",
      "EngineSettings - Widgets",
      "EngineSettings - XP table",
      "EngineSettings - Number Format",
      "EngineSettings - Resource Stats",
    ],
  },
];

const INDEX = "Attribute Referansı.md";

function engineStamp() {
  let short = "unknown";
  let version = "unknown";
  try {
    const ts = fs.readFileSync(TARGET_TS, "utf8");
    short = (ts.match(/short:\s*'([^']+)'/) || [])[1] || short;
    version = (ts.match(/version:\s*'([^']+)'/) || [])[1] || version;
  } catch {
    // stamp stays "unknown"; the pages are still usable
  }
  return { short, version, label: `engine \`${short}\` · v${version}` };
}

/** `ItemManager: Items` -> `ItemManager - Items` (the vault's file naming). */
function noteName(className) {
  return className.replace(/: /g, " - ");
}

function yaml(value) {
  return JSON.stringify(String(value));
}

function oneLine(text) {
  return String(text == null ? "" : text)
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "'")
    .trim();
}

function cell(text) {
  const flat = oneLine(text);
  return flat || "—";
}

function codeCell(text) {
  if (text == null || String(text).trim() === "") return "—";
  return "`" + oneLine(text).replace(/`/g, "'") + "`";
}

function tableRow(className, key) {
  const section = key.section ? cell(key.section) : "—";
  const repeatable = key.repeatable || String(key.type || "").startsWith("repeatable");
  return `| \`${oneLine(key.key)}\` | ${section} | ${cell(key.type)} | ${repeatable ? "evet" : ""} | ${cell(key.description)} |`;
}

/** Obsidian callouts (`> [!warning] ...`) are the only hand-written content in a page. */
function manualCallouts(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("> [!")) continue;
    const block = [];
    while (i < lines.length && lines[i].startsWith(">")) block.push(lines[i++]);
    blocks.push(block.join("\n"));
    i--;
  }
  return blocks;
}

function page(entry, stamp, callouts) {
  const name = noteName(entry.class);
  const keys = entry.keys || [];
  const out = [
    "---",
    "tags: [flare/referans, flare/attribute]",
    `sinif: ${yaml(entry.class)}`,
    `anahtar_sayisi: ${keys.length}`,
    `kaynak: ${yaml(`flare-engine src (@ATTR) via Flare-Studio/src/schema/attribute-reference.json · ${stamp.label}`)}`,
    "---",
    "",
    `# ${entry.class}`,
    "",
    `**Dosya:** ${codeCell(entry.file)}`,
    "",
  ];
  if (entry.description && String(entry.description).trim()) out.push(`> ${oneLine(entry.description)}`, "");
  out.push(
    `Üretildi: \`Flare-Studio/tools/generate-attribute-notes.cjs\` ← \`Flare-Studio/src/schema/attribute-reference.json\` (${stamp.label}). Elle düzenlemeyin. Değer tipleri: [[Değer Tipleri]]. Dizin: [[Attribute Referansı]].`,
    "",
    "| Anahtar | Bölüm | Tip | Tekrar | Açıklama |",
    "|---|---|---|---|---|",
  );
  for (const key of keys) out.push(tableRow(entry.class, key));
  for (const block of callouts) out.push("", block);
  return out.join("\n") + "\n";
}

function indexPage(schema, stamp) {
  const classes = schema.classes;
  const keys = classes.reduce((n, entry) => n + (entry.keys || []).length, 0);
  const valuetypes = Object.keys(schema.valuetypes || {}).length;
  const byName = new Map(classes.map((entry) => [noteName(entry.class), entry]));

  const known = new Set(GROUPS.flatMap((group) => group.classes));
  const missing = [...byName.keys()].filter((name) => !known.has(name));
  const unknown = [...known].filter((name) => !byName.has(name));
  if (missing.length || unknown.length) {
    throw new Error(
      `GRUPLAR güncel değil. Eklenen: ${JSON.stringify(missing)} · kaybolan: ${JSON.stringify(unknown)}`,
    );
  }

  const out = [
    "---",
    "tags: [flare/referans, moc]",
    "---",
    "",
    "# Attribute Referansı",
    "",
    `Flare motorunun tüm veri dosyası anahtarları: **${classes.length} sınıf/dosya, ${keys} anahtar, ${valuetypes} değer tipi**. Kaynak: \`flare-engine\` kaynak kodundaki \`@ATTR\` yorumları (${stamp.label}); Studio'nun kullandığı şema \`Flare-Studio/src/schema/attribute-reference.json\`.`,
    "",
    "- Sayfalar \`Flare-Studio/tools/generate-attribute-notes.cjs\` ile üretilir; tabloları elle düzenlemeyin, not eklemek için \`> [!warning]\` kutusu kullanın.",
    "- Şemayı tazelemek: \`node Flare-Studio/tools/extract-engine-schema.cjs\` → \`node Flare-Studio/tools/generate-attribute-notes.cjs\`.",
    "- Değer tipleri: [[Değer Tipleri]]",
    "- Bu şema, GUI serializer'ları için **whitelist** olarak kullanılır → [[Uyumsuzluklar]] O1/O2/O6.",
    "",
    "> [!note] Referans her zaman doğru değil",
    "> Referans koddaki yorumlardan üretilir. Bilinen sapma: `Map` içindeki `enemygroup.*` → kodda `[enemy]` bölümü. Şüphede kaynak kod esastır.",
  ];

  for (const group of GROUPS) {
    out.push("", `## ${group.title}`, "", "| Not | Dosya | Anahtar |", "|---|---|---|");
    for (const name of group.classes) {
      const entry = byName.get(name);
      out.push(`| [[${name}]] | ${codeCell(entry.file)} | ${(entry.keys || []).length} |`);
    }
  }
  return out.join("\n") + "\n";
}

function main() {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const next = args[at + 1];
    if (!next || next.startsWith("--")) throw new Error(`${flag} bir değer ister`);
    return next;
  };
  const outDir = path.resolve(value("--out") || DEFAULT_OUT);
  const only = value("--only");
  const check = args.includes("--check");
  const stamp = engineStamp();
  const schema = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));

  const written = [];
  const stale = [];
  const write = (file, content) => {
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (before === content) return;
    if (before !== null) stale.push(path.basename(file));
    if (!check) fs.writeFileSync(file, content);
    written.push(path.basename(file));
  };

  for (const entry of schema.classes) {
    if (only && entry.class !== only && noteName(entry.class) !== only) continue;
    const file = path.join(outDir, `${noteName(entry.class)}.md`);
    write(file, page(entry, stamp, manualCallouts(file)));
  }
  if (!only) write(path.join(outDir, INDEX), indexPage(schema, stamp));

  const verb = check ? "güncel değil" : "yazıldı";
  console.log(`${verb}: ${written.length} dosya · ${outDir}`);
  if (written.length && !check) console.log(written.slice(0, 5).join(", ") + (written.length > 5 ? ", …" : ""));
  if (check) {
    for (const name of stale) console.log(`  ${name}`);
    process.exit(stale.length ? 1 : 0);
  }
}

main();
