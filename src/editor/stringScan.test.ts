import { describe, expect, it } from 'vitest';
import { scanProjectStrings, type DirEntry, type ProjectFs } from './stringScan';

function memFs(files: Record<string, string>, dirs: Record<string, DirEntry[]>): ProjectFs {
  return {
    readDir: async (abs) => dirs[abs] ?? [],
    readFile: async (abs) => files[abs] ?? '',
  };
}

describe('scanProjectStrings', () => {
  it('collects unique strings from content JSON and Flare .txt keys', async () => {
    const root = '/proj';
    const fs = memFs(
      {
        '/proj/content/items/sword.json': JSON.stringify({ name: 'Iron Sword', description: 'A blade.', image: 'icons/sword.png' }),
        '/proj/items/potion.txt': 'name=Health Potion\ndescription=Restores HP\nicon=icons/potion.png\n',
        '/proj/maps/town.txt': '[event]\nmsg=Welcome to town\n',
        '/proj/languages/data.pot': 'msgid "Ignored"\nmsgstr ""\n',
      },
      {
        '/proj/content': [{ name: 'items', isDirectory: true }],
        '/proj/content/items': [{ name: 'sword.json', isDirectory: false }],
        '/proj/items': [{ name: 'potion.txt', isDirectory: false }],
        '/proj/maps': [{ name: 'town.txt', isDirectory: false }],
        '/proj/languages': [{ name: 'data.pot', isDirectory: false }],
      },
    );
    const catalog = await scanProjectStrings(root, fs);
    const msgids = catalog.map((entry) => entry.msgid).sort();
    expect(msgids).toEqual(['A blade.', 'Health Potion', 'Iron Sword', 'Restores HP', 'Welcome to town']);
    expect(catalog.find((entry) => entry.msgid === 'Iron Sword')?.comments).toEqual(['#: content/items/sword.json']);
    expect(msgids).not.toContain('Ignored');
    expect(msgids).not.toContain('icons/sword.png');
  });
});
