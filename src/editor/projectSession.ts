import { backupMapName, isCrashBackupFresh } from '@/editor/saveHealth';

export const PROJECT_BACKUP_VERSION = 2;

export type EditorFileDraft = { path: string; content: string };

export type MapSessionDraft = {
  mapName: string;
  snapshot: Record<string, unknown>;
};

export type ProjectCrashBackup = {
  version: number;
  timestamp: number;
  /** Currently active / last-edited map, used to open a tab first. */
  mapName?: string;
  maps: MapSessionDraft[];
  editors: Record<string, EditorFileDraft[]>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Turn a v1 (single current-map) or v2 backup into a normalized payload. */
export function normalizeProjectBackup(raw: unknown): ProjectCrashBackup | null {
  if (!isRecord(raw)) return null;
  const timestamp = typeof raw.timestamp === 'number' ? raw.timestamp : 0;
  if (!isCrashBackupFresh(timestamp)) return null;

  const editors: Record<string, EditorFileDraft[]> = {};
  if (isRecord(raw.editors)) {
    for (const [id, files] of Object.entries(raw.editors)) {
      if (!Array.isArray(files)) continue;
      const cleaned = files.flatMap((file) => {
        if (!isRecord(file)) return [];
        const path = typeof file.path === 'string' ? file.path.trim() : '';
        const content = typeof file.content === 'string' ? file.content : '';
        return path ? [{ path, content }] : [];
      });
      if (cleaned.length) editors[id] = cleaned;
    }
  }

  const maps: MapSessionDraft[] = [];
  const seen = new Set<string>();
  const push = (mapName: string, snapshot: Record<string, unknown>) => {
    const name = mapName.trim();
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    maps.push({ mapName: name, snapshot });
  };

  if (Array.isArray(raw.maps)) {
    for (const entry of raw.maps) {
      if (!isRecord(entry)) continue;
      const name = typeof entry.mapName === 'string' ? entry.mapName : backupMapName(entry.snapshot) ?? backupMapName(entry);
      const snapshot = isRecord(entry.snapshot) ? entry.snapshot : entry;
      if (name) push(name, { ...snapshot, mapName: name, timestamp: typeof snapshot.timestamp === 'number' ? snapshot.timestamp : timestamp });
    }
  }

  // v1: the backup object itself is the current map snapshot.
  const fallbackName = backupMapName(raw);
  if (fallbackName && !seen.has(fallbackName.toLowerCase())) {
    push(fallbackName, raw);
  }

  return {
    version: typeof raw.version === 'number' ? raw.version : maps.length || Object.keys(editors).length ? PROJECT_BACKUP_VERSION : 1,
    timestamp,
    mapName: fallbackName ?? maps[0]?.mapName,
    maps,
    editors,
  };
}

export function buildProjectBackup(args: {
  timestamp?: number;
  currentMapName?: string | null;
  currentSnapshot?: Record<string, unknown> | null;
  mapDrafts?: MapSessionDraft[];
  editors?: Record<string, EditorFileDraft[]>;
}): ProjectCrashBackup {
  const timestamp = args.timestamp ?? Date.now();
  const maps: MapSessionDraft[] = [];
  const seen = new Set<string>();
  const push = (draft: MapSessionDraft) => {
    const name = draft.mapName.trim();
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    maps.push({ mapName: name, snapshot: { ...draft.snapshot, mapName: name, timestamp } });
  };

  if (args.currentSnapshot) {
    const name = (args.currentMapName || backupMapName(args.currentSnapshot) || '').trim();
    if (name) push({ mapName: name, snapshot: args.currentSnapshot });
  }
  for (const draft of args.mapDrafts ?? []) push(draft);

  const editors: Record<string, EditorFileDraft[]> = {};
  for (const [id, files] of Object.entries(args.editors ?? {})) {
    if (files.length) editors[id] = files;
  }

  return {
    version: PROJECT_BACKUP_VERSION,
    timestamp,
    mapName: args.currentMapName?.trim() || maps[0]?.mapName,
    maps,
    editors,
  };
}
