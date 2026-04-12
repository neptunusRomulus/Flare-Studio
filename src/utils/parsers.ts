export type RandomStockEntry = { chance: number; min: number; max: number };

export function parseConstantStock(value?: string): Record<number, number> {
  if (!value) return {};
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<number, number>>((acc, token) => {
      const [idPart, qtyPart] = token.split(':').map((p) => p.trim());
      const id = Number.parseInt(idPart, 10);
      if (Number.isNaN(id)) return acc;
      const qty = Math.max(1, Number.parseInt(qtyPart || '1', 10) || 1);
      acc[id] = qty;
      return acc;
    }, {});
}

export function buildConstantStockString(selection: Record<number, number>): string {
  const entries = Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([id, qty]) => `${id}:${qty}`);
  return entries.join(',');
}

export function parseStatusStockEntries(value?: string): Array<{ id: string; requirement: string; items: Record<number, number> }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, idx) => {
        if (!entry) return null;
        const requirement = typeof entry.requirement === 'string' ? entry.requirement.trim() : '';
        const itemsObj = typeof entry.items === 'object' && entry.items !== null ? entry.items : {};
        return {
          id: entry.id || `req-${idx}`,
          requirement,
          items: Object.entries(itemsObj).reduce<Record<number, number>>((acc, [k, v]) => {
            const idNum = Number.parseInt(k, 10);
            const qtyNum = Math.max(1, Number.parseInt(String(v), 10) || 1);
            if (!Number.isNaN(idNum)) acc[idNum] = qtyNum;
            return acc;
          }, {})
        };
      })
      .filter(Boolean) as Array<{ id: string; requirement: string; items: Record<number, number> }>;
  } catch {
    return [];
  }
}

export function buildStatusStockEntriesString(entries: Array<{ id: string; requirement: string; items: Record<number, number> }>): string {
  const cleaned = entries
    .map((entry) => ({
      id: entry.id || 'status',
      requirement: entry.requirement.trim(),
      items: Object.fromEntries(
        Object.entries(entry.items || {})
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => [String(id), qty])
      )
    }))
    .filter((entry) => entry.requirement && Object.keys(entry.items).length > 0);

  return JSON.stringify(cleaned);
}

export function parseRandomStock(value?: string): Record<number, RandomStockEntry> {
  if (!value) return {};
  const tokens = value.split(',').map(t => t.trim()).filter(Boolean);
  const result: Record<number, RandomStockEntry> = {};
  for (let i = 0; i + 3 < tokens.length; i += 4) {
    const id = parseInt(tokens[i], 10);
    const chance = parseInt(tokens[i + 1], 10);
    const min = parseInt(tokens[i + 2], 10);
    const max = parseInt(tokens[i + 3], 10);
    if (Number.isNaN(id)) continue;
    result[id] = {
      chance: Number.isNaN(chance) ? 100 : chance,
      min: Number.isNaN(min) ? 1 : Math.max(1, min),
      max: Number.isNaN(max) ? Math.max(1, Number.isNaN(min) ? 1 : min) : Math.max(1, max)
    };
  }
  return result;
}

export function parseRandomStockCount(value?: string): { min: number; max: number } {
  if (!value) return { min: 1, max: 1 };
  const parts = value.split(',').map(p => p.trim()).filter(Boolean);
  const min = parts[0] ? Math.max(1, parseInt(parts[0], 10) || 1) : 1;
  const max = parts[1] ? Math.max(min, parseInt(parts[1], 10) || min) : min;
  return { min, max };
}

export function buildRandomStockString(selection: Record<number, RandomStockEntry>): string {
  const entries = Object.entries(selection)
    .filter(([, val]) => val.min > 0 && val.max > 0 && val.chance > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .flatMap(([id, val]) => [id, val.chance.toString(), val.min.toString(), val.max.toString()]);
  return entries.join(', ');
}

export function buildRandomStockCountString(count: { min: number; max: number }) {
  return `${Math.max(1, count.min)},${Math.max(Math.max(1, count.min), count.max)}`;
}
