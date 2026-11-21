import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { loadProjectTextMap, writeProjectFiles } from '@/editor/projectFiles';
import { loadEngineFileWithFallback } from '@/editor/engineFileFallback';
import {
  CORE_STATS,
  DAMAGE_TYPES_PATH,
  DEFAULT_PRIMARY_STATS,
  HERO_STATS_PATH,
  PRIMARY_STATS_PATH,
  RESOURCE_STATS_PATH,
  damageTypeStatIds,
  emptyHeroStats,
  emptyResourceStat,
  normalizeStatId,
  parseDamageTypes,
  parseHeroStats,
  parsePrimaryStats,
  parseResourceStats,
  renamePrimaryInHeroStats,
  resourceStatIds,
  serializeDamageTypes,
  serializeHeroStats,
  serializePrimaryStats,
  serializeResourceStats,
  type DamageType,
  type HeroStatsFile,
  type PrimaryStat,
  type ResourceStat,
} from '@/editor/statsTitles';
import { COMBAT_PATH, HERO_LAYERS_PATH, HERO_OPTIONS_PATH, XP_TABLE_PATH, collectSectionIds } from '@/editor/engineForms';
import { CLASSES_PATH } from '@/editor/heroClasses';
import { EQUIP_FLAGS_PATH } from '@/editor/equipFlags';
import { ClassHeroForm, EquipFlagsForm, HeroLayersForm, HeroOptionsForm, XpTableForm } from '@/components/engine/EngineSpecialForms';
import XpScalingTablesForm from '@/components/engine/XpScalingTablesForm';
import { AvatarSfxTablesForm, StepSoundsForm } from '@/components/engine/AvatarSoundsForms';
import { AVATAR_SFX_DIR, STEP_SOUND_LIST_ID, STEP_SOUNDS_PATH } from '@/editor/avatarSounds';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { XP_SCALING_DIR } from '@/editor/xpScaling';
import { CombatSettingsForm, DamageTypesForm } from '@/components/engine/CombatAndDamageForms';
import { useRegisterDirty } from '@/context/SaveHealthContext';

type Props = { projectPath?: string | null };

type Row = { key: string; name: string; group: string; percent: boolean };

const StatsEditorView: React.FC<Props> = ({ projectPath }) => {
  const [primaries, setPrimaries] = useState<PrimaryStat[]>(DEFAULT_PRIMARY_STATS);
  const [hero, setHero] = useState<HeroStatsFile>(emptyHeroStats());
  const [resources, setResources] = useState<ResourceStat[]>([]);
  const [damageTypes, setDamageTypes] = useState<DamageType[]>([]);
  const [sourceKind, setSourceKind] = useState<'project' | 'mod' | 'empty'>('empty');
  const [sourceLabel, setSourceLabel] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showResist, setShowResist] = useState(false);
  const [combatText, setCombatText] = useState('');
  const [xpText, setXpText] = useState('');
  const [scalingFiles, setScalingFiles] = useState<Record<string, string>>({});
  const [scalingOriginal, setScalingOriginal] = useState<string[]>([]);
  const [damageSourceText, setDamageSourceText] = useState('');
  const [pane, setPane] = useState<'stats' | 'combat' | 'damage' | 'xp' | 'classes' | 'appearance' | 'equip'>('stats');
  const [classesText, setClassesText] = useState('');
  const [heroOptionsText, setHeroOptionsText] = useState('');
  const [heroLayersText, setHeroLayersText] = useState('');
  const [equipFlagsText, setEquipFlagsText] = useState('');
  const [stepSoundsText, setStepSoundsText] = useState('');
  const [avatarSfxFiles, setAvatarSfxFiles] = useState<Record<string, string>>({});
  const [avatarSfxOriginal, setAvatarSfxOriginal] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<Set<string>>(new Set());
  const [powerIds, setPowerIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');
  const [resourceOpen, setResourceOpen] = useState(false);
  const [draftResource, setDraftResource] = useState<ResourceStat>(emptyResourceStat());

  const mark = () => setDirty(true);

  const loadAll = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.readFile) {
      setPrimaries(DEFAULT_PRIMARY_STATS);
      setHero(emptyHeroStats());
      setResources([]);
      setDamageTypes([]);
      setCombatText('');
      setXpText('');
      setScalingFiles({});
      setScalingOriginal([]);
      setDamageSourceText('');
      setClassesText('');
      setHeroOptionsText('');
      setHeroLayersText('');
      setEquipFlagsText('');
      setStepSoundsText('');
      setAvatarSfxFiles({});
      setAvatarSfxOriginal([]);
      setItemIds(new Set());
      setPowerIds(new Set());
      setSourceKind('empty');
      setDirty(false);
      return;
    }
    const fs = { readFile: window.electronAPI.readFile };
    const flarePath = getStoredFlarePath();
    const [primaryFile, statsFile, resourceFile, damageFile, combatFile, xpFile, classesFile, heroOptionsFile, heroLayersFile, equipFlagsFile] = await Promise.all([
      loadEngineFileWithFallback({ projectPath, relative: PRIMARY_STATS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: HERO_STATS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: RESOURCE_STATS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: DAMAGE_TYPES_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: COMBAT_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: XP_TABLE_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: CLASSES_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: HERO_OPTIONS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: HERO_LAYERS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: EQUIP_FLAGS_PATH, flarePath, fs }),
    ]);
    const parsedPrimaries = parsePrimaryStats(primaryFile.text);
    setPrimaries(parsedPrimaries.length ? parsedPrimaries : DEFAULT_PRIMARY_STATS);
    setHero(statsFile.text.trim() ? parseHeroStats(statsFile.text) : emptyHeroStats());
    setResources(parseResourceStats(resourceFile.text));
    setDamageTypes(parseDamageTypes(damageFile.text));
    setDamageSourceText(damageFile.text);
    setCombatText(combatFile.text);
    setXpText(xpFile.text);
    const scaling: Record<string, string> = {};
    try {
      const root = projectPath.replace(/\\/g, '/');
      for (const rel of await listTxtUnder(root, XP_SCALING_DIR)) {
        const text = await window.electronAPI.readFile(`${root}/${rel}`);
        if (text != null) scaling[rel] = text;
      }
    } catch {
      /* no enemies/xp_scaling folder yet */
    }
    setScalingFiles(scaling);
    setScalingOriginal(Object.keys(scaling));
    setClassesText(classesFile.text);
    setHeroOptionsText(heroOptionsFile.text);
    setHeroLayersText(heroLayersFile.text);
    setEquipFlagsText(equipFlagsFile.text);
    const stepFile = await loadEngineFileWithFallback({ projectPath, relative: STEP_SOUNDS_PATH, flarePath, fs });
    setStepSoundsText(stepFile.text);
    const avatar: Record<string, string> = {};
    try {
      const root = projectPath.replace(/\\/g, '/');
      for (const rel of await listTxtUnder(root, AVATAR_SFX_DIR)) {
        const text = await window.electronAPI.readFile(`${root}/${rel}`);
        if (text != null) avatar[rel] = text;
      }
    } catch {
      /* no engine/avatar folder yet */
    }
    setAvatarSfxFiles(avatar);
    setAvatarSfxOriginal(Object.keys(avatar));
    try {
      const projectFiles = await loadProjectTextMap(projectPath);
      setItemIds(collectSectionIds(projectFiles, ['item']));
      setPowerIds(collectSectionIds(projectFiles, ['power', 'upgrade']));
    } catch {
      setItemIds(new Set());
      setPowerIds(new Set());
    }
    setSourceKind(statsFile.source === 'project' || primaryFile.source === 'project' ? 'project' : (statsFile.source === 'mod' || primaryFile.source === 'mod' ? 'mod' : 'empty'));
    setSourceLabel(statsFile.label || primaryFile.label);
    setDirty(false);
  }, [projectPath]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const rows: Row[] = useMemo(() => {
    const list: Row[] = CORE_STATS.map((stat) => ({
      key: stat.key,
      name: stat.name,
      group: stat.category === 'resist' ? 'resist' : stat.category,
      percent: stat.percent,
    }));
    for (const type of damageTypes) {
      const ids = damageTypeStatIds(type);
      list.push(
        { key: ids.min, name: `${type.name || type.id} (Min.)`, group: 'damage', percent: false },
        { key: ids.max, name: `${type.name || type.id} (Max.)`, group: 'damage', percent: false },
        { key: ids.resist, name: `Resist (${type.name || type.id})`, group: 'damage', percent: true },
      );
    }
    for (const resource of resources) {
      for (const key of resourceStatIds(resource)) {
        list.push({ key, name: key, group: 'resource', percent: key !== resource.stat_base });
      }
    }
    const known = new Set(list.map((row) => row.key));
    for (const key of [...Object.keys(hero.base), ...Object.keys(hero.perLevel), ...hero.perPrimary.map((row) => row.stat)]) {
      if (key && !known.has(key)) {
        list.push({ key, name: key, group: 'other', percent: false });
        known.add(key);
      }
    }
    return list;
  }, [damageTypes, hero.base, hero.perLevel, hero.perPrimary, resources]);

  const visibleRows = rows.filter((row) => showResist || row.group !== 'resist');

  const setScalar = (key: keyof HeroStatsFile['scalars'], value: string) => {
    setHero((current) => ({ ...current, scalars: { ...current.scalars, [key]: value } }));
    mark();
  };

  const setBase = (key: string, value: string) => {
    setHero((current) => ({ ...current, base: { ...current.base, [key]: value } }));
    mark();
  };

  const setPerLevel = (key: string, value: string) => {
    setHero((current) => ({ ...current, perLevel: { ...current.perLevel, [key]: value } }));
    mark();
  };

  const setPerPrimary = (primary: string, stat: string, value: string) => {
    setHero((current) => {
      const rest = current.perPrimary.filter((row) => !(row.primary === primary && row.stat === stat));
      return { ...current, perPrimary: value === '' ? rest : [...rest, { primary, stat, value }] };
    });
    mark();
  };

  const perPrimaryValue = (primary: string, stat: string) => (
    hero.perPrimary.find((row) => row.primary === primary && row.stat === stat)?.value ?? ''
  );

  const addPrimary = () => {
    const id = normalizeStatId(addId);
    if (!id) {
      toast({ title: 'Invalid id', description: 'Use a letter first, then letters, numbers or underscores.', variant: 'destructive' });
      return;
    }
    if (primaries.some((stat) => stat.id === id)) {
      toast({ title: 'Already added', description: `${id} is already in the list.` });
      return;
    }
    setPrimaries((current) => [...current, { id, name: addName.trim() || id }]);
    setAddOpen(false);
    setAddId('');
    setAddName('');
    mark();
  };

  const renamePrimary = (index: number, field: 'id' | 'name', value: string) => {
    setPrimaries((current) => {
      const next = current.map((stat, statIndex) => statIndex === index ? { ...stat, [field]: value } : stat);
      if (field === 'id') {
        const from = current[index].id;
        const to = normalizeStatId(value) || value.trim();
        if (from && to && from !== to) setHero((heroFile) => renamePrimaryInHeroStats(heroFile, from, to));
      }
      return next;
    });
    mark();
  };

  const addResource = () => {
    const id = normalizeStatId(draftResource.stat_base);
    if (!id) {
      toast({ title: 'Invalid resource id', description: 'stat_base is required (e.g. stamina).', variant: 'destructive' });
      return;
    }
    const next = {
      ...draftResource,
      stat_base: id,
      stat_regen: draftResource.stat_regen.trim() || `${id}_regen`,
      stat_steal: draftResource.stat_steal.trim() || `${id}_steal`,
      stat_resist_steal: draftResource.stat_resist_steal.trim() || `resist_${id}_steal`,
      stat_heal: draftResource.stat_heal.trim() || `${id}_heal`,
      stat_heal_percent: draftResource.stat_heal_percent.trim() || `${id}_heal_percent`,
    };
    setResources((current) => [...current, next]);
    setResourceOpen(false);
    setDraftResource(emptyResourceStat());
    mark();
  };

  const save = async () => {
    if (!projectPath) {
      toast({ title: 'No project', description: 'Open a project before saving stats.', variant: 'destructive' });
      return;
    }
    const cleaned = primaries
      .map((stat) => ({ id: normalizeStatId(stat.id) || '', name: stat.name.trim() || stat.id }))
      .filter((stat) => stat.id);
    if (!cleaned.length) {
      toast({ title: 'Need a primary stat', description: 'Add at least one primary stat before saving.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const files = [
        { path: PRIMARY_STATS_PATH, content: serializePrimaryStats(cleaned) },
        { path: HERO_STATS_PATH, content: serializeHeroStats(hero) },
        { path: RESOURCE_STATS_PATH, content: serializeResourceStats(resources) },
      ];
      if (combatText.trim()) files.push({ path: COMBAT_PATH, content: combatText.endsWith('\n') ? combatText : `${combatText}\n` });
      if (xpText.trim()) files.push({ path: XP_TABLE_PATH, content: xpText.endsWith('\n') ? xpText : `${xpText}\n` });
      for (const [path, content] of Object.entries(scalingFiles)) {
        files.push({ path, content: content.endsWith('\n') ? content : `${content}\n` });
      }
      if (classesText.trim()) files.push({ path: CLASSES_PATH, content: classesText.endsWith('\n') ? classesText : `${classesText}\n` });
      if (heroOptionsText.trim()) files.push({ path: HERO_OPTIONS_PATH, content: heroOptionsText.endsWith('\n') ? heroOptionsText : `${heroOptionsText}\n` });
      if (heroLayersText.trim()) files.push({ path: HERO_LAYERS_PATH, content: heroLayersText.endsWith('\n') ? heroLayersText : `${heroLayersText}\n` });
      if (equipFlagsText.trim()) files.push({ path: EQUIP_FLAGS_PATH, content: equipFlagsText.endsWith('\n') ? equipFlagsText : `${equipFlagsText}\n` });
      if (stepSoundsText.trim()) files.push({ path: STEP_SOUNDS_PATH, content: stepSoundsText.endsWith('\n') ? stepSoundsText : `${stepSoundsText}\n` });
      for (const [path, content] of Object.entries(avatarSfxFiles)) {
        files.push({ path, content: content.endsWith('\n') ? content : `${content}\n` });
      }
      if (damageTypes.length || damageSourceText.trim()) {
        files.push({ path: DAMAGE_TYPES_PATH, content: serializeDamageTypes(damageTypes, damageSourceText) });
      }
      const saved = await writeProjectFiles(projectPath, files);
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not write the engine stat files.', variant: 'destructive' });
        return;
      }
      const kept = new Set(Object.keys(scalingFiles));
      const root = projectPath.replace(/\\/g, '/');
      for (const path of scalingOriginal) {
        if (kept.has(path) || !window.electronAPI?.deleteProjectFile) continue;
        await window.electronAPI.deleteProjectFile(`${root}/${path}`);
      }
      setScalingOriginal(Object.keys(scalingFiles));
      const keptAvatar = new Set(Object.keys(avatarSfxFiles));
      for (const path of avatarSfxOriginal) {
        if (keptAvatar.has(path) || !window.electronAPI?.deleteProjectFile) continue;
        await window.electronAPI.deleteProjectFile(`${projectPath.replace(/\\/g, '/')}/${path}`);
      }
      setAvatarSfxOriginal(Object.keys(avatarSfxFiles));
      setPrimaries(cleaned);
      setDirty(false);
      setSourceKind('project');
      toast({ title: 'Saved', description: `Wrote ${files.map((file) => file.path).join(', ')}.` });
    } finally {
      setBusy(false);
    }
  };

  const draftFiles = useMemo(() => {
    if (!dirty) return [];
    const cleaned = primaries
      .map((stat) => ({ id: normalizeStatId(stat.id) || '', name: stat.name.trim() || stat.id }))
      .filter((stat) => stat.id);
    if (!cleaned.length) return [];
    const files = [
      { path: PRIMARY_STATS_PATH, content: serializePrimaryStats(cleaned) },
      { path: HERO_STATS_PATH, content: serializeHeroStats(hero) },
      { path: RESOURCE_STATS_PATH, content: serializeResourceStats(resources) },
    ];
    if (combatText.trim()) files.push({ path: COMBAT_PATH, content: combatText.endsWith('\n') ? combatText : `${combatText}\n` });
    if (xpText.trim()) files.push({ path: XP_TABLE_PATH, content: xpText.endsWith('\n') ? xpText : `${xpText}\n` });
    for (const [path, content] of Object.entries(scalingFiles)) {
      files.push({ path, content: content.endsWith('\n') ? content : `${content}\n` });
    }
    if (classesText.trim()) files.push({ path: CLASSES_PATH, content: classesText.endsWith('\n') ? classesText : `${classesText}\n` });
    if (heroOptionsText.trim()) files.push({ path: HERO_OPTIONS_PATH, content: heroOptionsText.endsWith('\n') ? heroOptionsText : `${heroOptionsText}\n` });
    if (heroLayersText.trim()) files.push({ path: HERO_LAYERS_PATH, content: heroLayersText.endsWith('\n') ? heroLayersText : `${heroLayersText}\n` });
    if (equipFlagsText.trim()) files.push({ path: EQUIP_FLAGS_PATH, content: equipFlagsText.endsWith('\n') ? equipFlagsText : `${equipFlagsText}\n` });
    if (stepSoundsText.trim()) files.push({ path: STEP_SOUNDS_PATH, content: stepSoundsText.endsWith('\n') ? stepSoundsText : `${stepSoundsText}\n` });
    for (const [path, content] of Object.entries(avatarSfxFiles)) {
      files.push({ path, content: content.endsWith('\n') ? content : `${content}\n` });
    }
    if (damageTypes.length || damageSourceText.trim()) {
      files.push({ path: DAMAGE_TYPES_PATH, content: serializeDamageTypes(damageTypes, damageSourceText) });
    }
    return files;
  }, [dirty, primaries, hero, resources, combatText, xpText, scalingFiles, classesText, heroOptionsText, heroLayersText, equipFlagsText, stepSoundsText, avatarSfxFiles, damageTypes, damageSourceText]);
  useRegisterDirty('stats', dirty, save, draftFiles);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <FieldHint hint={
            sourceKind === 'project' ? 'Editing project overrides. Primary stats can be added; core derived keys (hp, mp, accuracy, and the rest of Stats.cpp) are fixed — you can set their values, not invent new core keys. Extra MP-like pools go under Resource stats. Combat, damage types, the XP table, XP scaling, classes, hero appearance and equipment flags are edited in this card.'
            : sourceKind === 'mod' ? `Loaded from a required mod or default (${sourceLabel}). Save writes project overrides. Primary stats can be added; core derived keys are fixed. Extra MP-like pools go under Resource stats.`
            : 'Primary stats can be added; they are not hardcoded. Core derived keys (hp, mp, accuracy, and the rest of Stats.cpp) are fixed — you can set their values, not invent new core keys. Extra MP-like pools go under Resource stats. Combat, damage types, the XP table, XP scaling, classes, hero appearance and equipment flags are edited in this card. No project stat files yet: empty fields use Flare engine defaults until you save.'
          }>
            <div className="text-sm font-semibold">Stats</div>
          </FieldHint>
        </div>
        <Button type="button" size="sm" onClick={() => { void save(); }} disabled={!projectPath || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
      </div>
      {projectPath ? (
        <div className="flex flex-wrap gap-1">
          {([
            { id: 'stats', label: 'Stats' },
            { id: 'combat', label: 'Combat' },
            { id: 'damage', label: 'Damage types' },
            { id: 'xp', label: 'XP' },
            { id: 'classes', label: 'Classes' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'equip', label: 'Equip flags' },
          ] as const).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={pane === item.id ? 'default' : 'outline'}
              aria-pressed={pane === item.id}
              className={pane === item.id ? 'h-7 bg-orange-600 text-white hover:bg-orange-600 hover:text-white' : 'h-7'}
              onClick={() => setPane(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}

      {!projectPath ? (
        <p className="text-sm text-muted-foreground">Open a project to edit stats.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto space-y-4 pr-1">
          {pane === 'combat' ? (
            <CombatSettingsForm text={combatText} onChange={(next) => { setCombatText(next); mark(); }} />
          ) : pane === 'damage' ? (
            <DamageTypesForm types={damageTypes} onChange={(next) => { setDamageTypes(next); mark(); }} />
          ) : pane === 'xp' ? (
            <div className="space-y-6">
              <XpTableForm text={xpText} onChange={(next) => { setXpText(next); mark(); }} />
              <XpScalingTablesForm files={scalingFiles} onChange={(next) => { setScalingFiles(next); mark(); }} />
            </div>
          ) : pane === 'classes' ? (
            <ClassHeroForm text={classesText} onChange={(next) => { setClassesText(next); mark(); }} itemIds={itemIds} powerIds={powerIds} />
          ) : pane === 'appearance' ? (
            <div className="space-y-6">
              <HeroOptionsForm text={heroOptionsText} onChange={(next) => { setHeroOptionsText(next); mark(); }} />
              <HeroLayersForm text={heroLayersText} onChange={(next) => { setHeroLayersText(next); mark(); }} />
              <StepSoundsForm text={stepSoundsText} onChange={(next) => { setStepSoundsText(next); mark(); }} />
              <AvatarSfxTablesForm files={avatarSfxFiles} onChange={(next) => { setAvatarSfxFiles(next); mark(); }} />
            </div>
          ) : pane === 'equip' ? (
            <EquipFlagsForm text={equipFlagsText} onChange={(next) => { setEquipFlagsText(next); mark(); }} />
          ) : (
          <>
          <section className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Level-up points</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <HintLabel className="text-[11px] font-normal text-muted-foreground" htmlFor="stat-points" hint="Stat points awarded each level.">stat_points_per_level</HintLabel>
                <Input id="stat-points" width="num" value={hero.scalars.stat_points_per_level} onChange={(event) => setScalar('stat_points_per_level', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <HintLabel className="text-[11px] font-normal text-muted-foreground" htmlFor="power-points" hint="Power points awarded each level.">power_points_per_level</HintLabel>
                <Input id="power-points" width="num" value={hero.scalars.power_points_per_level} onChange={(event) => setScalar('power_points_per_level', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <HintLabel className="text-[11px] font-normal text-muted-foreground" htmlFor="max-points" hint="Maximum points that can be put into one primary stat. Leave empty to use the engine default.">max_points_per_stat</HintLabel>
                <Input id="max-points" width="num" value={hero.scalars.max_points_per_stat} onChange={(event) => setScalar('max_points_per_stat', event.target.value)} className="h-8" placeholder="auto" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-2">
                <Switch id="restore-hp" checked={hero.scalars.levelup_restore_hp !== 'false'} onCheckedChange={(checked) => setScalar('levelup_restore_hp', checked === true ? 'true' : 'false')} />
                <Label htmlFor="restore-hp" className="text-xs font-normal">levelup_restore_hp</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="restore-mp" checked={hero.scalars.levelup_restore_mp !== 'false'} onCheckedChange={(checked) => setScalar('levelup_restore_mp', checked === true ? 'true' : 'false')} />
                <Label htmlFor="restore-mp" className="text-xs font-normal">levelup_restore_mp</Label>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <FieldHint hint="Renaming an id only updates bonuses in stats.txt here. Classes, items, powers and titles that use the old id must be edited separately.">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary stats</div>
              </FieldHint>
              <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}>Add primary</Button>
            </div>
            <div className="space-y-2">
              {primaries.map((stat, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input aria-label={`Primary id ${index + 1}`} width="id" value={stat.id} onChange={(event) => renamePrimary(index, 'id', event.target.value)} className="h-8" />
                  <Input aria-label={`Primary name ${index + 1}`} width="name" value={stat.name} onChange={(event) => renamePrimary(index, 'name', event.target.value)} className="h-8" />
                  <Button type="button" size="sm" variant="outline" onClick={() => { setPrimaries((current) => current.filter((_, statIndex) => statIndex !== index)); mark(); }}>Remove</Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Derived stats</div>
              <div className="flex items-center gap-2">
                <Switch id="show-resist" checked={showResist} onCheckedChange={(checked) => setShowResist(checked === true)} />
                <Label htmlFor="show-resist" className="text-xs font-normal">Show resistances</Label>
              </div>
            </div>
            <div className="overflow-auto rounded-md border border-border">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background z-[1] border-b border-border">
                  <tr>
                    <th className="text-left font-medium p-2">Stat</th>
                    <th className="text-left font-medium p-2 w-24">Base</th>
                    <th className="text-left font-medium p-2 w-24">Per level</th>
                    {primaries.map((stat) => (
                      <th key={stat.id || stat.name} className="text-left font-medium p-2 w-24">Per {stat.id || stat.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.key} className="border-t border-border">
                      <td className="p-2">
                        <FieldHint hint={`${row.key}${row.percent ? ' (%)' : ''}`}>
                          <div>{row.name}</div>
                        </FieldHint>
                      </td>
                      <td className="p-2"><Input aria-label={`${row.key} base`} width="num" value={hero.base[row.key] ?? ''} onChange={(event) => setBase(row.key, event.target.value)} className="h-8" /></td>
                      <td className="p-2"><Input aria-label={`${row.key} per level`} width="num" value={hero.perLevel[row.key] ?? ''} onChange={(event) => setPerLevel(row.key, event.target.value)} className="h-8" /></td>
                      {primaries.map((stat) => (
                        <td key={`${row.key}-${stat.id}`} className="p-2">
                          <Input aria-label={`${row.key} per ${stat.id}`} width="num" value={perPrimaryValue(stat.id, row.key)} onChange={(event) => setPerPrimary(stat.id, row.key, event.target.value)} className="h-8" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <FieldHint hint="Optional extra pools besides HP and MP (for example stamina). Each one creates base/regen/steal keys you can grow in the table above.">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resource stats</div>
              </FieldHint>
              <Button type="button" size="sm" variant="outline" onClick={() => setResourceOpen(true)}>Add resource</Button>
            </div>
            {resources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No extra resources.</p>
            ) : resources.map((resource, index) => (
              <div key={resource.stat_base || index} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                <div className="text-sm">{resource.text_base || resource.stat_base}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{resourceStatIds(resource).join(', ')}</div>
                <Button type="button" size="sm" variant="outline" onClick={() => { setResources((current) => current.filter((_, resourceIndex) => resourceIndex !== index)); mark(); }}>Remove</Button>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-border p-3 space-y-2">
            <FieldHint hint={hero.trailing ? 'The existing [render_layers] (or other) section is kept as-is when you save.' : 'Movement, sounds and other hero stats from engine/stats.txt.'}>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Other stats</div>
            </FieldHint>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-speed">speed</Label>
                <Input id="hero-speed" width="num" value={hero.scalars.speed} onChange={(event) => setScalar('speed', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-step">sfx_step</Label>
                <Input id="hero-step" width="id" value={hero.scalars.sfx_step} onChange={(event) => setScalar('sfx_step', event.target.value)} className="h-8" list={STEP_SOUND_LIST_ID} />
              </div>
              <div className="space-y-1">
                <HintLabel className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-cooldown" hint="Global attack cooldown. Defaults to 66ms if empty.">cooldown</HintLabel>
                <Input id="hero-cooldown" width="short" value={hero.scalars.cooldown} onChange={(event) => setScalar('cooldown', event.target.value)} className="h-8" placeholder="66ms" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-cooldown-hit">cooldown_hit</Label>
                <Input id="hero-cooldown-hit" width="short" value={hero.scalars.cooldown_hit} onChange={(event) => setScalar('cooldown_hit', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-categories">categories</Label>
                <Input id="hero-categories" width="name" value={hero.scalars.categories} onChange={(event) => setScalar('categories', event.target.value)} className="h-8" />
              </div>
            </div>
          </section>
          </>
          )}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <FieldHint hint="Writes a new [stat] block in engine/primary_stats.txt. The id is what other files (classes, items, titles) will use.">
              <DialogTitle>Add primary stat</DialogTitle>
            </FieldHint>
            <DialogDescription className="sr-only">Writes a new [stat] block in engine/primary_stats.txt. The id is what other files (classes, items, titles) will use.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="add-primary-id">Id</Label>
            <Input id="add-primary-id" width="id" value={addId} onChange={(event) => setAddId(event.target.value)} placeholder="spirit" className="h-8" />
            <Label htmlFor="add-primary-name">Display name</Label>
            <Input id="add-primary-name" width="name" value={addName} onChange={(event) => setAddName(event.target.value)} placeholder="Spirit" className="h-8" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="button" onClick={addPrimary}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resourceOpen} onOpenChange={setResourceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <FieldHint hint="Creates an extra MP-like pool in engine/resource_stats.txt. Empty related keys are filled with standard suffixes.">
              <DialogTitle>Add resource stat</DialogTitle>
            </FieldHint>
            <DialogDescription className="sr-only">Creates an extra MP-like pool in engine/resource_stats.txt. Empty related keys are filled with standard suffixes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resource-base">stat_base</Label>
            <Input id="resource-base" width="id" value={draftResource.stat_base} onChange={(event) => setDraftResource((current) => ({ ...current, stat_base: event.target.value }))} placeholder="stamina" className="h-8" />
            <Label htmlFor="resource-text">text_base (display name)</Label>
            <Input id="resource-text" width="name" value={draftResource.text_base} onChange={(event) => setDraftResource((current) => ({ ...current, text_base: event.target.value }))} placeholder="Max Stamina" className="h-8" />
            <Label htmlFor="resource-menu">menu_filename (optional)</Label>
            <Input id="resource-menu" width="path" value={draftResource.menu_filename} onChange={(event) => setDraftResource((current) => ({ ...current, menu_filename: event.target.value }))} placeholder="menus/resource_stamina.txt" className="h-8" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResourceOpen(false)}>Cancel</Button>
            <Button type="button" onClick={addResource}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatsEditorView;
