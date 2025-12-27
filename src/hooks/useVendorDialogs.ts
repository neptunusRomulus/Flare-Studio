import { useCallback, Dispatch, SetStateAction } from 'react';
import {
  parseConstantStock,
  parseStatusStockEntries,
  parseRandomStock,
  parseRandomStockCount,
  buildConstantStockString,
  buildRandomStockString,
  buildRandomStockCountString,
  RandomStockEntry
} from '../utils/parsers';
import type { MapObject } from '@/types';

type VendorUnlockEntry = { id: string; requirement: string; items: Record<number, number> };

export default function useVendorDialogs({
  editingObject,
  setEditingObject,
  vendorStockSelection,
  setVendorStockSelection,
  vendorUnlockEntries,
  setVendorUnlockEntries,
  vendorRandomSelection,
  setVendorRandomSelection,
  vendorRandomCount,
  setVendorRandomCount,
  setShowVendorStockDialog,
  setShowVendorUnlockDialog,
  setShowVendorRandomDialog
}: {
  editingObject: MapObject | null;
  setEditingObject: Dispatch<SetStateAction<MapObject | null>>;
  vendorStockSelection: Record<number, number>;
  setVendorStockSelection: Dispatch<SetStateAction<Record<number, number>>>;
  vendorUnlockEntries: VendorUnlockEntry[];
  setVendorUnlockEntries: Dispatch<SetStateAction<VendorUnlockEntry[]>>;
  vendorRandomSelection: Record<number, RandomStockEntry>;
  setVendorRandomSelection: Dispatch<SetStateAction<Record<number, RandomStockEntry>>>;
  vendorRandomCount: { min: number; max: number };
  setVendorRandomCount: Dispatch<SetStateAction<{ min: number; max: number }>>;
  setShowVendorStockDialog: (open: boolean) => void;
  setShowVendorUnlockDialog: (open: boolean) => void;
  setShowVendorRandomDialog: (open: boolean) => void;
}) {
  const handleOpenVendorStockDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseConstantStock(editingObject.properties?.constant_stock as string | undefined);
    setVendorStockSelection(parsed);
    setShowVendorStockDialog(true);
  }, [editingObject, setShowVendorStockDialog, setVendorStockSelection]);

  const handleOpenVendorUnlockDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseStatusStockEntries(editingObject.properties?.status_stock_entries as string | undefined);
    if (parsed.length === 0) {
      setVendorUnlockEntries([{ id: `req-${Date.now()}`, requirement: '', items: {} }]);
    } else {
      setVendorUnlockEntries(parsed);
    }
    setShowVendorUnlockDialog(true);
  }, [editingObject, setShowVendorUnlockDialog, setVendorUnlockEntries]);

  const handleOpenVendorRandomDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseRandomStock(editingObject.properties?.random_stock as string | undefined);
    setVendorRandomSelection(parsed);
    const parsedCount = parseRandomStockCount(editingObject.properties?.random_stock_count as string | undefined);
    setVendorRandomCount(parsedCount);
    setShowVendorRandomDialog(true);
  }, [editingObject, setShowVendorRandomDialog, setVendorRandomCount, setVendorRandomSelection]);

  const handleToggleVendorStockItem = useCallback((id: number) => {
    setVendorStockSelection((prev) => {
      const next = { ...(prev || {}) } as Record<number, number>;
      if (next[id] !== undefined) delete next[id]; else next[id] = 1;
      return next;
    });
  }, [setVendorStockSelection]);

  const handleVendorStockQtyChange = useCallback((id: number, qty: number) => {
    setVendorStockSelection((prev) => {
      const next = { ...(prev || {}) } as Record<number, number>;
      if (qty <= 0) qty = 1;
      next[id] = qty;
      return next;
    });
  }, [setVendorStockSelection]);

  const handleSaveVendorStock = useCallback(() => {
    if (!editingObject) return;
    const constantStock = buildConstantStockString(vendorStockSelection);
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) } as Record<string, string>;
      if (constantStock) properties.constant_stock = constantStock; else delete properties.constant_stock;
      return { ...prev, properties } as MapObject;
    });
    setShowVendorStockDialog(false);
  }, [editingObject, setEditingObject, setShowVendorStockDialog, vendorStockSelection]);

  const handleAddVendorUnlockRequirement = useCallback(() => {
    setVendorUnlockEntries((prev) => [...(prev || []), { id: `req-${Date.now()}-${Math.random()}`, requirement: '', items: {} }]);
  }, [setVendorUnlockEntries]);

  const handleUpdateVendorUnlockRequirement = useCallback((id: string, requirement: string) => {
    setVendorUnlockEntries((prev) => (prev || []).map((entry) => entry.id === id ? { ...entry, requirement } : entry));
  }, [setVendorUnlockEntries]);

  const handleToggleVendorUnlockItem = useCallback((reqId: string, itemId: number) => {
    setVendorUnlockEntries((prev) => (prev || []).map((entry) => {
      if (entry.id !== reqId) return entry;
      const items = { ...(entry.items || {}) } as Record<number, number>;
      if (items[itemId]) delete items[itemId]; else items[itemId] = 1;
      return { ...entry, items };
    }));
  }, [setVendorUnlockEntries]);

  const handleVendorUnlockQtyChange = useCallback((reqId: string, itemId: number, qty: number) => {
    setVendorUnlockEntries((prev) => (prev || []).map((entry) => {
      if (entry.id !== reqId) return entry;
      const items = { ...(entry.items || {}) } as Record<number, number>;
      if (qty <= 0) qty = 1;
      items[itemId] = qty;
      return { ...entry, items };
    }));
  }, [setVendorUnlockEntries]);

  const handleRemoveVendorUnlockRequirement = useCallback((id: string) => {
    setVendorUnlockEntries((prev) => (prev || []).filter((entry) => entry.id !== id));
  }, [setVendorUnlockEntries]);

  const handleSaveVendorUnlock = useCallback(() => {
    if (!editingObject) return;
    const cleaned = (vendorUnlockEntries || [])
      .map((entry, idx) => ({
          id: entry.id || `req-${idx}`,
          requirement: (entry.requirement || '').trim(),
          items: Object.fromEntries(Object.entries(entry.items || {}).filter(([, qty]) => (qty as number) > 0)) as Record<number, number>
        }))
      .filter((entry) => entry.requirement && Object.keys(entry.items).length > 0);

    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) } as Record<string, string>;
      if (cleaned.length > 0) properties.status_stock_entries = JSON.stringify(cleaned); else delete properties.status_stock_entries;
      return { ...prev, properties } as MapObject;
    });
    setShowVendorUnlockDialog(false);
  }, [editingObject, setEditingObject, setShowVendorUnlockDialog, vendorUnlockEntries]);

  const handleToggleVendorRandomItem = useCallback((itemId: number) => {
    setVendorRandomSelection((prev) => {
      const next = { ...(prev || {}) } as Record<number, RandomStockEntry>;
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = { chance: 50, min: 1, max: 1 };
      }
      return next;
    });
  }, [setVendorRandomSelection]);

  const handleVendorRandomFieldChange = useCallback((itemId: number, field: 'chance' | 'min' | 'max', value: number) => {
    setVendorRandomSelection((prev) => {
      const next = { ...(prev || {}) } as Record<number, RandomStockEntry>;
      const existing = next[itemId] || { chance: 100, min: 1, max: 1 };
      next[itemId] = { ...existing, [field]: value };
      return next;
    });
  }, [setVendorRandomSelection]);

  const handleRandomCountChange = useCallback((field: 'min' | 'max', value: number) => {
    setVendorRandomCount((prev) => ({ ...prev, [field]: value }));
  }, [setVendorRandomCount]);

  const handleSaveVendorRandom = useCallback(() => {
    if (!editingObject) return;
    const randomStock = buildRandomStockString(vendorRandomSelection || {});
    const randomStockCount = buildRandomStockCountString(vendorRandomCount);
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) } as Record<string, string>;
      if (randomStock) properties.random_stock = randomStock; else delete properties.random_stock;
      if (randomStockCount) properties.random_stock_count = randomStockCount; else delete properties.random_stock_count;
      return { ...prev, properties } as MapObject;
    });
    setShowVendorRandomDialog(false);
  }, [editingObject, setEditingObject, setShowVendorRandomDialog, vendorRandomCount, vendorRandomSelection]);

  return {
    handleOpenVendorStockDialog,
    handleOpenVendorUnlockDialog,
    handleOpenVendorRandomDialog,
    handleToggleVendorStockItem,
    handleVendorStockQtyChange,
    handleSaveVendorStock,
    handleAddVendorUnlockRequirement,
    handleUpdateVendorUnlockRequirement,
    handleToggleVendorUnlockItem,
    handleVendorUnlockQtyChange,
    handleRemoveVendorUnlockRequirement,
    handleSaveVendorUnlock,
    handleToggleVendorRandomItem,
    handleVendorRandomFieldChange,
    handleRandomCountChange,
    handleSaveVendorRandom
  };
}
