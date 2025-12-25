import React, { useEffect, useState } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { User, Eye, BarChart2, Settings, Sword, Gift, Flag, Volume2, HelpCircle } from 'lucide-react';
import type { MapObject } from '@/types';
import type { LucideIcon } from 'lucide-react';

type TabKey = 'identity' | 'visual' | 'audio' | 'stats' | 'behavior' | 'combat' | 'loot' | 'flags';

const TAB_CONFIG: Array<{ key: TabKey; icon: LucideIcon; tooltip: string }> = [
  { key: 'identity', icon: User, tooltip: 'Identity' },
  { key: 'stats', icon: BarChart2, tooltip: 'Stats' },
  { key: 'behavior', icon: Settings, tooltip: 'Movement and AI Behaviors' },
  { key: 'visual', icon: Eye, tooltip: 'Visual' },
  { key: 'audio', icon: Volume2, tooltip: 'Audio' },
  { key: 'combat', icon: Sword, tooltip: 'Combat / Powers' },
  { key: 'loot', icon: Gift, tooltip: 'Loot & Rewards' },
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

  // Audio SFX
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
  // Ranges
  const [meleeRange, setMeleeRange] = useState<string>(() => enemy?.properties?.melee_range || '');
  const [threadRange, setThreadRange] = useState<string>(() => enemy?.properties?.thread_range || '');

  // Advanced/Derived Stats
  const [statPerLevel, setStatPerLevel] = useState<string>(() => enemy?.properties?.stat_per_level || '');
  const [xpScaling, setXpScaling] = useState<string>(() => enemy?.properties?.xp_scaling || '');
  const [vulnerable, setVulnerable] = useState<string>(() => enemy?.properties?.vulnerable || '');
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

  // Behavior flags
  const [isMelee, setIsMelee] = useState<boolean>(() => (enemy?.properties?.melee === 'true'));
  const [isRanged, setIsRanged] = useState<boolean>(() => (enemy?.properties?.ranged === 'true'));
  const [isCaster, setIsCaster] = useState<boolean>(() => (enemy?.properties?.caster === 'true'));
  const [isSummoner, setIsSummoner] = useState<boolean>(() => (enemy?.properties?.summoner === 'true'));
  const [isBoss, setIsBoss] = useState<boolean>(() => (enemy?.properties?.boss === 'true'));
  const [isPassive, setIsPassive] = useState<boolean>(() => (enemy?.properties?.passive === 'true'));
  const [isStationary, setIsStationary] = useState<boolean>(() => (enemy?.properties?.stationary === 'true'));

  // Combat & powers
  const [powers, setPowers] = useState<string>(() => enemy?.properties?.powers || '');
  const [script, setScript] = useState<string>(() => enemy?.properties?.script || '');

  // Loot
  const [lootTable, setLootTable] = useState<string>(() => enemy?.properties?.loot || '');
  const [dropChance, setDropChance] = useState<string>(() => enemy?.properties?.drop_chance || '');

  // Flags / custom
  const [customPropsRaw, setCustomPropsRaw] = useState<string>(() => {
    if (!enemy?.properties) return '';
    const pairs = Object.entries(enemy.properties).filter(([k]) => !['tilesetPath','portraitPath','gfx','hp','mp','attack','defense','speed','xp','gold','melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform','sfx_attack','sfx_hit','sfx_die','sfx_critdie','melee_range','thread_range','stat_per_level','xp_scaling','vulnerable','resist_damage_over_time','resist_slow','resist_stun','resist_knockback','resist_stat_debuff','resist_damage_reflect','xp_gain','hp_regen','mp_regen','hp_steal','mp_steal','accuracy','avoidance','crit','absorb_min','absorb_max','poise','reflect_chance','return_damage','currency_find','item_find','stealth','powers','script','loot','drop_chance','categories'].includes(k));
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
      setResistDamageOverTime(enemy?.properties?.resist_damage_over_time || '');
      setResistSlow(enemy?.properties?.resist_slow || '');
      setResistStun(enemy?.properties?.resist_stun || '');
      setResistKnockback(enemy?.properties?.resist_knockback || '');
      setResistStatDebuff(enemy?.properties?.resist_stat_debuff || '');
      setResistDamageReflect(enemy?.properties?.resist_damage_reflect || '');
      setXpGain(enemy?.properties?.xp_gain || '');
      setHpRegen(enemy?.properties?.hp_regen || '');
      setMpRegen(enemy?.properties?.mp_regen || '');
      setHpSteal(enemy?.properties?.hp_steal || '');
      setMpSteal(enemy?.properties?.mp_steal || '');
      setAccuracy(enemy?.properties?.accuracy || '');
      setAvoidance(enemy?.properties?.avoidance || '');
      setCrit(enemy?.properties?.crit || '');
      setAbsorbMin(enemy?.properties?.absorb_min || '');
      setAbsorbMax(enemy?.properties?.absorb_max || '');
      setPoise(enemy?.properties?.poise || '');
      setReflectChance(enemy?.properties?.reflect_chance || '');
      setReturnDamage(enemy?.properties?.return_damage || '');
      setCurrencyFind(enemy?.properties?.currency_find || '');
      setItemFind(enemy?.properties?.item_find || '');
      setStealth(enemy?.properties?.stealth || '');

      setIsMelee(enemy?.properties?.melee === 'true');
      setIsRanged(enemy?.properties?.ranged === 'true');
      setIsCaster(enemy?.properties?.caster === 'true');
      setIsSummoner(enemy?.properties?.summoner === 'true');
      setIsBoss(enemy?.properties?.boss === 'true');
      setIsPassive(enemy?.properties?.passive === 'true');
      setIsStationary(enemy?.properties?.stationary === 'true');

      setPowers(enemy?.properties?.powers || '');
      setScript(enemy?.properties?.script || '');

      setLootTable(enemy?.properties?.loot || '');
      setDropChance(enemy?.properties?.drop_chance || '');

      setCustomPropsRaw(() => {
        if (!enemy?.properties) return '';
        const pairs = Object.entries(enemy.properties).filter(([k]) => !['tilesetPath','portraitPath','gfx','hp','mp','attack','defense','speed','xp','gold','melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform','sfx_attack','sfx_hit','sfx_die','sfx_critdie','melee_range','thread_range','powers','script','loot','drop_chance','categories'].includes(k));
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

    // Build updated properties
    const newProps: Record<string, string> = { ...(enemy.properties || {}) };
    const knownKeys = [
      'tilesetPath','portraitPath','gfx','hp','mp','attack','defense','speed','xp','gold',
      'melee','ranged','caster','summoner','boss','passive','stationary','humanoid','lifeform',
      'powers','script','loot','drop_chance','categories','sfx_attack','sfx_hit','sfx_die','sfx_critdie','melee_range','thread_range'
    ];

    // Basic fields
    if (categories) newProps.categories = categories; else delete newProps.categories;
    // Rarity
    if (rarity) newProps.rarity = rarity; else delete newProps.rarity;

    // Visual
    if (tilesetPath) newProps.tilesetPath = tilesetPath; else delete newProps.tilesetPath;
    if (portraitPath) newProps.portraitPath = portraitPath; else delete newProps.portraitPath;
    if (gfx) newProps.gfx = gfx; else delete newProps.gfx;

    // Audio SFX
    if (sfxAttack) newProps.sfx_attack = sfxAttack; else delete newProps.sfx_attack;
    if (sfxHit) newProps.sfx_hit = sfxHit; else delete newProps.sfx_hit;
    if (sfxDie) newProps.sfx_die = sfxDie; else delete newProps.sfx_die;
    if (sfxCritDie) newProps.sfx_critdie = sfxCritDie; else delete newProps.sfx_critdie;

    // Stats
    if (hp) newProps.hp = hp; else delete newProps.hp;
    if (mp) newProps.mp = mp; else delete newProps.mp;
    if (attack) newProps.attack = attack; else delete newProps.attack;
    if (defense) newProps.defense = defense; else delete newProps.defense;
    if (speed) newProps.speed = speed; else delete newProps.speed;
    if (xp) newProps.xp = xp; else delete newProps.xp;
    if (gold) newProps.gold = gold; else delete newProps.gold;

    // Range fields
    if (meleeRange) newProps.melee_range = meleeRange; else delete newProps.melee_range;
    if (threadRange) newProps.thread_range = threadRange; else delete newProps.thread_range;

    // Behavior flags
    if (isMelee) newProps.melee = 'true'; else delete newProps.melee;
    if (isRanged) newProps.ranged = 'true'; else delete newProps.ranged;
    if (isCaster) newProps.caster = 'true'; else delete newProps.caster;
    if (isSummoner) newProps.summoner = 'true'; else delete newProps.summoner;
    if (isBoss) newProps.boss = 'true'; else delete newProps.boss;
    if (isPassive) newProps.passive = 'true'; else delete newProps.passive;
    if (isStationary) newProps.stationary = 'true'; else delete newProps.stationary;
    if (isHumanoid) newProps.humanoid = 'true'; else delete newProps.humanoid;
    if (isLifeform) newProps.lifeform = 'true'; else delete newProps.lifeform;

    // Combat
    if (powers) newProps.powers = powers; else delete newProps.powers;
    if (script) newProps.script = script; else delete newProps.script;

    // Loot
    if (lootTable) newProps.loot = lootTable; else delete newProps.loot;
    if (dropChance) newProps.drop_chance = dropChance; else delete newProps.drop_chance;

    // Custom properties
    const customLines = (customPropsRaw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // Remove previous custom keys
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
      name: name,
      level: Number.isFinite(Number(level)) ? Number(level) : enemy.level,
      number: Number.isFinite(Number(count)) ? Number(count) : enemy.number,
      category: category || enemy.category,
      properties: newProps
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
              <div className="space-y-3">
                <h3 className="text-sm font-semibold mb-2">Movement and AI Behaviors</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={isMelee} onChange={(e) => setIsMelee(e.target.checked)} /> Melee</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={isRanged} onChange={(e) => setIsRanged(e.target.checked)} /> Ranged</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={isCaster} onChange={(e) => setIsCaster(e.target.checked)} /> Caster</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={isSummoner} onChange={(e) => setIsSummoner(e.target.checked)} /> Summoner</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={isBoss} onChange={(e) => setIsBoss(e.target.checked)} /> Boss</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={isPassive} onChange={(e) => setIsPassive(e.target.checked)} /> Passive</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={isStationary} onChange={(e) => setIsStationary(e.target.checked)} /> Stationary</label>
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

        <DialogFooter className="pt-2 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-orange-500 text-white">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

