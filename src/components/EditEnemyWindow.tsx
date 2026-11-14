import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sword, HelpCircle, X, Save, Plus, FolderOpen, Shield, Footprints, Swords, Feather } from 'lucide-react';
import NameField from '@/components/NameField';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import { statsFromStrength, strengthFromStats, strengthLabel, STRENGTH_TIERS, type StrengthTier } from '@/editor/enemyStrength';
import { behaviorPresetFromValues, valuesFromBehaviorPreset, BEHAVIOR_PRESET_IDS, BEHAVIOR_PRESET_META, type BehaviorPresetId } from '@/editor/enemyBehaviorPresets';
import { dropFromLootRows, summarizeEnemy } from '@/editor/enemySummary';
import type { MapObject } from '@/types';
import { applyEnemyFileUpdates, includesFromEnemyText } from '@/adapters/flare/flareAdapter.cjs';
import { propertyRecord, propertyText } from '@/editor/propertyText';
import { ENEMY_STAT_IDS, enemyFilePath, formatStatProperty, statsFromProperties } from '@/utils/enemyFileHydrate';
import { canonicalIdentity, displayIdentity } from '@/editor/identityRename';
import { renameIfNameChanged, uniqueSlugFromName } from '@/editor/identityFromName';
import { loadProjectTextMap } from '@/editor/projectFiles';
import { useToast } from '@/hooks/use-toast';
import useItems from '@/hooks/useItems';
import { normalizeItemsForState } from '@/utils/items';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import ResizeHandle from '@/components/ResizeHandle';
import LootRowsEditor from '@/components/LootRowsEditor';
import {
  formatLootProperty,
  formatLootRow,
  parseLootCount,
  parseLootProperty,
  parseLootTableText,
  type LootRow,
} from '@/editor/lootChance';

interface EditEnemyWindowProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  enemy?: MapObject | null;
  onSave?: (obj: MapObject) => void;
  projectPath?: string;
  inline?: boolean;
  showCloseConfirm?: boolean;
  onCloseDecision?: (decision: 'save' | 'discard' | 'cancel') => void;
}

const ENEMY_FILE_UNSUPPORTED_KEYS = ['gold', 'wander_radius', 'waypoints', 'script'];

const ENEMY_FORM_KEYS: string[] = [
  'tilesetPath', 'portraitPath', 'gfx', 'render_layers', 'animation_slots', 'animations', 'suppress_hp',
  'attack', 'defense', 'speed', 'xp', 'gold',
  'melee', 'ranged', 'caster', 'summoner', 'boss', 'passive', 'stationary', 'humanoid', 'lifeform',
  'powers', 'passive_powers', 'cooldown', 'cooldown_hit', 'cooldown_los', 'power_filter', 'script',
  'loot', 'loot_count', 'first_defeat_loot', 'quest_loot', 'defeat_status', 'convert_status',
  'categories', 'rarity', 'include',
  'sfx_attack', 'sfx_hit', 'sfx_die', 'sfx_critdie', 'sfx_block', 'sfx_levelup', 'sfx_lowhp',
  'melee_range', 'combat_style', 'threat_range', 'flee_range', 'flee_duration', 'flee_cooldown',
  'chance_pursue', 'chance_flee', 'turn_delay', 'wander_radius', 'waypoints', 'waypoint_pause',
  'facing', 'flying', 'intangible', 'abilities',
  'stat', 'stat_per_level', 'stat_per_primary', 'xp_scaling', 'vulnerable',
  'corpse_has_collision', 'corpse_has_timeout', 'corpse_render_below', 'resting_hp_regen_time',
  ...ENEMY_STAT_IDS,
];


function includeListFromProp(value: string): string[] {
  const list = String(value || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [''];
}

function enemySourceRel(enemy?: MapObject | null): string {
  if (!enemy) return '';
  const props = enemy.properties || {};
  const explicit = propertyText(props.enemyFilename) || propertyText(props.sourcePath);
  if (!explicit && !String(enemy.name || '').trim()) return '';
  // Same path the save uses: enemies/<name>.txt when no file was recorded yet.
  return enemyFilePath('', enemy).replace(/^\/+/, '');
}



const TIER_COLOR = { weak: 'text-muted-foreground', balanced: 'text-sky-500', strong: 'text-orange-500' } as const;

const BEHAVIOR_ICONS = {
  guard: Shield,
  wanders: Footprints,
  aggressive: Swords,
  coward: Feather,
} as const;

const enemyPropertyTooltips: Record<string, string> = {
  name: 'Name',
  level: 'Level',
  count: 'Number of enemies spawned together in a group.',
  include: 'INCLUDE. Path to another enemy file to inherit properties from. e.g. enemies/base/goblin.txt',
  rarity: 'Enemy rarity used for loot and display purposes.',
  humanoid: 'This creature gives human traits when transformed into, such as the ability to talk with NPCs.',
  lifeform: 'Determines whether this entity appears as living, such as displaying Dead vs Destroyed when HP reaches 0.',
  gfx: 'Deprecated animation template. The engine rewrites this to Animations on save.',
  animations: 'Filename of an animation definition.',
  tilesetPath: 'Internal tileset source path for enemy rendering.',
  portrait: 'Portrait image shown in the header card.',
  renderLayers: 'Render layers used by this enemy animation and display.',
  animationSlots: 'Animation slots assign animations to defined render layers.',
  sfxAttack: 'Sound effect played when the enemy attacks.',
  sfxHit: 'Sound effect played when the enemy is hit.',
  sfxDie: 'Sound effect played when the enemy dies.',
  sfxCritDie: 'Sound effect played when the enemy dies from a critical hit.',
  sfxBlock: 'Sound effect played when the enemy blocks.',
  sfxLevelup: 'Sound effect played when the enemy levels up.',
  sfxLowhp: 'Sound effect played when the enemy is low on health.',
  suppressHp: 'Hide the health bar above this enemy.',
  corpseHasCollision: 'Dead body still blocks movement.',
  corpseHasTimeout: 'Dead body disappears after a while.',
  corpseRenderBelow: 'Draw the corpse under other entities.',
  hp: 'Maximum health points for this enemy.',
  mp: 'Maximum magic points for this enemy.',
  speed: 'Movement or action speed for this enemy.',
  accuracy: 'Chance to hit with attacks.',
  avoidance: 'Chance to dodge incoming attacks.',
  crit: 'Chance to land a critical hit.',
  poise: 'Ability to resist stagger or interrupt effects.',
  absorbMin: 'Minimum absorbed damage on each hit.',
  absorbMax: 'Maximum absorbed damage on each hit.',
  stealth: 'Stealth rating, affecting detection and surprise.',
  reflectChance: 'Chance to reflect a portion of incoming damage.',
  returnDamage: 'Damage returned to the attacker.',
  hpRegen: 'Health recovered over time.',
  mpRegen: 'Mana recovered over time.',
  hpSteal: 'Health stolen on hit.',
  mpSteal: 'Mana stolen on hit.',
  xpGain: 'Bonus to XP gained.',
  dmgMeleeMin: 'Minimum melee damage dealt by this enemy.',
  dmgMeleeMax: 'Maximum melee damage dealt by this enemy.',
  meleeRange: 'Effective melee attack range.',
  dmgRangedMin: 'Minimum ranged damage dealt by this enemy.',
  dmgRangedMax: 'Maximum ranged damage dealt by this enemy.',
  dmgMentMin: 'Minimum mental damage dealt by this enemy.',
  dmgMentMax: 'Maximum mental damage dealt by this enemy.',
  cooldown: 'Time between attacks or actions.',
  cooldownHit: 'Delay before the enemy can act again after being hit.',
  cooldownLos: 'Extra cooldown when the enemy loses sight of its target.',
  restingHpRegenTime: 'Delay before out-of-combat health regen starts.',
  powersList: 'Raw power list. Editing a power row clears this so the rows are saved instead.',
  power: 'Powers this enemy can use.',
  passivePowers: 'A list of passive powers this creature has.',
  powerFilter: 'Limit which powers this enemy can use.',
  attack: 'Studio-only attack value. The engine uses melee or ranged damage instead.',
  defense: 'Studio-only defense value. The engine uses absorb instead.',
  combatStyle: 'How the creature enters combat. Default engages when in range, aggressive always fights, passive waits until attacked.',
  threatRange: 'The first value is the engage radius; the second optional value is the stop distance, defaulting to double the first.',
  fleeRange: 'The radius at which the creature begins fleeing. Defaults to half of the threat range.',
  fleeDuration: 'How long the creature flees.',
  fleeCooldown: 'Wait time before the creature can flee again.',
  turnDelay: 'Duration it takes for this creature to turn and face its target in ms or s.',
  wanderRadius: 'Map spawn only in Flare 1.15; not saved to the enemy file.',
  waypoints: 'Map spawn only in Flare 1.15; not saved to the enemy file.',
  waypointPause: 'Pause at each waypoint.',
  chancePursue: 'Percentage chance the creature will chase its target.',
  chanceFlee: 'Percentage chance the creature will run away from its target.',
  isFacing: 'Creature can turn to face its target.',
  isFlying: 'Creature can move over gaps and water.',
  isIntangible: 'Creature can move through walls.',
  xp: 'XP awarded upon death.',
  gold: 'Not read by Flare 1.15; not saved to the enemy file. Use loot with currency instead.',
  itemFind: 'Chance to find items on this enemy.',
  currencyFind: 'Chance to find currency on this enemy.',
  loot: 'Possible loot that can be dropped on death.',
  lootCount: 'Minimum and optional maximum number of loot drops from this creature.',
  firstDefeatLoot: 'Item dropped the first time this creature is defeated. Requires defeat status.',
  defeatStatus: 'Campaign status set when this enemy dies.',
  questLoot: 'Item dropped when a campaign status condition is met.',
  convertStatus: 'Campaign status applied if this enemy is converted.',
  script: 'Not an enemy file key in Flare 1.15; kept on the object only.',
  vulnerable: 'Damage types or elements this enemy is vulnerable to.',
  statPerLevel: 'Stats gained per level.',
  statPerPrimary: 'Stats gained per primary stat.',
  xpScaling: 'How awarded XP scales with level.',
  resistDamageOverTime: 'Resistance to damage over time.',
  resistSlow: 'Resistance to slow.',
  resistStun: 'Resistance to stun.',
  resistKnockback: 'Resistance to knockback.',
  resistStatDebuff: 'Resistance to stat debuffs.',
  resistDamageReflect: 'Resistance to reflected damage.',
  resistHpSteal: 'Resistance to health steal.',
  resistMpSteal: 'Resistance to mana steal.',
};

const LabelWithTooltip = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => (
  <label className={`text-xs text-muted-foreground flex items-center gap-1 ${className || ''}`}>
    {children}
    {enemyPropertyTooltips[field] ? (
      <Tooltip content={enemyPropertyTooltips[field]} side="top">
        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
      </Tooltip>
    ) : null}
  </label>
);

const MoreToggle = ({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: React.ReactNode }) => (
  <div className="space-y-2">
    <button type="button" className="text-[10px] text-muted-foreground underline underline-offset-2" onClick={onToggle}>
      {open ? 'Less' : 'More'}
    </button>
    {open ? children : null}
  </div>
);

const EditorSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h4 className="text-sm font-semibold">{title}</h4>
    {children}
  </section>
);

const Flag = ({ checked, onChange, label, tip }: { checked: boolean; onChange: (on: boolean) => void; label: string; tip?: string }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
    <span className="text-xs">{label}</span>
    {tip ? (
      <Tooltip content={tip} side="top">
        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
      </Tooltip>
    ) : null}
  </label>
);

export default function EditEnemyWindow({ open, onOpenChange, enemy, onSave, projectPath = '', inline = false, showCloseConfirm = false, onCloseDecision }: EditEnemyWindowProps) {
  const { toast } = useToast();
  const itemsHook = useItems({ currentProjectPath: projectPath || null, toast, normalizeItemsForState });
  const { itemsList = [], refreshItemsList } = itemsHook;
  // The window stays mounted, so reload items each time it opens; otherwise items made after the project loaded never show up in Loot.
  useEffect(() => {
    if (open && projectPath) void refreshItemsList(projectPath);
  }, [open, projectPath, refreshItemsList]);
  const lootItems = useMemo(() => itemsList.filter((item) => item.role !== 'loot_groups'), [itemsList]);

  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'edit_enemy', initialWidth: 820, initialHeight: 680, minWidth: 600, minHeight: 500 });

const [name, setName] = useState(() => enemy?.name || '');
  const [level, setLevel] = useState<number>(() => enemy?.level ?? 1);
  const [rarity, setRarity] = useState<'common'|'uncommon'|'rare'|'unique'>(() => (enemy?.properties?.rarity as 'common'|'uncommon'|'rare'|'unique') || 'common');
  const [count, setCount] = useState<number>(() => enemy?.number ?? 1);
  const [category, setCategory] = useState(() => enemy?.category || '');
  const [includes, setIncludes] = useState<string[]>(() => includeListFromProp(propertyText(enemy?.properties?.include)));
  const [isHumanoid, setIsHumanoid] = useState<boolean>(() => (enemy?.properties?.humanoid === 'true'));
  const [isLifeform, setIsLifeform] = useState<boolean>(() => (enemy?.properties?.lifeform === 'false' ? false : true));
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [presets, setPresets] = useState<string[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);

  useEffect(() => {
    const fetchPresets = async () => {
      if (open && projectPath && window.electronAPI?.listEnemies) {
        setIsLoadingPresets(true);
        try {
          const list = await window.electronAPI.listEnemies(projectPath);
          setPresets(list);
        } catch (e) {
          console.error('Failed to fetch presets:', e);
        } finally {
          setIsLoadingPresets(false);
        }
      }
    };
    fetchPresets();
  }, [open, projectPath]);

  useEffect(() => {
    if (!open) return;
    const rel = enemySourceRel(enemy);
    if (!rel || !projectPath || !window.electronAPI?.readFile) return;
    let cancelled = false;
    const path = `${projectPath.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;
    window.electronAPI.readFile(path).then((text) => {
      if (cancelled || !text) return;
      const fromFile = includesFromEnemyText(text);
      if (fromFile.length) setIncludes(fromFile);
    }).catch(() => { /* keep property includes */ });
    return () => { cancelled = true; };
  }, [open, projectPath, enemy]);


  const handleSaveAsPreset = async () => {
    if (!projectPath || !window.electronAPI?.saveEnemyPreset) return;
    if (!name.trim()) return;

    const previousPath = propertyText(enemy?.properties?.enemyFilename) || propertyText(enemy?.properties?.sourcePath);
    const files = await loadProjectTextMap(projectPath);
    let allocated = previousPath
      ? uniqueSlugFromName(files, 'enemy', name, previousPath)
      : uniqueSlugFromName(files, 'enemy', name);
    if (previousPath) {
      const renamed = await renameIfNameChanged(projectPath, 'enemy', previousPath, name);
      if (renamed.ok) allocated = displayIdentity('enemy', renamed.nextId);
    }
    const filename = `${allocated.split('/').pop()}.txt`;

    const includePaths = includes.map((s) => s.trim()).filter(Boolean);

    const lines: string[] = [];
    lines.push(`name=${name}`);
    
    if (category) {
      // Categories should be comma separated lists.
      lines.push(`categories=${category}`);
    }

    if (level !== undefined && level !== null) lines.push(`level=${level}`);
    if (rarity) lines.push(`rarity=${rarity}`);
    if (xp) lines.push(`xp=${xp}`);
    
    // Core Stats (Standard key=value)
    if (speed) lines.push(`speed=${speed}`);
    if (cooldown) lines.push(`cooldown=${cooldown}`);
    if (turnDelay) lines.push(`turn_delay=${turnDelay}`);
    if (waypointPause) lines.push(`waypoint_pause=${waypointPause}`);
    
    // Core Stats (stat=id,value)
    if (hp) lines.push(`stat=hp,${hp}`);
    if (mp) lines.push(`stat=mp,${mp}`);
    if (accuracy) lines.push(`stat=accuracy,${accuracy}`);
    if (avoidance) lines.push(`stat=avoidance,${avoidance}`);
    if (crit) lines.push(`stat=crit,${crit}`);
    if (poise) lines.push(`stat=poise,${poise}`);
    if (stealth) lines.push(`stat=stealth,${stealth}`);
    if (absorbMin) lines.push(`stat=absorb_min,${absorbMin}`);
    if (absorbMax) lines.push(`stat=absorb_max,${absorbMax}`);
    
    // Damage stats
    if (dmgMeleeMin) lines.push(`stat=dmg_melee_min,${dmgMeleeMin}`);
    if (dmgMeleeMax) lines.push(`stat=dmg_melee_max,${dmgMeleeMax}`);
    if (dmgRangedMin) lines.push(`stat=dmg_ranged_min,${dmgRangedMin}`);
    if (dmgRangedMax) lines.push(`stat=dmg_ranged_max,${dmgRangedMax}`);

    // Utility stats
    if (reflectChance) lines.push(`stat=reflect_chance,${reflectChance}`);
    if (returnDamage) lines.push(`stat=return_damage,${returnDamage}`);
    if (currencyFind) lines.push(`stat=currency_find,${currencyFind}`);
    if (itemFind) lines.push(`stat=item_find,${itemFind}`);

    // Ranges & Behavior
    if (meleeRange) lines.push(`melee_range=${meleeRange}`);
    if (threatRange) lines.push(`threat_range=${threatRange}`);
    if (fleeRange) lines.push(`flee_range=${fleeRange}`);
    if (fleeDuration) lines.push(`flee_duration=${fleeDuration}`);
    if (fleeCooldown) lines.push(`flee_cooldown=${fleeCooldown}`);
    if (chancePursue) lines.push(`chance_pursue=${chancePursue}`);
    if (chanceFlee) lines.push(`chance_flee=${chanceFlee}`);
    if (combatStyle) lines.push(`combat_style=${combatStyle}`);

    // Flags
    if (isFacing) lines.push(`facing=true`);
    if (isFlying) lines.push(`flying=true`);
    if (isIntangible) lines.push(`intangible=true`);
    if (isHumanoid) lines.push(`humanoid=true`);
    if (!isLifeform) lines.push(`lifeform=false`);
    
    // Visuals & Audio
    if (gfx) lines.push(`gfx=${gfx}`);
    if (animations) lines.push(`animations=${animations}`);
    if (renderLayers) lines.push(`render_layers=${renderLayers}`);
    if (animationSlots) lines.push(`animation_slots=${animationSlots}`);
    
    // Powers
    // Flare formats power as: power=state,power_id,chance
    if (powers && Array.isArray(powers)) {
       powers.forEach((p) => {
         if (p.id) lines.push(`power=${p.state || 'melee'},${p.id},${p.chance || 100}`);
       });
    }

    if (passivePowers) lines.push(`passive_powers=${passivePowers}`);
    if (cooldownHit) lines.push(`cooldown_hit=${cooldownHit}`);
    if (powerFilter) lines.push(`power_filter=${powerFilter}`);

    // Loot
    const savedLootCount = buildLootCount();
    if (savedLootCount) lines.push(`loot_count=${savedLootCount}`);
    if (firstDefeatLoot) lines.push(`first_defeat_loot=${firstDefeatLoot}`);
    if (questLoot) lines.push(`quest_loot=${questLoot}`);
    if (defeatStatus) lines.push(`defeat_status=${defeatStatus}`);

    // Flare 1.15 StatBlock does not read these keys; wander_radius/waypoints belong on the map spawn
    const notSaved = new Set<string>();
    if (gold) notSaved.add('gold');
    if (wanderRadius) notSaved.add('wander_radius');
    if (waypoints) notSaved.add('waypoints');
    if (script) notSaved.add('script');
    const customLines = (customPropsRaw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      .filter((line) => {
        const key = line.split('=')[0].trim();
        if (ENEMY_FILE_UNSUPPORTED_KEYS.includes(key)) { notSaved.add(key); return false; }
        return true;
      });
    lines.push(...customLines);

    let source = '';
    const raw = (enemy as MapObject & { _raw?: string } | null | undefined)?._raw;
    if (typeof raw === 'string' && raw) source = raw;
    else {
      const rel = enemySourceRel(enemy);
      if (rel && window.electronAPI?.readFile) {
        const path = `${projectPath.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;
        source = (await window.electronAPI.readFile(path)) || '';
      }
    }

    const uniqueFields: Record<string, string> = {};
    if (name) uniqueFields.name = name;
    if (category) uniqueFields.categories = category;
    if (level !== undefined && level !== null) uniqueFields.level = String(level);
    if (rarity) uniqueFields.rarity = rarity;
    if (xp) uniqueFields.xp = xp;
    if (speed) uniqueFields.speed = speed;
    if (cooldown) uniqueFields.cooldown = cooldown;
    if (turnDelay) uniqueFields.turn_delay = turnDelay;
    if (waypointPause) uniqueFields.waypoint_pause = waypointPause;
    if (meleeRange) uniqueFields.melee_range = meleeRange;
    if (threatRange) uniqueFields.threat_range = threatRange;
    if (fleeRange) uniqueFields.flee_range = fleeRange;
    if (fleeDuration) uniqueFields.flee_duration = fleeDuration;
    if (fleeCooldown) uniqueFields.flee_cooldown = fleeCooldown;
    if (chancePursue) uniqueFields.chance_pursue = chancePursue;
    if (chanceFlee) uniqueFields.chance_flee = chanceFlee;
    if (combatStyle) uniqueFields.combat_style = combatStyle;
    if (isFacing) uniqueFields.facing = 'true';
    if (isFlying) uniqueFields.flying = 'true';
    if (isIntangible) uniqueFields.intangible = 'true';
    if (isHumanoid) uniqueFields.humanoid = 'true';
    if (!isLifeform) uniqueFields.lifeform = 'false';
    if (gfx) uniqueFields.gfx = gfx;
    if (animations) uniqueFields.animations = animations;
    if (renderLayers) uniqueFields.render_layers = renderLayers;
    if (animationSlots) uniqueFields.animation_slots = animationSlots;
    if (passivePowers) uniqueFields.passive_powers = passivePowers;
    if (cooldownHit) uniqueFields.cooldown_hit = cooldownHit;
    if (powerFilter) uniqueFields.power_filter = powerFilter;
    const presetLootCount = buildLootCount();
    if (presetLootCount) uniqueFields.loot_count = presetLootCount;
    if (firstDefeatLoot) uniqueFields.first_defeat_loot = firstDefeatLoot;
    if (questLoot) uniqueFields.quest_loot = questLoot;
    if (defeatStatus) uniqueFields.defeat_status = defeatStatus;

    const lootValues = lootRows.filter((row) => row.id.trim()).map((row) => formatLootRow(row));
    const presetStats: Record<string, string> = {
      hp, mp,
      hp_regen: hpRegen, mp_regen: mpRegen, accuracy, avoidance, crit, poise, stealth,
      absorb_min: absorbMin, absorb_max: absorbMax, xp_gain: xpGain,
      currency_find: currencyFind, item_find: itemFind,
      reflect_chance: reflectChance, return_damage: returnDamage,
      hp_steal: hpSteal, mp_steal: mpSteal,
      resist_damage_over_time: resistDamageOverTime, resist_slow: resistSlow,
      resist_stun: resistStun, resist_knockback: resistKnockback,
      resist_stat_debuff: resistStatDebuff, resist_damage_reflect: resistDamageReflect,
      dmg_melee_min: dmgMeleeMin, dmg_melee_max: dmgMeleeMax,
      dmg_ranged_min: dmgRangedMin, dmg_ranged_max: dmgRangedMax,
      dmg_ment_min: dmgMentMin, dmg_ment_max: dmgMentMax,
      resist_hp_steal: resistHpSteal, resist_mp_steal: resistMpSteal,
    };
    const presetStatText = formatStatProperty(
      { ...statsFromProperties(enemy?.properties as Record<string, unknown> | undefined), ...presetStats },
      (enemy?.properties as Record<string, unknown> | undefined)?.stat,
    );
    const listFields: Record<string, string[]> = {};
    if (formatLootProperty(lootRows) !== formatLootProperty(originalLoot) || !source.trim()) {
      listFields.loot = lootValues;
    }
    if (presetStatText || propertyText(enemy?.properties?.stat)) {
      listFields.stat = presetStatText ? presetStatText.split('\n') : [];
    }
    const { text: content, warnings } = source.trim()
      ? applyEnemyFileUpdates(source, { includes: includePaths, fields: uniqueFields, listFields })
      : applyEnemyFileUpdates('', {
          header: '# Enemy file generated by Flare Studio',
          includes: includePaths,
          lines,
          listFields,
        });
    for (const w of warnings) {
      for (const key of ENEMY_FILE_UNSUPPORTED_KEYS) {
        if (w.includes(key)) notSaved.add(key);
      }
    }

    try {
      const success = await window.electronAPI.saveEnemyPreset(projectPath, filename, content);
      if (success) {
        const list = await window.electronAPI.listEnemies(projectPath);
        setPresets(list);
        setIncludes([`enemies/${filename}`]);
        toast({
          title: 'Enemy file saved',
          description: `Enemy saved to enemies/${filename}`,
          variant: 'default',
        });
        if (notSaved.size > 0) {
          toast({
            title: 'Some fields were not saved',
            description: `${[...notSaved].join(', ')}: not enemy file keys in Flare 1.15. Set wander radius and waypoints on the map spawn.`,
            variant: 'destructive',
          });
        }
      }
    } catch (e) {
      console.error('Failed to save enemy file:', e);
    }
  };

  const selectedCategories = category.split(',').map(s => s.trim()).filter(Boolean);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setCategory(selectedCategories.filter(c => c !== cat).join(','));
    } else {
      setCategory([...selectedCategories, cat].join(','));
    }
  };

  const addCategory = () => {
    const trimmed = newCatInput.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setCategory([...selectedCategories, trimmed].join(','));
    }
    setNewCatInput('');
    setIsAddingCategory(false);
  };

  // Visual
  const [tilesetPath, setTilesetPath] = useState<string>(() => (enemy?.properties?.tilesetPath as string) || '');
  const [portraitPath, setPortraitPath] = useState<string>(() => (enemy?.properties?.portraitPath as string) || '');
  const [gfx, setGfx] = useState<string>(() => (enemy?.properties?.gfx as string) || '');
  const [renderLayers, setRenderLayers] = useState<string>(() => propertyText(enemy?.properties?.render_layers));
  const [animationSlots, setAnimationSlots] = useState<string>(() => propertyText(enemy?.properties?.animation_slots));
  const [suppressHp, setSuppressHp] = useState<boolean>(() => (enemy?.properties?.suppress_hp === 'true'));

  // Audio
  const [sfxAttack, setSfxAttack] = useState<string>(() => propertyText(enemy?.properties?.sfx_attack));
  const [sfxHit, setSfxHit] = useState<string>(() => propertyText(enemy?.properties?.sfx_hit));
  const [sfxDie, setSfxDie] = useState<string>(() => propertyText(enemy?.properties?.sfx_die));
  const [sfxCritDie, setSfxCritDie] = useState<string>(() => propertyText(enemy?.properties?.sfx_critdie));

  // Stats (values come from stat=id,value lines, not bare hp= keys)
  const loadedStats = statsFromProperties(enemy?.properties as Record<string, unknown> | undefined);
  const [hp, setHp] = useState<string>(() => loadedStats.hp || '');
  const [mp, setMp] = useState<string>(() => loadedStats.mp || '');
  const [attack, setAttack] = useState<string>(() => propertyText(enemy?.properties?.attack));
  const [defense, setDefense] = useState<string>(() => propertyText(enemy?.properties?.defense));
  const [speed, setSpeed] = useState<string>(() => propertyText(enemy?.properties?.speed));
  const [xp, setXp] = useState<string>(() => propertyText(enemy?.properties?.xp));
  const [gold, setGold] = useState<string>(() => propertyText(enemy?.properties?.gold));
  const [meleeRange, setMeleeRange] = useState<string>(() => propertyText(enemy?.properties?.melee_range));

  // Advanced
  const [statPerLevel, setStatPerLevel] = useState<string>(() => propertyText(enemy?.properties?.stat_per_level));
  const [xpScaling, setXpScaling] = useState<string>(() => propertyText(enemy?.properties?.xp_scaling));
  const [vulnerable, setVulnerable] = useState<string>(() => propertyText(enemy?.properties?.vulnerable));
  // More advanced stats (resists, regen, utility)
  const [resistDamageOverTime, setResistDamageOverTime] = useState<string>(() => loadedStats.resist_damage_over_time || '');
  const [resistSlow, setResistSlow] = useState<string>(() => loadedStats.resist_slow || '');
  const [resistStun, setResistStun] = useState<string>(() => loadedStats.resist_stun || '');
  const [resistKnockback, setResistKnockback] = useState<string>(() => loadedStats.resist_knockback || '');
  const [resistStatDebuff, setResistStatDebuff] = useState<string>(() => loadedStats.resist_stat_debuff || '');
  const [resistDamageReflect, setResistDamageReflect] = useState<string>(() => loadedStats.resist_damage_reflect || '');
  const [xpGain, setXpGain] = useState<string>(() => loadedStats.xp_gain || '');
  const [hpRegen, setHpRegen] = useState<string>(() => loadedStats.hp_regen || '');
  const [mpRegen, setMpRegen] = useState<string>(() => loadedStats.mp_regen || '');
  const [hpSteal, setHpSteal] = useState<string>(() => loadedStats.hp_steal || '');
  const [mpSteal, setMpSteal] = useState<string>(() => loadedStats.mp_steal || '');
  const [accuracy, setAccuracy] = useState<string>(() => loadedStats.accuracy || '');
  const [avoidance, setAvoidance] = useState<string>(() => loadedStats.avoidance || '');
  const [crit, setCrit] = useState<string>(() => loadedStats.crit || '');
  const [absorbMin, setAbsorbMin] = useState<string>(() => loadedStats.absorb_min || '');
  const [absorbMax, setAbsorbMax] = useState<string>(() => loadedStats.absorb_max || '');
  const [poise, setPoise] = useState<string>(() => loadedStats.poise || '');
  const [reflectChance, setReflectChance] = useState<string>(() => loadedStats.reflect_chance || '');
  const [returnDamage, setReturnDamage] = useState<string>(() => loadedStats.return_damage || '');
  const [currencyFind, setCurrencyFind] = useState<string>(() => loadedStats.currency_find || '');
  const [itemFind, setItemFind] = useState<string>(() => loadedStats.item_find || '');
  const [stealth, setStealth] = useState<string>(() => loadedStats.stealth || '');

  // Combat & powers (dmg stats)
  const [dmgMeleeMin, setDmgMeleeMin] = useState<string>(() => loadedStats.dmg_melee_min || '');
  const [dmgMeleeMax, setDmgMeleeMax] = useState<string>(() => loadedStats.dmg_melee_max || '');
  const [dmgRangedMin, setDmgRangedMin] = useState<string>(() => loadedStats.dmg_ranged_min || '');
  const [dmgRangedMax, setDmgRangedMax] = useState<string>(() => loadedStats.dmg_ranged_max || '');
  const [animations, setAnimations] = useState<string>(() => propertyText(enemy?.properties?.animations));

  const [powers, setPowers] = useState<Array<{ state: string; id: string; chance: number }>>(() => {
    try {
      const p = propertyText(enemy?.properties?.powers);
      if (!p) return [];
      // If it's a string from old version, try to parse it or keep as is?
      // For Flare, powers can be multiple lines. In our MapObject properties,
      // we might have stored it as JSON or a raw string.
      return JSON.parse(p);
    } catch {
      return [];
    }
  });
  const [script, setScript] = useState<string>(() => propertyText(enemy?.properties?.script));

  // Loot

  // Behavior flags
  const [isMelee, setIsMelee] = useState<boolean>(() => (enemy?.properties?.melee === 'true'));
  const [isRanged, setIsRanged] = useState<boolean>(() => (enemy?.properties?.ranged === 'true'));
  const [isCaster, setIsCaster] = useState<boolean>(() => (enemy?.properties?.caster === 'true'));
  const [isSummoner, setIsSummoner] = useState<boolean>(() => (enemy?.properties?.summoner === 'true'));
  const [isBoss, setIsBoss] = useState<boolean>(() => (enemy?.properties?.boss === 'true'));
  const [isPassive, setIsPassive] = useState<boolean>(() => (enemy?.properties?.passive === 'true'));
  const [isStationary, setIsStationary] = useState<boolean>(() => (enemy?.properties?.stationary === 'true'));

  // Movement & AI
  const [combatStyle, setCombatStyle] = useState<'default'|'aggressive'|'passive'>(() => ((enemy?.properties?.combat_style as 'default'|'aggressive'|'passive') || 'default'));
  const [threatRange, setThreatRange] = useState<string>(() => propertyText(enemy?.properties?.threat_range));
  const [fleeRange, setFleeRange] = useState<string>(() => propertyText(enemy?.properties?.flee_range));
  const [fleeDuration, setFleeDuration] = useState<string>(() => propertyText(enemy?.properties?.flee_duration));
  const [fleeCooldown, setFleeCooldown] = useState<string>(() => propertyText(enemy?.properties?.flee_cooldown));
  const [chancePursue, setChancePursue] = useState<string>(() => propertyText(enemy?.properties?.chance_pursue));
  const [chanceFlee, setChanceFlee] = useState<string>(() => propertyText(enemy?.properties?.chance_flee));
  const [turnDelay, setTurnDelay] = useState<string>(() => propertyText(enemy?.properties?.turn_delay));
  const [wanderRadius, setWanderRadius] = useState<string>(() => propertyText(enemy?.properties?.wander_radius));
  const [waypoints, setWaypoints] = useState<string>(() => propertyText(enemy?.properties?.waypoints));
  const [waypointPause, setWaypointPause] = useState<string>(() => propertyText(enemy?.properties?.waypoint_pause));
  const [isFacing, setIsFacing] = useState<boolean>(() => (enemy?.properties?.facing === 'true'));
  const [isFlying, setIsFlying] = useState<boolean>(() => (enemy?.properties?.flying === 'true'));
  const [isIntangible, setIsIntangible] = useState<boolean>(() => (enemy?.properties?.intangible === 'true'));

  // Attack & Skills
  const [powersList, setPowersList] = useState<string>(() => propertyText(enemy?.properties?.powers));
  const [passivePowers, setPassivePowers] = useState<string>(() => propertyText(enemy?.properties?.passive_powers));
  const [cooldown, setCooldown] = useState<string>(() => propertyText(enemy?.properties?.cooldown));
  const [cooldownHit, setCooldownHit] = useState<string>(() => propertyText(enemy?.properties?.cooldown_hit));
  const [powerFilter, setPowerFilter] = useState<string>(() => propertyText(enemy?.properties?.power_filter));

  // Actions / Abilities
  const [abilitiesList, setAbilitiesList] = useState<Array<{ id: string; name: string; type: string }>>(() => {
    try {
      const abs = propertyText(enemy?.properties?.abilities);
      return abs ? JSON.parse(abs) : [];
    } catch {
      return [];
    }
  });

  // Loot
  const [lootRows, setLootRows] = useState<LootRow[]>(() => parseLootProperty(propertyText(enemy?.properties?.loot)));
  const [lootCountMin, setLootCountMin] = useState<string>('');
  const [lootCountMax, setLootCountMax] = useState<string>('');
  const [firstDefeatLoot, setFirstDefeatLoot] = useState<string>(() => propertyText(enemy?.properties?.first_defeat_loot));
  const [tableRows, setTableRows] = useState<Record<string, LootRow[]>>({});
  const originalLoot = useMemo(() => parseLootProperty(propertyText(enemy?.properties?.loot)), [enemy]);

  const splitLootCount = (value: string | undefined) => {
    const parsed = parseLootCount(value);
    return [parsed.min != null ? String(parsed.min) : '', parsed.max != null ? String(parsed.max) : ''] as const;
  };

  const buildLootCount = () => {
    if (lootCountMin && lootCountMax) return `${lootCountMin},${lootCountMax}`;
    if (lootCountMin) return lootCountMin;
    if (lootCountMax) return `1,${lootCountMax}`;
    return '';
  };

  // Quest
  const [questLoot, setQuestLoot] = useState<string>(() => propertyText(enemy?.properties?.quest_loot));
  const [defeatStatus, setDefeatStatus] = useState<string>(() => propertyText(enemy?.properties?.defeat_status));
  const [convertStatus, setConvertStatus] = useState<string>(() => propertyText(enemy?.properties?.convert_status));
  const [cooldownLos, setCooldownLos] = useState<string>(() => propertyText(enemy?.properties?.cooldown_los));
  const [corpseHasCollision, setCorpseHasCollision] = useState<boolean>(() => (enemy?.properties?.corpse_has_collision === 'true'));
  const [corpseHasTimeout, setCorpseHasTimeout] = useState<boolean>(() => (enemy?.properties?.corpse_has_timeout === 'true'));
  const [corpseRenderBelow, setCorpseRenderBelow] = useState<boolean>(() => (enemy?.properties?.corpse_render_below === 'true'));
  const [restingHpRegenTime, setRestingHpRegenTime] = useState<string>(() => propertyText(enemy?.properties?.resting_hp_regen_time));
  const [sfxBlock, setSfxBlock] = useState<string>(() => propertyText(enemy?.properties?.sfx_block));
  const [sfxLevelup, setSfxLevelup] = useState<string>(() => propertyText(enemy?.properties?.sfx_levelup));
  const [sfxLowhp, setSfxLowhp] = useState<string>(() => propertyText(enemy?.properties?.sfx_lowhp));
  const [statPerPrimary, setStatPerPrimary] = useState<string>(() => propertyText(enemy?.properties?.stat_per_primary));
  const [resistHpSteal, setResistHpSteal] = useState<string>(() => loadedStats.resist_hp_steal || '');
  const [resistMpSteal, setResistMpSteal] = useState<string>(() => loadedStats.resist_mp_steal || '');
  const [dmgMentMin, setDmgMentMin] = useState<string>(() => loadedStats.dmg_ment_min || '');
  const [dmgMentMax, setDmgMentMax] = useState<string>(() => loadedStats.dmg_ment_max || '');
  const [headerMore, setHeaderMore] = useState(false);
  const [lookMore, setLookMore] = useState(false);
  const [combatMore, setCombatMore] = useState(false);
  const [behaviorMore, setBehaviorMore] = useState(false);
  const [lootMore, setLootMore] = useState(false);
  const [storyMore, setStoryMore] = useState(false);

  const handleSelectFirstDefeatLootItem = useCallback((itemId: string) => {
    setFirstDefeatLoot(itemId);
  }, []);

  const handleSelectQuestLootItem = useCallback((itemId: string) => {
    const parts = questLoot.split(',').map((part) => part.trim());
    const [status = '', notStatus = ''] = parts;
    setQuestLoot([status, notStatus, itemId].join(','));
  }, [questLoot]);

  useEffect(() => {
    const paths = lootRows.filter((row) => row.isTable && row.id).map((row) => row.id);
    if (!paths.length || !projectPath || !window.electronAPI?.readFile) return;
    let alive = true;
    (async () => {
      const next: Record<string, LootRow[]> = {};
      for (const rel of paths) {
        const path = `${projectPath.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;
        try {
          const text = await window.electronAPI.readFile(path);
          if (text) next[rel] = parseLootTableText(text);
        } catch {
          /* table may live in another mod; the summary will just name it */
        }
      }
      if (alive) setTableRows((prev) => ({ ...prev, ...next }));
    })();
    return () => { alive = false; };
  }, [lootRows, projectPath]);

  // Flags / custom
  const [customPropsRaw, setCustomPropsRaw] = useState<string>(() => {
    if (!enemy?.properties) return '';
    const pairs = Object.entries(enemy.properties).filter(([k]) => !ENEMY_FORM_KEYS.includes(k));
    return pairs.map(([k,v]) => `${k}=${v}`).join('\n');
  });

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setName(enemy?.name || '');
      setLevel(enemy?.level ?? 1);
      setRarity((enemy?.properties?.rarity as 'common'|'uncommon'|'rare'|'unique') || 'common');
      setCount(enemy?.number ?? 1);

      setCategory(enemy?.category || '');
      setIsHumanoid(enemy?.properties?.humanoid === 'true');
      setIsLifeform(enemy?.properties?.lifeform === 'false' ? false : true);
      setIncludes(includeListFromProp(propertyText(enemy?.properties?.include)));

      setTilesetPath((enemy?.properties?.tilesetPath as string) || '');
      setPortraitPath((enemy?.properties?.portraitPath as string) || '');
      setGfx((enemy?.properties?.gfx as string) || '');
      setRenderLayers(propertyText(enemy?.properties?.render_layers));
      setAnimationSlots(propertyText(enemy?.properties?.animation_slots));
      setSuppressHp(enemy?.properties?.suppress_hp === 'true');

      setSfxAttack(propertyText(enemy?.properties?.sfx_attack));
      setSfxHit(propertyText(enemy?.properties?.sfx_hit));
      setSfxDie(propertyText(enemy?.properties?.sfx_die));
      setSfxCritDie(propertyText(enemy?.properties?.sfx_critdie));

      const stats = statsFromProperties(enemy?.properties as Record<string, unknown> | undefined);
      setHp(stats.hp || '');
      setMp(stats.mp || '');
      setAttack(propertyText(enemy?.properties?.attack));
      setDefense(propertyText(enemy?.properties?.defense));
      setSpeed(propertyText(enemy?.properties?.speed));
      setXp(propertyText(enemy?.properties?.xp));
      setGold(propertyText(enemy?.properties?.gold));
      setMeleeRange(propertyText(enemy?.properties?.melee_range));

      setStatPerLevel(propertyText(enemy?.properties?.stat_per_level));
      setXpScaling(propertyText(enemy?.properties?.xp_scaling));
      setVulnerable(propertyText(enemy?.properties?.vulnerable));
      setResistDamageOverTime(stats.resist_damage_over_time || '');
      setResistSlow(stats.resist_slow || '');
      setResistStun(stats.resist_stun || '');
      setResistKnockback(stats.resist_knockback || '');
      setResistStatDebuff(stats.resist_stat_debuff || '');
      setResistDamageReflect(stats.resist_damage_reflect || '');
      setXpGain(stats.xp_gain || '');
      setHpRegen(stats.hp_regen || '');
      setMpRegen(stats.mp_regen || '');
      setHpSteal(stats.hp_steal || '');
      setMpSteal(stats.mp_steal || '');
      setAccuracy(stats.accuracy || '');
      setAvoidance(stats.avoidance || '');
      setCrit(stats.crit || '');
      setAbsorbMin(stats.absorb_min || '');
      setAbsorbMax(stats.absorb_max || '');
      setPoise(stats.poise || '');
      setReflectChance(stats.reflect_chance || '');
      setReturnDamage(stats.return_damage || '');
      setCurrencyFind(stats.currency_find || '');
      setItemFind(stats.item_find || '');
      setStealth(stats.stealth || '');

      setIsMelee(enemy?.properties?.melee === 'true');
      setIsRanged(enemy?.properties?.ranged === 'true');
      setIsCaster(enemy?.properties?.caster === 'true');
      setIsSummoner(enemy?.properties?.summoner === 'true');
      setIsBoss(enemy?.properties?.boss === 'true');
      setIsPassive(enemy?.properties?.passive === 'true');
      setIsStationary(enemy?.properties?.stationary === 'true');

      setCombatStyle((enemy?.properties?.combat_style as 'default'|'aggressive'|'passive') || 'default');
      setThreatRange(propertyText(enemy?.properties?.threat_range));
      setFleeRange(propertyText(enemy?.properties?.flee_range));
      setFleeDuration(propertyText(enemy?.properties?.flee_duration));
      setFleeCooldown(propertyText(enemy?.properties?.flee_cooldown));
      setChancePursue(propertyText(enemy?.properties?.chance_pursue));
      setChanceFlee(propertyText(enemy?.properties?.chance_flee));
      setTurnDelay(propertyText(enemy?.properties?.turn_delay));
      setWanderRadius(propertyText(enemy?.properties?.wander_radius));

      try {
        const abs = propertyText(enemy?.properties?.abilities);
        setAbilitiesList(abs ? JSON.parse(abs) : []);
      } catch {
        setAbilitiesList([]);
      }
      setWaypoints(propertyText(enemy?.properties?.waypoints));
      setWaypointPause(propertyText(enemy?.properties?.waypoint_pause));
      setIsFacing(enemy?.properties?.facing === 'true');
      setIsFlying(enemy?.properties?.flying === 'true');
      setIsIntangible(enemy?.properties?.intangible === 'true');

      setDmgMeleeMin(stats.dmg_melee_min || '');
      setDmgMeleeMax(stats.dmg_melee_max || '');
      setDmgRangedMin(stats.dmg_ranged_min || '');
      setDmgRangedMax(stats.dmg_ranged_max || '');
      setAnimations(propertyText(enemy?.properties?.animations));

      try {
        const p = propertyText(enemy?.properties?.powers);
        setPowers(p ? JSON.parse(p) : []);
      } catch {
        setPowers([]);
      }

      setPassivePowers(propertyText(enemy?.properties?.passive_powers));
      setCooldown(propertyText(enemy?.properties?.cooldown));
      setCooldownHit(propertyText(enemy?.properties?.cooldown_hit));
      setPowerFilter(propertyText(enemy?.properties?.power_filter));

      setLootRows(parseLootProperty(propertyText(enemy?.properties?.loot)));
      const [minCount, maxCount] = splitLootCount(propertyText(enemy?.properties?.loot_count) || undefined);
      setLootCountMin(minCount);
      setLootCountMax(maxCount);
      setFirstDefeatLoot(propertyText(enemy?.properties?.first_defeat_loot));

      setQuestLoot(propertyText(enemy?.properties?.quest_loot));
      setDefeatStatus(propertyText(enemy?.properties?.defeat_status));
      setConvertStatus(propertyText(enemy?.properties?.convert_status));
      setCooldownLos(propertyText(enemy?.properties?.cooldown_los));
      setCorpseHasCollision(enemy?.properties?.corpse_has_collision === 'true');
      setCorpseHasTimeout(enemy?.properties?.corpse_has_timeout === 'true');
      setCorpseRenderBelow(enemy?.properties?.corpse_render_below === 'true');
      setRestingHpRegenTime(propertyText(enemy?.properties?.resting_hp_regen_time));
      setSfxBlock(propertyText(enemy?.properties?.sfx_block));
      setSfxLevelup(propertyText(enemy?.properties?.sfx_levelup));
      setSfxLowhp(propertyText(enemy?.properties?.sfx_lowhp));
      setStatPerPrimary(propertyText(enemy?.properties?.stat_per_primary));
      setResistHpSteal(stats.resist_hp_steal || '');
      setResistMpSteal(stats.resist_mp_steal || '');
      setDmgMentMin(stats.dmg_ment_min || '');
      setDmgMentMax(stats.dmg_ment_max || '');

      const filled = (...values: Array<string | boolean | undefined>) => values.some((value) => (
        typeof value === 'boolean' ? value : String(value || '').trim() !== ''
      ));
      const props = enemy?.properties || {};
      setHeaderMore(filled(enemy?.category, propertyText(props.include), enemy?.number != null && enemy.number !== 1, props.humanoid === 'true', props.lifeform === 'false', props.rarity && props.rarity !== 'common'));
      setLookMore(filled(propertyText(props.tilesetPath), propertyText(props.render_layers), propertyText(props.animation_slots), props.suppress_hp === 'true', propertyText(props.sfx_critdie), propertyText(props.sfx_block), propertyText(props.sfx_levelup), propertyText(props.sfx_lowhp), propertyText(props.gfx), propertyText(props.portraitPath), props.corpse_has_collision === 'true', props.corpse_has_timeout === 'true', props.corpse_render_below === 'true'));
      setCombatMore(filled(stats.mp, stats.accuracy, stats.avoidance, stats.crit, stats.poise, stats.stealth, stats.absorb_min, stats.hp_regen, stats.mp_regen, stats.hp_steal, stats.mp_steal, stats.reflect_chance, stats.return_damage, stats.resist_damage_over_time, stats.resist_slow, stats.resist_stun, stats.resist_knockback, stats.resist_stat_debuff, stats.resist_damage_reflect, stats.resist_hp_steal, stats.resist_mp_steal, stats.dmg_ment_min, stats.xp_gain, propertyText(props.cooldown_hit), propertyText(props.cooldown_los), propertyText(props.power_filter), propertyText(props.passive_powers), propertyText(props.stat_per_level), propertyText(props.stat_per_primary), propertyText(props.xp_scaling), propertyText(props.vulnerable), propertyText(props.resting_hp_regen_time), props.caster === 'true', props.summoner === 'true', props.boss === 'true', props.passive === 'true'));
      setBehaviorMore(filled(propertyText(props.flee_duration), propertyText(props.flee_cooldown), propertyText(props.turn_delay), propertyText(props.waypoints), propertyText(props.waypoint_pause), props.facing === 'true', props.flying === 'true', props.intangible === 'true'));
      setLootMore(filled(propertyText(props.loot_count), propertyText(props.gold), stats.item_find, stats.currency_find));
      setStoryMore(filled(propertyText(props.first_defeat_loot), propertyText(props.convert_status), propertyText(props.script)));

      setCustomPropsRaw(() => {
        if (!enemy?.properties) return '';
        const pairs = Object.entries(enemy.properties).filter(([k]) => !ENEMY_FORM_KEYS.includes(k));
        return pairs.map(([k,v]) => `${k}=${v}`).join('\n');
      });

      setCategory(enemy?.category || '');
      setIncludes(includeListFromProp(propertyText(enemy?.properties?.include)));

    }, 0);

    return () => clearTimeout(t);
  }, [open, enemy]);

  const handleClose = () => onOpenChange ? onOpenChange(false) : undefined;

  const handleSave = async () => {
    if (!enemy) {
      handleClose();
      return;
    }

    const newProps: Record<string, string> = propertyRecord(enemy.properties);
    const knownKeys = ENEMY_FORM_KEYS;

    if (rarity) newProps.rarity = rarity; else delete newProps.rarity;
    const savedIncludes = includes.map((s) => s.trim()).filter(Boolean);
    if (savedIncludes.length) newProps.include = savedIncludes.join('\n'); else delete newProps.include;

    if (tilesetPath) newProps.tilesetPath = tilesetPath; else delete newProps.tilesetPath;
    if (portraitPath) newProps.portraitPath = portraitPath; else delete newProps.portraitPath;
    if (gfx) newProps.gfx = gfx; else delete newProps.gfx;
    if (renderLayers) newProps.render_layers = renderLayers; else delete newProps.render_layers;
    if (animationSlots) newProps.animation_slots = animationSlots; else delete newProps.animation_slots;
    if (suppressHp) newProps.suppress_hp = 'true'; else delete newProps.suppress_hp;

    if (sfxAttack) newProps.sfx_attack = sfxAttack; else delete newProps.sfx_attack;
    if (sfxHit) newProps.sfx_hit = sfxHit; else delete newProps.sfx_hit;
    if (sfxDie) newProps.sfx_die = sfxDie; else delete newProps.sfx_die;
    if (sfxCritDie) newProps.sfx_critdie = sfxCritDie; else delete newProps.sfx_critdie;

    const formStats: Record<string, string> = {
      hp, mp,
      hp_regen: hpRegen, mp_regen: mpRegen, accuracy, avoidance, crit, poise, stealth,
      absorb_min: absorbMin, absorb_max: absorbMax, xp_gain: xpGain,
      currency_find: currencyFind, item_find: itemFind,
      reflect_chance: reflectChance, return_damage: returnDamage,
      hp_steal: hpSteal, mp_steal: mpSteal,
      resist_damage_over_time: resistDamageOverTime, resist_slow: resistSlow,
      resist_stun: resistStun, resist_knockback: resistKnockback,
      resist_stat_debuff: resistStatDebuff, resist_damage_reflect: resistDamageReflect,
      dmg_melee_min: dmgMeleeMin, dmg_melee_max: dmgMeleeMax,
      dmg_ranged_min: dmgRangedMin, dmg_ranged_max: dmgRangedMax,
      dmg_ment_min: dmgMentMin, dmg_ment_max: dmgMentMax,
      resist_hp_steal: resistHpSteal, resist_mp_steal: resistMpSteal,
    };
    const mergedStats = { ...statsFromProperties(enemy.properties as Record<string, unknown>), ...formStats };
    const statText = formatStatProperty(mergedStats, (enemy.properties as Record<string, unknown> | undefined)?.stat);
    if (statText) newProps.stat = statText; else delete newProps.stat;
    for (const id of ENEMY_STAT_IDS) delete newProps[id];
    if (attack) newProps.attack = attack; else delete newProps.attack;
    if (defense) newProps.defense = defense; else delete newProps.defense;
    if (speed) newProps.speed = speed; else delete newProps.speed;
    if (xp) newProps.xp = xp; else delete newProps.xp;
    if (gold) newProps.gold = gold; else delete newProps.gold;

    if (statPerLevel) newProps.stat_per_level = statPerLevel; else delete newProps.stat_per_level;
    if (xpScaling) newProps.xp_scaling = xpScaling; else delete newProps.xp_scaling;
    if (vulnerable) newProps.vulnerable = vulnerable; else delete newProps.vulnerable;

    if (meleeRange) newProps.melee_range = meleeRange; else delete newProps.melee_range;
    delete newProps.thread_range;

    if (isMelee) newProps.melee = 'true'; else delete newProps.melee;
    if (isRanged) newProps.ranged = 'true'; else delete newProps.ranged;
    if (isCaster) newProps.caster = 'true'; else delete newProps.caster;
    if (isSummoner) newProps.summoner = 'true'; else delete newProps.summoner;
    if (isBoss) newProps.boss = 'true'; else delete newProps.boss;
    if (isPassive) newProps.passive = 'true'; else delete newProps.passive;
    if (isStationary) newProps.stationary = 'true'; else delete newProps.stationary;
    if (isHumanoid) newProps.humanoid = 'true'; else delete newProps.humanoid;
    if (isLifeform) newProps.lifeform = 'true'; else delete newProps.lifeform;

    if (combatStyle) newProps.combat_style = combatStyle; else delete newProps.combat_style;
    if (threatRange) newProps.threat_range = threatRange; else delete newProps.threat_range;
    if (fleeRange) newProps.flee_range = fleeRange; else delete newProps.flee_range;
    if (fleeDuration) newProps.flee_duration = fleeDuration; else delete newProps.flee_duration;
    if (fleeCooldown) newProps.flee_cooldown = fleeCooldown; else delete newProps.flee_cooldown;
    if (chancePursue) newProps.chance_pursue = chancePursue; else delete newProps.chance_pursue;
    if (chanceFlee) newProps.chance_flee = chanceFlee; else delete newProps.chance_flee;
    if (turnDelay) newProps.turn_delay = turnDelay; else delete newProps.turn_delay;
    if (wanderRadius) newProps.wander_radius = wanderRadius; else delete newProps.wander_radius;
    if (waypoints) newProps.waypoints = waypoints; else delete newProps.waypoints;
    if (waypointPause) newProps.waypoint_pause = waypointPause; else delete newProps.waypoint_pause;
    if (isFacing) newProps.facing = 'true'; else delete newProps.facing;
    if (isFlying) newProps.flying = 'true'; else delete newProps.flying;
    if (isIntangible) newProps.intangible = 'true'; else delete newProps.intangible;

    if (animations) newProps.animations = animations; else delete newProps.animations;

    if (powersList) {
      newProps.powers = powersList;
    } else if (powers && powers.length > 0) {
      newProps.powers = JSON.stringify(powers);
    } else {
      delete newProps.powers;
    }
    if (passivePowers) newProps.passive_powers = passivePowers; else delete newProps.passive_powers;
    if (cooldown) newProps.cooldown = cooldown; else delete newProps.cooldown;
    if (cooldownHit) newProps.cooldown_hit = cooldownHit; else delete newProps.cooldown_hit;
    if (powerFilter) newProps.power_filter = powerFilter; else delete newProps.power_filter;

    const lootText = formatLootProperty(lootRows);
    if (lootText) newProps.loot = lootText; else delete newProps.loot;
    const resolvedLootCount = buildLootCount();
    if (resolvedLootCount) newProps.loot_count = resolvedLootCount; else delete newProps.loot_count;
    if (firstDefeatLoot) newProps.first_defeat_loot = firstDefeatLoot; else delete newProps.first_defeat_loot;

    if (questLoot) newProps.quest_loot = questLoot; else delete newProps.quest_loot;
    if (defeatStatus) newProps.defeat_status = defeatStatus; else delete newProps.defeat_status;
    if (convertStatus) newProps.convert_status = convertStatus; else delete newProps.convert_status;
    if (cooldownLos) newProps.cooldown_los = cooldownLos; else delete newProps.cooldown_los;
    if (corpseHasCollision) newProps.corpse_has_collision = 'true'; else delete newProps.corpse_has_collision;
    if (corpseHasTimeout) newProps.corpse_has_timeout = 'true'; else delete newProps.corpse_has_timeout;
    if (corpseRenderBelow) newProps.corpse_render_below = 'true'; else delete newProps.corpse_render_below;
    if (restingHpRegenTime) newProps.resting_hp_regen_time = restingHpRegenTime; else delete newProps.resting_hp_regen_time;
    if (sfxBlock) newProps.sfx_block = sfxBlock; else delete newProps.sfx_block;
    if (sfxLevelup) newProps.sfx_levelup = sfxLevelup; else delete newProps.sfx_levelup;
    if (sfxLowhp) newProps.sfx_lowhp = sfxLowhp; else delete newProps.sfx_lowhp;
    if (statPerPrimary) newProps.stat_per_primary = statPerPrimary; else delete newProps.stat_per_primary;
    if (script) newProps.script = script; else delete newProps.script;
    if (abilitiesList.length > 0) newProps.abilities = JSON.stringify(abilitiesList); else delete newProps.abilities;

    const customLines = (customPropsRaw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const k of Object.keys(newProps)) {
      if (!knownKeys.includes(k)) delete newProps[k];
    }
    for (const line of customLines) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim();
        if (k) newProps[k] = v;
      }
    }

    const previousPath = propertyText(enemy.properties?.enemyFilename) || propertyText(enemy.properties?.sourcePath);
    if (projectPath && name.trim()) {
      try {
        if (previousPath) {
          const renamed = await renameIfNameChanged(projectPath, 'enemy', previousPath, name);
          if (renamed.ok && renamed.changed) {
            const path = canonicalIdentity('enemy', renamed.nextId);
            newProps.sourcePath = path;
            newProps.enemyFilename = path;
          }
        } else {
          const files = await loadProjectTextMap(projectPath);
          const path = canonicalIdentity('enemy', uniqueSlugFromName(files, 'enemy', name));
          newProps.sourcePath = path;
          newProps.enemyFilename = path;
        }
      } catch (err) {
        console.error(err);
      }
    }

    const updated: MapObject = {
      ...enemy,
      name,
      level: Number.isFinite(Number(level)) ? Number(level) : enemy.level,
      number: Number.isFinite(Number(count)) ? Number(count) : enemy.number,
      category: category,
      properties: newProps,
    };

    onSave?.(updated);
    handleClose();
  };

  const handleCloseDecision = (decision: 'save' | 'discard' | 'cancel') => {
    if (decision === 'save') {
      void handleSave();
    }
    onCloseDecision?.(decision);
  };

  const strength = strengthFromStats({
    hp,
    xp,
    attack,
    defense,
    dmgMeleeMax,
    absorbMax,
  });

  const behaviorValues = {
    combatStyle,
    isStationary,
    threatRange,
    fleeRange,
    fleeDuration,
    fleeCooldown,
    chancePursue,
    chanceFlee,
    wanderRadius,
  };
  const behaviorPreset = behaviorPresetFromValues(behaviorValues);

  const applyStrength = (tier: StrengthTier) => {
    const next = statsFromStrength(tier);
    setHp(next.hp);
    setAttack(next.attack);
    setDefense(next.defense);
    setXp(next.xp);
    setDmgMeleeMin(next.dmgMeleeMin);
    setDmgMeleeMax(next.dmgMeleeMax);
    setAbsorbMin(next.absorbMin);
    setAbsorbMax(next.absorbMax);
    if (isRanged) {
      setDmgRangedMin(next.dmgMeleeMin);
      setDmgRangedMax(next.dmgMeleeMax);
    }
  };

  const applyBehavior = (id: BehaviorPresetId) => {
    const next = valuesFromBehaviorPreset(id);
    setCombatStyle(next.combatStyle);
    setIsStationary(next.isStationary);
    setThreatRange(next.threatRange);
    setFleeRange(next.fleeRange);
    setFleeDuration(next.fleeDuration);
    setFleeCooldown(next.fleeCooldown);
    setChancePursue(next.chancePursue);
    setChanceFlee(next.chanceFlee);
    setWanderRadius(next.wanderRadius);
  };

  const drop = dropFromLootRows(lootRows, (id) => lootItems.find((item) => String(item.id) === id)?.name || id);
  const summary = summarizeEnemy({
    strength,
    isMelee,
    isRanged,
    isCaster,
    isBoss,
    cooldown,
    combatStyle,
    threatRange,
    chancePursue,
    chanceFlee,
    isStationary,
    wanderRadius,
    dropName: drop?.dropName,
    dropChance: drop?.dropChance,
  });

  if (!open && !inline) return null;

  const inputCls = 'h-7 text-xs';
  const portraitSrc = portraitPath || null;

  const panel = (
    <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
      <section className="shrink-0 space-y-2 border-b border-border/60 px-4 pt-3 pb-3">
        <div className="flex gap-3 items-start border border-border rounded-md p-3 bg-muted/20">
          <NpcAssetThumb imagePath={portraitSrc} alt="Portrait" className="h-20 w-20 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <NameField value={name} onChange={setName} placeholder="Enemy name" />
            <div className="grid grid-cols-[5.5rem_1fr] items-end gap-3">
              <div>
                <LabelWithTooltip field="level">Level</LabelWithTooltip>
                <Input type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  {STRENGTH_TIERS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`font-medium ${strength === tier ? TIER_COLOR[tier] : 'text-muted-foreground/50'}`}
                      onClick={() => applyStrength(tier)}
                    >
                      {strengthLabel(tier)}
                    </button>
                  ))}
                </div>
                <Tooltip content="Sets HP, attack, defense and XP together. You can still edit those numbers by hand.">
                  <input
                    type="range"
                    aria-label="Enemy strength"
                    min={0}
                    max={2}
                    step={1}
                    value={strength ? STRENGTH_TIERS.indexOf(strength) : 1}
                    className="w-full h-1 accent-orange-500 cursor-pointer"
                    onChange={(e) => applyStrength(STRENGTH_TIERS[Number(e.target.value)])}
                  />
                </Tooltip>
                <div className="text-[10px] text-muted-foreground mt-1">
                  HP {hp || '—'} · Atk {dmgMeleeMax || attack || '—'} · Def {absorbMax || defense || '—'} · XP {xp || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">{summary}</p>
        <MoreToggle open={headerMore} onToggle={() => setHeaderMore((v) => !v)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <LabelWithTooltip field="count">Spawn number</LabelWithTooltip>
              <Input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="rarity">Rarity</LabelWithTooltip>
              <Select value={rarity} onValueChange={(v: 'common' | 'uncommon' | 'rare' | 'unique') => setRarity(v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">Common</SelectItem>
                  <SelectItem value="uncommon">Uncommon</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="unique">Unique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              Categories
            </label>
            <div className="flex flex-wrap gap-1.5">
              {selectedCategories.map((cat) => (
                <Badge key={cat} variant="secondary" className="pl-2 pr-1 h-6 gap-1 bg-background border-border/50">
                  {cat}
                  <button type="button" onClick={() => toggleCategory(cat)} className="hover:text-red-500 transition-colors" aria-label={`Remove ${cat}`}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {isAddingCategory ? (
                <div className="flex gap-1.5">
                  <Input autoFocus value={newCatInput} onChange={(e) => setNewCatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} placeholder="Category name" className="h-7 text-xs w-32" />
                  <Button type="button" size="sm" onClick={addCategory} className="h-7 px-2">Add</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setIsAddingCategory(false)} className="h-7 px-2"><X className="w-3 h-3" /></Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingCategory(true)} className="h-7 text-[10px] border-dashed">
                  <Plus className="w-3 h-3 mr-1" /> Add category
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              Shared file
              <Tooltip content={enemyPropertyTooltips.include}><HelpCircle className="w-3 h-3" /></Tooltip>
            </label>
            <div className="space-y-1.5">
              {includes.map((path, index) => (
                <div key={index} className="flex items-center gap-1">
                  <Input
                    value={path}
                    onChange={(e) => setIncludes((prev) => prev.map((item, i) => (i === index ? e.target.value : item)))}
                    placeholder="enemies/base/..."
                    className="h-7 font-mono text-xs"
                  />
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" aria-label="Choose file" onClick={async () => {
                    const api = window.electronAPI as typeof window.electronAPI & {
                      selectProjectFile?: (opts: { projectPath?: string | null; title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
                    };
                    if (!api?.selectProjectFile) return;
                    const selected = await api.selectProjectFile({
                      projectPath,
                      title: 'Choose a shared enemy file',
                      filters: [
                        { name: 'Enemy or text files', extensions: ['txt'] },
                        { name: 'All files', extensions: ['*'] },
                      ],
                    });
                    if (selected) setIncludes((prev) => prev.map((item, i) => (i === index ? selected : item)));
                  }}>
                    <FolderOpen className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" aria-label="Remove shared file" onClick={() => setIncludes((prev) => {
                    const next = prev.filter((_, i) => i !== index);
                    return next.length ? next : [''];
                  })}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] border-dashed" onClick={() => setIncludes((prev) => [...prev, ''])}>
                <Plus className="w-3 h-3 mr-1" /> Add shared file
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Flag checked={isHumanoid} onChange={setIsHumanoid} label="Humanoid" tip={enemyPropertyTooltips.humanoid} />
            <Flag checked={isLifeform} onChange={setIsLifeform} label="Lifeform" tip={enemyPropertyTooltips.lifeform} />
          </div>
        </MoreToggle>
      </section>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0 custom-scrollbar">
        <EditorSection title="Look">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <LabelWithTooltip field="animations">Animations</LabelWithTooltip>
              <Input value={animations} onChange={(e) => setAnimations(e.target.value)} placeholder="animations/enemies/goblin.txt" className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="sfxAttack">Attack sound</LabelWithTooltip>
              <Input value={sfxAttack} onChange={(e) => setSfxAttack(e.target.value)} placeholder="soundfx/enemies/hit.ogg" className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="sfxHit">Hit sound</LabelWithTooltip>
              <Input value={sfxHit} onChange={(e) => setSfxHit(e.target.value)} placeholder="soundfx/enemies/pain.ogg" className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="sfxDie">Death sound</LabelWithTooltip>
              <Input value={sfxDie} onChange={(e) => setSfxDie(e.target.value)} placeholder="soundfx/enemies/die.ogg" className={`${inputCls} font-mono`} />
            </div>
          </div>
          <MoreToggle open={lookMore} onToggle={() => setLookMore((v) => !v)}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <LabelWithTooltip field="gfx">GFX (deprecated)</LabelWithTooltip>
                <Input value={gfx} onChange={(e) => setGfx(e.target.value)} placeholder="Replaced by Animations on save" className={inputCls} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="tilesetPath">Tileset source</LabelWithTooltip>
                <Input value={tilesetPath} onChange={(e) => setTilesetPath(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="portrait">Portrait path</LabelWithTooltip>
                <Input value={portraitPath} onChange={(e) => setPortraitPath(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="renderLayers">Render layers</LabelWithTooltip>
                <Input value={renderLayers} onChange={(e) => setRenderLayers(e.target.value)} placeholder="e.g. floor,object" className={inputCls} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="animationSlots">Animation slots</LabelWithTooltip>
                <Input value={animationSlots} onChange={(e) => setAnimationSlots(e.target.value)} placeholder="e.g. body,weapon" className={inputCls} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="sfxCritDie">Crit death sound</LabelWithTooltip>
                <Input value={sfxCritDie} onChange={(e) => setSfxCritDie(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="sfxBlock">Block sound</LabelWithTooltip>
                <Input value={sfxBlock} onChange={(e) => setSfxBlock(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="sfxLevelup">Level-up sound</LabelWithTooltip>
                <Input value={sfxLevelup} onChange={(e) => setSfxLevelup(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="sfxLowhp">Low HP sound</LabelWithTooltip>
                <Input value={sfxLowhp} onChange={(e) => setSfxLowhp(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <Flag checked={suppressHp} onChange={setSuppressHp} label="Hide HP bar" tip={enemyPropertyTooltips.suppressHp} />
              <Flag checked={corpseHasCollision} onChange={setCorpseHasCollision} label="Corpse blocks movement" tip={enemyPropertyTooltips.corpseHasCollision} />
              <Flag checked={corpseHasTimeout} onChange={setCorpseHasTimeout} label="Corpse disappears" tip={enemyPropertyTooltips.corpseHasTimeout} />
              <Flag checked={corpseRenderBelow} onChange={setCorpseRenderBelow} label="Draw corpse below" tip={enemyPropertyTooltips.corpseRenderBelow} />
            </div>
          </MoreToggle>
        </EditorSection>

        <EditorSection title="Combat">
          <div className="flex flex-wrap gap-1.5">
            {([
              ['Melee', isMelee, setIsMelee],
              ['Ranged', isRanged, setIsRanged],
              ['Caster', isCaster, setIsCaster],
            ] as const).map(([label, on, set]) => (
              <button
                key={label}
                type="button"
                className={`h-7 px-2 rounded-md border text-xs ${on ? 'border-orange-500 bg-muted/40' : 'border-border bg-muted/20'}`}
                onClick={() => set(!on)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <LabelWithTooltip field="hp">Health</LabelWithTooltip>
              <Input type="number" value={hp} onChange={(e) => setHp(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="dmgMeleeMin">Melee min</LabelWithTooltip>
              <Input type="number" value={dmgMeleeMin} onChange={(e) => setDmgMeleeMin(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="dmgMeleeMax">Melee max</LabelWithTooltip>
              <Input type="number" value={dmgMeleeMax} onChange={(e) => setDmgMeleeMax(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="meleeRange">Melee range</LabelWithTooltip>
              <Input type="number" step="0.1" value={meleeRange} onChange={(e) => setMeleeRange(e.target.value)} className={inputCls} />
            </div>
            {(isRanged || dmgRangedMin || dmgRangedMax) && (
              <>
                <div className="space-y-1">
                  <LabelWithTooltip field="dmgRangedMin">Ranged min</LabelWithTooltip>
                  <Input type="number" value={dmgRangedMin} onChange={(e) => setDmgRangedMin(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <LabelWithTooltip field="dmgRangedMax">Ranged max</LabelWithTooltip>
                  <Input type="number" value={dmgRangedMax} onChange={(e) => setDmgRangedMax(e.target.value)} className={inputCls} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <LabelWithTooltip field="speed">Speed</LabelWithTooltip>
              <Input type="number" step="0.1" value={speed} onChange={(e) => setSpeed(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="cooldown">Cooldown</LabelWithTooltip>
              <Input value={cooldown} onChange={(e) => setCooldown(e.target.value)} placeholder="e.g. 1500ms" className={inputCls} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <LabelWithTooltip field="power" className="text-xs">Powers</LabelWithTooltip>
              <Button type="button" size="sm" variant="outline" onClick={() => { setPowersList(''); setPowers((prev) => [...prev, { state: 'melee', id: '', chance: 100 }]); }} className="h-7 text-[10px]">
                <Plus className="w-3 h-3 mr-1" /> Add power
              </Button>
            </div>
            {powersList && powers.length === 0 && (
              <Input value={powersList} onChange={(e) => setPowersList(e.target.value)} placeholder="power=melee,fireball,100" className={`${inputCls} font-mono`} />
            )}
            <div className="space-y-1.5">
              {powers.map((pow, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <Select value={pow.state} onValueChange={(v) => {
                    const next = [...powers];
                    next[index] = { ...next[index], state: v };
                    setPowersList('');
                    setPowers(next);
                  }}>
                    <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="melee">Melee</SelectItem>
                      <SelectItem value="ranged">Ranged</SelectItem>
                      <SelectItem value="beacon">Beacon</SelectItem>
                      <SelectItem value="on_hit">On hit</SelectItem>
                      <SelectItem value="on_death">On death</SelectItem>
                      <SelectItem value="on_half_dead">On half dead</SelectItem>
                      <SelectItem value="on_join_combat">On join combat</SelectItem>
                      <SelectItem value="on_debuff">On debuff</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Power ID" value={pow.id} onChange={(e) => {
                    const next = [...powers];
                    next[index] = { ...next[index], id: e.target.value };
                    setPowersList('');
                    setPowers(next);
                  }} className={`${inputCls} flex-1`} />
                  <Input type="number" aria-label="Power chance" value={pow.chance} onChange={(e) => {
                    const next = [...powers];
                    next[index] = { ...next[index], chance: Number(e.target.value) };
                    setPowersList('');
                    setPowers(next);
                  }} className={`${inputCls} w-16 text-center`} />
                  <span className="text-[10px] text-muted-foreground">%</span>
                  <button type="button" aria-label="Remove power" className="text-muted-foreground hover:text-foreground" onClick={() => { setPowersList(''); setPowers((prev) => prev.filter((_, i) => i !== index)); }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <MoreToggle open={combatMore} onToggle={() => setCombatMore((v) => !v)}>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['Summoner', isSummoner, setIsSummoner],
                ['Boss', isBoss, setIsBoss],
                ['Passive', isPassive, setIsPassive],
              ] as const).map(([label, on, set]) => (
                <button key={label} type="button" className={`h-7 px-2 rounded-md border text-xs ${on ? 'border-orange-500 bg-muted/40' : 'border-border bg-muted/20'}`} onClick={() => set(!on)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><LabelWithTooltip field="mp">Mana</LabelWithTooltip><Input type="number" value={mp} onChange={(e) => setMp(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="accuracy">Accuracy</LabelWithTooltip><Input type="number" value={accuracy} onChange={(e) => setAccuracy(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="avoidance">Avoidance</LabelWithTooltip><Input type="number" value={avoidance} onChange={(e) => setAvoidance(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="crit">Crit</LabelWithTooltip><Input type="number" value={crit} onChange={(e) => setCrit(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="poise">Poise</LabelWithTooltip><Input type="number" value={poise} onChange={(e) => setPoise(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="stealth">Stealth</LabelWithTooltip><Input type="number" value={stealth} onChange={(e) => setStealth(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="absorbMin">Absorb min</LabelWithTooltip><Input type="number" value={absorbMin} onChange={(e) => setAbsorbMin(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="absorbMax">Absorb max</LabelWithTooltip><Input type="number" value={absorbMax} onChange={(e) => setAbsorbMax(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="reflectChance">Reflect %</LabelWithTooltip><Input type="number" value={reflectChance} onChange={(e) => setReflectChance(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="returnDamage">Return damage</LabelWithTooltip><Input type="number" value={returnDamage} onChange={(e) => setReturnDamage(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="hpRegen">HP regen</LabelWithTooltip><Input type="number" value={hpRegen} onChange={(e) => setHpRegen(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="mpRegen">MP regen</LabelWithTooltip><Input type="number" value={mpRegen} onChange={(e) => setMpRegen(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="hpSteal">HP steal</LabelWithTooltip><Input type="number" value={hpSteal} onChange={(e) => setHpSteal(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="mpSteal">MP steal</LabelWithTooltip><Input type="number" value={mpSteal} onChange={(e) => setMpSteal(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="xpGain">XP gain</LabelWithTooltip><Input type="number" value={xpGain} onChange={(e) => setXpGain(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="dmgMentMin">Mental min</LabelWithTooltip><Input type="number" value={dmgMentMin} onChange={(e) => setDmgMentMin(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="dmgMentMax">Mental max</LabelWithTooltip><Input type="number" value={dmgMentMax} onChange={(e) => setDmgMentMax(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="cooldownHit">Cooldown on hit</LabelWithTooltip><Input value={cooldownHit} onChange={(e) => setCooldownHit(e.target.value)} placeholder="e.g. 500ms" className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="cooldownLos">Cooldown on lost sight</LabelWithTooltip><Input value={cooldownLos} onChange={(e) => setCooldownLos(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="restingHpRegenTime">Resting regen delay</LabelWithTooltip><Input value={restingHpRegenTime} onChange={(e) => setRestingHpRegenTime(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="attack">Attack (Studio)</LabelWithTooltip><Input value={attack} onChange={(e) => setAttack(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="defense">Defense (Studio)</LabelWithTooltip><Input value={defense} onChange={(e) => setDefense(e.target.value)} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><LabelWithTooltip field="resistDamageOverTime">Resist DoT</LabelWithTooltip><Input value={resistDamageOverTime} onChange={(e) => setResistDamageOverTime(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="resistSlow">Resist slow</LabelWithTooltip><Input value={resistSlow} onChange={(e) => setResistSlow(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="resistStun">Resist stun</LabelWithTooltip><Input value={resistStun} onChange={(e) => setResistStun(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="resistKnockback">Resist knockback</LabelWithTooltip><Input value={resistKnockback} onChange={(e) => setResistKnockback(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="resistStatDebuff">Resist stat debuff</LabelWithTooltip><Input value={resistStatDebuff} onChange={(e) => setResistStatDebuff(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="resistDamageReflect">Resist reflect</LabelWithTooltip><Input value={resistDamageReflect} onChange={(e) => setResistDamageReflect(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="resistHpSteal">Resist HP steal</LabelWithTooltip><Input value={resistHpSteal} onChange={(e) => setResistHpSteal(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="resistMpSteal">Resist MP steal</LabelWithTooltip><Input value={resistMpSteal} onChange={(e) => setResistMpSteal(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="vulnerable">Vulnerable</LabelWithTooltip><Input value={vulnerable} onChange={(e) => setVulnerable(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="statPerLevel">Stat per level</LabelWithTooltip><Input value={statPerLevel} onChange={(e) => setStatPerLevel(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="statPerPrimary">Stat per primary</LabelWithTooltip><Input value={statPerPrimary} onChange={(e) => setStatPerPrimary(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="xpScaling">XP scaling</LabelWithTooltip><Input value={xpScaling} onChange={(e) => setXpScaling(e.target.value)} className={inputCls} /></div>
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="passivePowers">Passive powers</LabelWithTooltip>
              <Input value={passivePowers} onChange={(e) => setPassivePowers(e.target.value)} placeholder="e.g. health_regen,armor_bonus" className={inputCls} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="powerFilter">Power filter</LabelWithTooltip>
              <Input value={powerFilter} onChange={(e) => setPowerFilter(e.target.value)} className={inputCls} />
            </div>
            {powers.length > 0 && (
              <div className="space-y-1">
                <LabelWithTooltip field="powersList">Raw powers</LabelWithTooltip>
                <Input value={powersList} onChange={(e) => setPowersList(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
            )}
          </MoreToggle>
        </EditorSection>

        <EditorSection title="Behavior">
          <div className="grid grid-cols-4 gap-1.5">
            {BEHAVIOR_PRESET_IDS.map((id) => {
              const meta = BEHAVIOR_PRESET_META[id];
              const Icon = BEHAVIOR_ICONS[id];
              const active = behaviorPreset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyBehavior(id)}
                  className={`min-w-0 rounded-md border px-2 py-1.5 text-left ${active ? 'border-orange-500 bg-muted/40' : 'border-border bg-muted/20'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium leading-none truncate">{meta.label}</span>
                  </div>
                  <div className="h-3.5 mt-1 text-[10px] leading-[14px] text-muted-foreground truncate">{meta.hint}</div>
                </button>
              );
            })}
          </div>
          <MoreToggle open={behaviorMore} onToggle={() => setBehaviorMore((v) => !v)}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <LabelWithTooltip field="combatStyle">Combat style</LabelWithTooltip>
                <Select value={combatStyle} onValueChange={(v: 'default' | 'aggressive' | 'passive') => setCombatStyle(v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                    <SelectItem value="passive">Passive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <Flag checked={isStationary} onChange={setIsStationary} label="Stationary" tip="stationary — Enemy does not walk." />
              </div>
              <div className="space-y-1"><LabelWithTooltip field="threatRange">Threat range</LabelWithTooltip><Input value={threatRange} onChange={(e) => setThreatRange(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="fleeRange">Flee range</LabelWithTooltip><Input value={fleeRange} onChange={(e) => setFleeRange(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="chancePursue">Chance pursue %</LabelWithTooltip><Input type="number" value={chancePursue} onChange={(e) => setChancePursue(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="chanceFlee">Chance flee %</LabelWithTooltip><Input type="number" value={chanceFlee} onChange={(e) => setChanceFlee(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="fleeDuration">Flee duration</LabelWithTooltip><Input value={fleeDuration} onChange={(e) => setFleeDuration(e.target.value)} placeholder="3s" className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="fleeCooldown">Flee cooldown</LabelWithTooltip><Input value={fleeCooldown} onChange={(e) => setFleeCooldown(e.target.value)} placeholder="5s" className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="turnDelay">Turn delay</LabelWithTooltip><Input value={turnDelay} onChange={(e) => setTurnDelay(e.target.value)} placeholder="200ms" className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="wanderRadius">Wander radius</LabelWithTooltip><Input value={wanderRadius} onChange={(e) => setWanderRadius(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="waypoints">Waypoints</LabelWithTooltip><Input value={waypoints} onChange={(e) => setWaypoints(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1"><LabelWithTooltip field="waypointPause">Waypoint pause</LabelWithTooltip><Input value={waypointPause} onChange={(e) => setWaypointPause(e.target.value)} className={inputCls} /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Flag checked={isFacing} onChange={setIsFacing} label="Faces target" tip={enemyPropertyTooltips.isFacing} />
              <Flag checked={isFlying} onChange={setIsFlying} label="Flying" tip={enemyPropertyTooltips.isFlying} />
              <Flag checked={isIntangible} onChange={setIsIntangible} label="Intangible" tip={enemyPropertyTooltips.isIntangible} />
            </div>
          </MoreToggle>
        </EditorSection>

        <EditorSection title="Loot">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <LabelWithTooltip field="xp">Kill XP</LabelWithTooltip>
              <Input type="number" value={xp} onChange={(e) => setXp(e.target.value)} className={inputCls} />
            </div>
          </div>
          <LootRowsEditor
            rows={lootRows}
            onChange={setLootRows}
            items={lootItems}
            summary={{
              lootCountMin: lootCountMin ? Number(lootCountMin) : undefined,
              lootCountMax: lootCountMax ? Number(lootCountMax) : undefined,
              dropMax: 1,
              expandTable: (path) => tableRows[path],
              itemName: (id) => lootItems.find((item) => String(item.id) === id)?.name || id,
            }}
          />
          <MoreToggle open={lootMore} onToggle={() => setLootMore((v) => !v)}>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <LabelWithTooltip field="lootCount">Loot count min</LabelWithTooltip>
                <Input value={lootCountMin} onChange={(e) => setLootCountMin(e.target.value)} placeholder="Min" className={inputCls} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="lootCount">Loot count max</LabelWithTooltip>
                <Input value={lootCountMax} onChange={(e) => setLootCountMax(e.target.value)} placeholder="Max" className={inputCls} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="itemFind">Item find %</LabelWithTooltip>
                <Input value={itemFind} onChange={(e) => setItemFind(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="currencyFind">Currency find %</LabelWithTooltip>
                <Input value={currencyFind} onChange={(e) => setCurrencyFind(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1 col-span-2">
                <LabelWithTooltip field="gold">Base gold</LabelWithTooltip>
                <Input type="number" value={gold} onChange={(e) => setGold(e.target.value)} className={inputCls} />
              </div>
            </div>
          </MoreToggle>
        </EditorSection>

        <EditorSection title="Story">
          <div className="space-y-2">
            <div className="space-y-1">
              <LabelWithTooltip field="defeatStatus">Story Flag on death</LabelWithTooltip>
              <Input value={defeatStatus} onChange={(e) => setDefeatStatus(e.target.value)} placeholder="e.g. boss_defeated" className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-1">
              <LabelWithTooltip field="questLoot">Quest loot</LabelWithTooltip>
              <Input value={questLoot} onChange={(e) => setQuestLoot(e.target.value)} placeholder="required_status,required_not_status,item_id" className={`${inputCls} font-mono`} />
              <Select value={questLoot.split(',').map((p) => p.trim()).slice(2).join(',')} onValueChange={handleSelectQuestLootItem}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {lootItems.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <MoreToggle open={storyMore} onToggle={() => setStoryMore((v) => !v)}>
            <div className="space-y-2">
              <div className="space-y-1">
                <LabelWithTooltip field="firstDefeatLoot">First defeat loot</LabelWithTooltip>
                <Input value={firstDefeatLoot} onChange={(e) => setFirstDefeatLoot(e.target.value)} className={`${inputCls} font-mono`} />
                <Select value={firstDefeatLoot} onValueChange={handleSelectFirstDefeatLootItem}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>
                    {lootItems.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="convertStatus">Convert status</LabelWithTooltip>
                <Input value={convertStatus} onChange={(e) => setConvertStatus(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip field="script">Script</LabelWithTooltip>
                <Input value={script} onChange={(e) => setScript(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Raw properties</label>
                <textarea
                  value={customPropsRaw}
                  onChange={(e) => setCustomPropsRaw(e.target.value)}
                  className="min-h-[8rem] w-full bg-muted/10 border border-border rounded-md p-2 font-mono text-xs focus:ring-1 focus:ring-orange-500 outline-none resize-y"
                  placeholder="KEY=VALUE"
                />
                <p className="text-[10px] text-muted-foreground">Keys not covered above. Written as they are.</p>
              </div>
            </div>
          </MoreToggle>
        </EditorSection>
      </div>

      <Button
        type="button"
        onClick={() => { void handleSave(); }}
        className="absolute bottom-3 right-3 z-[60] bg-orange-500 hover:bg-orange-600 text-white w-9 h-9 p-0 flex items-center justify-center rounded-lg shadow-xl border border-background active:scale-95 transition-all"
        title="Save"
      >
        <Save className="w-4 h-4" />
      </Button>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full h-full p-0 overflow-hidden flex flex-col relative bg-background">
        {panel}
      </div>
    );
  }

  if (!open) return null;

  return createPortal(
    <div 
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 100,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex items-center justify-between p-4 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <Sword className="w-5 h-5 text-orange-500" />
          {name && <Badge variant="outline" className="bg-muted/30">{name}</Badge>}
        </div>
        <button
          onClick={() => onOpenChange?.(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {panel}
      </div>

      {/* Resize handle */}
      <ResizeHandle onMouseDown={handleResizeMouseDown} />
    </div>,
    document.body
  );
}
