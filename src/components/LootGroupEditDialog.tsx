
import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, Save, X, Tag, Layers, Shield, Check, HelpCircle, Search, ChevronDown, ChevronRight } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import type { ItemSummary } from '@/utils/items';

type LootGroupEditDialogProps = {
  open: boolean;
  lootGroupItem: ItemSummary | null;
  lootGroupData: Record<string, unknown> | null;
  itemsList?: ItemSummary[];
  updateLootGroupField: (key: string, value: unknown) => void;
  onClose: () => void;
  onSave: () => void;
};

const safeString = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const CollapsibleSection = ({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  className = ''
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={`space-y-3 border-b border-border/50 pb-4 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between group py-2"
      >
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-orange-500" />
          {title}
        </h4>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>
      {isOpen && <div className="animate-in fade-in slide-in-from-top-1 duration-200">{children}</div>}
    </div>
  );
};

function LootGroupEditDialog(props: LootGroupEditDialogProps) {
  const { open, lootGroupItem, lootGroupData, itemsList = [], updateLootGroupField, onClose, onSave } = props;
  const { position, size, dialogRef, handleHeaderMouseDown, handleResizeMouseDown } = useDraggableResizable({ id: 'loot_group_edit_dialog', initialWidth: 700, initialHeight: 500 });
  const [searchQuery, setSearchQuery] = useState('');

  const name = safeString(lootGroupData?.name ?? lootGroupItem?.name ?? '');
  const generatedId = safeString(lootGroupData?.id) || slugify(name || 'loot_group');
  const description = safeString(lootGroupData?.description ?? '');
  const selectedContents = (lootGroupData?.loot_contents as Record<string, number>) ?? {};
  const selectedContentIds = useMemo(() => new Set(Object.keys(selectedContents)), [selectedContents]);

  const availableItems = useMemo(() => {
    const filterValue = searchQuery.trim().toLowerCase();
    return itemsList
      .filter((item) => item.role !== 'loot_groups')
      .filter((item) => {
        if (!filterValue) return true;
        return [String(item.id), item.name, item.category]
          .join(' ')
          .toLowerCase()
          .includes(filterValue);
      });
  }, [itemsList, searchQuery]);

  const handleToggleContentItem = (itemId: number) => {
    const nextContents = { ...selectedContents };
    const key = String(itemId);
    if (nextContents[key] !== undefined) {
      delete nextContents[key];
    } else {
      nextContents[key] = 1;
    }
    updateLootGroupField('loot_contents', nextContents);
  };

  const handleContentQuantity = (itemId: number, value: string) => {
    const nextContents = { ...selectedContents };
    const key = String(itemId);
    const quantity = Number(value);
    if (!value || Number.isNaN(quantity) || quantity <= 0) {
      delete nextContents[key];
    } else {
      nextContents[key] = quantity;
    }
    updateLootGroupField('loot_contents', nextContents);
  };

  const requiresStatus = safeString(lootGroupData?.requires_status);
  const requiresLevel = safeString(lootGroupData?.requires_level);
  const quantityPerLevel = safeString(lootGroupData?.quantity_per_level);
  const lootChanceValue = safeString(lootGroupData?.loot_chance_value);
  const lootChanceFixed = lootGroupData?.loot_chance_fixed === true;

  const handleChanceFixedChange = (checked: boolean) => {
    updateLootGroupField('loot_chance_fixed', checked);
    if (checked) {
      updateLootGroupField('loot_chance_value', '');
    }
  };

  useEffect(() => {
    if (name && !lootGroupData?.id) {
      updateLootGroupField('id', generatedId);
    }
  }, [name, generatedId, lootGroupData?.id, updateLootGroupField]);

  // Helper: get loot entries as array
  const lootEntries: any[] = Array.isArray(lootGroupData?.loot)
    ? lootGroupData.loot as any[]
    : lootGroupData?.loot ? [lootGroupData.loot] : [];

  // Add new loot entry
  const handleAddLootEntry = () => {
    const newEntry = {
      'loot.id': '',
      'loot.chance': '',
      'loot.quantity': '',
      'loot.requires_status': '',
      'loot.requires_level': '',
      'loot.quantity_per_level': '',
      'status_loot': ''
    };
    updateLootGroupField('loot', [...lootEntries, newEntry]);
  };

  // Remove loot entry
  const handleRemoveLootEntry = (idx: number) => {
    const updated = lootEntries.filter((_, i) => i !== idx);
    updateLootGroupField('loot', updated);
  };

  // Update loot entry field
  const handleLootEntryField = (idx: number, key: string, value: string) => {
    const updated = lootEntries.map((entry, i) => i === idx ? { ...entry, [key]: value } : entry);
    updateLootGroupField('loot', updated);
  };

  // ESC key closes dialog
  React.useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{ zIndex: 100 }}
      className="fixed inset-0 flex items-center justify-center select-none pointer-events-none"
    >
      {/* No black tint background */}
      {/* Draggable, resizable dialog */}
      <div
        ref={dialogRef}
        className="bg-background border border-border rounded-lg flex flex-col shadow-xl pointer-events-auto"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 101,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header: draggable area, title, close icon */}
        <div
          className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center gap-2 cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <Sheet className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          <span className="text-lg font-semibold flex-1">Edit Item Group</span>
          <Tooltip content="Close">
            <button
              type="button"
              className="ml-2 p-1 rounded hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-orange-400"
              onClick={onClose}
              aria-label="Close"
              tabIndex={0}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </Tooltip>
        </div>


        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">
          <CollapsibleSection title="Identity" icon={Tag}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Tooltip content="Set the display name for this item group. This name helps generate the loot group ID and file name.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <Input
                  value={name}
                  onChange={(event) => updateLootGroupField('name', event.target.value)}
                  placeholder="Item group name"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                  <Tooltip content="Optional notes or author-facing description for this loot group.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <Input
                  value={description}
                  onChange={(event) => updateLootGroupField('description', event.target.value)}
                  placeholder="Describe this loot group"
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Loot Group ID</label>
                <Tooltip content="This ID is automatically generated from the group name and cannot be edited directly.">
                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </Tooltip>
              </div>
              <Input value={generatedId} readOnly className="h-10 bg-muted/10 text-muted-foreground" />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Contents" icon={Layers}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Search items</label>
                  <Tooltip content="Filter the user-created items list by ID, name, or category.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by ID, name, category"
                    className="h-10 pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-auto rounded border border-border bg-background">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-muted/30">
                  <tr>
                    <th className="p-2 w-10" />
                    <th className="p-2 w-16">Icon</th>
                    <th className="p-2">ID</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Category</th>
                    <th className="p-2 w-28">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {availableItems.map((item) => {
                    const selected = selectedContentIds.has(String(item.id));
                    return (
                      <tr key={item.filePath} className={`border-b border-border/50 ${selected ? 'bg-orange-50' : ''}`}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleContentItem(item.id)}
                            className="h-4 w-4 rounded border-border text-orange-500"
                          />
                        </td>
                        <td className="p-2">
                          <div className="w-8 h-8 rounded bg-muted/60 flex items-center justify-center text-[10px] uppercase text-muted-foreground">
                            {item.name.charAt(0) || '#'}
                          </div>
                        </td>
                        <td className="p-2 text-xs font-medium text-slate-700">{item.id}</td>
                        <td className="p-2 text-xs text-slate-700">{item.name}</td>
                        <td className="p-2 text-xs text-muted-foreground">{item.category || 'Unknown'}</td>
                        <td className="p-2">
                          <Input
                            value={safeString(selectedContents[String(item.id)])}
                            onChange={(event) => handleContentQuantity(item.id, event.target.value)}
                            placeholder="1"
                            className="h-9 text-xs"
                            disabled={!selected}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {availableItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-xs text-muted-foreground">
                        No items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Conditions" icon={Shield}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">requires_status</label>
                  <Tooltip content="Enter a campaign status ID that must be active for this loot to drop.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <Input
                  value={requiresStatus}
                  onChange={(event) => updateLootGroupField('requires_status', event.target.value)}
                  placeholder="status id"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">requires_level</label>
                  <Tooltip content="Specify a player level range in the form min,max for this loot to be eligible.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <Input
                  value={requiresLevel}
                  onChange={(event) => updateLootGroupField('requires_level', event.target.value)}
                  placeholder="min,max"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">quantity_per_level</label>
                  <Tooltip content="Enter a min,max pair to add scaled quantity based on player level.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <Input
                  value={quantityPerLevel}
                  onChange={(event) => updateLootGroupField('quantity_per_level', event.target.value)}
                  placeholder="min,max"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">loot.chance</label>
                  <Tooltip content="Set a drop chance as a float, or check Fixed to force the loot to drop before random selection.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={lootChanceValue}
                    onChange={(event) => updateLootGroupField('loot_chance_value', event.target.value)}
                    disabled={lootChanceFixed}
                    placeholder="0.0 - 1.0"
                    className="h-10 flex-1"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={lootChanceFixed}
                      onChange={(event) => handleChanceFixedChange(event.target.checked)}
                      className="h-4 w-4 rounded border-border text-orange-500"
                    />
                    Fixed
                  </label>
                </div>
              </div>
            </div>
          </CollapsibleSection>

        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
          title="Drag to resize"
        >
          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
        </div>

        {/* Footer: Save icon-only button with tooltip */}
        <div className="flex justify-end px-6 pb-4">
          <Tooltip content="Save Item Group">
            <button
              type="button"
              className="p-2 rounded bg-orange-500 hover:bg-orange-600 text-white shadow focus:outline-none focus:ring-2 focus:ring-orange-400"
              onClick={onSave}
              aria-label="Save Item Group"
            >
              <Save className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default LootGroupEditDialog;
