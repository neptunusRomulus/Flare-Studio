import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapObject } from '@/types';
import { importNpcText } from '@/adapters/flare/flareAdapter.cjs';
import { projectRoot, writeProjectFiles } from '@/editor/projectFiles';
import { normalizeNpcFile, npcFileForActor } from '@/editor/npcInstances';
import { propertyRecord, propertyText } from '@/editor/propertyText';
import useNpcInstances from '@/hooks/useNpcInstances';
import { questMapEventsFromMapProject, questMapEventsFromMapText, questMapEventsFromObjects } from '@/editor/questMapEvents';
import { slugFileName } from '@/adapters/flare/flareAdapter.cjs';
import {
  QUEST_MAP_SIDECAR,
  type QuestMapEventInput,
  parseQuestMapPositions,
  serializeQuestMapPositions,
  type QuestMapDialogInput,
  type QuestMapNpcInput,
  type QuestMapPositions,
} from '@/editor/questMap';

type FileNpc = { file: string; name: string; portrait?: string; dialogs: QuestMapDialogInput[] };

function parseTrees(value: unknown): QuestMapDialogInput[] | null {
  const text = Array.isArray(value) ? value.join('\n') : value == null ? '' : String(value);
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as QuestMapDialogInput[]) : null;
  } catch {
    return null;
  }
}

type Params = {
  open: boolean;
  projectPath?: string | null;
  mapName?: string;
  /** Live objects of the open map (NPC objects open in the NPC editor). */
  mapObjects: MapObject[];
};

/** NPC dialogs from npcs/*.txt (open map edits win), their map locations, and saved card positions. */
export default function useQuestMapData({ open, projectPath, mapName = '', mapObjects }: Params) {
  const [fileNpcs, setFileNpcs] = useState<FileNpc[]>([]);
  const [mapEvents, setMapEvents] = useState<QuestMapEventInput[]>([]);
  const [positions, setPositions] = useState<QuestMapPositions>({});
  const [loading, setLoading] = useState(false);
  const npcObjects = useMemo(() => mapObjects.filter((o) => o.type === 'npc'), [mapObjects]);
  const { instances } = useNpcInstances({ projectPath: open ? projectPath : null, currentMapName: mapName, objects: npcObjects });

  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!open || !projectPath || !api?.readDir || !api.readFile) return;
    let cancelled = false;
    const root = projectRoot(projectPath);
    setLoading(true);
    void (async () => {
      const found: FileNpc[] = [];
      try {
        const entries = await api.readDir(`${root}/npcs`);
        for (const entry of entries) {
          if (entry.isDirectory || !/\.txt$/i.test(entry.name)) continue;
          const text = await api.readFile(`${root}/npcs/${entry.name}`);
          if (!text) continue;
          try {
            const npc = importNpcText(text) as { name?: string; portrait?: string; customProperties?: { dialogueTrees?: QuestMapDialogInput[] } };
            found.push({
              file: normalizeNpcFile(`npcs/${entry.name}`),
              name: String(npc.name || entry.name.replace(/\.txt$/i, '')),
              portrait: npc.portrait ? String(npc.portrait).split('\n')[0] : undefined,
              dialogs: npc.customProperties?.dialogueTrees || [],
            });
          } catch {
            /* an NPC file Studio cannot read adds nothing */
          }
        }
      } catch {
        /* no npcs folder yet */
      }
      const events: QuestMapEventInput[] = [];
      try {
        const maps = api.listMaps ? await api.listMaps(projectPath) : [];
        for (const file of maps) {
          if (cancelled) return;
          try {
            if (/\.json$/i.test(file)) {
              const text = await api.readFile(`${root}/${file}`);
              if (text) events.push(...questMapEventsFromMapProject(text, file));
            } else if (/\.txt$/i.test(file) && api.readMapFile) {
              const text = await api.readMapFile(projectPath, file);
              if (text) events.push(...questMapEventsFromMapText(text, file));
            }
          } catch {
            /* a map Studio cannot read adds no events */
          }
        }
      } catch {
        /* listing failed */
      }
      let saved: QuestMapPositions = {};
      try {
        saved = parseQuestMapPositions(await api.readFile(`${root}/${QUEST_MAP_SIDECAR}`));
      } catch {
        saved = {};
      }
      if (cancelled) return;
      setFileNpcs(found);
      setMapEvents(events);
      setPositions(saved);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, projectPath]);

  const npcs = useMemo<QuestMapNpcInput[]>(() => {
    const byFile = new Map<string, QuestMapNpcInput>();
    for (const npc of fileNpcs) {
      byFile.set(npc.file, { id: npc.file, name: npc.name, portrait: npc.portrait, dialogs: npc.dialogs, locations: [] });
    }
    for (const object of npcObjects) {
      const file = npcFileForActor(object);
      const props = propertyRecord(object.properties);
      const live = parseTrees(props.dialogueTrees);
      const existing = byFile.get(file);
      byFile.set(file, {
        id: file,
        name: object.name || existing?.name || file,
        portrait: propertyText(props.portraitPath) || existing?.portrait,
        dialogs: live ?? existing?.dialogs ?? [],
        locations: [],
        objectId: existing?.objectId ?? object.id,
      });
    }
    for (const instance of instances) {
      const npc = byFile.get(instance.file);
      if (npc) npc.locations.push({ mapTitle: instance.mapTitle, x: instance.x, y: instance.y });
    }
    return Array.from(byFile.values());
  }, [fileNpcs, npcObjects, instances]);

  // The open map's saved copy is stale: use its live event objects instead.
  const events = useMemo<QuestMapEventInput[]>(() => {
    const currentKey = mapName.trim() ? slugFileName(mapName) : '';
    const others = currentKey
      ? mapEvents.filter((e) => slugFileName(e.mapTitle) !== currentKey && slugFileName(e.id.split('#')[0].replace(/\.(json|txt)$/i, '').replace(/^.*\//, '')) !== currentKey)
      : mapEvents;
    const live = questMapEventsFromObjects(mapObjects as unknown as Array<Record<string, unknown>>, '__current_map__', mapName.trim() || 'Current map');
    return [...others, ...live];
  }, [mapEvents, mapObjects, mapName]);

  const saveTimer = useRef<number | null>(null);
  const savePositions = useCallback((next: QuestMapPositions) => {
    setPositions(next);
    if (!projectPath) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void writeProjectFiles(projectPath, [{ path: QUEST_MAP_SIDECAR, content: serializeQuestMapPositions(next) }]);
    }, 400);
  }, [projectPath]);

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  return { npcs, events, positions, savePositions, loading };
}
