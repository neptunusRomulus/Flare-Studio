/**
 * Dialogue model shared by the dialogue chat and the quest/dialogue editors.
 */
export interface DialogueRequirement {
  id: string;
  type:
    | 'status' | 'not_status' | 'item' | 'not_item' | 'level' | 'not_level'
    | 'currency' | 'not_currency' | 'class' | 'not_class' | 'tile' | 'not_tile';
  value: string;
}

export interface DialogueLine {
  id: string;
  speaker: 'npc' | 'player';
  text: string;
  voice?: string;
  portrait?: string;
  /** Flare line key for NPC lines: him (default) or her */
  key?: 'her';
  /** Flare key of the per-line portrait: portrait_him/portrait_her (NPC side) or portrait_you (player side) */
  portraitKey?: 'portrait_him' | 'portrait_her' | 'portrait_you' | 'portrait';
  keepEmpty?: boolean;
}

export interface DialogueReward {
  id?: string;
  type: 'xp' | 'gold' | 'item' | 'remove_gold' | 'remove_item' | 'restore' | 'msg' | 'loot';
  value: string;
  quantity?: number;
}

export interface DialogueWorldEffect {
  id?: string;
  type:
    | 'set_status' | 'unset_status' | 'teleport' | 'spawn' | 'cutscene' | 'sound' | 'npc'
    | 'intramap' | 'music' | 'stash' | 'book' | 'respec' | 'save_game' | 'script' | 'visual_effect'
    | 'intermap_id' | 'intermap_random' | 'mapmod' | 'mapmod_toggle' | 'loot' | 'shakycam'
    | 'power' | 'power_path' | 'power_damage' | 'power_stats' | 'power_level'
    | 'spawn_level' | 'chance_exec'
    | 'random_status' | 'repeat' | 'tooltip' | 'show_on_minimap'
    | 'parallax_layers' | 'procgen_filename' | 'procgen_link' | 'procgen_door_level';
  value: string;
}

export interface DialogueTree {
  id: string;
  dialogueId: string;
  topic: string;
  group?: string;
  responseOnly?: boolean;
  responses: string[];
  requirements: DialogueRequirement[];
  dialogues: DialogueLine[];
  rewards: DialogueReward[];
  worldEffects: DialogueWorldEffect[];
  /** [dialog] keys Studio doesn't model (allow_movement, visual_effect, ...), in file order */
  passthrough?: Array<{ key: string; value: string }>;
  _reqExpanded?: boolean;
  _dlgExpanded?: boolean;
  _rewExpanded?: boolean;
  _wfExpanded?: boolean;
}
