export type StatusUsage = { setBy: string[]; readBy: string[] };

const SET_KEYS = new Set(['set_status', 'unset_status', 'complete_status', 'status']);
const READ_KEYS = new Set(['requires_status', 'requires_not_status']);

function splitStatuses(value: unknown): string[] {
  return String(value ?? '')
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function add(index: Record<string, StatusUsage>, status: string, role: 'set' | 'read', source: string) {
  if (!index[status]) index[status] = { setBy: [], readBy: [] };
  const list = role === 'set' ? index[status].setBy : index[status].readBy;
  if (!list.includes(source)) list.push(source);
}

function walk(node: unknown, source: string, index: Record<string, StatusUsage>, seen: WeakSet<object>) {
  if (!node || typeof node !== 'object') return;
  if (seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    node.forEach((entry) => walk(entry, source, index, seen));
    return;
  }
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && SET_KEYS.has(key)) {
      splitStatuses(value).forEach((status) => add(index, status, 'set', source));
    } else if (typeof value === 'string' && READ_KEYS.has(key)) {
      splitStatuses(value).forEach((status) => add(index, status, 'read', source));
    } else if (value && typeof value === 'object') {
      walk(value, source, index, seen);
    }
  }
}

export function collectStatusReferences(sources: Array<{ source: string; value: unknown }>): Record<string, StatusUsage> {
  const index: Record<string, StatusUsage> = {};
  const seen = new WeakSet<object>();
  for (const entry of sources) walk(entry.value, entry.source, index, seen);
  return index;
}
