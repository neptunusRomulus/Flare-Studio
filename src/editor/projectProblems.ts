/**
 * Project-wide broken-reference scan: intermap, loot, vendor stock, class powers,
 * book paths, item ids, and quest files.
 */
import { collectSectionIds, listedIds } from './engineForms';

export type ProblemKind = 'intermap' | 'loot' | 'vendor' | 'class' | 'book' | 'item' | 'quest';

export type ProjectProblem = {
  id: string;
  kind: ProblemKind;
  path: string;
  line: number;
  key: string;
  value: string;
  message: string;
};

function listFiles(files: Record<string, string>, prefix: string): Set<string> {
  const out = new Set<string>();
  for (const path of Object.keys(files)) {
    const norm = path.replace(/\\/g, '/');
    if (norm.startsWith(prefix)) out.add(norm);
  }
  return out;
}

function fileExists(files: Set<string>, raw: string): boolean {
  const first = raw.split(',')[0].trim().replace(/\\/g, '/');
  if (!first) return true;
  if (files.has(first)) return true;
  if (files.has(`${first}.txt`)) return true;
  return false;
}

export function findProjectProblems(files: Record<string, string>): ProjectProblem[] {
  const itemIds = collectSectionIds(files, ['item']);
  const powerIds = collectSectionIds(files, ['power', 'upgrade']);
  const maps = listFiles(files, 'maps/');
  const lootFiles = listFiles(files, 'loot/');
  const books = new Set([...listFiles(files, 'books/'), ...Object.keys(files).filter((p) => /\/books\//.test(p))]);
  const quests = listFiles(files, 'quests/');
  const out: ProjectProblem[] = [];
  const add = (kind: ProblemKind, path: string, line: number, key: string, value: string, message: string) => {
    out.push({ id: `${kind}:${path}:${line}:${key}:${value}`, kind, path, line, key, value, message });
  };

  for (const [path, text] of Object.entries(files)) {
    let section = '';
    String(text || '').replace(/\r/g, '').split('\n').forEach((raw, i) => {
      const line = i + 1;
      const trimmed = raw.trim();
      const sec = trimmed.match(/^\[([^\]]+)\]$/);
      if (sec) { section = sec[1].trim(); return; }
      const eq = trimmed.indexOf('=');
      if (eq <= 0 || trimmed.startsWith('#')) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();

      if (key === 'intermap' || key === 'intramap' || (key === 'map' && section === 'event')) {
        const dest = value.split(',')[0].trim();
        if (dest && !fileExists(maps, dest.startsWith('maps/') ? dest : `maps/${dest}`)) {
          add('intermap', path, line, key, value, `Map not found: ${dest}`);
        }
      }
      if (key === 'loot' || key === 'reward_loot') {
        if (value.includes('/') || value.endsWith('.txt')) {
          const dest = value.split(',')[0].trim();
          const rel = dest.startsWith('loot/') ? dest : dest.startsWith('maps/') ? dest : `loot/${dest}`;
          if (!fileExists(lootFiles, rel) && !fileExists(new Set(Object.keys(files)), dest)) {
            add('loot', path, line, key, value, `Loot table not found: ${dest}`);
          }
        } else {
          const id = listedIds(value)[0];
          if (id && itemIds.size && !itemIds.has(id)) add('loot', path, line, key, value, `Unknown item ${id}`);
        }
      }
      if (key === 'status_stock' && itemIds.size) {
        for (const id of listedIds(value.split(',').slice(1).join(','))) {
          if (!itemIds.has(id)) add('vendor', path, line, key, value, `Vendor stock item ${id} does not exist`);
        }
      }
      if (path.startsWith('engine/classes.txt') && itemIds.size) {
        if (key === 'equipment' || key === 'equipment_set' || key === 'carried') {
          for (const id of listedIds(value)) {
            if (!itemIds.has(id)) add('class', path, line, key, value, `Class ${key} item ${id} does not exist`);
          }
        }
        if (powerIds.size && (key === 'powers' || key === 'actionbar')) {
          for (const id of listedIds(value, { allowZero: true })) {
            if (!powerIds.has(id)) add('class', path, line, key, value, `Class ${key} power ${id} does not exist`);
          }
        }
      }
      if ((key === 'book' || key === 'book_id') && value) {
        const dest = value.split(',')[0].trim();
        const rel = dest.includes('/') ? dest : `books/${dest}`.replace(/\.txt$/i, '') + (/\.txt$/i.test(dest) ? '' : (dest.endsWith('.txt') ? '' : '.txt'));
        const candidates = [dest, rel, dest.endsWith('.txt') ? dest : `${dest}.txt`, dest.startsWith('books/') ? dest : `books/${dest}`];
        if (!candidates.some((c) => fileExists(books, c) || fileExists(new Set(Object.keys(files)), c))) {
          add('book', path, line, key, value, `Book not found: ${dest}`);
        }
      }
      if (itemIds.size && (key === 'requires_item' || key === 'requires_not_item' || key === 'reward_item' || key === 'remove_item')) {
        for (const id of listedIds(value)) {
          if (!itemIds.has(id)) add('item', path, line, key, value, `Unknown item ${id}`);
        }
      }
      if (key === 'quest') {
        const dest = value.split(',')[0].trim();
        const rel = dest.startsWith('quests/') ? dest : `quests/${dest}${/\.txt$/i.test(dest) ? '' : '.txt'}`;
        if (dest && !fileExists(quests, rel) && !fileExists(quests, dest)) {
          add('quest', path, line, key, value, `Quest file not found: ${dest}`);
        }
      }
    });
  }
  return out;
}

type Opener = (problem: ProjectProblem) => boolean;
const openers = new Set<Opener>();

export function registerProblemOpener(opener: Opener): () => void {
  openers.add(opener);
  return () => { openers.delete(opener); };
}

export function openProjectProblem(problem: ProjectProblem): boolean {
  for (const opener of openers) {
    if (opener(problem)) return true;
  }
  return false;
}
