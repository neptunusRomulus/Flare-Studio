import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Gift, HandCoins, HelpCircle, Package, Save, Sparkles, ChevronDown, X } from 'lucide-react';
import type { ItemSummary } from '@/utils/items';

type NpcVendorSettingsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenStockDialog: () => void;
  onOpenUnlockDialog: () => void;
  onOpenRandomDialog: () => void;
  itemsList: ItemSummary[];
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
};

const NpcVendorSettingsDialog = ({
  isOpen,
  onClose,
  onOpenStockDialog,
  onOpenUnlockDialog,
  onOpenRandomDialog,
  itemsList,
  getEditingObjectProperty,
  updateEditingObjectProperty,
}: NpcVendorSettingsDialogProps) => {
  const [vendorRequirementsExpanded, setVendorRequirementsExpanded] = useState(true);
  const [vendorStockExpanded, setVendorStockExpanded] = useState(true);
  const [vendorPricingExpanded, setVendorPricingExpanded] = useState(true);

  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'npc_vendor_settings_dialog', initialWidth: 700, initialHeight: 520, minWidth: 560, minHeight: 420 });

  const itemGroups = itemsList.filter((item) => item.role === 'loot_groups');
  const constantStockGroup = getEditingObjectProperty('constant_stock_group', '') || 'none';
  const statusStockGroup = getEditingObjectProperty('status_stock_group', '') || 'none';
  const randomStockGroup = getEditingObjectProperty('random_stock_group', '') || 'none';

  const handleSelectConstantStockGroup = (groupId: string) => {
    updateEditingObjectProperty('constant_stock_group', groupId === 'none' ? null : groupId);
  };

  const handleSelectStatusStockGroup = (groupId: string) => {
    updateEditingObjectProperty('status_stock_group', groupId === 'none' ? null : groupId);
  };

  const handleSelectRandomStockGroup = (groupId: string) => {
    updateEditingObjectProperty('random_stock_group', groupId === 'none' ? null : groupId);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 60,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold">Vendor Settings</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-6 h-6 p-0 hover:bg-transparent"
          onClick={onClose}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-border bg-muted/50 space-y-3">
        <p className="text-sm text-muted-foreground">
          Items created in the Items layer can be added to this vendor using the item-based dialogs below.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onOpenStockDialog}>
            Always Available
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenUnlockDialog}>
            Unlockable
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenRandomDialog}>
            Random Offers
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
          <button
            type="button"
            className="w-full px-3 py-3 flex items-center justify-between gap-3 text-sm font-semibold text-foreground hover:bg-transparent"
            onClick={() => setVendorRequirementsExpanded((prev) => !prev)}
          >
            <span className="flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-emerald-500" />
              Vendor Requirements
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${vendorRequirementsExpanded ? 'rotate-180' : ''}`} />
          </button>
          {vendorRequirementsExpanded && (
            <div className="px-3 pb-3 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1">
                    Vendor Requires Status
                    <Tooltip content="The player must have these statuses in order to use this NPC as a vendor.">
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                    </Tooltip>
                  </label>
                  <Input
                    className="h-10 text-sm"
                    value={getEditingObjectProperty('vendor_requires_status', '')}
                    onChange={(e) => updateEditingObjectProperty('vendor_requires_status', e.target.value || null)}
                    placeholder="e.g. hero_status"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1">
                    Vendor Requires Not Status
                    <Tooltip content="The player must not have these statuses in order to use this NPC as a vendor.">
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                    </Tooltip>
                  </label>
                  <Input
                    className="h-10 text-sm"
                    value={getEditingObjectProperty('vendor_requires_not_status', '')}
                    onChange={(e) => updateEditingObjectProperty('vendor_requires_not_status', e.target.value || null)}
                    placeholder="e.g. thief_status"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
          <button
            type="button"
            className="w-full px-3 py-3 flex items-center justify-between gap-3 text-sm font-semibold text-foreground hover:bg-transparent"
            onClick={() => setVendorStockExpanded((prev) => !prev)}
          >
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-500" />
              Vendor Stock
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${vendorStockExpanded ? 'rotate-180' : ''}`} />
          </button>
          {vendorStockExpanded && (
            <div className="px-3 pb-3 space-y-4">
              <div className="space-y-4">
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span>Constant Stock</span>
                      <Tooltip content="Select an item group to populate this vendor constant stock. Editing the table will save a new vendor-specific loot group if the selected group is modified.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span>Item Group</span>
                          <Tooltip content="Select one of the project loot groups to populate this vendor constant stock. Editing the table will save a new vendor-specific loot group if the selected group is modified.">
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                          </Tooltip>
                        </div>
                      </div>
                      <div className="w-full sm:w-72">
                        {itemGroups.length > 0 ? (
                          <Select onValueChange={handleSelectConstantStockGroup} value={constantStockGroup}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select item group">
                                {constantStockGroup === 'none' ? 'None' : itemGroups.find(g => String(g.id) === constantStockGroup)?.name || `Group ${constantStockGroup}`}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {itemGroups.map((group) => {
                                const groupId = group?.id ? String(group.id) : 'invalid';
                                return (
                                  <SelectItem key={groupId} value={groupId}>
                                    {group?.name || `Group ${group?.id || '?'}`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-md border border-border/70 bg-muted p-3 text-xs text-muted-foreground">
                            No item groups are available in the Items layer. Create items with role &quot;loot_groups&quot; in the Items layer.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span>Status Stock</span>
                      <Tooltip content="Select a loot group to populate the status stock item table. Edits will create a new vendor-specific loot group if the selected group is modified.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span>Item Group</span>
                          <Tooltip content="Select a loot group to populate the status stock item table. Edits will create a new vendor-specific loot group if the selected group is modified.">
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                          </Tooltip>
                        </div>
                      </div>
                      <div className="w-full sm:w-72">
                        {itemGroups.length > 0 ? (
                          <Select onValueChange={handleSelectStatusStockGroup} value={statusStockGroup}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select item group">
                                {statusStockGroup === 'none' ? 'None' : itemGroups.find(g => String(g.id) === statusStockGroup)?.name || `Group ${statusStockGroup}`}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {itemGroups.map((group) => {
                                const groupId = group?.id ? String(group.id) : 'invalid';
                                return (
                                  <SelectItem key={groupId} value={groupId}>
                                    {group?.name || `Group ${group?.id || '?'}`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-md border border-border/70 bg-muted p-3 text-xs text-muted-foreground">
                            No item groups are available in the Items layer. Create items with role &quot;loot_groups&quot; in the Items layer.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span>Random Stock</span>
                      <Tooltip content="Define candidates for the vendor random offers. You can include an existing loot group and still add custom random items.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span>Item Group</span>
                          <Tooltip content="Select a loot group to populate the random stock table. Edited group contents will be saved as a new vendor-specific loot group if modified.">
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                          </Tooltip>
                        </div>
                      </div>
                      <div className="w-full sm:w-72">
                        {itemGroups.length > 0 ? (
                          <Select onValueChange={handleSelectRandomStockGroup} value={randomStockGroup}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select item group">
                                {randomStockGroup === 'none' ? 'None' : itemGroups.find(g => String(g.id) === randomStockGroup)?.name || `Group ${randomStockGroup}`}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {itemGroups.map((group) => {
                                const groupId = group?.id ? String(group.id) : 'invalid';
                                return (
                                  <SelectItem key={groupId} value={groupId}>
                                    {group?.name || `Group ${group?.id || '?'}`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-md border border-border/70 bg-muted p-3 text-xs text-muted-foreground">
                            No item groups are available in the Items layer. Create items with role &quot;loot_groups&quot; in the Items layer.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1">
                    Random Stock Definition
                    <Tooltip content="Use a loot table filename or inline definition here. The selected items above will update this value.">
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                    </Tooltip>
                  </label>
                  <Input
                    className="h-10 text-sm"
                    value={getEditingObjectProperty('random_stock', '')}
                    onChange={(e) => updateEditingObjectProperty('random_stock', e.target.value || null)}
                    placeholder="loot table definition"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected items are serialized as <code>id,chance,min,max</code> entries in this field.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-1">
                      Random Stock Count Min
                      <Tooltip content="Sets the minimum amount of random items this npc can have.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </label>
                    <Input
                      type="number"
                      className="h-10 text-sm"
                      value={getEditingObjectProperty('random_stock_count_min', '')}
                      onChange={(e) => updateEditingObjectProperty('random_stock_count_min', e.target.value || null)}
                      placeholder="Min"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-1">
                      Random Stock Count Max
                      <Tooltip content="Sets the maximum amount of random items this npc can have.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </label>
                    <Input
                      type="number"
                      className="h-10 text-sm"
                      value={getEditingObjectProperty('random_stock_count_max', '')}
                      onChange={(e) => updateEditingObjectProperty('random_stock_count_max', e.target.value || null)}
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
            <button
              type="button"
              className="w-full px-3 py-3 flex items-center justify-between gap-3 text-sm font-semibold text-foreground hover:bg-transparent"
              onClick={() => setVendorPricingExpanded((prev) => !prev)}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                Vendor Pricing
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${vendorPricingExpanded ? 'rotate-180' : ''}`} />
            </button>
            {vendorPricingExpanded && (
              <div className="px-3 pb-3 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-1">
                      Vendor Ratio Buy
                      <Tooltip content="NPC-specific version of vendor_ratio_buy from engine/loot.txt. Uses the global setting when set to 0.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-10 text-sm"
                      value={getEditingObjectProperty('vendor_ratio_buy', '')}
                      onChange={(e) => updateEditingObjectProperty('vendor_ratio_buy', e.target.value || null)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-1">
                      Vendor Ratio Sell
                      <Tooltip content="NPC-specific version of vendor_ratio_sell from engine/loot.txt. Uses the global setting when set to 0.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-10 text-sm"
                      value={getEditingObjectProperty('vendor_ratio_sell', '')}
                      onChange={(e) => updateEditingObjectProperty('vendor_ratio_sell', e.target.value || null)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-1">
                      Vendor Ratio Sell Old
                      <Tooltip content="NPC-specific version of vendor_ratio_sell_old from engine/loot.txt. Uses the global setting when set to 0.">
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </Tooltip>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-10 text-sm"
                      value={getEditingObjectProperty('vendor_ratio_sell_old', '')}
                      onChange={(e) => updateEditingObjectProperty('vendor_ratio_sell_old', e.target.value || null)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border p-4">
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10"
          onClick={onClose}
          aria-label="Save"
        >
          <Save className="w-4 h-4" />
        </Button>
      </div>

      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
        title="Drag to resize"
      >
        <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
      </div>
    </div>,
    document.body,
  );
};

export default NpcVendorSettingsDialog;
