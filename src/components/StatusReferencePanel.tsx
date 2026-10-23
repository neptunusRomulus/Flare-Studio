import React, { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { collectStatusReferences, type StatusUsage } from '@/editor/statusIndex';
import { projectRoot } from '@/editor/projectFiles';

const StatusReferencePanel = () => {
  const ctx = useAppContext();
  const currentProjectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [index, setIndex] = useState<Record<string, StatusUsage>>({});

  useEffect(() => {
    if (!currentProjectPath || !window.electronAPI?.readDir || !window.electronAPI.readFile) {
      setIndex({});
      return;
    }
    let cancelled = false;
    const root = projectRoot(currentProjectPath);
    const load = async () => {
      const sources: Array<{ source: string; value: unknown }> = [];
      const folders = [
        ['quests', 'content/quests', 'quest'],
        ['maps', 'content/maps', 'map'],
        ['npcs', 'content/npcs', 'npc'],
      ] as const;
      for (const [label, folder, prefix] of folders) {
        const entries = await window.electronAPI.readDir(`${root}/${folder}`);
        for (const entry of entries || []) {
          if (entry.isDirectory || !entry.name.endsWith('.json')) continue;
          const text = await window.electronAPI.readFile(`${root}/${folder}/${entry.name}`);
          if (!text) continue;
          try {
            sources.push({ source: `${prefix}:${entry.name.replace(/\.json$/, '')}`, value: JSON.parse(text) });
          } catch {
            sources.push({ source: `${label}:${entry.name}`, value: text });
          }
        }
      }
      if (!cancelled) setIndex(collectStatusReferences(sources));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentProjectPath]);

  const names = Object.keys(index).sort();
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status cross-reference</div>
      {names.length === 0 ? (
        <p className="text-xs text-muted-foreground">No quest, map, or dialogue status references in this project yet.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {names.map((name) => (
            <li key={name}>
              <div className="font-medium">{name}</div>
              <div className="text-muted-foreground">sets: {index[name].setBy.join(', ') || '—'}</div>
              <div className="text-muted-foreground">reads: {index[name].readBy.join(', ') || '—'}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StatusReferencePanel;
