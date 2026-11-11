/** Power tree files (powers/trees/*.txt): [tab] titles plus [power] tab/position/requires_power. */

export type PowerTreeTab = { title: string; background: string };
export type PowerTreeNode = {
  kind: 'power' | 'upgrade';
  id: string;
  tab: string;
  position: string;
  requires_power: string;
  extras: Array<{ key: string; value: string }>;
};

export type PowerTreeFile = { tabs: PowerTreeTab[]; nodes: PowerTreeNode[] };

function fields(lines: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const raw of lines) {
    const trimmed = raw.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0 || trimmed.startsWith('#')) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    (out[key] ||= []).push(value);
  }
  return out;
}

export function parsePowerTree(text: string): PowerTreeFile {
  const tabs: PowerTreeTab[] = [];
  const nodes: PowerTreeNode[] = [];
  const rows = String(text || '').split('\n');
  let header = '';
  let buf: string[] = [];
  const flush = () => {
    if (!header) return;
    const map = fields(buf);
    if (header === 'tab') {
      tabs.push({ title: map.title?.[0] || '', background: map.background?.[0] || '' });
    } else if (header === 'power' || header === 'upgrade') {
      const extras = buf
        .map((raw) => raw.trim())
        .filter((line) => line.includes('=') && !line.startsWith('#'))
        .map((line) => {
          const eq = line.indexOf('=');
          return { key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
        })
        .filter((f) => !['id', 'tab', 'position', 'requires_power'].includes(f.key));
      nodes.push({
        kind: header,
        id: map.id?.[0] || '',
        tab: map.tab?.[0] || '',
        position: map.position?.[0] || '',
        requires_power: (map.requires_power || []).join(','),
        extras,
      });
    }
  };
  for (const raw of rows) {
    const sec = raw.trim().match(/^\[([^\]]+)\]$/);
    if (sec) {
      flush();
      header = sec[1].trim();
      buf = [];
      continue;
    }
    if (header) buf.push(raw);
  }
  flush();
  return { tabs, nodes };
}

export function serializePowerTree(tree: PowerTreeFile): string {
  const parts: string[] = [];
  tree.tabs.forEach((tab, i) => {
    parts.push(`# tab ${i}`, '[tab]', `title=${tab.title}`);
    if (tab.background) parts.push(`background=${tab.background}`);
    parts.push('');
  });
  for (const node of tree.nodes) {
    parts.push(`[${node.kind}]`, `id=${node.id}`);
    if (node.kind === 'power') {
      if (node.tab) parts.push(`tab=${node.tab}`);
      if (node.position) parts.push(`position=${node.position}`);
    }
    if (node.requires_power) {
      for (const id of node.requires_power.split(',').map((s) => s.trim()).filter(Boolean)) {
        parts.push(`requires_power=${id}`);
      }
    }
    for (const extra of node.extras) {
      if (extra.key) parts.push(`${extra.key}=${extra.value}`);
    }
    parts.push('');
  }
  return `${parts.join('\n').replace(/\n+$/, '')}\n`;
}

export const POWER_TREE_PATH = 'powers/trees/default.txt';
