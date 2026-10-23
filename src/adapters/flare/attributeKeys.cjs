/**
 * Allowed Flare keys, derived from src/schema/attribute-reference.json
 * (itself parsed from flare-engine/docs/attribute-reference.html).
 *
 * The map file's [enemy] section is documented as enemygroup.* The engine
 * reads [enemy], not [enemygroup] (Map.cpp).
 */

const reference = require("../../schema/attribute-reference.json");

function classByName(name) {
  return reference.classes.find((entry) => entry.class === name) || { keys: [] };
}

function names(entry, section) {
  const out = new Set();
  for (const key of entry.keys || []) {
    const keySection = key.section || "";
    if (section == null || keySection === section) out.add(key.name);
  }
  return out;
}

const mapClass = classByName("Map");
const eventClass = classByName("EventManager");
const npcClass = classByName("NPC");
const itemClass = classByName("ItemManager: Items");
const qualityClass = classByName("ItemManager: Qualities");
const enemyClass = classByName("StatBlock: Enemies");
const coreClass = classByName("StatBlock: Core stats");
const powerClass = classByName("PowerManager: Powers");
const tilesetClass = classByName("TileSet");
const modClass = classByName("ModManager");
const tilesetConfigClass = classByName("EngineSettings: Tileset config");
const renderClass = classByName("StatBlock: Render layers");
const slotClass = classByName("StatBlock: Animation slots");

const ITEM_KEYS = names(itemClass, "");
const POWER_KEYS = names(powerClass, "power");
const NPC_KEYS = names(npcClass, "npc");
// The engine accepts animations as the replacement for deprecated gfx.
NPC_KEYS.add("animations");
const DIALOG_KEYS = names(npcClass, "dialog");
const EVENT_KEYS = names(eventClass, "event");
const ENEMY_FILE_KEYS = new Set([...names(enemyClass, ""), ...names(coreClass, ""), "rarity"]);
const MAP_HEADER_KEYS = names(mapClass, "");
const MAP_LAYER_KEYS = names(mapClass, "layer");
const MAP_ENEMY_KEYS = names(mapClass, "enemygroup");
const MAP_NPC_KEYS = names(mapClass, "npc");

const POWER_ONLY_ITEM_FIELDS = [
  "speed",
  "radius",
  "trait_elemental",
  "wall_power",
  "use_hazard",
  "post_power",
  "post_effect",
  "requires_hpmp_state",
  "requires_item",
  "new_state",
  "modifier_damage",
  "lifespan",
  "face",
  "type",
];

function keysFor(category, section) {
  if (category === "items") {
    if (section === "item" || section === "root" || section === "") return ITEM_KEYS;
    if (section === "quality") return names(qualityClass, "quality");
    if (section === "settings") return names(qualityClass, "settings");
    return null;
  }
  if (category === "maps") {
    if (section === "header") return MAP_HEADER_KEYS;
    if (section === "layer") return MAP_LAYER_KEYS;
    if (section === "event") return EVENT_KEYS;
    if (section === "enemy") return MAP_ENEMY_KEYS;
    if (section === "npc") return MAP_NPC_KEYS;
    if (section === "tilesets") return new Set(["tileset"]);
    return null;
  }
  if (category === "npcs") {
    if (section === "npc" || section === "root" || section === "") return NPC_KEYS;
    // Dialog nodes also carry event actions (reward_currency, set_status, ...).
    if (section === "dialog") return new Set([...DIALOG_KEYS, ...EVENT_KEYS]);
    if (section === "visual_effect") return names(npcClass, "visual_effect");
    if (section === "render_layers") return names(renderClass, "render_layers");
    if (section === "animation_slots") return names(slotClass, "animation_slots");
    return null;
  }
  if (category === "enemies") {
    if (section === "render_layers") return names(renderClass, "render_layers");
    if (section === "animation_slots") return names(slotClass, "animation_slots");
    if (section === "root" || section === "" || section === "enemy") return ENEMY_FILE_KEYS;
    return null;
  }
  if (category === "powers") {
    if (section === "power" || section === "root" || section === "") return POWER_KEYS;
    return null;
  }
  if (category === "settings") return names(modClass, "");
  if (category === "tileset_config") return names(tilesetConfigClass, "");
  if (category === "tileset") return names(tilesetClass, "tileset");
  return null;
}

function allowedSections(category) {
  if (category === "items") return new Set(["item", "quality", "set", "type", "root", "settings", ""]);
  if (category === "maps") return new Set(["header", "tilesets", "layer", "event", "enemy", "npc", "root", ""]);
  if (category === "npcs") return new Set(["root", "", "npc", "dialog", "visual_effect", "render_layers", "animation_slots", "stats"]);
  if (category === "enemies") return new Set(["root", "", "enemy", "render_layers", "animation_slots"]);
  if (category === "powers") return new Set(["power", "root", ""]);
  return null;
}

module.exports = {
  ITEM_KEYS,
  POWER_KEYS,
  NPC_KEYS,
  DIALOG_KEYS,
  EVENT_KEYS,
  ENEMY_FILE_KEYS,
  MAP_HEADER_KEYS,
  MAP_LAYER_KEYS,
  MAP_ENEMY_KEYS,
  MAP_NPC_KEYS,
  POWER_ONLY_ITEM_FIELDS,
  keysFor,
  allowedSections,
};
