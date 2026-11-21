import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldHint } from '@/components/ui/field-hint';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import { writeProjectFiles } from '@/editor/projectFiles';
import { loadEngineFileWithFallback } from '@/editor/engineFileFallback';
import {
  TITLES_PATH,
  emptyTitle,
  parsePrimaryStats,
  parseTitles,
  serializeTitles,
  type TitleEntry,
  PRIMARY_STATS_PATH,
  DEFAULT_PRIMARY_STATS,
} from '@/editor/statsTitles';
import { useRegisterDirty } from '@/context/SaveHealthContext';

type Props = { projectPath?: string | null };

const TitlesEditorView: React.FC<Props> = ({ projectPath }) => {
  const [titles, setTitles] = useState<TitleEntry[]>([]);
  const [primaryIds, setPrimaryIds] = useState<string[]>(DEFAULT_PRIMARY_STATS.map((stat) => stat.id));
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceKind, setSourceKind] = useState<'project' | 'mod' | 'empty'>('empty');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.readFile) {
      setTitles([]);
      setSourceKind('empty');
      setSourceLabel('');
      setDirty(false);
      return;
    }
    const fs = { readFile: window.electronAPI.readFile };
    const flarePath = getStoredFlarePath();
    const [titlesFile, primaryFile] = await Promise.all([
      loadEngineFileWithFallback({ projectPath, relative: TITLES_PATH, flarePath, fs }),
      loadEngineFileWithFallback({ projectPath, relative: PRIMARY_STATS_PATH, flarePath, fs }),
    ]);
    setTitles(parseTitles(titlesFile.text));
    const primaries = parsePrimaryStats(primaryFile.text);
    setPrimaryIds((primaries.length ? primaries : DEFAULT_PRIMARY_STATS).map((stat) => stat.id));
    setSourceKind(titlesFile.source);
    setSourceLabel(titlesFile.label);
    setDirty(false);
  }, [projectPath]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const update = (index: number, patch: Partial<TitleEntry>) => {
    setTitles((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    setDirty(true);
  };

  const move = (index: number, delta: number) => {
    setTitles((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    if (!projectPath) {
      toast({ title: 'No project', description: 'Open a project before saving titles.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const saved = await writeProjectFiles(projectPath, [{ path: TITLES_PATH, content: serializeTitles(titles) }]);
      if (!saved) {
        toast({ title: 'Save failed', description: `Could not write ${TITLES_PATH}.`, variant: 'destructive' });
        return;
      }
      setDirty(false);
      setSourceKind('project');
      setSourceLabel('project');
      toast({ title: 'Saved', description: `Wrote ${TITLES_PATH}.` });
    } finally {
      setBusy(false);
    }
  };

  useRegisterDirty('titles', dirty, save);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <FieldHint hint={
            sourceKind === 'project' ? 'Editing the project file. Character-screen titles from engine/titles.txt. Flare uses the first matching title, so keep stricter or higher-level titles at the top.'
            : sourceKind === 'mod' ? `Loaded from a required mod or default (${sourceLabel}). Save writes a project override. Flare uses the first matching title, so keep stricter or higher-level titles at the top.`
            : 'Character-screen titles from engine/titles.txt. Flare uses the first matching title, so keep stricter or higher-level titles at the top. No titles file found yet; Save will create engine/titles.txt in the project.'
          }>
            <div className="text-sm font-semibold">Titles</div>
          </FieldHint>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => { setTitles((current) => [...current, emptyTitle()]); setDirty(true); }} disabled={!projectPath}>Add title</Button>
          <Button type="button" size="sm" onClick={() => { void save(); }} disabled={!projectPath || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
        </div>
      </div>

      {!projectPath ? (
        <p className="text-sm text-muted-foreground">Open a project to edit titles.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-background z-[1] border-b border-border">
              <tr>
                <th className="text-left font-medium p-2 w-8">#</th>
                <th className="text-left font-medium p-2">Title</th>
                <th className="text-left font-medium p-2 w-20">Level</th>
                <th className="text-left font-medium p-2 w-24">Power</th>
                <th className="text-left font-medium p-2">Requires status</th>
                <th className="text-left font-medium p-2">Requires not</th>
                <th className="text-left font-medium p-2 w-28">Primary</th>
                <th className="text-left font-medium p-2 w-28">2nd primary</th>
                <th className="p-2 w-28" />
              </tr>
            </thead>
            <tbody>
              {titles.length === 0 ? (
                <tr><td colSpan={9} className="p-3 text-muted-foreground">No titles yet. Add one, or save after loading a fallback.</td></tr>
              ) : titles.map((row, index) => (
                <tr key={index} className="border-t border-border align-top">
                  <td className="p-2 text-muted-foreground">{index + 1}</td>
                  <td className="p-2"><Input aria-label={`Title ${index + 1}`} width="name" value={row.title} onChange={(event) => update(index, { title: event.target.value })} className="h-8" /></td>
                  <td className="p-2"><Input aria-label={`Level ${index + 1}`} width="num" value={row.level} onChange={(event) => update(index, { level: event.target.value })} className="h-8" /></td>
                  <td className="p-2"><Input aria-label={`Power ${index + 1}`} width="id" value={row.power} onChange={(event) => update(index, { power: event.target.value })} className="h-8" /></td>
                  <td className="p-2"><Input aria-label={`Requires status ${index + 1}`} width="id" value={row.requires_status} onChange={(event) => update(index, { requires_status: event.target.value })} className="h-8" placeholder="status ids" /></td>
                  <td className="p-2"><Input aria-label={`Requires not status ${index + 1}`} width="id" value={row.requires_not_status} onChange={(event) => update(index, { requires_not_status: event.target.value })} className="h-8" placeholder="status ids" /></td>
                  <td className="p-2">
                    <Input list={`primary-stats-${index}`} aria-label={`Primary stat ${index + 1}`} width="id" value={row.primary_stat_1} onChange={(event) => update(index, { primary_stat_1: event.target.value })} className="h-8" />
                    <datalist id={`primary-stats-${index}`}>{primaryIds.map((id) => <option key={id} value={id} />)}</datalist>
                  </td>
                  <td className="p-2">
                    <Input list={`primary-stats-2-${index}`} aria-label={`Second primary ${index + 1}`} width="id" value={row.primary_stat_2} onChange={(event) => update(index, { primary_stat_2: event.target.value })} className="h-8" />
                    <datalist id={`primary-stats-2-${index}`}>{primaryIds.map((id) => <option key={id} value={id} />)}</datalist>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => move(index, -1)} disabled={index === 0}>Up</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => move(index, 1)} disabled={index === titles.length - 1}>Down</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setTitles((current) => current.filter((_, rowIndex) => rowIndex !== index)); setDirty(true); }}>Remove</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TitlesEditorView;
