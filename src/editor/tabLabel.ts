/** Display name for a tileset tab: custom name, else the tileset file name, else "Tab N". */
export function tilesetDisplayName(fileName: string | null | undefined): string {
  if (!fileName) return '';
  const base = fileName.split(/[\\/]/).pop() || '';
  const words = base
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^tileset[_\-\s]+/i, '')
    .split(/[_\-\s]+/)
    .filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function tabLabel(
  tab: { name?: string; tileset?: { fileName?: string | null } | null },
  index: number,
): string {
  const custom = tab.name && !/^Tab \d+$/.test(tab.name) ? tab.name : '';
  return custom || tilesetDisplayName(tab.tileset?.fileName) || `Tab ${index + 1}`;
}
