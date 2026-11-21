import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument } from '@/editor/projectFiles';
import { XP_TABLE_PATH, parseXpTable } from '@/editor/engineForms';

function xpForLevel(table: Array<{ level: string; xp: string }>, level: string): string {
  const wanted = String(level || '').trim();
  if (!wanted) return '0';
  const row = table.find((entry) => entry.level.trim() === wanted);
  return row?.xp.trim() || '0';
}

export default function TestLaunchForm({ projectPath }: { projectPath: string | null }) {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [maps, setMaps] = useState<string[]>([]);
  const [mapPath, setMapPath] = useState('');
  const [x, setX] = useState('0');
  const [y, setY] = useState('0');
  const [level, setLevel] = useState('1');
  const [xp, setXp] = useState('0');
  const [carried, setCarried] = useState('');
  const [equipped, setEquipped] = useState('');
  const [campaign, setCampaign] = useState('');
  const [written, setWritten] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) { setMaps([]); return; }
    let cancelled = false;
    void (async () => {
      const [list, tableText] = await Promise.all([
        listTxtUnder(root, 'maps'),
        loadConfigDocument(root, XP_TABLE_PATH),
      ]);
      if (cancelled) return;
      setMaps(list);
      if (!mapPath && list[0]) setMapPath(list[0]);
      const table = parseXpTable(tableText);
      setXp((current) => current === '0' ? xpForLevel(table, level) : current);
    })();
    return () => { cancelled = true; };
  }, [root]);

  const applyLevel = async (nextLevel: string) => {
    setLevel(nextLevel);
    if (!root) return;
    const table = parseXpTable(await loadConfigDocument(root, XP_TABLE_PATH));
    setXp(xpForLevel(table, nextLevel));
  };

  const write = async () => {
    if (!root) {
      toast({ title: 'No project', description: 'Open a project before writing a test save.', variant: 'destructive' });
      return;
    }
    if (!window.electronAPI?.writeFlareTestSave) {
      toast({ title: 'Restart the app', description: 'The test-save writer needs an Electron restart.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const result = await window.electronAPI.writeFlareTestSave({
        projectPath: root,
        mapPath,
        x,
        y,
        xp,
        carried,
        equipped,
        campaign,
      });
      if (!result?.success) {
        toast({ title: 'Could not write the test save', description: result?.error || 'Write failed.', variant: 'destructive' });
        return;
      }
      setWritten(result.avatarPath || result.testSaveDir || '');
      toast({ title: 'Test save written', description: result.avatarPath || `Prefix ${result.testPrefix}. Flare was not launched.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <FieldHint hint="Writes a Flare save under path_user/saves/<prefix>_studio_test/1/avatar.txt with the chosen map, XP, items and campaign statuses. Play Current Map launches that save (updating the spawn to the current map and position, and keeping any XP, items and statuses already in the file). This button only writes the file.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Test save</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Map file written into spawn=.">map</HintLabel>
        <Input width="path" className="h-7 text-xs" list="test-launch-maps" aria-label="Test save map" value={mapPath} onChange={(e) => setMapPath(e.target.value)} />
        <HintLabel className="text-xs font-normal w-8 shrink-0" hint="Spawn x,y on that map.">pos</HintLabel>
        <Input width="num" className="h-7 text-xs" aria-label="Spawn x" value={x} onChange={(e) => setX(e.target.value)} />
        <Input width="num" className="h-7 text-xs" aria-label="Spawn y" value={y} onChange={(e) => setY(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Hero level. XP is filled from engine/xp_table.txt when that file is in the project.">level</HintLabel>
        <Input width="num" className="h-7 text-xs" aria-label="Level" value={level} onChange={(e) => { void applyLevel(e.target.value); }} />
        <HintLabel className="text-xs font-normal w-8 shrink-0" hint="XP written to the save. The engine derives level from the XP table; there is no level= key.">xp</HintLabel>
        <Input width="num" className="h-7 text-xs" aria-label="XP" value={xp} onChange={(e) => setXp(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Item ids in the carried inventory, comma-separated.">carried</HintLabel>
        <Input width="path" className="h-7 text-xs" aria-label="Carried items" value={carried} onChange={(e) => setCarried(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Item ids in equipment slots, comma-separated, in slot order.">equipped</HintLabel>
        <Input width="path" className="h-7 text-xs" aria-label="Equipped items" value={equipped} onChange={(e) => setEquipped(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Campaign statuses written as campaign= in the save, comma-separated.">statuses</HintLabel>
        <Input width="path" className="h-7 text-xs" aria-label="Campaign statuses" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
      </div>
      <Button type="button" size="sm" className="h-7 text-xs" onClick={() => { void write(); }} disabled={!root || busy}>
        {busy ? 'Writing…' : 'Write test save'}
      </Button>
      {written ? <div className="text-xs font-mono text-muted-foreground break-all">{written}</div> : null}
      <datalist id="test-launch-maps">{maps.map((path) => <option key={path} value={path} />)}</datalist>
    </div>
  );
}
