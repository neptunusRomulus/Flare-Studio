import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapObject } from '@/types';
import { slugFileName } from '@/adapters/flare/flareAdapter.cjs';
import {
  dedupeNpcInstances,
  npcInstanceFromObject,
  npcInstancesFromMapProject,
  npcInstancesFromMapText,
  type NpcInstance,
} from '@/editor/npcInstances';

type Params = {
  projectPath?: string | null;
  /** Current map name: its live objects are used instead of the saved file. */
  currentMapName?: string;
  /** Current map objects (the sidebar entries); unplaced ones are ignored. */
  objects?: MapObject[];
};

/** Scans are per project; the map currently open in the editor stays live. */
const scanCache = new Map<string, NpcInstance[]>();

const LOCAL_MAP_FILE = '__current_map__';

export default function useNpcInstances({ projectPath, currentMapName = '', objects = [] }: Params) {
  const [remote, setRemote] = useState<NpcInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanTick, setScanTick] = useState(0);
  const scanId = useRef(0);

  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!projectPath || !api?.listMaps || !api?.readFile) {
      setRemote([]);
      setLoading(false);
      return;
    }

    const cached = scanCache.get(projectPath);
    if (cached) {
      setRemote(cached);
      setLoading(false);
      return;
    }

    const id = ++scanId.current;
    let cancelled = false;
    setLoading(true);

    const scan = async () => {
      const collected: NpcInstance[] = [];
      try {
        const maps = await api.listMaps!(projectPath);
        for (const file of maps) {
          if (cancelled) return;
          try {
            if (/\.json$/i.test(file)) {
              const text = await api.readFile!(`${projectPath.replace(/\\/g, '/')}/${file}`);
              if (text) collected.push(...npcInstancesFromMapProject(text, file));
            } else if (/\.txt$/i.test(file) && api.readMapFile) {
              const text = await api.readMapFile(projectPath, file);
              if (text) collected.push(...npcInstancesFromMapText(text, file));
            }
          } catch {
            // A map Studio cannot read simply contributes no instances.
          }
          // Yield between maps so a large project does not block the UI while scanning.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } catch {
        // Listing failed; keep whatever was collected.
      }
      if (cancelled || id !== scanId.current) return;
      const instances = dedupeNpcInstances(collected);
      scanCache.set(projectPath, instances);
      setRemote(instances);
      setLoading(false);
    };

    void scan();
    return () => { cancelled = true; };
  }, [projectPath, scanTick]);

  const localInstances = useMemo(() => {
    if (!objects.length) return [] as NpcInstance[];
    const title = currentMapName.trim() || 'Current map';
    return objects
      .map((object) => npcInstanceFromObject(object, LOCAL_MAP_FILE, title))
      .filter((instance): instance is NpcInstance => instance !== null);
  }, [objects, currentMapName]);

  const instances = useMemo(() => {
    const currentKey = currentMapName.trim() ? slugFileName(currentMapName) : '';
    // The saved copy of the open map is stale: its live objects below are the truth.
    const otherMaps = currentKey
      ? remote.filter((instance) => {
          const titleKey = slugFileName(instance.mapTitle);
          const fileKey = slugFileName(instance.mapFile.replace(/\.(json|txt)$/i, ''));
          return titleKey !== currentKey && fileKey !== currentKey;
        })
      : remote;
    return dedupeNpcInstances([...otherMaps, ...localInstances]);
  }, [remote, localInstances, currentMapName]);

  /** Re-read every project map (used when the instances window is opened). */
  const refresh = useCallback(() => {
    if (projectPath) scanCache.delete(projectPath);
    setScanTick((tick) => tick + 1);
  }, [projectPath]);

  return { instances, loading, refresh };
}
