import { useMemo, useState } from 'react';
import { ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { KIND_META, POWER_KIND_ORDER, categorizePower, classifyEffect, type ContentKind } from '@/editor/powers/powerKinds';
import { KindIcon } from './kindIcon';
import PowerEditorWindow, { type PowerTarget } from './PowerEditorWindow';
import { usePowerProjectFiles } from './usePowerProjectFiles';

type Row = { target: PowerTarget; name: string; hint: string };
const GROUPS: ContentKind[] = [...POWER_KIND_ORDER, 'buff', 'debuff', 'flag'];

/** Dock list for the Statuses layer: powers by usage, effects by Buff/Debuff, story flags. */
const PowersPanel = ({ projectPath }: { projectPath: string | null | undefined }) => {
  const data = usePowerProjectFiles(projectPath);
  const { project, kinds } = data;
  const [open, setOpen] = useState<Set<ContentKind>>(new Set());
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<PowerTarget | null>(null);

  const groups = useMemo(() => {
    const out = Object.fromEntries(GROUPS.map((g) => [g, [] as Row[]])) as Record<ContentKind, Row[]>;
    for (const p of project.powers) out[categorizePower(p, project.powerUsedBy[p.id] || [], kinds[p.id])].push({ target: { type: 'power', id: p.id }, name: p.name, hint: p.id });
    for (const e of project.effects) out[classifyEffect(e, project.effectUsedBy[e.id] || [])].push({ target: { type: 'effect', id: e.id }, name: e.name, hint: e.id });
    for (const f of Object.keys(project.flags).sort()) out.flag.push({ target: { type: 'flag', id: f }, name: f, hint: '' });
    return out;
  }, [project, kinds]);

  const q = query.trim().toLowerCase();
  const match = (r: Row) => !q || `${r.name} ${r.hint}`.toLowerCase().includes(q);

  if (!projectPath) return <div className="p-3 text-xs text-muted-foreground">Open a project to see its powers.</div>;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1 px-1 pt-1">
        <Input className="h-7 text-xs" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search powers" />
        <Tooltip content="Reload from disk" side="bottom">
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label="Reload" onClick={() => void data.reload()}>
            <RefreshCw className={`w-3.5 h-3.5 ${data.loading ? 'animate-spin' : ''}`} />
          </Button>
        </Tooltip>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-1 py-1">
        {GROUPS.map((g) => {
          const rows = groups[g].filter(match);
          const expanded = open.has(g) || (!!q && rows.length > 0);
          return (
            <div key={g}>
              <Tooltip content={KIND_META[g].tooltip} side="left">
                <button type="button" className="w-full flex items-center gap-2 h-7 px-1.5 rounded hover:bg-muted/50 text-xs"
                  onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
                  <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  <KindIcon kind={g} />
                  <span className="flex-1 text-left font-medium truncate">{KIND_META[g].plural}</span>
                  <span className="text-[10px] text-muted-foreground">{rows.length}</span>
                </button>
              </Tooltip>
              {expanded && rows.map((r) => (
                <button key={`${r.target.type}-${r.target.id}`} type="button" onClick={() => setTarget(r.target)}
                  className={`w-full flex items-center gap-2 h-6 pl-8 pr-1.5 rounded text-xs hover:bg-muted/50 ${target?.type === r.target.type && target.id === r.target.id ? 'bg-muted' : ''}`}>
                  <span className="flex-1 text-left truncate">{r.name}</span>
                  {r.hint && r.hint !== r.name && <span className="text-[10px] text-muted-foreground truncate max-w-[5rem]">{r.hint}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex justify-center py-2">
        <Button size="sm" className="h-7 text-xs px-3" onClick={() => setTarget({ type: 'new', id: 'skill' })}>
          <Plus className="w-3 h-3 mr-1" />New
        </Button>
      </div>
      {target && <PowerEditorWindow target={target} data={data} onClose={() => setTarget(null)} onOpen={setTarget} />}
    </div>
  );
};

export default PowersPanel;
