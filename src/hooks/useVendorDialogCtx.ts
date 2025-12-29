type Params = {
  itemsList: unknown;
  showVendorUnlockDialog: boolean;
  setShowVendorUnlockDialog: (...args: any[]) => any;
  vendorUnlockEntries: unknown;
  showVendorRandomDialog: boolean;
  setShowVendorRandomDialog: (...args: any[]) => any;
  vendorRandomSelection: unknown;
  vendorRandomCount: any;
  showVendorStockDialog: boolean;
  setShowVendorStockDialog: (...args: any[]) => any;
  vendorStockSelection: unknown;
  handleUpdateVendorUnlockRequirement: (...args: any[]) => any;
  handleRemoveVendorUnlockRequirement: (...args: any[]) => any;
  handleToggleVendorUnlockItem: (...args: any[]) => any;
  handleVendorUnlockQtyChange: (...args: any[]) => any;
  handleAddVendorUnlockRequirement: (...args: any[]) => any;
  handleSaveVendorUnlock: (...args: any[]) => any;
  handleToggleVendorRandomItem: (...args: any[]) => any;
  handleVendorRandomFieldChange: (...args: any[]) => any;
  handleRandomCountChange: (...args: any[]) => any;
  handleSaveVendorRandom: (...args: any[]) => any;
  handleToggleVendorStockItem: (...args: any[]) => any;
  handleVendorStockQtyChange: (...args: any[]) => any;
  handleSaveVendorStock: (...args: any[]) => any;
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
