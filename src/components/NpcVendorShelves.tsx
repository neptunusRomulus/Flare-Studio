import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import { HelpCircle, X } from 'lucide-react';
import type { ItemSummary } from '@/utils/items';
import { useAppContext } from '@/context/AppContext';
import {
  effectiveVendorRatio,
  parseVendorShelves,
  removeStatusStockItem,
  removeStockItem,
  setStockQuantity,
  vendorItemPrices,
  vendorPriceText,
  type VendorShelf,
} from '@/editor/vendorShelves';

type Props = {
  properties: Record<string, unknown> | undefined;
  itemsList: ItemSummary[];
  updateProperty: (key: string, value: string | null) => void;
};

type ItemFileInfo = { price: string; priceSell: string; icon: string };

/** Flare's engine/loot.txt defaults; an NPC ratio above 0 replaces them. */
const GLOBAL_RATIOS = { buy: 1, sell: 0.25 };

const STOCK_KEY: Record<VendorShelf['kind'], { constant: string; status: string }> = {
  always: { constant: 'constant_stock', status: '' },
  unlock: { constant: '', status: 'status_stock' },
  random: { constant: '', status: '' },
  craft: { constant: 'craft_constant_stock', status: 'craft_status_stock' },
};

const NpcVendorShelves = ({ properties, itemsList, updateProperty }: Props) => {
  const [files, setFiles] = useState<Record<string, ItemFileInfo>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { controls } = useAppContext() as any;
  const projectPath = String(controls?.currentProjectPath || '').replace(/\\/g, '/').replace(/\/$/, '');

  const shelves = useMemo(() => parseVendorShelves(properties), [properties]);
  const itemsById = useMemo(() => {
    const map = new Map<string, ItemSummary>();
    for (const item of itemsList) map.set(String(item.id), item);
    return map;
  }, [itemsList]);

  const stockIds = useMemo(
    () => [...new Set(shelves.flatMap((shelf) => shelf.items.map((item) => item.id)))].sort(),
    [shelves],
  );

  useEffect(() => {
    const api = window.electronAPI as unknown as {
      readItemFile?: (path: string) => Promise<{ success: boolean; data?: Record<string, unknown> }>;
    };
    if (!api?.readItemFile) return;
    let cancelled = false;
    const load = async () => {
      const next: Record<string, ItemFileInfo> = {};
      await Promise.all(stockIds.map(async (id) => {
        const summary = itemsById.get(id);
        if (!summary?.filePath) return;
        try {
          const result = await api.readItemFile!(summary.filePath);
          if (!result?.success || !result.data) return;
          const d = result.data;
          next[id] = {
            price: d.price == null ? '' : String(d.price),
            priceSell: d.price_sell == null ? '' : String(d.price_sell),
            icon: d.icon == null ? '' : String(d.icon),
          };
        } catch {
          /* unreadable item file: price stays unknown */
        }
      }));
      if (!cancelled) setFiles(next);
    };
    void load();
    return () => { cancelled = true; };
  }, [stockIds, itemsById]);

  const npcRatioBuy = String(properties?.vendor_ratio_buy ?? '');
  const npcRatioSell = String(properties?.vendor_ratio_sell ?? '');
  const buyRatio = effectiveVendorRatio(npcRatioBuy, GLOBAL_RATIOS.buy);
  const sellRatio = effectiveVendorRatio(npcRatioSell, GLOBAL_RATIOS.sell);

  const priceFor = (id: string) => {
    const info = files[id];
    if (!info) return null;
    return vendorItemPrices({ price: info.price, priceSell: info.priceSell, buyRatio, sellRatio });
  };

  const iconPath = (id: string): string | null => {
    const icon = files[id]?.icon || '';
    if (!icon) return null;
    if (icon.startsWith('data:') || /^([a-zA-Z]:|\/)/.test(icon)) return icon;
    return projectPath ? `${projectPath}/${icon}` : null;
  };

  const removeItem = (shelf: VendorShelf, id: string) => {
    const keys = STOCK_KEY[shelf.kind];
    if (shelf.kind === 'unlock') {
      const next = removeStatusStockItem(String(properties?.status_stock ?? ''), id);
      updateProperty(keys.status, next || null);
      return;
    }
    if (!keys.constant) return;
    const next = removeStockItem(String(properties?.[keys.constant] ?? ''), id);
    updateProperty(keys.constant, next || null);
  };

  const setQuantity = (shelf: VendorShelf, id: string, quantity: string) => {
    const keys = STOCK_KEY[shelf.kind];
    const key = shelf.kind === 'unlock' ? keys.status : keys.constant;
    if (!key) return;
    updateProperty(key, setStockQuantity(String(properties?.[key] ?? ''), id, quantity) || null);
  };

  const filled = shelves.filter((shelf) => shelf.items.length > 0 || shelf.tables.length > 0);
  if (filled.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-1">No stock yet. Add items with the shelf buttons below.</p>
    );
  }

  return (
    <div className="space-y-3">
      {filled.map((shelf) => (
        <div key={shelf.kind} className="rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60">
            <span className="text-xs font-semibold">{shelf.title}</span>
            <span className="text-[10px] text-muted-foreground">
              {shelf.items.length + shelf.tables.length} {shelf.items.length + shelf.tables.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="p-2 space-y-1.5">
            {shelf.items.map((item) => {
              const summary = itemsById.get(item.id);
              const prices = priceFor(item.id);
              return (
                <div key={`${shelf.kind}-${item.status || ''}-${item.id}`} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 p-1.5">
                  <NpcAssetThumb imagePath={iconPath(item.id)} alt={item.id} className="h-8 w-8 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{summary?.name || `Item ${item.id}`}</div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="font-mono">{item.id}</span>
                      {item.status && <span className="px-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">{item.status}</span>}
                    </div>
                  </div>
                  <Tooltip content="Quantity written as item_id:quantity. Empty means one.">
                    <Input
                      className="h-7 w-14 text-xs text-center"
                      value={item.quantity}
                      placeholder="1"
                      onChange={(e) => setQuantity(shelf, item.id, e.target.value)}
                    />
                  </Tooltip>
                  <Tooltip content={`Buy / sell price. ${prices ? 'Buy uses ' + (npcRatioBuy.trim() && Number(npcRatioBuy) > 0 ? 'this NPC’s ratio' : 'the engine default (1.0)') + ', sell uses ' + (npcRatioSell.trim() && Number(npcRatioSell) > 0 ? 'this NPC’s ratio' : 'the engine default (0.25)') + '.' : 'No price in the item file.'}`}>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-16 text-right shrink-0 cursor-help">
                      {vendorPriceText(prices)}
                    </span>
                  </Tooltip>
                  <button
                    type="button"
                    className="h-6 w-6 shrink-0 flex items-center justify-center rounded hover:bg-muted"
                    aria-label={`Remove ${item.id}`}
                    onClick={() => removeItem(shelf, item.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {shelf.tables.map((table) => (
              <div key={`${shelf.kind}-${table}`} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 p-1.5">
                <span className="text-xs font-mono truncate flex-1">{table}</span>
                <Tooltip content="Loot table or inline loot; edit the raw line in Advanced.">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NpcVendorShelves;
