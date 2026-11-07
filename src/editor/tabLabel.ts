/**
 * Plain tileset file name for a tab label: no folder, no extension, and no
 * save-time "background_tab3_" key prefix or "tileset_" prefix.
 * "background_tab3_tileset_snowplains_ice.png" -> "snowplains_ice".
 */
export function tilesetDisplayName(fileName: string | null | undefined): string {
  if (!fileName) return '';
  let base = (fileName.split(/[\\/]/).pop() || '').replace(/\.[a-z0-9]+$/i, '');
  while (/^[a-zA-Z]+[_-]tab\d*_/.test(base)) base = base.replace(/^[a-zA-Z]+[_-]tab\d*_/, '');
  return base.replace(/^tileset[_-]/i, '');
}

/** Custom tab name, else the tileset file name, else "Tab N". */
export function tabLabel(
  tab: { name?: string; tileset?: { fileName?: string | null } | null },
  index: number,
): string {
  const custom = tab.name && !/^Tab \d+$/.test(tab.name) ? tab.name : '';
  return custom || tilesetDisplayName(tab.tileset?.fileName) || `Tab ${index + 1}`;
}
