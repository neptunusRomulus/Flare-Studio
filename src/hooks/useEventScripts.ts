import { useCallback, useEffect, useState } from 'react';
import {
  collectScriptUsages,
  DEFAULT_EVENT_SCRIPT,
  eventScriptDisplayName,
  eventScriptRelPath,
  normalizeEventScriptPath,
  type EventScriptEntry,
} from '@/editor/eventScripts';

export const EVENT_SCRIPT_LIST_ID = 'event-script-suggestions';
export const EVENT_SCRIPT_REFRESH = 'flare-studio:event-scripts';

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

const USAGE_DIRS = ['scripts', 'maps', 'books', 'npcs', 'powers', 'items', 'cutscenes', 'enemies'];

export async function listTxtUnder(root: string, rel: string): Promise<string[]> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!root || !api?.readDir) return [];
  const out: string[] = [];
  const walk = async (dir: string) => {
    const entries = (await api.readDir(projectFile(root, dir)).catch(() => [])) || [];
    for (const entry of entries) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory) await walk(next);
      else if (entry.name.endsWith('.txt')) out.push(next);
    }
  };
  await walk(rel);
  return out.sort();
}

async function loadTexts(root: string, dirs: string[]): Promise<Record<string, string>> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!root || !api?.readFile) return {};
  const files: Record<string, string> = {};
  for (const dir of dirs) {
    const paths = await listTxtUnder(root, dir);
    for (const rel of paths) {
      const text = await api.readFile(projectFile(root, rel));
      if (text != null) files[rel] = text;
    }
  }
  return files;
}

/** List scripts/*.txt, with how many places each is referenced. */
export default function useEventScripts(
  projectPath: string | null | undefined,
  liveObjects?: Array<{ type?: string; properties?: Record<string, string | string[] | undefined> }>,
) {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [entries, setEntries] = useState<EventScriptEntry[]>([]);
  const scripts = entries.map((entry) => entry.path);

  const refresh = useCallback(async () => {
    if (!root) {
      setEntries([]);
      return [];
    }
    const paths = await listTxtUnder(root, 'scripts');
    const files = await loadTexts(root, USAGE_DIRS);
    const uses = collectScriptUsages(files, liveObjects);
    const next = paths.map((path) => ({
      path,
      name: eventScriptDisplayName(path),
      usage: [...new Set(uses.get(path) || uses.get(normalizeEventScriptPath(path)) || [])].length,
    }));
    setEntries(next);
    return next;
  }, [root]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onRefresh = () => { void refresh(); };
    window.addEventListener('focus', onRefresh);
    window.addEventListener(EVENT_SCRIPT_REFRESH, onRefresh);
    return () => {
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener(EVENT_SCRIPT_REFRESH, onRefresh);
    };
  }, [refresh]);

  const abs = (rel: string) => projectFile(root, rel);

  const create = useCallback(async (name: string) => {
    if (!root || !window.electronAPI?.writeFile) return null;
    const rel = eventScriptRelPath(name || 'event');
    await window.electronAPI.writeFile(abs(rel), DEFAULT_EVENT_SCRIPT);
    window.dispatchEvent(new Event(EVENT_SCRIPT_REFRESH));
    await refresh();
    return rel;
  }, [root, refresh]);

  const duplicate = useCallback(async (path: string) => {
    if (!root || !window.electronAPI?.readFile || !window.electronAPI.writeFile) return null;
    const source = normalizeEventScriptPath(path);
    const text = (await window.electronAPI.readFile(abs(source))) ?? DEFAULT_EVENT_SCRIPT;
    const stem = eventScriptDisplayName(source);
    let rel = eventScriptRelPath(`${stem}_copy`);
    let n = 2;
    const existing = new Set((await listTxtUnder(root, 'scripts')).map((item) => item.toLowerCase()));
    while (existing.has(rel.toLowerCase())) {
      rel = eventScriptRelPath(`${stem}_copy${n}`);
      n += 1;
    }
    await window.electronAPI.writeFile(abs(rel), text);
    window.dispatchEvent(new Event(EVENT_SCRIPT_REFRESH));
    await refresh();
    return rel;
  }, [root, refresh]);

  const remove = useCallback(async (path: string) => {
    if (!root || !window.electronAPI?.deleteProjectFile) return false;
    const result = await window.electronAPI.deleteProjectFile(abs(normalizeEventScriptPath(path)));
    window.dispatchEvent(new Event(EVENT_SCRIPT_REFRESH));
    await refresh();
    return !!result?.success;
  }, [root, refresh]);

  const read = useCallback(async (path: string) => {
    if (!root || !window.electronAPI?.readFile) return '';
    return (await window.electronAPI.readFile(abs(normalizeEventScriptPath(path)))) ?? '';
  }, [root]);

  const write = useCallback(async (path: string, content: string) => {
    if (!root || !window.electronAPI?.writeFile) return false;
    const ok = await window.electronAPI.writeFile(abs(normalizeEventScriptPath(path)), content);
    window.dispatchEvent(new Event(EVENT_SCRIPT_REFRESH));
    return !!ok;
  }, [root]);

  return { entries, scripts, refresh, create, duplicate, remove, read, write };
}
