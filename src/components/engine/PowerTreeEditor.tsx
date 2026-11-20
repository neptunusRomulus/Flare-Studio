import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { collectSectionIds, unknownIds } from '@/editor/engineForms';
import { loadEngineFileWithFallback } from '@/editor/engineFileFallback';
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
import PowerTreeNodeFields, { type PowerOption } from '@/components/engine/PowerTreeNodeFields';

function collectPowerOptions(files: Record<string, string>): PowerOption[] {
  const byId = new Map<string, string>();
  for (const [path, text] of Object.entries(files)) {
    if (!/^powers\//i.test(path) || /^powers\/trees\//i.test(path)) continue;
    let id = '';
    let name = '';
    let inSection = false;
    for (const line of String(text || '').split(/\r?\n/)) {
      const header = line.match(/^\[(.+)\]\s*$/);
      if (header) {
        if (inSection && id && !byId.has(id)) byId.set(id, name);
        inSection = /^(power|upgrade)$/i.test(header[1].trim());
        id = '';
        name = '';
        continue;
      }
      if (!inSection) continue;
      const kv = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (!kv) continue;
      if (kv[1] === 'id') id = kv[2].trim();
      if (kv[1] === 'name' && !name) name = kv[2].trim();
    }
    if (inSection && id && !byId.has(id)) byId.set(id, name);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export default function PowerTreeEditor() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [path, setPath] = useState(POWER_TREE_PATH);
  const [pathDraft, setPathDraft] = useState(POWER_TREE_PATH);
  const [treePaths, setTreePaths] = useState<string[]>([POWER_TREE_PATH]);
  const [tree, setTree] = useState<PowerTreeFile>(emptyTree());
  const [activeTab, setActiveTab] = useState(0);
  const [powerIds, setPowerIds] = useState<Set<string>>(new Set());
  const [powerOptions, setPowerOptions] = useState<PowerOption[]>([]);
  const [primaries, setPrimaries] = useState<PrimaryStat[]>(DEFAULT_PRIMARY_STATS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setPowerOptions(collectPowerOptions(files));
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

  const switchPath = (nextPath: string) => {
    if (!nextPath || nextPath === path) return;
    void load(nextPath);
  };

  const tabs = tabItems(tree);
  const active = tabs[activeTab] || tabs[0];
  const tabPowers = powersOnTab(tree, activeTab);
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
  };

  const addPower = (id = '') => {
    const node = id ? updateNode(emptyPower(String(activeTab), '0,0'), { id }) : emptyPower(String(activeTab), '0,0');
    update({ ...tree, items: [...tree.items, node] });
  };

  const removePower = (powerIndex: number) => {
    const drop = new Set([powerIndex, ...ownedUpgradeIndexes(tree, powerIndex)]);
    update({ ...tree, items: tree.items.filter((_, i) => !drop.has(i)) });
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
            onClick={() => setActiveTab(i)}
            className={`h-7 px-2 rounded border text-xs ${activeTab === i ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-600 hover:text-white' : 'border-border text-muted-foreground'}`}
          >
            {tab.title || `Tab ${i}`}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addTab}>
          <Plus className="w-3 h-3 mr-1" />Tab
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!tabs.length ? (
          <p className="text-xs text-muted-foreground">Add a tab to start this tree.</p>
        ) : null}

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

        {tabPowers.map((power) => {
          const missing = power.id && powerIds.size ? unknownIds(power.id, powerIds) : [];
          const upgradeIndexes = ownedUpgradeIndexes(tree, power.index);
          return (
            <div key={power.index} className="rounded-md border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium truncate">{power.id || 'Power'}</div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove power" onClick={() => removePower(power.index)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              {missing.length > 0 && (
                <p className="text-[11px] text-amber-500">Unknown power id: {missing.join(', ')}</p>
              )}
              <PowerTreeNodeFields
                node={power}
                primaries={primaries}
                powerOptions={options}
                showPlacement
                showUpgrades
                upgradeIds={power.upgrades}
                onChange={(next) => update(replaceItem(tree, power.index, next))}
                onChangeUpgrades={(ids) => update(setPowerUpgrades(tree, power.index, ids))}
              />
              {upgradeIndexes.length > 0 ? (
                <details className="rounded border border-border/40 p-2">
                  <summary className="text-xs cursor-pointer">Upgrade requirements ({upgradeIndexes.length})</summary>
                  <div className="mt-2 space-y-3">
                    {upgradeIndexes.map((index) => {
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
          );
        })}

        {tabs.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addPower()}>
              <Plus className="w-3 h-3 mr-1" />Power
            </Button>
            <SearchablePalette
              buttonLabel="Add from list"
              placeholder="Search powers…"
              entries={options.map((item) => ({
                id: item.id,
                label: item.name ? `${item.name} (${item.id})` : item.id,
                searchText: `${item.name} ${item.id}`,
              }))}
              onSelect={(id) => addPower(id)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
