import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import type { ItemResourceSubtype, ItemRole } from '@/editor/itemRoles';
import { Gift, HelpCircle, Package, Save, Sparkles, X } from 'lucide-react';

type ItemSummary = {
  id: number;
  name: string;
  category: string;
  filePath: string;
  fileName: string;
  role: ItemRole;
  resourceSubtype?: ItemResourceSubtype;
};

type VendorUnlockEntry = {
  id: string;
  requirement: string;
  items: Record<number, number>;
};

type VendorDialogsProps = {
  itemsList: ItemSummary[];
  showVendorUnlockDialog: boolean;
  setShowVendorUnlockDialog: (open: boolean) => void;
  vendorUnlockEntries: VendorUnlockEntry[];
  handleUpdateVendorUnlockRequirement: (entryId: string, value: string) => void;
  handleRemoveVendorUnlockRequirement: (entryId: string) => void;
  handleToggleVendorUnlockItem: (entryId: string, itemId: number) => void;
  handleVendorUnlockQtyChange: (entryId: string, itemId: number, value: number) => void;
  handleAddVendorUnlockRequirement: () => void;
  handleSaveVendorUnlock: () => void;
  showVendorRandomDialog: boolean;
  setShowVendorRandomDialog: (open: boolean) => void;
  vendorRandomSelection: Record<number, { chance: number; min: number; max: number }>;
  handleToggleVendorRandomItem: (itemId: number) => void;
  handleVendorRandomFieldChange: (itemId: number, field: 'chance' | 'min' | 'max', value: number) => void;
  vendorRandomCount: { min: number; max: number };
  handleRandomCountChange: (field: 'min' | 'max', value: number) => void;
  handleSaveVendorRandom: () => void;
  showVendorStockDialog: boolean;
  setShowVendorStockDialog: (open: boolean) => void;
  vendorStockSelection: Record<number, number>;
  handleToggleVendorStockItem: (itemId: number) => void;
  handleVendorStockQtyChange: (itemId: number, value: number) => void;
  handleSaveVendorStock: () => void;
};

const VendorDialogs = ({
  itemsList,
  showVendorUnlockDialog,
  setShowVendorUnlockDialog,
  vendorUnlockEntries,
  handleUpdateVendorUnlockRequirement,
  handleRemoveVendorUnlockRequirement,
  handleToggleVendorUnlockItem,
  handleVendorUnlockQtyChange,
  handleAddVendorUnlockRequirement,
  handleSaveVendorUnlock,
  showVendorRandomDialog,
  setShowVendorRandomDialog,
  vendorRandomSelection,
  handleToggleVendorRandomItem,
  handleVendorRandomFieldChange,
  vendorRandomCount,
  handleRandomCountChange,
  handleSaveVendorRandom,
  showVendorStockDialog,
  setShowVendorStockDialog,
  vendorStockSelection,
  handleToggleVendorStockItem,
  handleVendorStockQtyChange,
  handleSaveVendorStock
}: VendorDialogsProps) => {
  return (
    <>
      <Dialog open={showVendorUnlockDialog} onOpenChange={setShowVendorUnlockDialog} zIndex={80}>
        <DialogContent className="max-w-4xl w-full z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              Unlockable Items
            </DialogTitle>
            <DialogDescription>
              Add status-based stock. Each requirement creates its own stock list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {vendorUnlockEntries.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No requirements yet. Use &quot;Add Requirement&quot; to start.
              </div>
            )}

            {vendorUnlockEntries.map((entry) => (
              <div key={entry.id} className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 h-9 text-sm"
                    placeholder="Requirement status (e.g., emp_perdition_trader1)"
                    value={entry.requirement}
                    onChange={(e) => handleUpdateVendorUnlockRequirement(entry.id, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveVendorUnlockRequirement(entry.id)}
                    aria-label="Remove requirement"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {itemsList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No items found. Create items in the Items layer to add them here.
                    </p>
                  ) : (
                    itemsList.map((item) => {
                      const selected = entry.items[item.id] !== undefined;
                      const qty = entry.items[item.id] ?? 1;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-2 rounded-md border transition-all ${
                            selected
                              ? 'border-amber-500 ring-2 ring-amber-200 dark:ring-amber-900/60 bg-amber-50/40 dark:bg-amber-900/10'
                              : 'border-border bg-muted/30 hover:bg-muted/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleVendorUnlockItem(entry.id, item.id)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Badge className="text-[10px] font-semibold px-2 py-0.5">
                                ID {item.id}
                              </Badge>
                              <span className="font-medium text-sm">{item.name || `Item ${item.id}`}</span>
                              <span className="text-xs text-muted-foreground">({item.role})</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.category || 'Default'} • {item.fileName}
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Qty</span>
                            <Input
                              type="number"
                              className="h-8 w-20 text-xs"
                              min={1}
                              disabled={!selected}
                              value={qty}
                              onChange={(e) => handleVendorUnlockQtyChange(
                                entry.id,
                                item.id,
                                Number.parseInt(e.target.value, 10) || 1
                              )}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleAddVendorUnlockRequirement}>
              Add Requirement
            </Button>
            <DialogFooter className="justify-between w-auto gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowVendorUnlockDialog(false)} aria-label="Cancel unlockable items">
                <X className="w-4 h-4" />
              </Button>
              <Button size="icon" onClick={handleSaveVendorUnlock} aria-label="Save unlockable items">
                <Save className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVendorRandomDialog} onOpenChange={setShowVendorRandomDialog} zIndex={80}>
        <DialogContent className="max-w-4xl w-full z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Random Offers
            </DialogTitle>
            <DialogDescription>
              Pick random offer candidates with chance and quantity ranges.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {itemsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items found. Create items in the Items layer to add them here.
              </p>
            ) : (
              itemsList.map((item) => {
                const selected = vendorRandomSelection[item.id] !== undefined;
                const entry = vendorRandomSelection[item.id] || { chance: 100, min: 1, max: 1 };
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-md border transition-all ${
                      selected
                        ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-900/60 bg-purple-50/40 dark:bg-purple-900/10'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleVendorRandomItem(item.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] font-semibold px-2 py-0.5">
                          ID {item.id}
                        </Badge>
                        <span className="font-medium text-sm">{item.name || `Item ${item.id}`}</span>
                        <span className="text-xs text-muted-foreground">({item.role})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.category || 'Default'} · {item.fileName}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Chance</span>
                      <select
                        className="h-8 text-xs border rounded px-2 bg-background"
                        disabled={!selected}
                        value={entry.chance.toString()}
                        onChange={(e) => handleVendorRandomFieldChange(item.id, 'chance', parseInt(e.target.value, 10) || 1)}
                      >
                        {[100, 50, 25, 10, 5].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Min</span>
                      <Input
                        type="number"
                        className="h-8 w-16 text-xs"
                        min={1}
                        disabled={!selected}
                        value={entry.min}
                        onChange={(e) => handleVendorRandomFieldChange(item.id, 'min', parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Max</span>
                      <Input
                        type="number"
                        className="h-8 w-16 text-xs"
                        min={1}
                        disabled={!selected}
                        value={entry.max}
                        onChange={(e) => handleVendorRandomFieldChange(item.id, 'max', parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Min item number</span>
                <Tooltip content="How many of these items can appear in total?">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </Tooltip>
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  min={1}
                  value={vendorRandomCount.min}
                  onChange={(e) => handleRandomCountChange('min', parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Max item number</span>
                <Tooltip content="How many of these items can appear in total?">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </Tooltip>
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  min={1}
                  value={vendorRandomCount.max}
                  onChange={(e) => handleRandomCountChange('max', parseInt(e.target.value, 10) || 1)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowVendorRandomDialog(false)} aria-label="Cancel random offers">
                <X className="w-4 h-4" />
              </Button>
              <Button size="icon" onClick={handleSaveVendorRandom} aria-label="Save random offers">
                <Save className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVendorStockDialog} onOpenChange={setShowVendorStockDialog} zIndex={80}>
        <DialogContent className="max-w-3xl w-full z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-500" />
              Always Available Items
            </DialogTitle>
            <DialogDescription>
              Select items to keep in this vendor&apos;s shop and set their quantities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {itemsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items found. Create items in the Items layer to add them here.
              </p>
            ) : (
              itemsList.map((item) => {
                const selected = vendorStockSelection[item.id] !== undefined;
                const qty = vendorStockSelection[item.id] ?? 1;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-md border transition-all ${selected
                      ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-900/10'
                      : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleVendorStockItem(item.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] font-semibold px-2 py-0.5">
                          ID {item.id}
                        </Badge>
                        <span className="font-medium text-sm">{item.name || `Item ${item.id}`}</span>
                        <span className="text-xs text-muted-foreground">({item.role})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.category || 'Default'} • {item.fileName}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Qty</span>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs"
                        min={1}
                        disabled={!selected}
                        value={qty}
                        onChange={(e) => handleVendorStockQtyChange(item.id, Number.parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="justify-between">
            <Button variant="outline" size="icon" onClick={() => setShowVendorStockDialog(false)} aria-label="Cancel vendor items">
              <X className="w-4 h-4" />
            </Button>
            <Button size="icon" onClick={handleSaveVendorStock} aria-label="Save vendor items">
              <Save className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VendorDialogs;
