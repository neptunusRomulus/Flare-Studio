import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument } from '@/editor/projectFiles';
import { collectStatusHitsFromText, groupStatusHits, type StatusHit, type StatusRow } from '@/editor/statusTracking';

const SCAN_DIRS = ['maps', 'scripts', 'books', 'npcs', 'powers', 'items', 'cutscenes', 'enemies', 'quests', 'engine'];

function counts(row: StatusRow): string {
  const parts = [
    row.set.length ? `set ${row.set.length}` : '',
    row.unset.length ? `unset ${row.unset.length}` : '',
    row.require.length ? `require ${row.require.length}` : '',
    row.require_not.length ? `require_not ${row.require_not.length}` : '',
    row.other.length ? `other ${row.other.length}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'mentioned';
}

function Hits({ label, hint, hits }: { label: string; hint: string; hits: StatusHit[] }) {
  if (!hits.length) return null;
  return (
    <div className="space-y-0.5">
      <HintLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground" hint={hint}>{label}</HintLabel>
      {hits.map((hit, index) => (
        <div key={`${hit.file}:${hit.line}:${index}`} className="text-xs font-mono text-muted-foreground">
          {hit.file}:{hit.line} {hit.key}={hit.value}
        </div>
      ))}
    </div>
  );
}

export default function StatusTrackingView({ projectPath }: { projectPath: string | null }) {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    if (!root) { setRows([]); setFileCount(0); return; }
    let cancelled = false;
    setBusy(true);
    void (async () => {
      const hits: StatusHit[] = [];
      let scanned = 0;
      for (const dir of SCAN_DIRS) {
        const paths = await listTxtUnder(root, dir);
        for (const path of paths) {
          const text = await loadConfigDocument(root, path);
          hits.push(...collectStatusHitsFromText(path, text));
          scanned += 1;
        }
      }
      if (cancelled) return;
      setRows(groupStatusHits(hits));
      setFileCount(scanned);
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [root]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return rows.filter((row) => !needle || row.status.toLowerCase().includes(needle) || counts(row).includes(needle));
  }, [rows, filter]);

  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-2 p-3">
      <FieldHint hint="Campaign statuses found in the project. set/unset come from event and item keys; require/require_not are conditions. quest_loot, status_loot, vendor stock and random_status append lists are included. Only .txt files under maps, scripts, books, npcs, powers, items, cutscenes, enemies, quests and engine are scanned. This is a read-only view.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status tracking</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal" hint="Filter by status id or role.">filter</HintLabel>
        <Input width="path" className="h-7 text-xs" aria-label="Filter statuses" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="text-xs text-muted-foreground">{busy ? 'Scanning…' : `${visible.length} of ${rows.length} statuses in ${fileCount} files`}</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {visible.map((row) => (
          <div key={row.status} className="space-y-1 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="text-sm font-mono">{row.status}</div>
              <div className="text-[11px] text-muted-foreground">{counts(row)}</div>
            </div>
            <Hits label="set" hint="Places that set this status (set_status, pickup_status, defeat_status, campaign, …)." hits={row.set} />
            <Hits label="unset" hint="Places that clear this status (unset_status)." hits={row.unset} />
            <Hits label="require" hint="Places that require this status to be set." hits={row.require} />
            <Hits label="require_not" hint="Places that require this status to be unset." hits={row.require_not} />
            <Hits label="other" hint="Other mentions: show_status, procgen_reset_status, random_status append lists." hits={row.other} />
          </div>
        ))}
        {!busy && !visible.length ? (
          <div className="text-xs text-muted-foreground">{root ? 'No campaign statuses found in the scanned folders.' : 'Open a project to scan statuses.'}</div>
        ) : null}
      </div>
    </div>
  );
}
