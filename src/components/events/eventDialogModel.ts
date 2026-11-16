import React from 'react';
import {
  MapPinPlus,
  MousePointerClick,
  MapPinMinus,
  LogIn,
  LogOut,
  SquareCheckBig,
  Repeat2,
} from 'lucide-react';

export type EventActivation = 'Trigger' | 'Interact' | 'Load' | 'Leave' | 'MapExit' | 'MapClear' | 'Loop';

export type EventItemRequirement = {
  id: string;
  type: 'requires_item' | 'requires_not_item';
  itemId: string;
  itemQuantity: number;
};

export type EventData = {
  name: string;
  description: string;
  positioning: {
    mapName: string;
    coordinates: { x: number; y: number };
    size: { width: number; height: number };
    hotspot: { x: number; y: number; width: number; height: number };
  };
  timing: {
    activeActivation: EventActivation | null;
    cooldown: number;
    delay: number;
  };
  requirements: {
    status: string[];
    minLevel: number;
    itemRequirements: EventItemRequirement[];
    currency: number;
  };
  rewards: {
    message: string;
    expReward: number;
    rewardCurrency: number;
    removeCurrency: number;
    rewardItemId: string;
    rewardItemQuantity: number;
    removeItemId: string;
    removeItemQuantity: number;
    lootGroup: string;
    rewardLootGroup: string;
    rewardLootCountMin: number;
    rewardLootCountMax: number;
    enemySpawn: string;
    teleportMap: string;
    teleportX: number;
    teleportY: number;
    sound: string;
    // NEW: Power & spell effects
    power: string;
    powerPath: string;
    powerDamage: number;
    powerStats: string;
    powerLevel: string;
    // NEW: Map modification
    mapmod: string;
    mapmodToggle: string;
    requiresTile: string;
    requiresNotTile: string;
    spawnLevel: string;
    intermapId: string;
    procgenFilename: string;
    procgenLink: string;
    procgenDoorLevel: string;
    // NEW: Restore
    restore: string;
    // NEW: NPC / Music / Book
    npc: string;
    music: string;
    book: string;
    // NEW: Advanced
    respec: boolean;
    showOnMinimap: boolean;
    parallaxLayers: string;
    randomStatus: string;
  };
  engine: {
    chance: number;
    autoSave: boolean;
    script: string;
  };
};

export type EventSectionKey = 'eventInfo' | 'positioning' | 'requirements' | 'rewards' | 'advancedEffects' | 'engine';

/** Props every collapsible section of the event dialog shares. */
export type EventSectionProps = {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  expandedSections: Record<EventSectionKey, boolean>;
  toggleSection: (_section: EventSectionKey) => void;
};

/** One selectable item / loot group in the dialog's dropdowns. */
export type EventItemOption = { id: number | string; name?: string; fileName?: string };

export const ACTIVATION_OPTIONS: EventActivation[] = ['Interact', 'Trigger', 'Leave', 'Load', 'MapExit', 'MapClear', 'Loop'];

export const ACTIVATION_CONFIG: Record<EventActivation, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; tooltip: string; label: string }> = {
  Interact: {
    icon: MousePointerClick,
    tooltip: 'Interact - Activated specifically when the player interacts with the hotspot',
    label: 'Interact',
  },
  Trigger: {
    icon: MapPinPlus,
    tooltip: 'Trigger - Activated when the player stands in the event area or interacts with a defined hotspot',
    label: 'Trigger',
  },
  Leave: {
    icon: MapPinMinus,
    tooltip: 'Leave - Activated as the player leaves an event spot they were previously inside',
    label: 'Leave',
  },
  Load: {
    icon: LogIn,
    tooltip: 'Load - Activated as the player enters a map',
    label: 'Load',
  },
  MapExit: {
    icon: LogOut,
    tooltip: 'Map Exit - Activated as the player leaves the map',
    label: 'Map Exit',
  },
  MapClear: {
    icon: SquareCheckBig,
    tooltip: 'Map Clear - Activated when all enemies on a map have been defeated',
    label: 'Map Clear',
  },
  Loop: {
    icon: Repeat2,
    tooltip: 'Loop - Activated constantly, every frame',
    label: 'Loop',
  },
};

/** Reverse map: Flare activate values -> UI activation names. */
export const FLARE_TO_ACTIVATION: Record<string, EventActivation> = {
  on_interact: 'Interact',
  on_trigger: 'Trigger',
  on_leave: 'Leave',
  on_load: 'Load',
  on_mapexit: 'MapExit',
  on_clear: 'MapClear',
  static: 'Loop',
};

export const ACTIVATION_TO_FLARE: Record<string, string> = {
  Interact: 'on_interact',
  Trigger: 'on_trigger',
  Leave: 'on_leave',
  Load: 'on_load',
  MapExit: 'on_mapexit',
  MapClear: 'on_clear',
  Loop: 'static',
};

/** Keep an event coordinate inside the map. */
export function getSafeCoord(val: number, max: number): number {
  if (isNaN(val)) return 0;
  return Math.max(0, Math.min(max - 1, val));
}

/** Keep an event area size inside the map, starting at `pos`. */
export function getSafeSize(val: number, pos: number, max: number): number {
  if (isNaN(val)) return 1;
  return Math.max(1, Math.min(max - pos, val));
}
