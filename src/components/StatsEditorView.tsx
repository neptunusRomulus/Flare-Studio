import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { writeProjectFiles } from '@/editor/projectFiles';
import { loadEngineFileWithFallback } from '@/editor/engineFileFallback';
import {
  CORE_STATS,
  DAMAGE_TYPES_PATH,
  DEFAULT_PRIMARY_STATS,
  HERO_STATS_PATH,
  PRIMARY_STATS_PATH,
  RESOURCE_STATS_PATH,
  emptyHeroStats,
  emptyResourceStat,
  normalizeStatId,
  parseDamageTypes,
  parseHeroStats,
  parsePrimaryStats,
  parseResourceStats,
  renamePrimaryInHeroStats,
  resourceStatIds,
  serializeHeroStats,
  serializePrimaryStats,
  serializeResourceStats,
  type DamageType,
  type HeroStatsFile,
  type PrimaryStat,
  type ResourceStat,
} from '@/editor/statsTitles';

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
      setSourceKind('empty');
      setDirty(false);
      return;
    }
    const fs = { readFile: window.electronAPI.readFile };
    const flarePath = getStoredFlarePath();
    const [primaryFile, statsFile, resourceFile, damageFile] = await Promise.all([
      loadEngineFileWithFallback({ projectPath, relative: PRIMARY_STATS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: HERO_STATS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: RESOURCE_STATS_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: DAMAGE_TYPES_PATH, flarePath, fs }),
    ]);
    const parsedPrimaries = parsePrimaryStats(primaryFile.text);
    setPrimaries(parsedPrimaries.length ? parsedPrimaries : DEFAULT_PRIMARY_STATS);
    setHero(statsFile.text.trim() ? parseHeroStats(statsFile.text) : emptyHeroStats());
    setResources(parseResourceStats(resourceFile.text));
    setDamageTypes(parseDamageTypes(damageFile.text));
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
      list.push(
        { key: type.min, name: `${type.name || type.id} (Min.)`, group: 'damage', percent: false },
        { key: type.max, name: `${type.name || type.id} (Max.)`, group: 'damage', percent: false },
        { key: type.resist, name: `Resist (${type.name || type.id})`, group: 'damage', percent: true },
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
      const saved = await writeProjectFiles(projectPath, files);
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not write the engine stat files.', variant: 'destructive' });
        return;
      }
      setPrimaries(cleaned);
      setDirty(false);
      setSourceKind('project');
      toast({ title: 'Saved', description: `Wrote ${PRIMARY_STATS_PATH}, ${HERO_STATS_PATH} and ${RESOURCE_STATS_PATH}.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Stats</div>
          <p className="text-[11px] text-muted-foreground">
            Primary stats can be added; they are not hardcoded. Core derived keys (hp, mp, accuracy, and the rest of Stats.cpp) are fixed — you can set their values, not invent new core keys. Extra MP-like pools go under Resource stats. Damage-type stats come from engine/damage_types.txt (Engine data files).
          </p>
          {projectPath ? (
            <p className="text-[11px] text-muted-foreground mt-1">
              {sourceKind === 'project' ? 'Editing project overrides.' : sourceKind === 'mod' ? `Loaded from a required mod or default (${sourceLabel}). Save writes project overrides.` : 'No project stat files yet. Empty fields use Flare engine defaults until you save.'}
            </p>
          ) : null}
        </div>
        <Button type="button" size="sm" onClick={() => { void save(); }} disabled={!projectPath || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
      </div>

      {!projectPath ? (
        <p className="text-sm text-muted-foreground">Open a project to edit stats.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto space-y-4 pr-1">
          <section className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Level-up points</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="stat-points">stat_points_per_level</Label>
                <Input id="stat-points" value={hero.scalars.stat_points_per_level} onChange={(event) => setScalar('stat_points_per_level', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="power-points">power_points_per_level</Label>
                <Input id="power-points" value={hero.scalars.power_points_per_level} onChange={(event) => setScalar('power_points_per_level', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="max-points">max_points_per_stat</Label>
                <Input id="max-points" value={hero.scalars.max_points_per_stat} onChange={(event) => setScalar('max_points_per_stat', event.target.value)} className="h-8" placeholder="engine default if empty" />
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
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary stats</div>
              <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}>Add primary</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Renaming an id only updates bonuses in stats.txt here. Classes, items, powers and titles that use the old id must be edited separately.</p>
            <div className="space-y-2">
              {primaries.map((stat, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input aria-label={`Primary id ${index + 1}`} value={stat.id} onChange={(event) => renamePrimary(index, 'id', event.target.value)} className="h-8 w-36" />
                  <Input aria-label={`Primary name ${index + 1}`} value={stat.name} onChange={(event) => renamePrimary(index, 'name', event.target.value)} className="h-8 flex-1 min-w-[8rem]" />
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
                        <div>{row.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{row.key}{row.percent ? ' (%)' : ''}</div>
                      </td>
                      <td className="p-2"><Input aria-label={`${row.key} base`} value={hero.base[row.key] ?? ''} onChange={(event) => setBase(row.key, event.target.value)} className="h-8" /></td>
                      <td className="p-2"><Input aria-label={`${row.key} per level`} value={hero.perLevel[row.key] ?? ''} onChange={(event) => setPerLevel(row.key, event.target.value)} className="h-8" /></td>
                      {primaries.map((stat) => (
                        <td key={`${row.key}-${stat.id}`} className="p-2">
                          <Input aria-label={`${row.key} per ${stat.id}`} value={perPrimaryValue(stat.id, row.key)} onChange={(event) => setPerPrimary(stat.id, row.key, event.target.value)} className="h-8" />
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
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resource stats</div>
              <Button type="button" size="sm" variant="outline" onClick={() => setResourceOpen(true)}>Add resource</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Optional extra pools besides HP and MP (for example stamina). Each one creates base/regen/steal keys you can grow in the table above.</p>
            {resources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No extra resources. Default Flare only uses HP and MP.</p>
            ) : resources.map((resource, index) => (
              <div key={resource.stat_base || index} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                <div className="text-sm">{resource.text_base || resource.stat_base}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{resourceStatIds(resource).join(', ')}</div>
                <Button type="button" size="sm" variant="outline" onClick={() => { setResources((current) => current.filter((_, resourceIndex) => resourceIndex !== index)); mark(); }}>Remove</Button>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Other hero fields</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-speed">speed</Label>
                <Input id="hero-speed" value={hero.scalars.speed} onChange={(event) => setScalar('speed', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-step">sfx_step</Label>
                <Input id="hero-step" value={hero.scalars.sfx_step} onChange={(event) => setScalar('sfx_step', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-cooldown">cooldown</Label>
                <Input id="hero-cooldown" value={hero.scalars.cooldown} onChange={(event) => setScalar('cooldown', event.target.value)} className="h-8" placeholder="66ms default" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-cooldown-hit">cooldown_hit</Label>
                <Input id="hero-cooldown-hit" value={hero.scalars.cooldown_hit} onChange={(event) => setScalar('cooldown_hit', event.target.value)} className="h-8" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-normal text-muted-foreground" htmlFor="hero-categories">categories</Label>
                <Input id="hero-categories" value={hero.scalars.categories} onChange={(event) => setScalar('categories', event.target.value)} className="h-8" />
              </div>
            </div>
            {hero.trailing ? <p className="text-[11px] text-muted-foreground">The existing [render_layers] (or other) section is kept as-is when you save.</p> : null}
          </section>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add primary stat</DialogTitle>
            <DialogDescription>Writes a new [stat] block in engine/primary_stats.txt. The id is what other files (classes, items, titles) will use.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="add-primary-id">Id</Label>
            <Input id="add-primary-id" value={addId} onChange={(event) => setAddId(event.target.value)} placeholder="spirit" className="h-8" />
            <Label htmlFor="add-primary-name">Display name</Label>
            <Input id="add-primary-name" value={addName} onChange={(event) => setAddName(event.target.value)} placeholder="Spirit" className="h-8" />
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
            <DialogTitle>Add resource stat</DialogTitle>
            <DialogDescription>Creates an extra MP-like pool in engine/resource_stats.txt. Empty related keys are filled with standard suffixes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resource-base">stat_base</Label>
            <Input id="resource-base" value={draftResource.stat_base} onChange={(event) => setDraftResource((current) => ({ ...current, stat_base: event.target.value }))} placeholder="stamina" className="h-8" />
            <Label htmlFor="resource-text">text_base (display name)</Label>
            <Input id="resource-text" value={draftResource.text_base} onChange={(event) => setDraftResource((current) => ({ ...current, text_base: event.target.value }))} placeholder="Max Stamina" className="h-8" />
            <Label htmlFor="resource-menu">menu_filename (optional)</Label>
            <Input id="resource-menu" value={draftResource.menu_filename} onChange={(event) => setDraftResource((current) => ({ ...current, menu_filename: event.target.value }))} placeholder="menus/resource_stamina.txt" className="h-8" />
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
