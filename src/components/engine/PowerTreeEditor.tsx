import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { collectSectionIds, unknownIds } from '@/editor/engineForms';
import { loadProjectTextMap, writeProjectFiles } from '@/editor/projectFiles';
import { parsePowerTree, POWER_TREE_PATH, serializePowerTree, type PowerTreeFile, type PowerTreeTab } from '@/editor/powerTree';
import { useAppContext } from '@/context/AppContext';

export default function PowerTreeEditor() {
  const ctx = useAppContext();
  const projectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [path, setPath] = useState(POWER_TREE_PATH);
  const [tree, setTree] = useState<PowerTreeFile>({ tabs: [], nodes: [] });
  const [activeTab, setActiveTab] = useState(0);
  const [powerIds, setPowerIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    if (!projectPath || !window.electronAPI?.readFile) return;
    const files = await loadProjectTextMap(projectPath);
    const treePath = Object.keys(files).find((p) => /^powers\/trees\/.+\.txt$/i.test(p)) || POWER_TREE_PATH;
    setPath(treePath);
    setTree(parsePowerTree(files[treePath] || ''));
    setPowerIds(collectSectionIds(files, ['power', 'upgrade']));
    setDirty(false);
    setActiveTab(0);
  };

  useEffect(() => { void load(); }, [projectPath]);

  const update = (next: PowerTreeFile) => { setTree(next); setDirty(true); };

  const save = async () => {
    if (!projectPath) return;
    const saved = await writeProjectFiles(projectPath, [{ path, content: serializePowerTree(tree) }]);
    if (saved) {
      setDirty(false);
      toast({ title: 'Power tree saved', description: path });
    } else {
      toast({ title: 'Save failed', description: `Could not write ${path}`, variant: 'destructive' });
    }
  };

  const tabNodes = tree.nodes.filter((n) => n.kind === 'power' && Number(n.tab || 0) === activeTab);
  const upgrades = tree.nodes.filter((n) => n.kind === 'upgrade');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-xs text-muted-foreground truncate">{path}</div>
        <Button size="sm" className="h-7 text-xs" onClick={() => void save()} disabled={!dirty}>Save</Button>
      </div>
      <div className="flex gap-1 px-3 py-2 border-b border-border flex-wrap">
        {tree.tabs.map((tab, i) => (
          <button key={i} type="button" onClick={() => setActiveTab(i)}
            className={`h-7 px-2 rounded border text-xs ${activeTab === i ? 'bg-orange-600 text-white border-orange-600' : 'border-border text-muted-foreground'}`}>
            {tab.title || `Tab ${i}`}
          </button>
        ))}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => update({ ...tree, tabs: [...tree.tabs, { title: 'New tab', background: '' }] })}>
          <Plus className="w-3 h-3 mr-1" />Tab
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tree.tabs[activeTab] && (
          <div className="grid grid-cols-[7rem_1fr] gap-2 items-center">
            <Tooltip content="tab.title"><span className="text-xs">Tab title</span></Tooltip>
            <Input className="h-7 text-xs" value={tree.tabs[activeTab].title} onChange={(e) => {
              const tabs = tree.tabs.map((tab, i) => (i === activeTab ? { ...tab, title: e.target.value } as PowerTreeTab : tab));
              update({ ...tree, tabs });
            }} />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Powers on this tab (tab=, position=x,y, requires_power).  Other keys are kept when you save.</p>
        {tabNodes.map((node) => {
          const missing = unknownIds(node.requires_power, powerIds);
          const idMissing = node.id && powerIds.size > 0 && !powerIds.has(node.id);
          const setNode = (patch: Partial<typeof node>) => {
            update({ ...tree, nodes: tree.nodes.map((n) => (n === node ? { ...n, ...patch } : n)) });
          };
          return (
            <div key={`${node.kind}-${node.id}`} className="border border-border/50 rounded-md p-2 space-y-1">
              <div className="grid grid-cols-[4rem_8rem_8rem_1fr_auto] gap-1 items-center">
                <span className="text-[11px] text-muted-foreground">id</span>
                <Input className="h-6 text-xs font-mono" value={node.id} onChange={(e) => setNode({ id: e.target.value })} />
                <Tooltip content="position"><Input className="h-6 text-xs" value={node.position} placeholder="x,y" onChange={(e) => setNode({ position: e.target.value })} /></Tooltip>
                <Tooltip content="requires_power"><Input className="h-6 text-xs" value={node.requires_power} placeholder="requires_power" onChange={(e) => setNode({ requires_power: e.target.value })} /></Tooltip>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove power" onClick={() => update({ ...tree, nodes: tree.nodes.filter((n) => n !== node) })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              {(idMissing || missing.length > 0) && (
                <p className="text-[11px] text-amber-500">
                  {idMissing ? `Unknown power id ${node.id}. ` : ''}
                  {missing.length ? `Unknown requires_power: ${missing.join(', ')}` : ''}
                </p>
              )}
            </div>
          );
        })}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => update({
          ...tree,
          nodes: [...tree.nodes, { kind: 'power', id: '', tab: String(activeTab), position: '0,0', requires_power: '', extras: [] }],
        })}>
          <Plus className="w-3 h-3 mr-1" />Power
        </Button>
        {upgrades.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium">Upgrades</div>
            {upgrades.map((node) => (
              <div key={node.id} className="grid grid-cols-[4rem_8rem_1fr] gap-1 items-center">
                <span className="text-[11px] text-muted-foreground">id {node.id}</span>
                <span className="text-[11px] text-muted-foreground">requires_power</span>
                <Input className="h-6 text-xs" value={node.requires_power} onChange={(e) => update({
                  ...tree,
                  nodes: tree.nodes.map((n) => (n === node ? { ...n, requires_power: e.target.value } : n)),
                })} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
