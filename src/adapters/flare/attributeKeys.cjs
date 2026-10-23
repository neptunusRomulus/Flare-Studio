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
const lootClass = classByName("LootManger");
const questClass = classByName("QuestLog");
const effectClass = classByName("PowerManager: Effects");
const itemTypeClass = classByName("ItemManager: Types");
const itemSetClass = classByName("ItemManager: Sets");
const cutsceneClass = classByName("Cutscene");
const parallaxClass = classByName("MapParallax");
const fogClass = classByName("FogOfWar");
const procgenClass = classByName("Map: Procedural generation rules");

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

const LOOT_HEADER_KEYS = new Set(["id", "name", "description", "status_loot", "loot"]);
const LOOT_KEYS = names(lootClass, "loot");
const QUEST_HEADER_KEYS = names(questClass, "");
const QUEST_KEYS = names(questClass, "quest");
const EFFECT_KEYS = names(effectClass, "effect");
const ITEM_TYPE_SETTINGS = names(itemTypeClass, "settings");
const ITEM_TYPE_KEYS = names(itemTypeClass, "type");
const ITEM_SET_KEYS = names(itemSetClass, "");
const CUTSCENE_HEADER_KEYS = names(cutsceneClass, "");
const CUTSCENE_SCENE_KEYS = names(cutsceneClass, "scene");
const CUTSCENE_VSCROLL_KEYS = names(cutsceneClass, "vscroll");
const PARALLAX_KEYS = names(parallaxClass, "layer");
const FOG_HEADER_KEYS = names(fogClass, "header");
const FOG_BITS_KEYS = names(fogClass, "bits");
const FOG_TILES_KEYS = names(fogClass, "tiles");
const FOG_MASK_KEYS = names(fogClass, "mask");
const PROCGEN_SETTINGS_KEYS = names(procgenClass, "settings");
const PROCGEN_CHUNK_KEYS = names(procgenClass, "chunks");

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
    if (section === "type") return ITEM_TYPE_KEYS;
    if (section === "set") return ITEM_SET_KEYS;
    return null;
  }
  if (category === "item_types") {
    if (section === "settings") return ITEM_TYPE_SETTINGS;
    if (section === "type") return ITEM_TYPE_KEYS;
    return null;
  }
  if (category === "item_sets") return ITEM_SET_KEYS;
  if (category === "loot") {
    if (section === "loot") return LOOT_KEYS;
    if (section === "root" || section === "" || section === "header") return LOOT_HEADER_KEYS;
    return null;
  }
  if (category === "quests") {
    if (section === "quest") return QUEST_KEYS;
    if (section === "root" || section === "" || section === "header") return QUEST_HEADER_KEYS;
    return null;
  }
  if (category === "effects") {
    if (section === "effect" || section === "root" || section === "") return EFFECT_KEYS;
    return null;
  }
  if (category === "cutscenes") {
    if (section === "scene") return CUTSCENE_SCENE_KEYS;
    if (section === "vscroll") return CUTSCENE_VSCROLL_KEYS;
    if (section === "root" || section === "" || section === "header") return CUTSCENE_HEADER_KEYS;
    return null;
  }
  if (category === "parallax") return PARALLAX_KEYS;
  if (category === "fog") {
    if (section === "header") return FOG_HEADER_KEYS;
    if (section === "bits") return FOG_BITS_KEYS;
    if (section === "tiles") return FOG_TILES_KEYS;
    if (section === "mask") return FOG_MASK_KEYS;
    return null;
  }
  if (category === "procgen") {
    if (section === "settings") return PROCGEN_SETTINGS_KEYS;
    if (section === "chunks") return PROCGEN_CHUNK_KEYS;
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
  if (category === "effects") return new Set(["effect", "root", ""]);
  if (category === "loot") return new Set(["loot", "root", "header", ""]);
  if (category === "quests") return new Set(["quest", "root", "header", ""]);
  if (category === "item_types") return new Set(["settings", "type", "root", ""]);
  if (category === "item_sets") return new Set(["root", ""]);
  if (category === "cutscenes") return new Set(["scene", "vscroll", "root", "header", ""]);
  if (category === "parallax") return new Set(["layer", "root", ""]);
  if (category === "fog") return new Set(["header", "bits", "tiles", "mask"]);
  if (category === "procgen") return new Set(["settings", "chunks"]);
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
