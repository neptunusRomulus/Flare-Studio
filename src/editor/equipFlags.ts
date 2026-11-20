/** Parse/serialize engine/equip_flags.txt. The engine keys are flag.id and flag.name. */

export const EQUIP_FLAGS_PATH = 'engine/equip_flags.txt';

export type EquipFlag = { id: string; name: string };

export function emptyEquipFlag(): EquipFlag {
  return { id: '', name: '' };
}

export function parseEquipFlags(text: string): { header: string; flags: EquipFlag[] } {
  const header: string[] = [];
  const flags: EquipFlag[] = [];
  let current: EquipFlag | null = null;
  let seenSection = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!seenSection) {
      if (/^\[flag\]$/i.test(line)) {
        seenSection = true;
        current = emptyEquipFlag();
        flags.push(current);
        continue;
      }
      header.push(raw);
      continue;
    }
    if (/^\[flag\]$/i.test(line)) {
      current = emptyEquipFlag();
      flags.push(current);
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    if (/^\[[^\]]+\]/.test(line)) {
      current = null;
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || !current) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'id') current.id = value;
    else if (key === 'name') current.name = value;
  }
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  return { header: header.join('\n'), flags };
}

export function serializeEquipFlags(file: { header: string; flags: EquipFlag[] }, previous = ''): string {
  const header = file.header || parseEquipFlags(previous).header;
  const blocks = file.flags
    .filter((flag) => flag.id.trim())
    .map((flag) => {
      const lines = ['[flag]', `id=${flag.id.trim()}`];
      if (flag.name.trim()) lines.push(`name=${flag.name.trim()}`);
      return lines.join('\n');
    });
  const parts: string[] = [];
  if (header.trim()) parts.push(header.replace(/\n+$/, ''));
  parts.push(...blocks);
  if (!parts.length) return previous.endsWith('\n') || !previous ? previous : `${previous}\n`;
  return `${parts.join('\n\n').replace(/\n+$/, '')}\n`;
}
