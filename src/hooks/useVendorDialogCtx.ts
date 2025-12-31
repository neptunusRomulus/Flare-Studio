/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Dispatch, SetStateAction } from 'react';

type RandomCount = { min: number; max: number };

type VendorUnlockEntry = { id: string; requirement: string; items: Record<number, number> };

type Params = {
  itemsList: unknown[] | null;
  showVendorUnlockDialog: boolean;
  setShowVendorUnlockDialog: Dispatch<SetStateAction<boolean>>;
  vendorUnlockEntries: VendorUnlockEntry[];
  showVendorRandomDialog: boolean;
  setShowVendorRandomDialog: Dispatch<SetStateAction<boolean>>;
  vendorRandomSelection: Record<any, any> | null;
  vendorRandomCount: RandomCount | null;
  showVendorStockDialog: boolean;
  setShowVendorStockDialog: Dispatch<SetStateAction<boolean>>;
  vendorStockSelection: Record<number, number> | null;
  handleUpdateVendorUnlockRequirement: (entryId: string, value: string) => void;
  handleRemoveVendorUnlockRequirement: (entryId: string) => void;
  handleToggleVendorUnlockItem: (entryId: string, itemId: number) => void;
  handleVendorUnlockQtyChange: (entryId: string, itemId: number, qty: number) => void;
  handleAddVendorUnlockRequirement: () => void;
  handleSaveVendorUnlock: () => void;
  handleToggleVendorRandomItem: (itemId: number) => void;
  handleVendorRandomFieldChange: (itemId: number, field: 'chance' | 'min' | 'max', value: number) => void;
  handleRandomCountChange: (field: 'min' | 'max', value: number) => void;
  handleSaveVendorRandom: () => void;
  handleToggleVendorStockItem: (id: number) => void;
  handleVendorStockQtyChange: (id: number, qty: number) => void;
  handleSaveVendorStock: () => void;
};

export default function useVendorDialogCtx(params: Params) {
  const {
    itemsList,
    showVendorUnlockDialog,
    setShowVendorUnlockDialog,
    vendorUnlockEntries,
    showVendorRandomDialog,
    setShowVendorRandomDialog,
    vendorRandomSelection,
    vendorRandomCount,
    showVendorStockDialog,
    setShowVendorStockDialog,
    vendorStockSelection,
    handleUpdateVendorUnlockRequirement,
    handleRemoveVendorUnlockRequirement,
    handleToggleVendorUnlockItem,
    handleVendorUnlockQtyChange,
    handleAddVendorUnlockRequirement,
    handleSaveVendorUnlock,
    handleToggleVendorRandomItem,
    handleVendorRandomFieldChange,
    handleRandomCountChange,
    handleSaveVendorRandom,
    handleToggleVendorStockItem,
    handleVendorStockQtyChange,
    handleSaveVendorStock
  } = params;

  return {
    vendorState: {
      itemsList,
      showVendorUnlockDialog,
      setShowVendorUnlockDialog,
      vendorUnlockEntries,
      showVendorRandomDialog,
      setShowVendorRandomDialog,
      vendorRandomSelection,
      vendorRandomCount,
      showVendorStockDialog,
      setShowVendorStockDialog,
      vendorStockSelection
    },
    vendorHandlers: {
      handleUpdateVendorUnlockRequirement,
      handleRemoveVendorUnlockRequirement,
      handleToggleVendorUnlockItem,
      handleVendorUnlockQtyChange,
      handleAddVendorUnlockRequirement,
      handleSaveVendorUnlock,
      handleToggleVendorRandomItem,
      handleVendorRandomFieldChange,
      handleRandomCountChange,
      handleSaveVendorRandom,
      handleToggleVendorStockItem,
      handleVendorStockQtyChange,
      handleSaveVendorStock
    }
  } as const;
}
