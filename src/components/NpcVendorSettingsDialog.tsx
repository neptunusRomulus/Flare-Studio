import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Tooltip from '@/components/ui/tooltip';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Gift, HandCoins, HelpCircle, Package, Save, Sparkles, ChevronDown, Table2, X } from 'lucide-react';
import type { ItemSummary } from '@/utils/items';

// PATCH TEST: verify file sync

type NpcVendorSettingsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenStockDialog: () => void;
  onOpenUnlockDialog: () => void;
  onOpenRandomDialog: () => void;
  onCreateVendorStockGroup: (stockType: 'constant' | 'status' | 'random', selectedGroupId: string | null, npcName: string) => Promise<ItemSummary | null>;
  itemsList: ItemSummary[];
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
};

// Vendor stock section configuration
const NpcVendorSettingsDialog = ({
  isOpen,
  onClose,
  onOpenStockDialog,
  onOpenUnlockDialog,
  onOpenRandomDialog,
  onCreateVendorStockGroup,
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
  const npcName = getEditingObjectProperty('name', 'Vendor');

  const handleSelectConstantStockGroup = (groupId: string) => {
    updateEditingObjectProperty('constant_stock_group', groupId === 'none' ? null : groupId);
  };

  const handleSelectStatusStockGroup = (groupId: string) => {
    updateEditingObjectProperty('status_stock_group', groupId === 'none' ? null : groupId);
  };

  const handleSelectRandomStockGroup = (groupId: string) => {
    updateEditingObjectProperty('random_stock_group', groupId === 'none' ? null : groupId);
  };

  const handleCreateVendorStockItem = async (
    stockType: 'constant' | 'status' | 'random',
    selectedGroupId: string | null,
    propertyKey: 'constant_stock_group' | 'status_stock_group' | 'random_stock_group'
  ) => {
    const created = await onCreateVendorStockGroup(stockType, selectedGroupId, npcName);
    if (created) {
      updateEditingObjectProperty(propertyKey, String(created.id));
    }
  };

  const vendorStockSections = [
    {
      title: 'Always Available',
      value: constantStockGroup,
      onSelect: handleSelectConstantStockGroup,
      stockType: 'constant' as const,
      propertyKey: 'constant_stock_group' as const,
      tooltip: 'Items that vendor always sells.',
      buttonTooltip: 'Use an item group or create a new one.',
    },
    {
      title: 'Unlockable',
      value: statusStockGroup,
      onSelect: handleSelectStatusStockGroup,
      stockType: 'status' as const,
      propertyKey: 'status_stock_group' as const,
      tooltip: 'Items that vendor sells after a certain status change.',
      buttonTooltip: 'Use an item group or create a new one.',
    },
    {
      title: 'Random',
      value: randomStockGroup,
      onSelect: handleSelectRandomStockGroup,
      stockType: 'random' as const,
      propertyKey: 'random_stock_group' as const,
      tooltip: 'Items that vendor randomly sells.',
      buttonTooltip: 'Use an item group or create a new one.',
    },
  ] as const;

  if (!isOpen) return null;

  return (
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
            <div className="px-3 pb-3 space-y-3">
              {vendorStockSections.map((section) => (
                <div key={section.title} className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground whitespace-nowrap">
                        <span>{section.title}</span>
                        <Tooltip content={section.tooltip}>
                          <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2 flex-nowrap">
                        <Button
                          size="sm"
                          className="inline-flex items-center gap-2 bg-orange-500 text-white hover:bg-orange-600"
                          onClick={() => void handleCreateVendorStockItem(section.stockType, section.value === 'none' ? null : section.value, section.propertyKey)}
                        >
                          <Table2 className="w-4 h-4" />
                          + Create New
                        </Button>
                        <Badge variant="outline" className="h-7 px-2 text-[0.65rem] uppercase text-muted-foreground bg-muted border border-border hover:bg-muted">
                          OR
                        </Badge>
                        <Select value={section.value} onValueChange={section.onSelect}>
                          <SelectTrigger className="h-9 text-sm min-w-[160px]">
                            <SelectValue placeholder="Select Item Group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-[0.65rem]">Select Item Group</SelectItem>
                            {itemGroups.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)} className="text-xs">
                                {item.name || item.fileName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Tooltip content={section.buttonTooltip}>
                          <HelpCircle className="w-5 h-5 text-muted-foreground cursor-pointer" />
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
            <div className="px-3 pb-3">
              <p className="text-sm text-muted-foreground">Vendor pricing placeholder</p>
            </div>
          )}
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
    </div>
  );
};

export default NpcVendorSettingsDialog;
