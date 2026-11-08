/**
 * Vendor shelves: turn the flat stock keys into item lists a designer can read,
 * and compute what the player actually pays (Flare's ratio rules).
 */
type Props = Record<string, unknown> | undefined;

export type VendorShelfKind = 'always' | 'unlock' | 'random' | 'craft';

export type VendorStockItem = {
  /** Item id as written in the file ("1001"). */
  id: string;
  quantity: string;
  /** Status gate for the unlock shelf. */
  status?: string;
  shelf: VendorShelfKind;
};

export type VendorShelf = {
  kind: VendorShelfKind;
  title: string;
  items: VendorStockItem[];
  /** Loot table / inline loot lines (random shelves). */
  tables: string[];
};

const text = (value: unknown): string =>
  Array.isArray(value) ? value.map((v) => String(v)).join('\n') : value == null ? '' : String(value);

const lines = (value: unknown): string[] =>
  text(value).split('\n').map((line) => line.trim()).filter(Boolean);

const splitPair = (token: string): { id: string; quantity: string } => {
  const at = token.indexOf(':');
  if (at < 0) return { id: token.trim(), quantity: '' };
  return { id: token.slice(0, at).trim(), quantity: token.slice(at + 1).trim() };
};

/** constant_stock / craft_constant_stock: "id[:qty],id[:qty]" per line. */
function constantItems(props: Props, key: string, shelf: VendorShelfKind): VendorStockItem[] {
  const out: VendorStockItem[] = [];
  for (const line of lines(props?.[key])) {
    for (const token of line.split(',').map((part) => part.trim()).filter(Boolean)) {
      const { id, quantity } = splitPair(token);
      if (id) out.push({ id, quantity, shelf });
    }
  }
  return out;
}

/** status_stock / craft_status_stock: "status,id[:qty],id[:qty]" per line. */
function statusItems(props: Props, key: string, shelf: VendorShelfKind): VendorStockItem[] {
  const out: VendorStockItem[] = [];
  for (const line of lines(props?.[key])) {
    const parts = line.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const [status, ...entries] = parts;
    for (const token of entries) {
      const { id, quantity } = splitPair(token);
      if (id) out.push({ id, quantity, status, shelf });
    }
  }
  return out;
}

export function parseVendorShelves(props: Props): VendorShelf[] {
  return [
    {
      kind: 'always',
      title: 'Always',
      items: constantItems(props, 'constant_stock', 'always'),
      tables: [],
    },
    {
      kind: 'unlock',
      title: 'Unlock',
      items: statusItems(props, 'status_stock', 'unlock'),
      tables: [],
    },
    {
      kind: 'random',
      title: 'Random',
      items: [],
      tables: lines(props?.random_stock),
    },
    {
      kind: 'craft',
      title: 'Craft',
      items: [
        ...constantItems(props, 'craft_constant_stock', 'craft'),
        ...statusItems(props, 'craft_status_stock', 'craft'),
      ],
      tables: lines(props?.craft_random_stock),
    },
  ];
}

/** Ratio actually used by the engine: an NPC value above 0 wins, otherwise the global one. */
export const effectiveVendorRatio = (npcRatio: string, globalRatio: number): number => {
  const parsed = Number.parseFloat(String(npcRatio || '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : globalRatio;
};

/**
 * Engine prices are truncated ints and never below 1.
 * `price_sell` overrides the base price for the sell direction.
 */
export function vendorItemPrices(input: {
  price: string;
  priceSell?: string;
  buyRatio: number;
  sellRatio: number;
}): { buy: number; sell: number; levelScaled: boolean } | null {
  const raw = String(input.price || '').trim();
  if (!raw) return null;
  const levelScaled = raw.includes(':');
  const base = Number.parseInt(raw, 10);
  if (!Number.isFinite(base) || base <= 0) return null;
  const sellBase = Number.parseInt(String(input.priceSell || '').trim(), 10);
  const sell = Number.isFinite(sellBase) && sellBase > 0 ? sellBase : Math.trunc(base * input.sellRatio);
  return {
    buy: Math.max(1, Math.trunc(base * input.buyRatio)),
    sell: Math.max(1, sell),
    levelScaled,
  };
}

export const vendorPriceText = (prices: { buy: number; sell: number; levelScaled: boolean } | null): string => {
  if (!prices) return '—';
  const buy = prices.levelScaled ? `${prices.buy}+` : String(prices.buy);
  return `${buy} / ${prices.sell}`;
};

/** Remove one item id from a single-line stock list, keeping every other entry as written. */
export function removeStockItem(value: string, itemId: string): string {
  return text(value)
    .split('\n')
    .map((line) => line.split(',').map((part) => part.trim()).filter(Boolean)
      .filter((token) => splitPair(token).id !== itemId)
      .join(','))
    .filter(Boolean)
    .join('\n');
}

/** status_stock keeps the gate status first; a line with no items left is dropped. */
export function removeStatusStockItem(value: string, itemId: string): string {
  return text(value)
    .split('\n')
    .map((line) => {
      const parts = line.split(',').map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) return line.trim();
      const [status, ...entries] = parts;
      const kept = entries.filter((token) => splitPair(token).id !== itemId);
      return kept.length ? [status, ...kept].join(',') : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Set "id:qty" (or plain id when qty is empty) inside a constant stock list. */
export function setStockQuantity(value: string, itemId: string, quantity: string): string {
  const qty = quantity.trim();
  const write = (token: string) => {
    const parsed = splitPair(token);
    return parsed.id === itemId ? (qty ? `${parsed.id}:${qty}` : parsed.id) : token;
  };
  return text(value)
    .split('\n')
    .map((line) => line.split(',').map((part) => part.trim()).filter(Boolean).map(write).join(','))
    .filter(Boolean)
    .join('\n');
}
