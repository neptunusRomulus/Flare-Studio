import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { collectSectionIds, unknownIds } from '@/editor/engineForms';
import { loadEngineFileWithFallback, resolveExistingPath } from '@/editor/engineFileFallback';
import { loadProjectTextMap, writeProjectFiles } from '@/editor/projectFiles';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import {
  DEFAULT_PRIMARY_STATS,
  PRIMARY_STATS_PATH,
  parsePrimaryStats,
  type PrimaryStat,
} from '@/editor/statsTitles';
import {
  POWER_TREE_PATH,
  emptyPower,
  emptyTab,
  emptyTree,
  listTreePaths,
  ownedUpgradeIndexes,
  parsePowerTree,
  powersOnTab,
  replaceItem,
  serializePowerTree,
  setPowerUpgrades,
  tabItems,
  updateNode,
  updateTab,
  type PowerTreeFile,
  type PowerTreeNode,
} from '@/editor/powerTree';
import { useAppContext } from '@/context/AppContext';
import SearchablePalette from '@/components/ui/searchable-palette';
import PowerTreeNodeFields from '@/components/engine/PowerTreeNodeFields';
import {
  POWER_DEFINITIONS_PATH,
  appendNewPowerDefinition,
  applyPowerName,
  defaultPowerName,
  formatPowerLabel,
  isPlaceholderPowerName,
  loadPowerRefs,
  nextNumericPowerId,
  projectPathForPower,
  type PowerRef,
} from '@/editor/powerCatalog';

import PowerTreeCanvas from '@/components/engine/PowerTreeCanvas';
import PowerEditorWindow, { type PowerTarget } from '@/components/powers/PowerEditorWindow';
import { usePowerProjectFiles } from '@/components/powers/usePowerProjectFiles';
import {
  parsePowersMenuLayout,
  DEFAULT_POWERS_MENU_POS,
  DEFAULT_POWERS_TAB_AREA,
  type PowersMenuLayout,
} from '@/editor/menuLayout';
import { useRegisterDirty } from '@/context/SaveHealthContext';


export default function PowerTreeEditor() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [path, setPath] = useState(POWER_TREE_PATH);
  const [pathDraft, setPathDraft] = useState(POWER_TREE_PATH);
  const [treePaths, setTreePaths] = useState<string[]>([POWER_TREE_PATH]);
  const [tree, setTree] = useState<PowerTreeFile>(emptyTree());
  const [activeTab, setActiveTab] = useState(0);
  const [powerIds, setPowerIds] = useState<Set<string>>(new Set());
  const [powerOptions, setPowerOptions] = useState<PowerRef[]>([]);
  const [primaries, setPrimaries] = useState<PrimaryStat[]>(DEFAULT_PRIMARY_STATS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState<PowersMenuLayout>({ pos: DEFAULT_POWERS_MENU_POS, tabArea: DEFAULT_POWERS_TAB_AREA });
  const [menuArt, setMenuArt] = useState<string | null>(null);
  const [tabArt, setTabArt] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [powerTarget, setPowerTarget] = useState<PowerTarget | null>(null);
  const powerFiles = usePowerProjectFiles(projectPath);


  const load = useCallback(async (preferredPath?: string) => {
    if (!projectPath || !window.electronAPI?.readFile) {
      setTree(emptyTree());
      setDirty(false);
      return;
    }
    const files = await loadProjectTextMap(projectPath);
    const found = listTreePaths(files);
    const requested = (preferredPath || '').trim();
    const nextPath = requested || found[0] || POWER_TREE_PATH;
    setTreePaths(found.includes(nextPath) ? found : [...found, nextPath].sort());
    setPath(nextPath);
    setPathDraft(nextPath);
    setTree(parsePowerTree(files[nextPath] || ''));
    setPowerIds(collectSectionIds(files, ['power', 'upgrade']));
    const catalog = await loadPowerRefs({
      projectPath,
      flarePath: getStoredFlarePath(),
      projectFiles: files,
      fs: {
        readFile: window.electronAPI.readFile,
        readDir: window.electronAPI.readDir,
      },
    });
    setPowerOptions(catalog);

    setDirty(false);
    setActiveTab(0);
    const flarePath = getStoredFlarePath();
    const primaryFile = await loadEngineFileWithFallback({
      projectPath,
      relative: PRIMARY_STATS_PATH,
      flarePath,
      fs: { readFile: window.electronAPI.readFile },
    });
    const parsed = parsePrimaryStats(primaryFile.text);
    setPrimaries(parsed.length ? parsed : DEFAULT_PRIMARY_STATS);
    const api = window.electronAPI;
    const [menuFile, art] = await Promise.all([
      loadEngineFileWithFallback({
        projectPath,
        relative: 'menus/powers.txt',
        flarePath,
        fs: { readFile: api.readFile },
      }),
      api.fileExists
        ? resolveExistingPath({
            projectPath,
            relative: 'images/menus/powers.png',
            flarePath,
            fileExists: api.fileExists,
            readFile: api.readFile,
          })
        : Promise.resolve(null),
    ]);
    setLayout(parsePowersMenuLayout(menuFile.text));
    setMenuArt(art ? `file://${art}` : null);
    setSelectedIndex(null);
  }, [projectPath]);

  useEffect(() => { void load(); }, [load]);

  const update = (next: PowerTreeFile) => {
    setTree(next);
    setDirty(true);
  };

  const save = async () => {
    if (!projectPath) {
      toast({ title: 'No project', description: 'Open a project before saving the power tree.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const saved = await writeProjectFiles(projectPath, [{ path, content: serializePowerTree(tree) }]);
      if (!saved) {
        toast({ title: 'Save failed', description: `Could not write ${path}`, variant: 'destructive' });
        return;
      }
      setDirty(false);
      setTreePaths((current) => (current.includes(path) ? current : [...current, path].sort()));
      toast({ title: 'Power tree saved', description: path });
    } finally {
      setBusy(false);
    }
  };

  const draftFiles = useMemo(() => (dirty ? [{ path, content: serializePowerTree(tree) }] : []), [dirty, path, tree]);
  useRegisterDirty('power-tree', dirty, save, draftFiles, (incoming) => {
    const file = incoming[0];
    if (!file) return;
    setTree(parsePowerTree(file.content));
    if (file.path) setPath(file.path);
    setDirty(true);
  });

  const switchPath = (nextPath: string) => {
    if (!nextPath || nextPath === path) return;
    void load(nextPath);
  };

  const tabs = tabItems(tree);
  const active = tabs[activeTab] || tabs[0];
  const tabPowers = powersOnTab(tree, activeTab);
  const selected = selectedIndex != null && tree.items[selectedIndex]?.kind === 'power'
    ? tree.items[selectedIndex] as PowerTreeNode
    : null;

  useEffect(() => {
    const rel = (active?.background || tree.background || '').trim();
    if (!rel || rel === 'images/menus/powers.png' || !projectPath || !window.electronAPI?.fileExists) {
      setTabArt(null);
      return;
    }
    let cancelled = false;
    void resolveExistingPath({
      projectPath,
      relative: rel,
      flarePath: getStoredFlarePath(),
      fileExists: window.electronAPI.fileExists,
      readFile: window.electronAPI.readFile,
    }).then((abs) => {
      if (!cancelled) setTabArt(abs ? `file://${abs}` : null);
    });
    return () => { cancelled = true; };
  }, [projectPath, active?.background, tree.background]);
  const options = useMemo(() => {
    const known = new Map(powerOptions.map((item) => [item.id, item]));
    tree.items.forEach((item) => {
      if ((item.kind === 'power' || item.kind === 'upgrade') && item.id && !known.has(item.id)) {
        known.set(item.id, { id: item.id, name: '' });
      }
    });
    return [...known.values()];
  }, [powerOptions, tree]);

  const addTab = () => {
    update({ ...tree, items: [...tree.items, emptyTab(`Tab ${tabs.length}`)] });
    setActiveTab(tabs.length);
  };

  const removeTab = (index: number) => {
    const item = tabs[index];
    if (!item) return;
    update({ ...tree, items: tree.items.filter((_, i) => i !== item.index) });
    setActiveTab((current) => Math.max(0, current === index ? index - 1 : current > index ? current - 1 : current));
    setSelectedIndex(null);
  };

  const labelOf = (id?: string, fallbackName = '') => {
    const ref = id ? powerOptions.find((item) => item.id === id) : undefined;
    return formatPowerLabel({ id: id || '', name: ref?.name || fallbackName });
  };

  const addPower = async (id = '') => {
    const position = `${layout.tabArea.x},${layout.tabArea.y}`;
    let nextId = id.trim();
    if (!nextId) {
      if (!projectPath) {
        const node = emptyPower(String(activeTab), position);
        const nextIndex = tree.items.length;
        update({ ...tree, items: [...tree.items, node] });
        setSelectedIndex(nextIndex);
        return;
      }
      const known = [
        ...powerOptions.map((item) => item.id),
        ...tree.items.map((item) => (item.kind === 'power' || item.kind === 'upgrade' ? item.id : '')),
      ];
      nextId = nextNumericPowerId(known);
      const name = defaultPowerName(nextId);
      const defPath = POWER_DEFINITIONS_PATH;
      const files = await loadProjectTextMap(projectPath);
      const nextText = appendNewPowerDefinition(files[defPath] || '', nextId, name);
      const saved = await writeProjectFiles(projectPath, [{ path: defPath, content: nextText }]);
      if (!saved) {
        toast({ title: 'Could not create power', description: `Failed to write ${defPath}`, variant: 'destructive' });
        return;
      }
      setPowerOptions((current) => (
        current.some((item) => item.id === nextId)
          ? current
          : [...current, { id: nextId, name, path: defPath, source: 'project' as const }]
      ));
      setPowerIds((current) => new Set([...current, nextId]));
      void powerFiles.reload();
    }
    const node = updateNode(emptyPower(String(activeTab), position), { id: nextId });
    const nextIndex = tree.items.length;
    update({ ...tree, items: [...tree.items, node] });
    setSelectedIndex(nextIndex);
  };

  const savePowerName = async (id: string, name: string) => {
    if (!projectPath || !id) return;
    const ref = powerOptions.find((item) => item.id === id);
    const defPath = projectPathForPower(ref);
    const files = await loadProjectTextMap(projectPath);
    const nextText = applyPowerName(files[defPath] || '', id, name);
    const saved = await writeProjectFiles(projectPath, [{ path: defPath, content: nextText }]);
    if (!saved) {
      toast({ title: 'Could not rename power', description: `Failed to write ${defPath}`, variant: 'destructive' });
      return;
    }
    setPowerOptions((current) => {
      const next = current.some((item) => item.id === id)
        ? current.map((item) => (item.id === id ? { ...item, name, path: defPath, source: 'project' as const } : item))
        : [...current, { id, name, path: defPath, source: 'project' as const }];
      return next;
    });
    void powerFiles.reload();
  };

  const removePower = (powerIndex: number) => {
    const drop = new Set([powerIndex, ...ownedUpgradeIndexes(tree, powerIndex)]);
    update({ ...tree, items: tree.items.filter((_, i) => !drop.has(i)) });
    setSelectedIndex((current) => {
      if (current == null) return null;
      if (drop.has(current)) return null;
      return current - [...drop].filter((index) => index < current).length;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <FieldHint hint="Power tree files live in powers/trees/. If a class has no power_tree= path, Flare loads powers/trees/default.txt. The same power id may appear on more than one tab.">
          <div className="text-xs font-medium">Power tree</div>
        </FieldHint>
        <Button size="sm" className="h-7 text-xs" onClick={() => void save()} disabled={!dirty || busy}>Save</Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 px-3 py-2 border-b border-border">
        <div>
          <HintLabel className="text-xs font-normal" hint="Pick an existing tree file or type a new powers/trees/*.txt path. Save writes only to the project, never to Flare's own files.">File</HintLabel>
          <div className="flex items-center gap-1">
            <Select value={treePaths.includes(path) ? path : (treePaths[0] || path)} onValueChange={switchPath}>
              <SelectTrigger width="path" className="h-7 text-xs"><SelectValue placeholder="Tree file" /></SelectTrigger>
              <SelectContent>
                {treePaths.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              width="path"
              className="h-7 text-xs font-mono"
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== path) void load(next);
                else setPathDraft(path);
              }}
              aria-label="Tree file path"
            />
          </div>
        </div>
        <div>
          <HintLabel className="text-xs font-normal" hint="background — default tree image, used when a tab has no background of its own. Path is relative to the mod.">Background</HintLabel>
          <Input
            width="path"
            className="h-7 text-xs"
            value={tree.background}
            onChange={(e) => update({ ...tree, background: e.target.value })}
            aria-label="Tree background"
          />
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-border flex-wrap items-center">
        {tabs.map((tab, i) => (
          <Button
            key={tab.index}
            type="button"
            variant="ghost"
            aria-pressed={activeTab === i}
            onClick={() => { setActiveTab(i); setSelectedIndex((current) => (current != null && Number((tree.items[current] as PowerTreeNode).tab || 0) === i ? current : null)); }}
            className={`h-7 px-2 rounded border text-xs ${activeTab === i ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-600 hover:text-white' : 'border-border text-muted-foreground'}`}
          >
            {tab.title || `Tab ${i}`}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addTab}>
          <Plus className="w-3 h-3 mr-1" />Tab
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 min-h-0 p-3">
          {tabs.length ? (
            <PowerTreeCanvas
              tree={tree}
              tabIndex={activeTab}
              layout={layout}
              menuArt={menuArt}
              tabArt={tabArt}
              names={Object.fromEntries(powerOptions.map((item) => [item.id, item.name]))}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onMove={(index, position) => {
                const item = tree.items[index];
                if (item?.kind !== 'power') return;
                update(replaceItem(tree, index, updateNode(item, { position })));
              }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Add a tab to start this tree.</p>
          )}
        </div>
        <div className="w-[22rem] shrink-0 border-l border-border overflow-y-auto p-3 space-y-3">
          {active ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <HintLabel className="text-xs font-normal" hint="tab.title — label shown on this tab.">Tab title</HintLabel>
                <Input
                  width="name"
                  className="h-7 text-xs"
                  value={active.title}
                  onChange={(e) => update(replaceItem(tree, active.index, updateTab(active, { title: e.target.value })))}
                />
              </div>
              <div>
                <HintLabel className="text-xs font-normal" hint="tab.background — optional image for this tab. If empty, the top-level background is used.">Tab background</HintLabel>
                <Input
                  width="path"
                  className="h-7 text-xs"
                  value={active.background}
                  onChange={(e) => update(replaceItem(tree, active.index, updateTab(active, { background: e.target.value })))}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => removeTab(activeTab)}>
                <Trash2 className="w-3 h-3 mr-1" />Remove tab
              </Button>
            </div>
          ) : null}

          {tabs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addPower()}>
                <Plus className="w-3 h-3 mr-1" />Power
              </Button>
              <SearchablePalette
                buttonLabel="Add from list"
                placeholder="Search powers…"
                entries={options.map((item) => ({
                  id: item.id,
                  label: formatPowerLabel(item),
                  searchText: `${item.name} ${item.id}`,
                }))}
                onSelect={(id) => addPower(id)}
              />
            </div>
          ) : null}

          {tabPowers.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tabPowers.map((power) => (
                <Button
                  key={power.index}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`h-6 px-2 text-[11px] ${selectedIndex === power.index ? 'bg-orange-600 text-white hover:bg-orange-600 hover:text-white' : ''}`}
                  onClick={() => setSelectedIndex(power.index)}
                >
                  {labelOf(power.id)}
                </Button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <div className="rounded-md border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium truncate">{labelOf(selected.id)}</div>
                <div className="flex items-center gap-1">
                  {selected.id ? (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPowerTarget({ type: 'power', id: selected.id })}>
                      Edit definition
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove power" onClick={() => removePower(selectedIndex!)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <HintLabel className="text-xs font-normal" hint="name — the name stored on the power definition in powers/powers.txt. The tree itself only stores the id.">Name</HintLabel>
                <Input
                  width="name"
                  className="h-7 text-xs"
                  value={powerOptions.find((item) => item.id === selected.id)?.name || ''}
                  placeholder={selected.id ? defaultPowerName(selected.id) : 'Name'}
                  aria-label="Power name"
                  onChange={(e) => {
                    const name = e.target.value;
                    const id = selected.id;
                    if (!id) return;
                    setPowerOptions((current) => {
                      const defPath = projectPathForPower(current.find((item) => item.id === id));
                      if (current.some((item) => item.id === id)) {
                        return current.map((item) => (item.id === id ? { ...item, name } : item));
                      }
                      return [...current, { id, name, path: defPath, source: 'project' }];
                    });
                  }}
                  onBlur={(e) => {
                    if (selected.id) void savePowerName(selected.id, e.target.value.trim());
                  }}
                />
              </div>
              {selected.id && isPlaceholderPowerName(powerOptions.find((item) => item.id === selected.id)?.name) ? (
                <p className="text-[11px] text-amber-500">This power still has a placeholder name.</p>
              ) : null}
              {selected.id && powerIds.size && unknownIds(selected.id, powerIds).length > 0 ? (
                <p className="text-[11px] text-amber-500">Unknown power id: {unknownIds(selected.id, powerIds).join(', ')}</p>
              ) : null}
              <PowerTreeNodeFields
                node={selected}
                primaries={primaries}
                powerOptions={options}
                showPlacement
                showUpgrades
                upgradeIds={selected.upgrades}
                onChange={(next) => update(replaceItem(tree, selectedIndex!, next))}
                onChangeUpgrades={(ids) => update(setPowerUpgrades(tree, selectedIndex!, ids))}
              />
              {ownedUpgradeIndexes(tree, selectedIndex!).length > 0 ? (
                <details className="rounded border border-border/40 p-2">
                  <summary className="text-xs cursor-pointer">Upgrade requirements ({ownedUpgradeIndexes(tree, selectedIndex!).length})</summary>
                  <div className="mt-2 space-y-3">
                    {ownedUpgradeIndexes(tree, selectedIndex!).map((index) => {
                      const upgrade = tree.items[index] as PowerTreeNode;
                      return (
                        <div key={index} className="space-y-1">
                          <div className="text-[11px] font-medium text-muted-foreground">{upgrade.id || 'Upgrade'}</div>
                          <PowerTreeNodeFields
                            node={upgrade}
                            primaries={primaries}
                            powerOptions={options}
                            onChange={(next) => update(replaceItem(tree, index, next))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </div>
          ) : tabs.length ? (
            <p className="text-xs text-muted-foreground">Select a power on the canvas to edit it.</p>
          ) : null}
        </div>
      </div>
      {powerTarget ? (
        <PowerEditorWindow target={powerTarget} data={powerFiles} onClose={() => setPowerTarget(null)} onOpen={setPowerTarget} />
      ) : null}
    </div>
  );
}
