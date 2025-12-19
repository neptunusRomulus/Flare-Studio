import React, { useEffect, useState } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { User, Eye, BarChart2, Settings, Sword, Gift, Flag, MapPin, Volume2, HelpCircle } from 'lucide-react';
import type { MapObject } from '@/types';
import type { LucideIcon } from 'lucide-react';

type TabKey = 'identity' | 'visual' | 'audio' | 'stats' | 'behavior' | 'attack' | 'loot' | 'quest' | 'combat' | 'flags';

const TAB_CONFIG: Array<{ key: TabKey; icon: LucideIcon; tooltip: string }> = [
  { key: 'identity', icon: User, tooltip: 'Identity' },
  { key: 'stats', icon: BarChart2, tooltip: 'Stats' },
  { key: 'behavior', icon: Settings, tooltip: 'Movement and AI Behaviors' },
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
}

export default function EditEnemyWindow({ open, onOpenChange, enemy, onSave }: EditEnemyWindowProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [name, setName] = useState(() => enemy?.name || '');
  const [level, setLevel] = useState<number>(() => enemy?.level ?? 1);
  const [rarity, setRarity] = useState<'common'|'uncommon'|'rare'|'unique'>(() => (enemy?.properties?.rarity as 'common'|'uncommon'|'rare'|'unique') || 'common');
  const [count, setCount] = useState<number>(() => enemy?.number ?? 1);
  const [category, setCategory] = useState(() => enemy?.category || '');
  const [categories, setCategories] = useState(() => enemy?.properties?.categories || '');
  const [isHumanoid, setIsHumanoid] = useState<boolean>(() => (enemy?.properties?.humanoid === 'true'));
  const [isLifeform, setIsLifeform] = useState<boolean>(() => (enemy?.properties?.lifeform === 'false' ? false : true));

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
  // ... (other advanced stats skipped for brevity) ...

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
      'powers','passive_powers','cooldown','cooldown_hit','script','loot','loot_count','first_defeat_loot','quest_loot','defeat_status','categories'
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
      setCategories(enemy?.properties?.categories || '');
      setIsHumanoid(enemy?.properties?.humanoid === 'true');
      setIsLifeform(enemy?.properties?.lifeform === 'false' ? false : true);

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
        const pairs = Object.entries(enemy.properties).filter(([k]) => !['tilesetPath','portraitPath','gfx','render_layers','animation_slots','suppress_hp','hp','mp','attack','defense','speed','xp','gold','melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform','powers','passive_powers','cooldown','cooldown_hit','script','loot','loot_count','first_defeat_loot','quest_loot','defeat_status','categories','combat_style','threat_range','flee_range','flee_duration','flee_cooldown','chance_pursue','chance_flee','turn_delay','wander_radius','waypoints','flying','intangible'].includes(k));
        return pairs.map(([k,v]) => `${k}=${v}`).join('\n');
      });

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
      'powers','passive_powers','cooldown','cooldown_hit','script','loot','loot_count','first_defeat_loot','quest_loot','defeat_status','categories','sfx_attack','sfx_hit','sfx_die','sfx_critdie','melee_range','thread_range','combat_style','threat_range','flee_range','flee_duration','flee_cooldown','chance_pursue','chance_flee','turn_delay','wander_radius','waypoints','flying','intangible'
    ];

    if (categories) newProps.categories = categories; else delete newProps.categories;
    if (rarity) newProps.rarity = rarity; else delete newProps.rarity;

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
      category: category || enemy.category,
      properties: newProps,
    };

    onSave?.(updated);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange?.(v)}>
      <DialogContent className="w-[820px] max-w-[90vw] h-[680px] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Enemy</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col items-center gap-2 py-4 px-2 bg-muted/10 border-r flex-shrink-0 overflow-auto tabs-scroll">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <Tooltip key={tab.key} content={tab.tooltip} side="right">
                  <button
                    type="button"
                    className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted/30 transition-all ${activeTab === tab.key ? 'bg-muted/40 shadow-lg' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                    aria-label={tab.tooltip}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div className="flex-1 p-4 min-w-0 overflow-y-auto minimal-scroll">
            {activeTab === 'identity' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enemy name" />
                </div>

                <div className="grid grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">Level</label>
                    <Input type="number" value={String(level)} onChange={(e) => setLevel(parseInt(e.target.value || '0') || 0)} placeholder="Level" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Rarity</label>
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

                  <div>
                    <label className="block text-sm font-medium mb-1">XP</label>
                    <Input type="number" value={String(xp)} onChange={(e) => setXp(e.target.value)} placeholder="XP value" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tags</label>
                    <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Comma-separated tags" />
                  </div>

                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. antlion" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Spawn Count</label>
                    <Input type="number" value={String(count)} onChange={(e) => setCount(parseInt(e.target.value || '0') || 0)} placeholder="Spawn count" />
                  </div>

                </div>

                <div className="mt-2 flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={isHumanoid} onChange={(e) => setIsHumanoid(e.target.checked)} />
                    Humanoid
                  </label>
                  <Tooltip content={"While a character who transforms into a monster normally cannot communicate with NPCs, when they transform into a creature with an active humanoid flag, they do not lose the ability to converse with NPCs."} side="top">
                    <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-4 h-4" /></button>
                  </Tooltip>

                  <label className="flex items-center gap-2 ml-4">
                    <input type="checkbox" className="h-4 w-4" checked={isLifeform} onChange={(e) => setIsLifeform(e.target.checked)} />
                    Lifeform
                  </label>
                  <Tooltip content={"When an enemy is eliminated if this is checked game will show it as \"Dead\" if not \"Destroyed\""} side="top">
                    <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-4 h-4" /></button>
                  </Tooltip>
                </div>

              </div>
            )}

            {/* other tabs omitted for brevity in restored copy */}

          </div>
        </div>

        <DialogFooter className="pt-2 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-orange-500 text-white">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
