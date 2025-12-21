import React, { useEffect, useState } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User, Eye, BarChart2, Settings, Sword, Gift, Flag, MapPin, Volume2, HelpCircle, X, Save, Edit2, Plus, Check, Rabbit, Sigma } from 'lucide-react';
import type { MapObject } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

type TabKey = 'identity' | 'visual' | 'audio' | 'stats' | 'behavior' | 'attack' | 'loot' | 'quest' | 'combat' | 'flags';

const TAB_CONFIG: Array<{ key: TabKey; icon: LucideIcon; tooltip: string }> = [
  { key: 'identity', icon: User, tooltip: 'Identity' },
  { key: 'stats', icon: Sigma, tooltip: 'Stats' },
  { key: 'behavior', icon: Rabbit, tooltip: 'Behavior' },
  { key: 'attack', icon: Sword, tooltip: 'Attack & Skills' },
  { key: 'loot', icon: Gift, tooltip: 'Loot & Rewards' },
  { key: 'quest', icon: MapPin, tooltip: 'Quest' },
  { key: 'visual', icon: Eye, tooltip: 'Visual' },
  { key: 'audio', icon: Volume2, tooltip: 'Audio' },
  { key: 'combat', icon: Sword, tooltip: 'Combat / Powers' },
  { key: 'flags', icon: Flag, tooltip: 'Flags & Special' },
];

interface EditEnemyWindowProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  enemy?: MapObject | null;
  onSave?: (obj: MapObject) => void;
  existingCategories?: string[];
  projectPath?: string;
}

export default function EditEnemyWindow({ open, onOpenChange, enemy, onSave, existingCategories = [], projectPath = '' }: EditEnemyWindowProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [name, setName] = useState(() => enemy?.name || '');
  const [level, setLevel] = useState<number>(() => enemy?.level ?? 1);
  const [rarity, setRarity] = useState<'common'|'uncommon'|'rare'|'unique'>(() => (enemy?.properties?.rarity as 'common'|'uncommon'|'rare'|'unique') || 'common');
  const [count, setCount] = useState<number>(() => enemy?.number ?? 1);
  const [category, setCategory] = useState(() => enemy?.category || '');
  const [include, setInclude] = useState<string>(() => enemy?.properties?.include || '');
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

  const handleSaveAsPreset = async () => {
    if (!projectPath || !window.electronAPI?.saveEnemyPreset) return;
    
    // Create a simple Flare enemy format content from current state
    const lines = [
      '# Enemy Preset',
      `name=${name}`,
      `category=${category}`,
      `level=${level}`,
      `rarity=${rarity}`,
      `humanoid=${isHumanoid}`,
      `lifeform=${isLifeform}`,
      // Add other important stats
      hp ? `hp=${hp}` : '',
      mp ? `mp=${mp}` : '',
      speed ? `speed=${speed}` : '',
      accuracy ? `accuracy=${accuracy}` : '',
      avoidance ? `avoidance=${avoidance}` : '',
      // ... we could add more, but for a preset these are common
    ].filter(Boolean);

    const content = lines.join('\n');
    const filename = `${name.toLowerCase().replace(/\s+/g, '_')}_base.txt`;
    
    try {
      const success = await window.electronAPI.saveEnemyPreset(projectPath, filename, content);
      if (success) {
        // Refresh presets list
        const list = await window.electronAPI.listEnemies(projectPath);
        setPresets(list);
        setInclude(`enemies/${filename}`);
        toast({
          title: "Preset Saved",
          description: `Enemy specifications saved to enemies/${filename}`,
          variant: "default",
        });
      }
    } catch (e) {
      console.error('Failed to save preset:', e);
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
  const [renderLayers, setRenderLayers] = useState<string>(() => enemy?.properties?.render_layers || '');
  const [animationSlots, setAnimationSlots] = useState<string>(() => enemy?.properties?.animation_slots || '');
  const [suppressHp, setSuppressHp] = useState<boolean>(() => (enemy?.properties?.suppress_hp === 'true'));

  // Audio
  const [sfxAttack, setSfxAttack] = useState<string>(() => enemy?.properties?.sfx_attack || '');
  const [sfxHit, setSfxHit] = useState<string>(() => enemy?.properties?.sfx_hit || '');
  const [sfxDie, setSfxDie] = useState<string>(() => enemy?.properties?.sfx_die || '');
  const [sfxCritDie, setSfxCritDie] = useState<string>(() => enemy?.properties?.sfx_critdie || '');

  // Stats
  const [hp, setHp] = useState<string>(() => enemy?.properties?.hp || '');
  const [mp, setMp] = useState<string>(() => enemy?.properties?.mp || '');
  const [attack, setAttack] = useState<string>(() => enemy?.properties?.attack || '');
  const [defense, setDefense] = useState<string>(() => enemy?.properties?.defense || '');
  const [speed, setSpeed] = useState<string>(() => enemy?.properties?.speed || '');
  const [xp, setXp] = useState<string>(() => enemy?.properties?.xp || '');
  const [gold, setGold] = useState<string>(() => enemy?.properties?.gold || '');
  const [meleeRange, setMeleeRange] = useState<string>(() => enemy?.properties?.melee_range || '');
  const [threadRange, setThreadRange] = useState<string>(() => enemy?.properties?.thread_range || '');

  // Advanced
  const [statPerLevel, setStatPerLevel] = useState<string>(() => enemy?.properties?.stat_per_level || '');
  const [xpScaling, setXpScaling] = useState<string>(() => enemy?.properties?.xp_scaling || '');
  const [vulnerable, setVulnerable] = useState<string>(() => enemy?.properties?.vulnerable || '');
  // More advanced stats (resists, regen, utility)
  const [resistDamageOverTime, setResistDamageOverTime] = useState<string>(() => enemy?.properties?.resist_damage_over_time || '');
  const [resistSlow, setResistSlow] = useState<string>(() => enemy?.properties?.resist_slow || '');
  const [resistStun, setResistStun] = useState<string>(() => enemy?.properties?.resist_stun || '');
  const [resistKnockback, setResistKnockback] = useState<string>(() => enemy?.properties?.resist_knockback || '');
  const [resistStatDebuff, setResistStatDebuff] = useState<string>(() => enemy?.properties?.resist_stat_debuff || '');
  const [resistDamageReflect, setResistDamageReflect] = useState<string>(() => enemy?.properties?.resist_damage_reflect || '');
  const [xpGain, setXpGain] = useState<string>(() => enemy?.properties?.xp_gain || '');
  const [hpRegen, setHpRegen] = useState<string>(() => enemy?.properties?.hp_regen || '');
  const [mpRegen, setMpRegen] = useState<string>(() => enemy?.properties?.mp_regen || '');
  const [hpSteal, setHpSteal] = useState<string>(() => enemy?.properties?.hp_steal || '');
  const [mpSteal, setMpSteal] = useState<string>(() => enemy?.properties?.mp_steal || '');
  const [accuracy, setAccuracy] = useState<string>(() => enemy?.properties?.accuracy || '');
  const [avoidance, setAvoidance] = useState<string>(() => enemy?.properties?.avoidance || '');
  const [crit, setCrit] = useState<string>(() => enemy?.properties?.crit || '');
  const [absorbMin, setAbsorbMin] = useState<string>(() => enemy?.properties?.absorb_min || '');
  const [absorbMax, setAbsorbMax] = useState<string>(() => enemy?.properties?.absorb_max || '');
  const [poise, setPoise] = useState<string>(() => enemy?.properties?.poise || '');
  const [reflectChance, setReflectChance] = useState<string>(() => enemy?.properties?.reflect_chance || '');
  const [returnDamage, setReturnDamage] = useState<string>(() => enemy?.properties?.return_damage || '');
  const [currencyFind, setCurrencyFind] = useState<string>(() => enemy?.properties?.currency_find || '');
  const [itemFind, setItemFind] = useState<string>(() => enemy?.properties?.item_find || '');
  const [stealth, setStealth] = useState<string>(() => enemy?.properties?.stealth || '');

  // Combat & powers
  const [powers, setPowers] = useState<string>(() => enemy?.properties?.powers || '');
  const [script, setScript] = useState<string>(() => enemy?.properties?.script || '');

  // Loot
  const [lootTable, setLootTable] = useState<string>(() => enemy?.properties?.loot || '');
  const [dropChance, setDropChance] = useState<string>(() => enemy?.properties?.drop_chance || '');

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
  const [threatRange, setThreatRange] = useState<string>(() => enemy?.properties?.threat_range || '');
  const [fleeRange, setFleeRange] = useState<string>(() => enemy?.properties?.flee_range || '');
  const [fleeDuration, setFleeDuration] = useState<string>(() => enemy?.properties?.flee_duration || '');
  const [fleeCooldown, setFleeCooldown] = useState<string>(() => enemy?.properties?.flee_cooldown || '');
  const [chancePursue, setChancePursue] = useState<string>(() => enemy?.properties?.chance_pursue || '');
  const [chanceFlee, setChanceFlee] = useState<string>(() => enemy?.properties?.chance_flee || '');
  const [turnDelay, setTurnDelay] = useState<string>(() => enemy?.properties?.turn_delay || '');
  const [wanderRadius, setWanderRadius] = useState<string>(() => enemy?.properties?.wander_radius || '');
  const [waypoints, setWaypoints] = useState<string>(() => enemy?.properties?.waypoints || '');
  const [waypointPause, setWaypointPause] = useState<string>(() => enemy?.properties?.waypoint_pause || '');
  const [isFacing, setIsFacing] = useState<boolean>(() => (enemy?.properties?.facing === 'true'));
  const [isFlying, setIsFlying] = useState<boolean>(() => (enemy?.properties?.flying === 'true'));
  const [isIntangible, setIsIntangible] = useState<boolean>(() => (enemy?.properties?.intangible === 'true'));

  // Attack & Skills
  const [powersList, setPowersList] = useState<string>(() => enemy?.properties?.powers || '');
  const [passivePowers, setPassivePowers] = useState<string>(() => enemy?.properties?.passive_powers || '');
  const [cooldown, setCooldown] = useState<string>(() => enemy?.properties?.cooldown || '');
  const [cooldownHit, setCooldownHit] = useState<string>(() => enemy?.properties?.cooldown_hit || '');

  // Loot
  const [loot, setLoot] = useState<string>(() => enemy?.properties?.loot || '');
  const [lootCount, setLootCount] = useState<string>(() => enemy?.properties?.loot_count || '');
  const [firstDefeatLoot, setFirstDefeatLoot] = useState<string>(() => enemy?.properties?.first_defeat_loot || '');

  // Quest
  const [questLoot, setQuestLoot] = useState<string>(() => enemy?.properties?.quest_loot || '');
  const [defeatStatus, setDefeatStatus] = useState<string>(() => enemy?.properties?.defeat_status || '');

  // Flags / custom
  const [customPropsRaw, setCustomPropsRaw] = useState<string>(() => {
    if (!enemy?.properties) return '';
    const pairs = Object.entries(enemy.properties).filter(([k]) => ![
      'tilesetPath','portraitPath','gfx','render_layers','animation_slots','suppress_hp','hp','mp','attack','defense','speed','xp','gold',
      'melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform',
      'powers','passive_powers','cooldown','cooldown_hit','script','loot','loot_count','first_defeat_loot','quest_loot','defeat_status','categories','include'
    ].includes(k));
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
      setInclude(enemy?.properties?.include || '');

      setTilesetPath((enemy?.properties?.tilesetPath as string) || '');
      setPortraitPath((enemy?.properties?.portraitPath as string) || '');
      setGfx((enemy?.properties?.gfx as string) || '');
      setRenderLayers(enemy?.properties?.render_layers || '');
      setAnimationSlots(enemy?.properties?.animation_slots || '');
      setSuppressHp(enemy?.properties?.suppress_hp === 'true');

      setSfxAttack(enemy?.properties?.sfx_attack || '');
      setSfxHit(enemy?.properties?.sfx_hit || '');
      setSfxDie(enemy?.properties?.sfx_die || '');
      setSfxCritDie(enemy?.properties?.sfx_critdie || '');

      setHp(enemy?.properties?.hp || '');
      setMp(enemy?.properties?.mp || '');
      setAttack(enemy?.properties?.attack || '');
      setDefense(enemy?.properties?.defense || '');
      setSpeed(enemy?.properties?.speed || '');
      setXp(enemy?.properties?.xp || '');
      setGold(enemy?.properties?.gold || '');
      setMeleeRange(enemy?.properties?.melee_range || '');
      setThreadRange(enemy?.properties?.thread_range || '');

      setStatPerLevel(enemy?.properties?.stat_per_level || '');
      setXpScaling(enemy?.properties?.xp_scaling || '');
      setVulnerable(enemy?.properties?.vulnerable || '');

      setIsMelee(enemy?.properties?.melee === 'true');
      setIsRanged(enemy?.properties?.ranged === 'true');
      setIsCaster(enemy?.properties?.caster === 'true');
      setIsSummoner(enemy?.properties?.summoner === 'true');
      setIsBoss(enemy?.properties?.boss === 'true');
      setIsPassive(enemy?.properties?.passive === 'true');
      setIsStationary(enemy?.properties?.stationary === 'true');

      setCombatStyle((enemy?.properties?.combat_style as 'default'|'aggressive'|'passive') || 'default');
      setThreatRange(enemy?.properties?.threat_range || '');
      setFleeRange(enemy?.properties?.flee_range || '');
      setFleeDuration(enemy?.properties?.flee_duration || '');
      setFleeCooldown(enemy?.properties?.flee_cooldown || '');
      setChancePursue(enemy?.properties?.chance_pursue || '');
      setChanceFlee(enemy?.properties?.chance_flee || '');
      setTurnDelay(enemy?.properties?.turn_delay || '');
      setWanderRadius(enemy?.properties?.wander_radius || '');
      setWaypoints(enemy?.properties?.waypoints || '');
      setWaypointPause(enemy?.properties?.waypoint_pause || '');
      setIsFacing(enemy?.properties?.facing === 'true');
      setIsFlying(enemy?.properties?.flying === 'true');
      setIsIntangible(enemy?.properties?.intangible === 'true');

      setPowersList(enemy?.properties?.powers || '');
      setPassivePowers(enemy?.properties?.passive_powers || '');
      setCooldown(enemy?.properties?.cooldown || '');
      setCooldownHit(enemy?.properties?.cooldown_hit || '');

      setLoot(enemy?.properties?.loot || '');
      setLootCount(enemy?.properties?.loot_count || '');
      setFirstDefeatLoot(enemy?.properties?.first_defeat_loot || '');

      setQuestLoot(enemy?.properties?.quest_loot || '');
      setDefeatStatus(enemy?.properties?.defeat_status || '');

      setCustomPropsRaw(() => {
        if (!enemy?.properties) return '';
        const pairs = Object.entries(enemy.properties).filter(([k]) => !['tilesetPath','portraitPath','gfx','render_layers','animation_slots','suppress_hp','hp','mp','attack','defense','speed','xp','gold','melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform','powers','passive_powers','cooldown','cooldown_hit','script','loot','loot_count','first_defeat_loot','quest_loot','defeat_status','categories','combat_style','threat_range','flee_range','flee_duration','flee_cooldown','chance_pursue','chance_flee','turn_delay','wander_radius','waypoints','waypoint_pause','facing','flying','intangible','include'].includes(k));
        return pairs.map(([k,v]) => `${k}=${v}`).join('\n');
      });

      setCategory(enemy?.category || '');
      setInclude(enemy?.properties?.include || '');

      setActiveTab('identity');
    }, 0);

    return () => clearTimeout(t);
  }, [open, enemy]);

  const handleClose = () => onOpenChange ? onOpenChange(false) : undefined;

  const handleSave = () => {
    if (!enemy) {
      handleClose();
      return;
    }

    const newProps: Record<string, string> = { ...(enemy.properties || {}) };
    const knownKeys = [
      'tilesetPath','portraitPath','gfx','render_layers','animation_slots','suppress_hp','hp','mp','attack','defense','speed','xp','gold',
      'melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform',
      'powers','passive_powers','cooldown','cooldown_hit','script','loot','loot_count','first_defeat_loot','quest_loot','defeat_status','categories','sfx_attack','sfx_hit','sfx_die','sfx_critdie','melee_range','thread_range','combat_style','threat_range','flee_range','flee_duration','flee_cooldown','chance_pursue','chance_flee','turn_delay','wander_radius','waypoints','flying','intangible','include'
    ];

    if (rarity) newProps.rarity = rarity; else delete newProps.rarity;
    if (include) newProps.include = include; else delete newProps.include;

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

    if (hp) newProps.hp = hp; else delete newProps.hp;
    if (mp) newProps.mp = mp; else delete newProps.mp;
    if (attack) newProps.attack = attack; else delete newProps.attack;
    if (defense) newProps.defense = defense; else delete newProps.defense;
    if (speed) newProps.speed = speed; else delete newProps.speed;
    if (xp) newProps.xp = xp; else delete newProps.xp;
    if (gold) newProps.gold = gold; else delete newProps.gold;

    if (statPerLevel) newProps.stat_per_level = statPerLevel; else delete newProps.stat_per_level;
    if (xpScaling) newProps.xp_scaling = xpScaling; else delete newProps.xp_scaling;
    if (vulnerable) newProps.vulnerable = vulnerable; else delete newProps.vulnerable;

    if (meleeRange) newProps.melee_range = meleeRange; else delete newProps.melee_range;
    if (threadRange) newProps.thread_range = threadRange; else delete newProps.thread_range;

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

    if (powersList) newProps.powers = powersList; else delete newProps.powers;
    if (passivePowers) newProps.passive_powers = passivePowers; else delete newProps.passive_powers;
    if (cooldown) newProps.cooldown = cooldown; else delete newProps.cooldown;
    if (cooldownHit) newProps.cooldown_hit = cooldownHit; else delete newProps.cooldown_hit;

    if (loot) newProps.loot = loot; else delete newProps.loot;
    if (lootCount) newProps.loot_count = lootCount; else delete newProps.loot_count;
    if (firstDefeatLoot) newProps.first_defeat_loot = firstDefeatLoot; else delete newProps.first_defeat_loot;

    if (questLoot) newProps.quest_loot = questLoot; else delete newProps.quest_loot;
    if (defeatStatus) newProps.defeat_status = defeatStatus; else delete newProps.defeat_status;

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

  const handleSaveAndEdit = () => {
    if (!enemy) return;
    const newProps: Record<string, string> = { ...(enemy.properties || {}) };
    const knownKeys = [
      'tilesetPath','portraitPath','gfx','render_layers','animation_slots','suppress_hp','hp','mp','attack','defense','speed','xp','gold',
      'melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform',
      'powers','passive_powers','cooldown','cooldown_hit','script','loot','loot_count','first_defeat_loot','quest_loot','defeat_status','categories','sfx_attack','sfx_hit','sfx_die','sfx_critdie','melee_range','thread_range','combat_style','threat_range','flee_range','flee_duration','flee_cooldown','chance_pursue','chance_flee','turn_delay','wander_radius','waypoints','waypoint_pause','facing','flying','intangible','include'
    ];
    if (rarity) newProps.rarity = rarity; else delete newProps.rarity;
    if (include) newProps.include = include; else delete newProps.include;
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
    if (hp) newProps.hp = hp; else delete newProps.hp;
    if (mp) newProps.mp = mp; else delete newProps.mp;
    if (attack) newProps.attack = attack; else delete newProps.attack;
    if (defense) newProps.defense = defense; else delete newProps.defense;
    if (speed) newProps.speed = speed; else delete newProps.speed;
    if (xp) newProps.xp = xp; else delete newProps.xp;
    if (gold) newProps.gold = gold; else delete newProps.gold;
    if (statPerLevel) newProps.stat_per_level = statPerLevel; else delete newProps.stat_per_level;
    if (xpScaling) newProps.xp_scaling = xpScaling; else delete newProps.xp_scaling;
    if (vulnerable) newProps.vulnerable = vulnerable; else delete newProps.vulnerable;
    if (meleeRange) newProps.melee_range = meleeRange; else delete newProps.melee_range;
    if (threadRange) newProps.thread_range = threadRange; else delete newProps.thread_range;
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
    if (powersList) newProps.powers = powersList; else delete newProps.powers;
    if (passivePowers) newProps.passive_powers = passivePowers; else delete newProps.passive_powers;
    if (cooldown) newProps.cooldown = cooldown; else delete newProps.cooldown;
    if (cooldownHit) newProps.cooldown_hit = cooldownHit; else delete newProps.cooldown_hit;
    if (loot) newProps.loot = loot; else delete newProps.loot;
    if (lootCount) newProps.loot_count = lootCount; else delete newProps.loot_count;
    if (firstDefeatLoot) newProps.first_defeat_loot = firstDefeatLoot; else delete newProps.first_defeat_loot;
    if (questLoot) newProps.quest_loot = questLoot; else delete newProps.quest_loot;
    if (defeatStatus) newProps.defeat_status = defeatStatus; else delete newProps.defeat_status;
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
    const updated: MapObject = {
      ...enemy,
      name,
      level: Number.isFinite(Number(level)) ? Number(level) : enemy.level,
      number: Number.isFinite(Number(count)) ? Number(count) : enemy.number,
      category: category,
      properties: newProps,
    };
    onSave?.(updated);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange?.(v)}>
      <DialogContent className="w-[820px] max-w-[90vw] h-[680px] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-3 flex flex-row items-center justify-between border-b relative">
          <div className="flex items-center gap-6">
            <DialogTitle className="whitespace-nowrap">Edit Enemy</DialogTitle>
            <div className="flex items-center gap-1.5 bg-muted/20 p-1 rounded-md border border-border/50">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <Tooltip key={tab.key} content={tab.tooltip} side="bottom">
                    <button
                      type="button"
                      className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
                        isActive 
                          ? 'bg-background shadow-sm text-orange-500 ring-1 ring-border/50' 
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                      onClick={() => setActiveTab(tab.key)}
                      aria-label={tab.tooltip}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 p-6 min-w-0 overflow-y-auto minimal-scroll">
            {activeTab === 'identity' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column: Name, Stats, Flags */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="block text-sm font-medium">Name</label>
                        <Tooltip content="This is the enemy's name as it appears in the game." side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-3.5 h-3.5" /></button>
                        </Tooltip>
                      </div>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enemy name" />
                    </div>

                    <div className="grid grid-cols-[100px_140px] gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Level</label>
                        <Input value={String(level)} onChange={(e) => setLevel(parseInt(e.target.value || '0') || 0)} placeholder="Level" className="w-full" />
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <label className="block text-sm font-medium">Rarity</label>
                          <Tooltip content="Enemy rarity. Used by loot tables, UI highlighting and content design. Does not control spawn rate by itself." side="top">
                            <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-3.5 h-3.5" /></button>
                          </Tooltip>
                        </div>
                        <Select value={rarity} onValueChange={(v: string) => setRarity(v as 'common'|'uncommon'|'rare'|'unique')}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select rarity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="common">Common</SelectItem>
                            <SelectItem value="uncommon">Uncommon</SelectItem>
                            <SelectItem value="rare">Rare</SelectItem>
                            <SelectItem value="unique">Unique</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="h-4 w-4" checked={isHumanoid} onChange={(e) => setIsHumanoid(e.target.checked)} />
                        <span className="text-sm font-medium">Humanoid</span>
                        <Tooltip content={"While a character who transforms into a monster normally cannot communicate with NPCs, when they transform into a creature with an active humanoid flag, they do not lose the ability to converse with NPCs."} side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-3.5 h-3.5" /></button>
                        </Tooltip>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="h-4 w-4" checked={isLifeform} onChange={(e) => setIsLifeform(e.target.checked)} />
                        <span className="text-sm font-medium">Lifeform</span>
                        <Tooltip content={"When an enemy is eliminated if this is checked game will show it as \"Dead\" if not \"Destroyed\""} side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-3.5 h-3.5" /></button>
                        </Tooltip>
                      </label>
                    </div>
                  </div>

                  {/* Right Column: Category */}
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-1 mb-1">
                      <label className="block text-sm font-medium">Category</label>
                      <Tooltip content="It is used to organize the mass spawning of certain types of enemies on maps or to filter which types of enemies abilities will damage." side="top">
                        <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-3.5 h-3.5" /></button>
                      </Tooltip>
                    </div>
                    
                    <div className="flex-1 flex flex-wrap content-start gap-1 p-2 border rounded-md bg-muted/20 min-h-[160px] overflow-y-auto minimal-scroll">
                      {selectedCategories.length === 0 && !isAddingCategory && (
                        <span className="text-xs text-muted-foreground py-1 px-1">No categories selected</span>
                      )}
                      {selectedCategories.map(cat => (
                        <Badge 
                          key={cat} 
                          variant="secondary" 
                          className="bg-orange-500/10 text-orange-600 border-orange-200/50 hover:bg-orange-500/20 gap-1 pr-1"
                        >
                          {cat}
                          <X 
                            className="w-3 h-3 cursor-pointer hover:text-destructive" 
                            onClick={() => toggleCategory(cat)}
                          />
                        </Badge>
                      ))}
                      {isAddingCategory ? (
                        <div className="flex items-center gap-1 w-full mt-1">
                          <Input 
                            value={newCatInput} 
                            onChange={(e) => setNewCatInput(e.target.value)} 
                            placeholder="Type..." 
                            autoFocus
                            className="h-7 text-xs flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addCategory();
                              if (e.key === 'Escape') setIsAddingCategory(false);
                            }}
                          />
                          <Check className="w-4 h-4 text-emerald-500 cursor-pointer" onClick={addCategory} />
                          <X className="w-4 h-4 text-muted-foreground cursor-pointer" onClick={() => setIsAddingCategory(false)} />
                        </div>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                          onClick={() => setIsAddingCategory(true)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Tag
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-1">
                    <label className="block text-sm font-medium">Preset</label>
                    <Tooltip content="Include another enemy file as a base for this enemy's properties." side="top">
                      <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-3.5 h-3.5" /></button>
                    </Tooltip>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs gap-1.5 border-orange-500/30 text-orange-600 hover:bg-orange-500/10 hover:border-orange-500/50"
                      onClick={handleSaveAsPreset}
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save as Preset
                    </Button>
                    <Tooltip content="Save this enemy specifications as a preset to use in other enemies." side="top">
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>

                  <Select value={include} onValueChange={setInclude}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={isLoadingPresets ? "Loading presets..." : (presets.length > 0 ? "Select a preset..." : "no saved enemy preset")} />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.length > 0 ? (
                        <>
                          <SelectItem value=" ">None (Clear)</SelectItem>
                          {presets.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </>
                      ) : (
                        <div className="p-2 text-xs text-muted-foreground text-center">
                          no saved enemy preset
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {activeTab === 'visual' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tileset</label>
                  <div className="flex gap-2">
                    <Input value={tilesetPath} onChange={(e) => setTilesetPath(e.target.value)} placeholder="Path to animation/tileset" />
                    <Button variant="outline" onClick={async () => {
                      try {
                        type EAPI = { selectTilesetFile?: () => Promise<string | undefined> };
                        const sel = await (window as unknown as { electronAPI?: EAPI })?.electronAPI?.selectTilesetFile?.();
                        if (sel) setTilesetPath(sel);
                      } catch {
                        // ignore
                      }
                    }}>Browse</Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Portrait</label>
                  <div className="flex gap-2">
                    <Input value={portraitPath} onChange={(e) => setPortraitPath(e.target.value)} placeholder="Path to portrait image" />
                    <Button variant="outline" onClick={async () => {
                      try {
                        type EAPI = { selectTilesetFile?: () => Promise<string | undefined> };
                        const sel = await (window as unknown as { electronAPI?: EAPI })?.electronAPI?.selectTilesetFile?.();
                        if (sel) setPortraitPath(sel);
                      } catch {
                        // ignore
                      }
                    }}>Browse</Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">GFX</label>
                  <Input value={gfx} onChange={(e) => setGfx(e.target.value)} placeholder="e.g. animations/enemy/antlion.txt" />
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">SFX: Attack</label>
                  <Input value={sfxAttack} onChange={(e) => setSfxAttack(e.target.value)} placeholder="path/to/attack.wav" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SFX: Hit</label>
                  <Input value={sfxHit} onChange={(e) => setSfxHit(e.target.value)} placeholder="path/to/hit.wav" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SFX: Die</label>
                  <Input value={sfxDie} onChange={(e) => setSfxDie(e.target.value)} placeholder="path/to/die.wav" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SFX: Critical Die</label>
                  <Input value={sfxCritDie} onChange={(e) => setSfxCritDie(e.target.value)} placeholder="path/to/critdie.wav" />
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">HP</label>
                    <Input value={hp} onChange={(e) => setHp(e.target.value)} placeholder="Max hit points" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">MP</label>
                    <Input value={mp} onChange={(e) => setMp(e.target.value)} placeholder="Magic points" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Attack</label>
                    <Input value={attack} onChange={(e) => setAttack(e.target.value)} placeholder="Physical attack" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Defense</label>
                    <Input value={defense} onChange={(e) => setDefense(e.target.value)} placeholder="Physical defense" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Speed</label>
                    <Input value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="Movement / turn speed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">XP</label>
                    <Input value={xp} onChange={(e) => setXp(e.target.value)} placeholder="XP reward" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Gold</label>
                    <Input value={gold} onChange={(e) => setGold(e.target.value)} placeholder="Gold reward" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Melee Range</label>
                    <Input value={meleeRange} onChange={(e) => setMeleeRange(e.target.value)} placeholder="Melee range" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Thread Range</label>
                    <Input value={threadRange} onChange={(e) => setThreadRange(e.target.value)} placeholder="Thread range" />
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold mb-2">Advanced Stats</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Stat Per Level</label>
                      <Input value={statPerLevel} onChange={(e) => setStatPerLevel(e.target.value)} placeholder="e.g. +1 per level" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">XP Scaling</label>
                      <Input value={xpScaling} onChange={(e) => setXpScaling(e.target.value)} placeholder="e.g. 1.2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Vulnerable</label>
                      <Input value={vulnerable} onChange={(e) => setVulnerable(e.target.value)} placeholder="e.g. fire" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Resist Damage Over Time</label>
                      <Input value={resistDamageOverTime} onChange={(e) => setResistDamageOverTime(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Resist Slow</label>
                      <Input value={resistSlow} onChange={(e) => setResistSlow(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Resist Stun</label>
                      <Input value={resistStun} onChange={(e) => setResistStun(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Resist Knockback</label>
                      <Input value={resistKnockback} onChange={(e) => setResistKnockback(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Resist Stat Debuff</label>
                      <Input value={resistStatDebuff} onChange={(e) => setResistStatDebuff(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Resist Damage Reflect</label>
                      <Input value={resistDamageReflect} onChange={(e) => setResistDamageReflect(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">XP Gain</label>
                      <Input value={xpGain} onChange={(e) => setXpGain(e.target.value)} placeholder="xp gain modifier" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">HP Regen</label>
                      <Input value={hpRegen} onChange={(e) => setHpRegen(e.target.value)} placeholder="hp/sec" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">MP Regen</label>
                      <Input value={mpRegen} onChange={(e) => setMpRegen(e.target.value)} placeholder="mp/sec" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">HP Steal</label>
                      <Input value={hpSteal} onChange={(e) => setHpSteal(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">MP Steal</label>
                      <Input value={mpSteal} onChange={(e) => setMpSteal(e.target.value)} placeholder="% or value" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Accuracy</label>
                      <Input value={accuracy} onChange={(e) => setAccuracy(e.target.value)} placeholder="accuracy" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Avoidance</label>
                      <Input value={avoidance} onChange={(e) => setAvoidance(e.target.value)} placeholder="avoidance" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Crit</label>
                      <Input value={crit} onChange={(e) => setCrit(e.target.value)} placeholder="crit rate" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Absorb Min</label>
                      <Input value={absorbMin} onChange={(e) => setAbsorbMin(e.target.value)} placeholder="min absorb" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Absorb Max</label>
                      <Input value={absorbMax} onChange={(e) => setAbsorbMax(e.target.value)} placeholder="max absorb" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Poise</label>
                      <Input value={poise} onChange={(e) => setPoise(e.target.value)} placeholder="poise" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Reflect Chance</label>
                      <Input value={reflectChance} onChange={(e) => setReflectChance(e.target.value)} placeholder="% chance" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Return Damage</label>
                      <Input value={returnDamage} onChange={(e) => setReturnDamage(e.target.value)} placeholder="damage returned" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Currency Find</label>
                      <Input value={currencyFind} onChange={(e) => setCurrencyFind(e.target.value)} placeholder="currency find modifier" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Item Find</label>
                      <Input value={itemFind} onChange={(e) => setItemFind(e.target.value)} placeholder="item find modifier" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Stealth</label>
                      <Input value={stealth} onChange={(e) => setStealth(e.target.value)} placeholder="stealth" />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mt-3">
                    <p><strong>Damage Types:</strong> According to the types defined in <code>engine/damage_types.txt</code>, stats like <code>physical_min</code>, <code>physical_max</code> can be used.</p>
                    <p className="mt-1"><strong>Elemental Resistances:</strong> You can define resistances to elements by appending <code>_resist</code> to an element id (for example: <code>fire_resist</code>).</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'behavior' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Combat Style</h3>
                  <div className="flex gap-2 mb-4">
                    {[
                      { id: 'default', label: 'Default' },
                      { id: 'aggressive', label: 'Aggressive' },
                      { id: 'passive', label: 'Passive' }
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setCombatStyle(style.id as any)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          combatStyle === style.id
                            ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                            : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="px-3 py-2.5 rounded-lg bg-muted/30 border border-border/50 min-h-[50px] flex items-center">
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      {combatStyle === 'default' && "Default: The enemy enters combat only when the hero comes into the threat range."}
                      {combatStyle === 'aggressive' && "Aggressive: The creature is always in a combat state regardless of the player's proximity."}
                      {combatStyle === 'passive' && "Passive: The enemy is non-hostile by default and must be attacked by the player before it will enter a combat state and fight back."}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center gap-1 mb-3">
                    <h3 className="text-sm font-semibold">Thread Range</h3>
                    <Tooltip content={
                      <>
                        <p>If you do not specify the second value, the engine defaults the "stop distance" to double the initial engagement radius. For example, if you set the threat range to 5, the enemy will start chasing you at 5 units away and stop chasing you once you are 10 units away.</p>
                        <p className="mt-2">You can think of threat_range as a "hostility bubble" surrounding the enemy. Once you step inside the first bubble, you have tripped their alarm; you must then move completely outside the second, larger bubble to "break the invisible tether" and make them give up the chase.</p>
                      </>
                    } side="top">
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium">Engage Distance</label>
                        <Tooltip content="This is the radius within which a creature detects the hero and begins to chase them" side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <Input 
                        type="number" 
                        value={threatRange.split(',')[0] || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const parts = threatRange.split(',');
                          const stop = parts[1] || '';
                          setThreatRange(stop ? `${val},${stop}` : val);
                        }} 
                        className="h-9"
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium">Stop Distance</label>
                        <Tooltip content="This is the radius at which the creature will stop pursuing the target" side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <Input 
                        type="number" 
                        value={threatRange.split(',')[1] || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const parts = threatRange.split(',');
                          const engage = parts[0] || '0';
                          setThreatRange(val ? `${engage},${val}` : engage);
                        }} 
                        className="h-9"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Tactical Response</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <label className="text-sm font-medium">Chance to Pursue</label>
                          <Tooltip content="This is a percentage chance that a creature will decide to chase its target. When a player enters the creature's detection zone, the engine uses this value to determine if the enemy will actively follow the player or remain at its current position." side="top">
                            <button type="button" className="text-muted-foreground hover:text-foreground">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                        <span className="text-xs font-mono text-orange-500 font-bold">{chancePursue || 0}%</span>
                      </div>
                      <Slider 
                        value={parseInt(chancePursue || '0', 10)} 
                        onChange={(val) => setChancePursue(String(val))} 
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <label className="text-sm font-medium">Chance to Flee</label>
                          <Tooltip content="This represents the percentage chance that a creature will run away from its target. This is often used to simulate 'cowardly' behavior or tactical repositioning for ranged attackers." side="top">
                            <button type="button" className="text-muted-foreground hover:text-foreground">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                        <span className="text-xs font-mono text-orange-500 font-bold">{chanceFlee || 0}%</span>
                      </div>
                      <Slider 
                        value={parseInt(chanceFlee || '0', 10)} 
                        onChange={(val) => setChanceFlee(String(val))} 
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Flee Mechanics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium text-[11px] whitespace-nowrap">Flee Range</label>
                        <Tooltip content="This is a numerical radius that defines the distance at which a creature begins moving to a safe location. If not defined, the engine defaults it to half of the engagement distance." side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <Input 
                        type="number" 
                        value={fleeRange} 
                        onChange={(e) => setFleeRange(e.target.value)} 
                        className="h-9"
                        placeholder="Radius"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium text-[11px] whitespace-nowrap">Flee Duration</label>
                        <Tooltip content="This is the minimum amount of time a creature will spend fleeing. While it will flee for at least this duration, it may continue to do so longer depending on the distance from the player. Time can be specified in milliseconds ('ms') or seconds ('s')." side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <Input 
                        value={fleeDuration} 
                        onChange={(e) => setFleeDuration(e.target.value)} 
                        className="h-9"
                        placeholder="e.g. 2s"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium text-[11px] whitespace-nowrap">Flee Cooldown</label>
                        <Tooltip content="This defines the waiting period required before the creature is physically able to start fleeing again. Measured in 'ms' or 's'." side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <Input 
                        value={fleeCooldown} 
                        onChange={(e) => setFleeCooldown(e.target.value)} 
                        className="h-9"
                        placeholder="e.g. 5s"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Movement & Patrol</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium">Turn Delay</label>
                        <Tooltip content="The time it takes for the enemy to turn towards the target. Supports 'ms' or 's'." side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <Input 
                        value={turnDelay} 
                        onChange={(e) => setTurnDelay(e.target.value)} 
                        className="h-9"
                        placeholder="e.g. 250ms"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium">Waypoint Pause</label>
                        <Tooltip content="The wait time at patrol points (waypoints). Supports 'ms' or 's'." side="top">
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <Input 
                        value={waypointPause} 
                        onChange={(e) => setWaypointPause(e.target.value)} 
                        className="h-9"
                        placeholder="e.g. 1s"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Movement Capabilities</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 transition-colors" 
                        checked={isFacing} 
                        onChange={(e) => setIsFacing(e.target.checked)} 
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-[11px] whitespace-nowrap">Facing</span>
                        <Tooltip content="Determines whether the enemy will turn to face its target." side="top">
                          <button type="button" className="text-muted-foreground group-hover:text-foreground transition-colors">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 transition-colors" 
                        checked={isFlying} 
                        onChange={(e) => setIsFlying(e.target.checked)} 
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-[11px] whitespace-nowrap">Flying</span>
                        <Tooltip content="Ability to fly over water or gaps." side="top">
                          <button type="button" className="text-muted-foreground group-hover:text-foreground transition-colors">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 transition-colors" 
                        checked={isIntangible} 
                        onChange={(e) => setIsIntangible(e.target.checked)} 
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-[11px] whitespace-nowrap">Intangible</span>
                        <Tooltip content="Ability to move through walls." side="top">
                          <button type="button" className="text-muted-foreground group-hover:text-foreground transition-colors">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'combat' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Powers / Abilities (comma-separated)</label>
                  <Input value={powers} onChange={(e) => setPowers(e.target.value)} placeholder="e.g. slam,stomp,acid" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Script / Behavior</label>
                  <textarea value={script} onChange={(e) => setScript(e.target.value)} className="w-full h-24 rounded-md border border-border p-2 text-sm" />
                </div>
              </div>
            )}

            {activeTab === 'loot' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Loot Table</label>
                  <Input value={lootTable} onChange={(e) => setLootTable(e.target.value)} placeholder="Name of loot table or comma-separated items" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Drop Chance (%)</label>
                  <Input value={dropChance} onChange={(e) => setDropChance(e.target.value)} placeholder="e.g. 50" />
                </div>
              </div>
            )}

            {activeTab === 'flags' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Custom Properties (one per line, KEY=VALUE)</label>
                  <textarea value={customPropsRaw} onChange={(e) => setCustomPropsRaw(e.target.value)} className="w-full h-48 rounded-md border border-border p-2 text-sm" />
                </div>
              </div>
            )}
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          className="absolute bottom-3 right-3 z-[60] bg-orange-500 hover:bg-orange-600 text-white w-9 h-9 p-0 flex items-center justify-center rounded-lg shadow-xl border border-background active:scale-95 transition-all"
          title="Save"
        >
          <Save className="w-4 h-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
