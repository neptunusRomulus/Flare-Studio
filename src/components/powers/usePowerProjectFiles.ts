import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPowerProject, type PowerKind, type ProjectFile } from '@/editor/powers/powerProject';
import { resolvePowerKinds } from '@/editor/powers/powerKinds';
import { joinPath, KIND_SIDECAR, loadPowerFiles, parseKindSidecar, serializeKindSidecar } from '@/editor/powers/powerFiles';
import { useRegisterDirty } from '@/context/SaveHealthContext';

type Api = {
  readDir?: (dir: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
  readFile?: (path: string) => Promise<string | null>;
  writeFile?: (path: string, content: string) => Promise<boolean>;
};

const api = (): Api => ((typeof window !== 'undefined' ? (window as unknown as { electronAPI?: Api }).electronAPI : undefined) || {});

const powerFilePatchListeners = new Set<(files: Record<string, string>) => void>();

/** Apply in-memory text patches after another saver (e.g. the icon atlas) writes icon=. */
export function notifyPowerFilePatches(files: Record<string, string>) {
  for (const listener of powerFilePatchListeners) listener(files);
}

/** Project files for the power editor, with debounced write-back per file. */
export function usePowerProjectFiles(projectPath: string | null | undefined) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [kinds, setKinds] = useState<Record<string, PowerKind>>({});
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, string>());
  const skipDiskLoadRef = useRef(false);

  const reload = useCallback(async () => {
    if (!projectPath) { setFiles([]); return; }
    setLoading(true);
    try {
      const loaded = await loadPowerFiles(api(), projectPath);
      if (skipDiskLoadRef.current) return;
      setFiles(loaded);
      const sidecar = await api().readFile?.(joinPath(projectPath, KIND_SIDECAR)).catch(() => null);
      if (skipDiskLoadRef.current) return;
      setKinds(parseKindSidecar(sidecar));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const listener = (incoming: Record<string, string>) => {
      setFiles((prev) => {
        let changed = false;
        const next = prev.map((file) => {
          if (incoming[file.path] == null || incoming[file.path] === file.text) return file;
          changed = true;
          return { ...file, text: incoming[file.path] };
        });
        const extras = Object.entries(incoming)
          .filter(([path]) => !prev.some((file) => file.path === path))
          .map(([path, content]) => ({ path, text: content }));
        if (!changed && extras.length === 0) return prev;
        return [...next, ...extras];
      });
    };
    powerFilePatchListeners.add(listener);
    return () => { powerFilePatchListeners.delete(listener); };
  }, []);

  const flush = useCallback(async (rel: string) => {
    const text = pending.current.get(rel);
    if (text == null || !projectPath) return;
    pending.current.delete(rel);
    setPendingCount(pending.current.size);
    await api().writeFile?.(joinPath(projectPath, rel), text);
  }, [projectPath]);

  const flushAll = useCallback(async () => {
    const rels = [...pending.current.keys()];
    for (const rel of rels) {
      const timer = timers.current.get(rel);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(rel);
      }
      await flush(rel);
    }
  }, [flush]);

  useEffect(() => {
    const map = timers.current;
    return () => { for (const [rel, t] of map) { clearTimeout(t); void flush(rel); } map.clear(); };
  }, [flush]);

  const writeFile = useCallback((rel: string, text: string, immediate = false) => {
    setFiles((prev) => (prev.some((f) => f.path === rel) ? prev.map((f) => (f.path === rel ? { ...f, text } : f)) : [...prev, { path: rel, text }]));
    pending.current.set(rel, text);
    setPendingCount(pending.current.size);
    const old = timers.current.get(rel);
    if (old) clearTimeout(old);
    if (immediate) { timers.current.delete(rel); void flush(rel); return; }
    timers.current.set(rel, setTimeout(() => { timers.current.delete(rel); void flush(rel); }, 400));
  }, [flush]);

  const setKind = useCallback((id: string, kind: PowerKind | null) => {
    setKinds((prev) => {
      const next = { ...prev };
      if (kind) next[id] = kind; else delete next[id];
      if (projectPath) void api().writeFile?.(joinPath(projectPath, KIND_SIDECAR), serializeKindSidecar(next));
      return next;
    });
  }, [projectPath]);

  const textOf = useCallback((rel: string) => files.find((f) => f.path === rel)?.text ?? '', [files]);
  const project = useMemo(() => buildPowerProject(files), [files]);
  const powerKinds = useMemo(() => resolvePowerKinds(project, kinds), [project, kinds]);
  const draftFiles = useMemo(
    () => [...pending.current.entries()].map(([path, content]) => ({ path, content })),
    [pendingCount],
  );
  useRegisterDirty('power-definitions', pendingCount > 0, flushAll, draftFiles, (incoming) => {
    skipDiskLoadRef.current = true;
    for (const file of incoming) {
      pending.current.set(file.path, file.content);
    }
    setPendingCount(pending.current.size);
    setFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        const index = next.findIndex((entry) => entry.path === file.path);
        if (index >= 0) next[index] = { ...next[index], text: file.content };
        else next.push({ path: file.path, text: file.content });
      }
      return next;
    });
  });

  return { files, project, kinds, powerKinds, loading, reload, writeFile, textOf, setKind, flushAll, projectPath: projectPath ?? null };
}

export type PowerProjectFiles = ReturnType<typeof usePowerProjectFiles>;
