import { useState } from 'react';

const useVendorState = () => {
  const [showVendorStockDialog, setShowVendorStockDialog] = useState(false);
  const [vendorStockSelection, setVendorStockSelection] = useState<Record<number, number>>({});
  const [showVendorUnlockDialog, setShowVendorUnlockDialog] = useState(false);
  const [vendorUnlockEntries, setVendorUnlockEntries] = useState<Array<{ id: string; requirement: string; items: Record<number, number> }>>([]);
  const [showVendorRandomDialog, setShowVendorRandomDialog] = useState(false);
  const [vendorRandomSelection, setVendorRandomSelection] = useState<Record<number, { chance: number; min: number; max: number }>>({});
  const [vendorRandomCount, setVendorRandomCount] = useState<{ min: number; max: number }>({ min: 1, max: 1 });

  return {
    showVendorStockDialog,
    setShowVendorStockDialog,
    vendorStockSelection,
    setVendorStockSelection,
    showVendorUnlockDialog,
    setShowVendorUnlockDialog,
    vendorUnlockEntries,
    setVendorUnlockEntries,
    showVendorRandomDialog,
    setShowVendorRandomDialog,
    vendorRandomSelection,
    setVendorRandomSelection,
    vendorRandomCount,
    setVendorRandomCount
  };
};

export default useVendorState;
