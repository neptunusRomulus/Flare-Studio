/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import VendorDialogs from '@/components/VendorDialogs';

import type { ItemSummary } from '@/utils/items';

type VendorUnlockEntry = {
  id: string;
  requirement: string;
  items: Record<number, number>;
};

type VendorState = {
  itemsList: ItemSummary[];
  showVendorUnlockDialog: boolean;
  setShowVendorUnlockDialog: (open: boolean) => void;
  vendorUnlockEntries: VendorUnlockEntry[];
  showVendorRandomDialog: boolean;
  setShowVendorRandomDialog: (open: boolean) => void;
  vendorRandomSelection: Record<number, { chance: number; min: number; max: number }>;
  vendorRandomCount: { min: number; max: number };
  showVendorStockDialog: boolean;
  setShowVendorStockDialog: (open: boolean) => void;
  vendorStockSelection: Record<number, number>;
};

type VendorHandlers = {
  handleUpdateVendorUnlockRequirement: (entryId: string, value: string) => void;
  handleRemoveVendorUnlockRequirement: (entryId: string) => void;
  handleToggleVendorUnlockItem: (entryId: string, itemId: number) => void;
  handleVendorUnlockQtyChange: (entryId: string, itemId: number, value: number) => void;
  handleAddVendorUnlockRequirement: () => void;
  handleSaveVendorUnlock: () => void;
  handleToggleVendorRandomItem: (itemId: number) => void;
  handleVendorRandomFieldChange: (itemId: number, field: 'chance' | 'min' | 'max', value: number) => void;
  handleRandomCountChange: (field: 'min' | 'max', value: number) => void;
  handleSaveVendorRandom: () => void;
  handleToggleVendorStockItem: (itemId: number) => void;
  handleVendorStockQtyChange: (itemId: number, value: number) => void;
  handleSaveVendorStock: () => void;
};

type VendorDialogsCtx = {
  vendorState?: VendorState | null;
  vendorHandlers?: VendorHandlers | null;
};

export default function VendorDialogsContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as VendorDialogsCtx;
  return <VendorDialogs vendorState={c.vendorState ?? undefined} vendorHandlers={c.vendorHandlers ?? undefined} />;
}
