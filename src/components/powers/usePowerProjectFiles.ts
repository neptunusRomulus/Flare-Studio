import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPowerProject, type PowerKind, type ProjectFile } from '@/editor/powers/powerProject';
import { resolvePowerKinds } from '@/editor/powers/powerKinds';
import { joinPath, KIND_SIDECAR, loadPowerFiles, parseKindSidecar, serializeKindSidecar } from '@/editor/powers/powerFiles';

type Api = {
  readDir?: (dir: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
  readFile?: (path: string) => Promise<string | null>;
  writeFile?: (path: string, content: string) => Promise<boolean>;
};

const api = (): Api => ((typeof window !== 'undefined' ? (window as unknown as { electronAPI?: Api }).electronAPI : undefined) || {});

/** Project files for the power editor, with debounced write-back per file. */
export function usePowerProjectFiles(projectPath: string | null | undefined) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [kinds, setKinds] = useState<Record<string, PowerKind>>({});
  const [loading, setLoading] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, string>());

  const reload = useCallback(async () => {
    if (!projectPath) { setFiles([]); return; }
    setLoading(true);
    try {
      const loaded = await loadPowerFiles(api(), projectPath);
      setFiles(loaded);
      const sidecar = await api().readFile?.(joinPath(projectPath, KIND_SIDECAR)).catch(() => null);
      setKinds(parseKindSidecar(sidecar));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { void reload(); }, [reload]);

  const flush = useCallback((rel: string) => {
    const text = pending.current.get(rel);
    if (text == null || !projectPath) return;
    pending.current.delete(rel);
    void api().writeFile?.(joinPath(projectPath, rel), text);
  }, [projectPath]);

  useEffect(() => {
    const map = timers.current;
    return () => { for (const [rel, t] of map) { clearTimeout(t); flush(rel); } map.clear(); };
  }, [flush]);

  const writeFile = useCallback((rel: string, text: string, immediate = false) => {
    setFiles((prev) => (prev.some((f) => f.path === rel) ? prev.map((f) => (f.path === rel ? { ...f, text } : f)) : [...prev, { path: rel, text }]));
    pending.current.set(rel, text);
    const old = timers.current.get(rel);
    if (old) clearTimeout(old);
    if (immediate) { timers.current.delete(rel); flush(rel); return; }
    timers.current.set(rel, setTimeout(() => { timers.current.delete(rel); flush(rel); }, 400));
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

  return { files, project, kinds, powerKinds, loading, reload, writeFile, textOf, setKind };
}

export type PowerProjectFiles = ReturnType<typeof usePowerProjectFiles>;
