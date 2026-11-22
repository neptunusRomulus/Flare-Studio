// Event instance -> Flare instance keys. Split out of EventDialog.tsx (2026-11-22) so the mapping can be
// tested without mounting the dialog. Pure: no React, no IPC.
//
// The keys written here are the instance half of an event. The action half lives in the script file
// (see `eventScripts.ts`); the two must never mix — see `docs/features/event-editor.md`.
import { ACTIVATION_TO_FLARE, type EventData } from '@/components/events/eventDialogModel';
import { eventExtraPropsFrom, type EventExtraRow } from '@/editor/eventExtraProperties';

export type EventInstanceProps = Record<string, string | string[]>;

/** Builds the `[event]` instance keys for the map file from the dialog state. */
export function buildEventInstanceProps(eventData: EventData, extraRows: EventExtraRow[]): EventInstanceProps {
  const { coordinates, size, hotspot } = eventData.positioning;
  const flareActivate = ACTIVATION_TO_FLARE[eventData.timing.activeActivation || ''] || '';
  const props: EventInstanceProps = {};

  if (flareActivate) props.activate = flareActivate;
  const placed = coordinates.x >= 0 && coordinates.y >= 0;
  if (placed && ['Trigger', 'Leave'].includes(eventData.timing.activeActivation || '')) {
    props.location = `${coordinates.x},${coordinates.y},${size.width},${size.height}`;
  }
  if (placed && ['Interact', 'Trigger'].includes(eventData.timing.activeActivation || '')) {
    props.hotspot = `${hotspot.x},${hotspot.y},${hotspot.width},${hotspot.height}`;
  }
  if (eventData.timing.cooldown > 0) props.cooldown = `${eventData.timing.cooldown}ms`;
  if (eventData.timing.delay > 0) props.delay = `${eventData.timing.delay}ms`;
  const statusValues = eventData.requirements.status
    .map(status => status.trim())
    .filter(Boolean);
  if (statusValues.length === 1) {
    props.requires_status = statusValues[0];
  } else if (statusValues.length > 1) {
    props.requires_status = statusValues;
  }
  if (eventData.requirements.minLevel > 0) props.requires_level = String(eventData.requirements.minLevel);

  const requiresItemValues = eventData.requirements.itemRequirements
    .filter(req => req.type === 'requires_item' && req.itemId.trim())
    .map(req => `${req.itemId.trim()}:${req.itemQuantity}`);
  const requiresNotItemValues = eventData.requirements.itemRequirements
    .filter(req => req.type === 'requires_not_item' && req.itemId.trim())
    .map(req => `${req.itemId.trim()}:${req.itemQuantity}`);

  if (requiresItemValues.length === 1) props.requires_item = requiresItemValues[0];
  else if (requiresItemValues.length > 1) props.requires_item = requiresItemValues;

  if (requiresNotItemValues.length === 1) props.requires_not_item = requiresNotItemValues[0];
  else if (requiresNotItemValues.length > 1) props.requires_not_item = requiresNotItemValues;

  if (eventData.requirements.currency > 0) props.requires_currency = String(eventData.requirements.currency);
  if (eventData.rewards.message.trim()) props.msg = eventData.rewards.message.trim();
  if (eventData.rewards.expReward > 0) props.reward_xp = String(eventData.rewards.expReward);
  if (eventData.rewards.rewardCurrency > 0) props.reward_currency = String(eventData.rewards.rewardCurrency);
  if (eventData.rewards.removeCurrency > 0) props.remove_currency = String(eventData.rewards.removeCurrency);
  if (eventData.rewards.rewardItemId.trim()) {
    props.reward_item = `${eventData.rewards.rewardItemId.trim()}:${eventData.rewards.rewardItemQuantity}`;
  }
  if (eventData.rewards.removeItemId.trim()) {
    props.remove_item = `${eventData.rewards.removeItemId.trim()}:${eventData.rewards.removeItemQuantity}`;
  }
  if (eventData.rewards.lootGroup.trim()) {
    props.loot = eventData.rewards.lootGroup.trim();
  }
  if (eventData.rewards.rewardLootGroup.trim()) {
    props.reward_loot = eventData.rewards.rewardLootGroup.trim();
    props.reward_loot_count = `${eventData.rewards.rewardLootCountMin},${eventData.rewards.rewardLootCountMax}`;
  }
  if (eventData.rewards.enemySpawn.trim()) props.spawn = eventData.rewards.enemySpawn.trim();
  if (eventData.rewards.teleportMap.trim()) {
    let mapFile = eventData.rewards.teleportMap.trim();
    if (!mapFile.startsWith('maps/')) mapFile = `maps/${mapFile}`;
    if (!mapFile.endsWith('.txt')) mapFile = `${mapFile}.txt`;
    props.intermap = `${mapFile},${eventData.rewards.teleportX},${eventData.rewards.teleportY}`;
  }
  if (eventData.rewards.sound.trim()) props.soundfx = eventData.rewards.sound.trim();
  if (eventData.engine.chance < 100) props.chance_exec = String(eventData.engine.chance);
  if (eventData.engine.autoSave) props.save_game = 'true';
  if (eventData.engine.script.trim()) props.script = eventData.engine.script.trim();
  if (eventData.description.trim()) props._description = eventData.description.trim();

  // Power & spell effects
  if (eventData.rewards.power.trim()) props.power = eventData.rewards.power.trim();
  if (eventData.rewards.powerPath.trim()) props.power_path = eventData.rewards.powerPath.trim();
  if (eventData.rewards.powerDamage !== undefined && eventData.rewards.powerDamage > 0) props.power_damage = String(eventData.rewards.powerDamage);
  if (eventData.rewards.powerStats.trim()) props.power_stats = eventData.rewards.powerStats.trim();
  if (eventData.rewards.powerLevel.trim()) props.power_level = eventData.rewards.powerLevel.trim();

  // Map modification. mapmod_toggle is "layer,x,y,tileA,tileB", never the boolean true.
  if (eventData.rewards.mapmod.trim()) props.mapmod = eventData.rewards.mapmod.trim();
  if (eventData.rewards.mapmodToggle.trim() && eventData.rewards.mapmodToggle.trim().toLowerCase() !== 'true') {
    props.mapmod_toggle = eventData.rewards.mapmodToggle.trim();
  }
  if (eventData.rewards.requiresTile.trim()) props.requires_tile = eventData.rewards.requiresTile.trim();
  if (eventData.rewards.requiresNotTile.trim()) props.requires_not_tile = eventData.rewards.requiresNotTile.trim();
  if (eventData.rewards.spawnLevel.trim()) props.spawn_level = eventData.rewards.spawnLevel.trim();
  if (eventData.rewards.intermapId.trim()) props.intermap_id = eventData.rewards.intermapId.trim();
  if (eventData.rewards.procgenFilename.trim()) props.procgen_filename = eventData.rewards.procgenFilename.trim();
  if (eventData.rewards.procgenLink.trim()) props.procgen_link = eventData.rewards.procgenLink.trim();
  if (eventData.rewards.procgenDoorLevel.trim()) props.procgen_door_level = eventData.rewards.procgenDoorLevel.trim();

  // Restore
  if (eventData.rewards.restore.trim()) props.restore = eventData.rewards.restore.trim();

  // NPC / Music / Book
  if (eventData.rewards.npc.trim()) props.npc = eventData.rewards.npc.trim();
  if (eventData.rewards.music.trim()) props.music = eventData.rewards.music.trim();
  if (eventData.rewards.book.trim()) props.book = eventData.rewards.book.trim();

  // Advanced
  if (eventData.rewards.respec) props.respec = 'true';
  if (eventData.rewards.showOnMinimap) props.show_on_minimap = 'true';
  if (eventData.rewards.parallaxLayers.trim()) props.parallax_layers = eventData.rewards.parallaxLayers.trim();
  if (eventData.rewards.randomStatus.trim()) props.random_status = eventData.rewards.randomStatus.trim();

  Object.assign(props, eventExtraPropsFrom(extraRows));

  return props;
}
