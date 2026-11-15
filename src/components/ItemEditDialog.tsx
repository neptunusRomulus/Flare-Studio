import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import EditorPropertyList from '@/components/EditorPropertyList';
import { extraItemPropertyKeys, ITEM_EXTRA_CATALOG } from '@/editor/itemFileHydrate';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Apple, Book, Box, Check, ChevronDown, ChevronRight, Coins, Folder, Gift, HelpCircle, Key, Layers, Save, Shield, Sparkles, Sword, Tag, Trash2, Volume2, X, Zap } from 'lucide-react';
import { ITEM_ROLE_META, ITEM_ROLE_SELECTIONS, RESOURCE_SUBTYPE_META } from '@/editor/itemRoles'
import { bookRelPath, DEFAULT_BOOK_TEMPLATE } from '@/editor/bookFile'
import { OPEN_BOOK_EVENT } from '@/components/BookEditorView';
import type { ItemResourceSubtype } from '@/editor/itemRoles'
import { useAppContext } from '@/context/AppContext';
import { buildPowerProject } from '@/editor/powers/powerProject';
import { loadTextFiles } from '@/editor/powers/powerFiles';
import { projectRoot } from '@/editor/projectFiles';
import { askConfirm } from '@/components/ui/inline-confirm';
import ResizeHandle from '@/components/ResizeHandle';

const EMPTY_POWER = '__empty__';

const RoleIcon = ({ roleId, className }: { roleId: string; className?: string }) => {
  switch (roleId) {
    case 'equipment': return <Sword className={className} />;
    case 'consumable': return <Apple className={className} />;
    case 'quest': return <Key className={className} />;
    case 'resource': return <Layers className={className} />;
    case 'book': return <Book className={className} />;
    default: return <Folder className={className} />;
  }
};


type EditingItem = {
  id?: number;
  name?: string;
  flavor?: string;
  icon?: string;
  level?: number;
  quality?: string;
  no_stash?: string;
  quest_item?: boolean;
  pickup_status?: string;
  price?: string | number;
  price_per_level?: string | number;
  price_sell?: string | number;
  max_quantity?: number;
  resourceSubtype?: string;
  role?: string;
  item_type?: string;
  type?: string;
  equip_flags?: string;
  requires_level?: number;
  requires_stat?: string;
  requires_class?: string;
  disable_slots?: string;
  gfx?: string;
  bonus?: string;
  bonus_power_level?: string;
  dmg?: string;
  abs?: string;
  trait_elemental?: string;
  power?: string;
  power_desc?: string;
  replace_power?: string;
  script?: string;
  book?: string;
  book_is_readable?: boolean;
  soundfx?: string;
  stepfx?: string;
  loot_animation?: string;
  randomizer_def?: string;
  loot_drops_max?: number;
  wall_power?: string;
  use_hazard?: boolean;
  post_power?: string;
  post_effect?: string;
  speed?: string;
  radius?: string;
  requires_hpmp_state?: string;
  requires_item?: string;
  new_state?: string;
  modifier_damage?: string;
  lifespan?: string;
  face?: boolean;
  [key: string]: unknown;
};

type FieldValue = string | number | boolean | Record<string, unknown> | null | undefined;

type ItemEditDialogProps = {
  showItemEditDialog: boolean;
  editingItem: EditingItem | null;
  updateEditingItemField: (key: string, value: FieldValue) => void;
  handleCloseItemEdit: () => void;
  handleSaveItemEdit: () => void;
  onDeleteItem?: (item: { id: number; name: string; filePath: string }, anchor?: { left: number; top: number; width: number; height: number }) => Promise<boolean | void>;
};

const CollapsibleSection = ({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  className = ""
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
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-auto flex items-center justify-between group py-1 px-0 hover:bg-transparent"
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
      </Button>
      {isOpen && <div className="animate-in fade-in slide-in-from-top-1 duration-200">{children}</div>}
    </div>
  );
};

const ItemEditDialog = (props: ItemEditDialogProps) => {
  const {
    showItemEditDialog,
    editingItem,
    updateEditingItemField,
    handleCloseItemEdit,
    handleSaveItemEdit,
    onDeleteItem
  } = props;
  const [powerIds, setPowerIds] = useState<string[]>([]);
  const [powerNames, setPowerNames] = useState<Record<string, string>>({});
  const ctx = useAppContext();
  const currentProjectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const itemBaseline = React.useRef('');
  const itemOpen = React.useRef(false);
  const itemDeleteBusy = React.useRef(false);
  if (showItemEditDialog && editingItem && !itemOpen.current) {
    itemBaseline.current = JSON.stringify(editingItem);
    itemOpen.current = true;
  }
  if (!showItemEditDialog && itemOpen.current) itemOpen.current = false;
  const requestCloseItem = async () => {
    if (editingItem && JSON.stringify(editingItem) !== itemBaseline.current) {
      if (!(await askConfirm('Discard changes?'))) return;
    }
    handleCloseItemEdit();
  };
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'item_edit_dialog', initialWidth: 900, initialHeight: 700 });

  useEffect(() => {
    if (!showItemEditDialog) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestCloseItem();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showItemEditDialog, handleCloseItemEdit, editingItem]);

  useEffect(() => {
    if (!showItemEditDialog || !currentProjectPath || !window.electronAPI?.readFile) {
      setPowerIds([]);
      return;
    }
    let cancelled = false;
    void loadTextFiles(window.electronAPI, projectRoot(currentProjectPath), ['powers']).then((files) => {
      if (cancelled) return;
      const project = buildPowerProject(files);
      setPowerIds(project.powers.map((power) => power.id));
      setPowerNames(Object.fromEntries(project.powers.map((power) => [power.id, power.name])));
    });
    return () => {
      cancelled = true;
    };
  }, [showItemEditDialog, currentProjectPath]);

  if (!showItemEditDialog || !editingItem) return null;

  const role = editingItem.role || 'unspecified';
  const isUnspecified = role === 'unspecified';
  const isEquipment = role === 'equipment' || isUnspecified;
  const isConsumable = role === 'consumable';
  const isQuest = role === 'quest';
  const isResource = role === 'resource';
  const isBook = role === 'book';

  const dialogContent = (
    <div
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 50,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center gap-2 cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <RoleIcon roleId={role} className="w-5 h-5 text-orange-500 flex-shrink-0" />
        <h3 className="text-lg font-semibold flex-1">Edit Item: {editingItem.name || 'Unknown'}</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={requestCloseItem}
          className="h-6 w-6 text-foreground/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
        {/* Identity */}
        <CollapsibleSection title="Identity" icon={Tag}>
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground font-normal">Name</Label>
                <Input
                  value={editingItem.name}
                  onChange={(e) => updateEditingItemField('name', e.target.value)}
                  placeholder="Item name"
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground font-normal">Description</Label>
                <Input
                  value={editingItem.flavor}
                  onChange={(e) => updateEditingItemField('flavor', e.target.value)}
                  placeholder="Item description shown in tooltips"
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground font-normal">Icon</Label>
                <Input
                  value={editingItem.icon ?? ''}
                  onChange={(e) => updateEditingItemField('icon', e.target.value)}
                  placeholder="Icon ID or filename"
                  className="h-8"
                />
              </div>
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground block mb-2 font-normal">Category (Role)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ITEM_ROLE_SELECTIONS.filter((roleOpt) => roleOpt.id !== 'loot_groups').map((roleOpt) => {
                    const isActive = (editingItem.role || 'unspecified') === roleOpt.id;
                    // const meta = ITEM_ROLE_META[roleOpt.id];
                    return (
                      <Tooltip key={roleOpt.id} content={roleOpt.description} side="bottom">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 px-2 text-[11px] flex items-center gap-1.5 border-border bg-card transition-all ${isActive ? 'ring-1 ring-orange-500 border-orange-500 bg-orange-500/5' : 'hover:border-muted-foreground/60'}`}
                          onClick={() => updateEditingItemField('role', roleOpt.id)}
                        >
                          <RoleIcon roleId={roleOpt.id} className={`w-3.5 h-3.5 ${isActive ? 'text-orange-500' : 'text-muted-foreground'}`} />
                          <span className={isActive ? 'font-semibold' : ''}>{roleOpt.label}</span>
                        </Button>
                      </Tooltip>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-8 px-2 text-[11px] flex items-center gap-1.5 border-border bg-card transition-all ${(editingItem.role === 'unspecified' || !editingItem.role) ? 'ring-1 ring-orange-500 border-orange-500 bg-orange-500/5' : 'hover:border-muted-foreground/60'}`}
                    onClick={() => updateEditingItemField('role', 'unspecified')}
                  >
                    <Folder className={`w-3.5 h-3.5 ${(editingItem.role === 'unspecified' || !editingItem.role) ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    <span>Unspecified</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Level</Label>
                <Input
                  type="text"
                  value={editingItem.level}
                  onChange={(e) => updateEditingItemField('level', parseInt(e.target.value, 10) || 1)}
                  className="h-8 w-24"
                />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground font-normal">Quality (Rarity)</Label>
                  <Tooltip content="Controls rarity color & overlay; does not affect stats." side="right">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                {(() => {
                  const qualityOptions = [
                    { value: '', label: 'None', swatch: '#d4d4d8' },
                    { value: 'low', label: 'Low', swatch: 'rgb(127,127,127)' },
                    { value: 'normal', label: 'Normal', swatch: 'rgb(255,255,255)' },
                    { value: 'high', label: 'High', swatch: 'rgb(64,255,64)' },
                    { value: 'epic', label: 'Epic', swatch: 'rgb(64,128,255)' },
                    { value: 'rare', label: 'Rare', swatch: 'rgb(160,64,255)' },
                    { value: 'unique', label: 'Unique', swatch: 'rgb(255,192,64)' },
                    { value: 'one_time_use', label: 'One-time Use', swatch: 'rgb(64,255,255)' },
                    { value: 'currency', label: 'Currency', swatch: 'rgb(255,232,156)' }
                  ];
                  const currentValue = editingItem.quality || '';
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {qualityOptions.map((opt) => {
                          const isActive = currentValue === opt.value;
                          return (
                            <Button
                              key={opt.value ?? 'none'}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs flex items-center gap-2 border-border bg-card text-foreground hover:border-muted-foreground/60"
                              onClick={() => updateEditingItemField('quality', opt.value)}
                              style={isActive ? { borderColor: opt.swatch } : undefined}
                            >
                              <span
                                className="h-3 w-3 rounded-full border border-border"
                                style={{ backgroundColor: opt.swatch }}
                              ></span>
                              <span className="truncate">{opt.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Trade and Inventory Properties */}
        <CollapsibleSection title="Trade and Inventory Properties" icon={Coins}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="md:col-span-1">
              {(() => {
                const noStash = editingItem.no_stash || 'ignore';
                const allowPrivate = !(noStash === 'private' || noStash === 'all');
                const allowShared = !(noStash === 'shared' || noStash === 'all');
                const updateStash = (nextAllowPrivate: boolean, nextAllowShared: boolean) => {
                  let next: 'ignore' | 'private' | 'shared' | 'all';
                  if (nextAllowPrivate && nextAllowShared) next = 'ignore';
                  else if (!nextAllowPrivate && nextAllowShared) next = 'private';
                  else if (nextAllowPrivate && !nextAllowShared) next = 'shared';
                  else next = 'all';
                  updateEditingItemField('no_stash', next);
                };
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Stash</span>
                      <Tooltip content="Where this can be stored?" side="right">
                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                      </Tooltip>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="flex items-center gap-2 text-xs font-normal text-foreground">
                        <Checkbox
                          className="h-4 w-4"
                          checked={allowPrivate}
                          onCheckedChange={(checked) => updateStash(checked === true, allowShared)}
                        />
                        <span className="leading-tight">
                          Private stash
                          <span className="block text-muted-foreground text-[11px]">Character-only storage</span>
                        </span>
                      </Label>
                      <Label className="flex items-center gap-2 text-xs font-normal text-foreground">
                        <Checkbox
                          className="h-4 w-4"
                          checked={allowShared}
                          onCheckedChange={(checked) => updateStash(allowPrivate, checked === true)}
                        />
                        <span className="leading-tight">
                          Shared stash
                          <span className="block text-muted-foreground text-[11px]">Account-wide storage</span>
                        </span>
                      </Label>
                    </div>
                    {editingItem.quest_item && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded px-2 py-1">
                        Quest items are not stashable by default. Adjust the checkboxes above if you want to allow stashing this quest item.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="md:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground font-normal">Buy Price</Label>
                      <Tooltip content="0 = vendors won't buy this item (unsellable)." side="right">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      </Tooltip>
                    </div>
                    <Input
                      type="text"
                      value={editingItem.price ?? ''}
                      onChange={(e) => updateEditingItemField('price', e.target.value)}
                      placeholder="10"
                      className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                  <div>
                    {(() => {
                      const autoSell = editingItem.price_sell === '0' || editingItem.price_sell === '' || editingItem.price_sell === undefined;
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground font-normal">Sell Price</Label>
                              <Tooltip content="0 = use automatic sell price (price * vendor_ratio_sell)." side="right">
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              </Tooltip>
                            </div>
                            <Label className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                              <Checkbox
                                className="h-3.5 w-3.5"
                                checked={autoSell}
                                onCheckedChange={(checked) => {
                                  if (checked === true) {
                                    updateEditingItemField('price_sell', '0');
                                  } else {
                                    const fallbackValue = editingItem.price_sell && editingItem.price_sell !== '0'
                                      ? editingItem.price_sell
                                      : (editingItem.price && Number(editingItem.price) > 0 ? Math.max(1, Number(editingItem.price) / 2) : 1);
                                    updateEditingItemField('price_sell', fallbackValue.toString());
                                  }
                                }}
                              />
                              Use automatic sell price
                            </Label>
                          </div>
                          <Input
                            type="text"
                            value={editingItem.price_sell ?? ''}
                            onChange={(e) => updateEditingItemField('price_sell', e.target.value)}
                            placeholder="5"
                            className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={autoSell}
                          />
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-normal">Price per Level</Label>
                  <Input
                    type="text"
                    value={editingItem.price_per_level ?? ''}
                    onChange={(e) => updateEditingItemField('price_per_level', e.target.value)}
                    placeholder="10"
                    className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground font-normal">Max stack size</Label>
                    <Tooltip content="Maximum items per stack. 1 = no stacking." side="right">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <Input
                    type="text"
                    value={editingItem.max_quantity}
                    onChange={(e) => updateEditingItemField('max_quantity', parseInt(e.target.value, 10) || 1)}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Resource-specific */}
        {isResource && (
          <CollapsibleSection title="Resource" icon={Layers}>
            <div className="grid sm:grid-cols-2 gap-2">
              {(Object.keys(RESOURCE_SUBTYPE_META) as Array<Exclude<ItemResourceSubtype, ''>>).map((key) => {
                const meta = RESOURCE_SUBTYPE_META[key];
                const isActive = editingItem.resourceSubtype === key;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    aria-pressed={isActive}
                    onClick={() => updateEditingItemField('resourceSubtype', key)}
                    className={`h-auto text-left border rounded-md px-3 py-2 transition-colors ${isActive ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30' : 'border-border hover:bg-muted/60'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      <Check className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100 text-purple-500' : 'opacity-0'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{meta.hint}</p>
                  </Button>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Equipment and Requirements */}
        {isEquipment && (
          <CollapsibleSection title="Equipment and Requirements" icon={Shield}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Item Type (equipment slot)</Label>
                <Input
                  value={editingItem.item_type}
                  onChange={(e) => updateEditingItemField('item_type', e.target.value)}
                  placeholder="items/types.txt ID"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Equip Flags</Label>
                <Input
                  value={editingItem.equip_flags}
                  onChange={(e) => updateEditingItemField('equip_flags', e.target.value)}
                  placeholder="flag1,flag2"
                  className="h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Requires Level</Label>
                <Input
                  type="number"
                  value={editingItem.requires_level}
                  onChange={(e) => updateEditingItemField('requires_level', parseInt(e.target.value) || 0)}
                  min={0}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Requires Stat</Label>
                <Input
                  value={editingItem.requires_stat}
                  onChange={(e) => updateEditingItemField('requires_stat', e.target.value)}
                  placeholder="physical,6"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Requires Class</Label>
                <Input
                  value={editingItem.requires_class}
                  onChange={(e) => updateEditingItemField('requires_class', e.target.value)}
                  placeholder="warrior"
                  className="h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Disable Slots</Label>
                <Input
                  value={editingItem.disable_slots}
                  onChange={(e) => updateEditingItemField('disable_slots', e.target.value)}
                  placeholder="slot1,slot2"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-normal">GFX (Animation)</Label>
                <Input
                  value={editingItem.gfx}
                  onChange={(e) => updateEditingItemField('gfx', e.target.value)}
                  placeholder="animations/item.txt"
                  className="h-8"
                />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Bonuses and Effects */}
        {isEquipment && (
          <CollapsibleSection title="Bonuses and Effects" icon={Sparkles}>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Bonus (stat bonuses)</Label>
              <Input
                value={editingItem.bonus}
                onChange={(e) => updateEditingItemField('bonus', e.target.value)}
                placeholder="hp,50 or speed,10"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Bonus Power Level</Label>
              <Input
                value={editingItem.bonus_power_level}
                onChange={(e) => updateEditingItemField('bonus_power_level', e.target.value)}
                placeholder="power_id,level"
                className="h-8"
              />
            </div>
          </CollapsibleSection>
        )}

        {/* Usage and Power */}
        {(isEquipment || isConsumable) && (
          <CollapsibleSection title="Usage and Power" icon={Zap}>
            {isEquipment && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground font-normal">Damage (dmg)</Label>
                  <Input
                    value={editingItem.dmg}
                    onChange={(e) => updateEditingItemField('dmg', e.target.value)}
                    placeholder="melee,1,10"
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground font-normal">Absorb (abs)</Label>
                  <Input
                    value={editingItem.abs}
                    onChange={(e) => updateEditingItemField('abs', e.target.value)}
                    placeholder="1,5"
                    className="h-8"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Tooltip content="power= — the Flare [power] id this item casts when used">
                  <Label className="text-xs text-muted-foreground font-normal">Item Use</Label>
                </Tooltip>
                {powerIds.length > 0 ? (
                  <Select
                    value={editingItem.power || EMPTY_POWER}
                    onValueChange={(value) => updateEditingItemField('power', value === EMPTY_POWER ? '' : value)}
                  >
                    <SelectTrigger className="h-8 w-full px-2 text-sm">
                      <SelectValue placeholder="Select a power" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_POWER}>Select a power</SelectItem>
                      {(editingItem.power && !powerIds.includes(String(editingItem.power))
                        ? [String(editingItem.power), ...powerIds]
                        : powerIds
                      ).map((id) => (
                        <SelectItem key={id} value={id}>{powerNames[id] && powerNames[id] !== id ? `${powerNames[id]} (${id})` : id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={editingItem.power}
                    onChange={(e) => updateEditingItemField('power', e.target.value)}
                    placeholder="power_id"
                    className="h-8"
                  />
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Power Description</Label>
                <Input
                  value={editingItem.power_desc}
                  onChange={(e) => updateEditingItemField('power_desc', e.target.value)}
                  placeholder="Description text"
                  className="h-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Replace Power</Label>
              <Input
                value={editingItem.replace_power}
                onChange={(e) => updateEditingItemField('replace_power', e.target.value)}
                placeholder="old_power_id,new_power_id"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Script</Label>
              <Input
                value={editingItem.script}
                onChange={(e) => updateEditingItemField('script', e.target.value)}
                placeholder="scripts/item_script.txt"
                className="h-8"
              />
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Advanced Item Attributes" icon={Box} defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Type</Label>
              <Input
                value={editingItem.type ?? ''}
                onChange={(e) => updateEditingItemField('type', e.target.value)}
                placeholder="fixed or custom type"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Speed</Label>
              <Input
                value={editingItem.speed ?? ''}
                onChange={(e) => updateEditingItemField('speed', e.target.value)}
                placeholder="16"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Radius</Label>
              <Input
                value={editingItem.radius ?? ''}
                onChange={(e) => updateEditingItemField('radius', e.target.value)}
                placeholder="1.0"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Trait Elemental</Label>
              <Input
                value={editingItem.trait_elemental ?? ''}
                onChange={(e) => updateEditingItemField('trait_elemental', e.target.value)}
                placeholder="fire,ice,lightning"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Wall Power</Label>
              <Input
                value={editingItem.wall_power ?? ''}
                onChange={(e) => updateEditingItemField('wall_power', e.target.value)}
                placeholder="power_id"
                className="h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                className="h-4 w-4"
                checked={!!editingItem.use_hazard}
                onCheckedChange={(checked) => updateEditingItemField('use_hazard', checked === true)}
              />
              <Label className="text-xs text-muted-foreground font-normal">Use Hazard</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Post Power</Label>
              <Input
                value={editingItem.post_power ?? ''}
                onChange={(e) => updateEditingItemField('post_power', e.target.value)}
                placeholder="power_id"
                className="h-8"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground font-normal">Post Effect</Label>
              <Input
                value={editingItem.post_effect ?? ''}
                onChange={(e) => updateEditingItemField('post_effect', e.target.value)}
                placeholder="effect_id,delay,duration"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Requires HP/MP State</Label>
              <Input
                value={editingItem.requires_hpmp_state ?? ''}
                onChange={(e) => updateEditingItemField('requires_hpmp_state', e.target.value)}
                placeholder="all,not_percent,100,ignore,0"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Requires Item</Label>
              <Input
                value={editingItem.requires_item ?? ''}
                onChange={(e) => updateEditingItemField('requires_item', e.target.value)}
                placeholder="item_id"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">New State</Label>
              <Input
                value={editingItem.new_state ?? ''}
                onChange={(e) => updateEditingItemField('new_state', e.target.value)}
                placeholder="instant"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Modifier Damage</Label>
              <Input
                value={editingItem.modifier_damage ?? ''}
                onChange={(e) => updateEditingItemField('modifier_damage', e.target.value)}
                placeholder="multiply,175,175"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Lifespan</Label>
              <Input
                value={editingItem.lifespan ?? ''}
                onChange={(e) => updateEditingItemField('lifespan', e.target.value)}
                placeholder="800ms"
                className="h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                className="h-4 w-4"
                checked={!!editingItem.face}
                onCheckedChange={(checked) => updateEditingItemField('face', checked === true)}
              />
              <Label className="text-xs text-muted-foreground font-normal">Face</Label>
            </div>
          </div>
        </CollapsibleSection>

        {/* Quest-only */}
        {isQuest && (
          <CollapsibleSection title="Quest Item Settings" icon={Key}>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="quest_item_lock"
                checked={!!editingItem.quest_item}
                disabled
                className="h-4 w-4"
              />
              <Label htmlFor="quest_item_lock" className="text-xs font-normal text-muted-foreground">Quest item (always on for this role)</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Pickup Status</Label>
              <Input
                value={editingItem.pickup_status}
                onChange={(e) => updateEditingItemField('pickup_status', e.target.value)}
                placeholder="campaign_status_id"
                className="h-8"
              />
            </div>
          </CollapsibleSection>
        )}

        {/* Book / Lore */}
        <CollapsibleSection title="Book / Lore" icon={Book} defaultOpen={isBook || !!editingItem.book}>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={async () => {
                  const rel = editingItem.book || bookRelPath(String(editingItem.name || editingItem.id || 'book'));
                  const root = (currentProjectPath || '').replace(/\\/g, '/');
                  if (root && window.electronAPI?.writeFile && window.electronAPI?.readFile) {
                    const path = `${root}/${rel.replace(/^\//, '')}`;
                    const exists = await window.electronAPI.readFile(path);
                    if (!exists) await window.electronAPI.writeFile(path, DEFAULT_BOOK_TEMPLATE);
                  }
                  updateEditingItemField('book', rel);
                  updateEditingItemField('book_is_readable', true);
                  if (!editingItem.role || editingItem.role === 'unspecified') updateEditingItemField('role', 'book');
                  window.dispatchEvent(new CustomEvent(OPEN_BOOK_EVENT, { detail: rel }));
                }}
              >
                Make readable
              </Button>
              <span className="text-[11px] text-muted-foreground">Sets book and book_is_readable, and can create a book file.</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Book File</Label>
                <Input
                  value={editingItem.book || ''}
                  onChange={(e) => updateEditingItemField('book', e.target.value)}
                  placeholder="books/lore.txt"
                  className="h-8"
                />
              </div>
              <Label className="flex items-center gap-2 text-xs font-normal text-foreground mt-6">
                <Checkbox
                  className="h-4 w-4"
                  checked={!!editingItem.book_is_readable}
                  onCheckedChange={(checked) => updateEditingItemField('book_is_readable', checked === true)}
                />
                Show "Read" instead of "Use"
              </Label>
            </div>
        </CollapsibleSection>

        {/* Visual and Audio */}
        <CollapsibleSection title="Visual and Audio" icon={Volume2}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Sound FX</Label>
              <Input
                value={editingItem.soundfx}
                onChange={(e) => updateEditingItemField('soundfx', e.target.value)}
                placeholder="sounds/item.ogg"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Step FX (for armor)</Label>
              <Input
                value={editingItem.stepfx}
                onChange={(e) => updateEditingItemField('stepfx', e.target.value)}
                placeholder="step_fx_id"
                className="h-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-normal">Loot Animation</Label>
            <Input
              value={editingItem.loot_animation}
              onChange={(e) => updateEditingItemField('loot_animation', e.target.value)}
              placeholder="loot/animation.txt,min,max"
              className="h-8"
            />
          </div>
        </CollapsibleSection>

        {/* Randomization and Loot */}
        {!isQuest && (
          <CollapsibleSection title="Randomization and Loot" icon={Gift} className="border-none">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Randomizer Definition</Label>
                <Input
                  value={editingItem.randomizer_def}
                  onChange={(e) => updateEditingItemField('randomizer_def', e.target.value)}
                  placeholder="randomizer/def.txt"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-normal">Loot Drops Max</Label>
                <Input
                  type="number"
                  value={editingItem.loot_drops_max}
                  onChange={(e) => updateEditingItemField('loot_drops_max', parseInt(e.target.value) || 1)}
                  min={1}
                  className="h-8"
                />
              </div>
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Properties" icon={Layers} className="border-none">
          <EditorPropertyList
            properties={extraItemPropertyKeys((editingItem || {}) as Record<string, unknown>).map((key) => {
              const entry = ITEM_EXTRA_CATALOG.find((item) => item.id === key);
              const raw = editingItem ? editingItem[key] : '';
              return {
                key,
                label: entry?.label || key,
                value: raw == null ? '' : String(raw),
                tooltip: entry?.tooltip || key,
              };
            })}
            catalog={ITEM_EXTRA_CATALOG.filter((entry) => {
              const raw = editingItem ? editingItem[entry.id] : undefined;
              return raw == null || raw === '';
            }).map((entry) => ({
              id: entry.id,
              label: entry.label,
              tooltip: entry.tooltip,
              searchText: `${entry.label} ${entry.tooltip}`,
            }))}
            onChange={(key, value) => updateEditingItemField(key, value)}
            onAdd={(key) => updateEditingItemField(key, '')}
            onRemove={(key) => updateEditingItemField(key, '')}
          />
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t border-border/50 bg-background px-6 py-3 flex justify-between items-center">
        <div>
          <Tooltip content="Delete Item" side="top">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete Item"
                onClick={async (e) => {
                  if (!onDeleteItem) {
                    console.warn('ItemEditDialog: onDeleteItem is missing; cannot delete.');
                    return;
                  }
                  if (!editingItem || itemDeleteBusy.current) return;
                  itemDeleteBusy.current = true;
                  try {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const deleted = await onDeleteItem({
                      id: editingItem.id as number,
                      name: editingItem.name as string,
                      filePath: editingItem.filePath as string,
                    }, { left: r.left, top: r.top, width: r.width, height: r.height });
                    if (deleted !== false) handleCloseItemEdit();
                  } catch (err) {
                    console.error('Failed to delete item:', err);
                  } finally {
                    itemDeleteBusy.current = false;
                  }
                }}
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </Tooltip>
        </div>
        <Tooltip content="Save Item" side="top">
          <Button
            size="icon"
            onClick={handleSaveItemEdit}
            className="h-9 w-9 bg-orange-500 hover:bg-orange-600 text-white rounded-md shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            <Save className="h-5 w-5" />
          </Button>
        </Tooltip>
      </div>

      {/* Resize handle */}
      <ResizeHandle onMouseDown={handleResizeMouseDown} />
    </div>
  );

  return createPortal(dialogContent, document.body);
};

export default ItemEditDialog;
