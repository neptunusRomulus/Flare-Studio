import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Apple, Book, Box, Check, ChevronDown, ChevronRight, Coins, Folder, Gift, HelpCircle, Key, Layers, Save, Shield, Sparkles, Sword, Tag, Trash2, Volume2, X, Zap } from 'lucide-react';
import { ITEM_ROLE_META, ITEM_ROLE_SELECTIONS, RESOURCE_SUBTYPE_META } from '@/editor/itemRoles';
import type { ItemResourceSubtype } from '@/editor/itemRoles';

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
  onDeleteItem?: (item: { id: number; name: string; filePath: string }) => Promise<void>;
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
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between group py-1"
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

const ItemEditDialog = (props: ItemEditDialogProps) => {
  const {
    showItemEditDialog,
    editingItem,
    updateEditingItemField,
    handleCloseItemEdit,
    handleSaveItemEdit,
    onDeleteItem
  } = props;
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
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
      if (e.key === 'Escape') handleCloseItemEdit();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showItemEditDialog, handleCloseItemEdit]);

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
          onClick={handleCloseItemEdit}
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
                <label className="text-xs text-muted-foreground">ID</label>
                <Badge variant="secondary" className="w-fit text-xs px-2 py-1 border border-border bg-muted/60">
                  {editingItem.id}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={editingItem.name}
                  onChange={(e) => updateEditingItemField('name', e.target.value)}
                  placeholder="Item name"
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Description</label>
                <Input
                  value={editingItem.flavor}
                  onChange={(e) => updateEditingItemField('flavor', e.target.value)}
                  placeholder="Item description shown in tooltips"
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Icon</label>
                <Input
                  value={editingItem.icon ?? ''}
                  onChange={(e) => updateEditingItemField('icon', e.target.value)}
                  placeholder="Icon ID or filename"
                  className="h-8"
                />
              </div>
              <div className="pt-2">
                <label className="text-xs text-muted-foreground block mb-2">Category (Role)</label>
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
                <label className="text-xs text-muted-foreground">Level</label>
                <Input
                  type="text"
                  value={editingItem.level}
                  onChange={(e) => updateEditingItemField('level', parseInt(e.target.value, 10) || 1)}
                  className="h-8 w-24"
                />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground">Quality (Rarity)</label>
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
                      <label className="flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={allowPrivate}
                          onChange={(e) => updateStash(e.target.checked, allowShared)}
                        />
                        <span className="leading-tight">
                          Private stash
                          <span className="block text-muted-foreground text-[11px]">Character-only storage</span>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={allowShared}
                          onChange={(e) => updateStash(allowPrivate, e.target.checked)}
                        />
                        <span className="leading-tight">
                          Shared stash
                          <span className="block text-muted-foreground text-[11px]">Account-wide storage</span>
                        </span>
                      </label>
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
                      <label className="text-xs text-muted-foreground">Buy Price</label>
                      <Tooltip content="0 = vendors won't buy this item (unsellable)." side="right">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      </Tooltip>
                    </div>
                    <input
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
                              <label className="text-xs text-muted-foreground">Sell Price</label>
                              <Tooltip content="0 = use automatic sell price (price * vendor_ratio_sell)." side="right">
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              </Tooltip>
                            </div>
                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5"
                                checked={autoSell}
                                onChange={(e) => {
                                  if (e.target.checked) {
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
                            </label>
                          </div>
                          <input
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
                  <label className="text-xs text-muted-foreground">Price per Level</label>
                  <input
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
                    <label className="text-xs text-muted-foreground">Max stack size</label>
                    <Tooltip content="Maximum items per stack. 1 = no stacking." side="right">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <input
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
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateEditingItemField('resourceSubtype', key)}
                    className={`text-left border rounded-md px-3 py-2 transition-colors ${isActive ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30' : 'border-border hover:bg-muted/60'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      <Check className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100 text-purple-500' : 'opacity-0'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{meta.hint}</p>
                  </button>
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
                <label className="text-xs text-muted-foreground">Item Type (equipment slot)</label>
                <Input
                  value={editingItem.item_type}
                  onChange={(e) => updateEditingItemField('item_type', e.target.value)}
                  placeholder="items/types.txt ID"
                  className="h-8"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Equip Flags</label>
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
                <label className="text-xs text-muted-foreground">Requires Level</label>
                <Input
                  type="number"
                  value={editingItem.requires_level}
                  onChange={(e) => updateEditingItemField('requires_level', parseInt(e.target.value) || 0)}
                  min={0}
                  className="h-8"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Requires Stat</label>
                <Input
                  value={editingItem.requires_stat}
                  onChange={(e) => updateEditingItemField('requires_stat', e.target.value)}
                  placeholder="physical,6"
                  className="h-8"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Requires Class</label>
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
                <label className="text-xs text-muted-foreground">Disable Slots</label>
                <Input
                  value={editingItem.disable_slots}
                  onChange={(e) => updateEditingItemField('disable_slots', e.target.value)}
                  placeholder="slot1,slot2"
                  className="h-8"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">GFX (Animation)</label>
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
              <label className="text-xs text-muted-foreground">Bonus (stat bonuses)</label>
              <Input
                value={editingItem.bonus}
                onChange={(e) => updateEditingItemField('bonus', e.target.value)}
                placeholder="hp,50 or speed,10"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bonus Power Level</label>
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
                  <label className="text-xs text-muted-foreground">Damage (dmg)</label>
                  <Input
                    value={editingItem.dmg}
                    onChange={(e) => updateEditingItemField('dmg', e.target.value)}
                    placeholder="melee,1,10"
                    className="h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Absorb (abs)</label>
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
                <label className="text-xs text-muted-foreground">Power ID</label>
                <Input
                  value={editingItem.power}
                  onChange={(e) => updateEditingItemField('power', e.target.value)}
                  placeholder="power_id"
                  className="h-8"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Power Description</label>
                <Input
                  value={editingItem.power_desc}
                  onChange={(e) => updateEditingItemField('power_desc', e.target.value)}
                  placeholder="Description text"
                  className="h-8"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Replace Power</label>
              <Input
                value={editingItem.replace_power}
                onChange={(e) => updateEditingItemField('replace_power', e.target.value)}
                placeholder="old_power_id,new_power_id"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Script</label>
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
              <label className="text-xs text-muted-foreground">Type</label>
              <Input
                value={editingItem.type ?? ''}
                onChange={(e) => updateEditingItemField('type', e.target.value)}
                placeholder="fixed or custom type"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Speed</label>
              <Input
                value={editingItem.speed ?? ''}
                onChange={(e) => updateEditingItemField('speed', e.target.value)}
                placeholder="16"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Radius</label>
              <Input
                value={editingItem.radius ?? ''}
                onChange={(e) => updateEditingItemField('radius', e.target.value)}
                placeholder="1.0"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Trait Elemental</label>
              <Input
                value={editingItem.trait_elemental ?? ''}
                onChange={(e) => updateEditingItemField('trait_elemental', e.target.value)}
                placeholder="fire,ice,lightning"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Wall Power</label>
              <Input
                value={editingItem.wall_power ?? ''}
                onChange={(e) => updateEditingItemField('wall_power', e.target.value)}
                placeholder="power_id"
                className="h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!editingItem.use_hazard}
                onChange={(e) => updateEditingItemField('use_hazard', e.target.checked)}
              />
              <label className="text-xs text-muted-foreground">Use Hazard</label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Post Power</label>
              <Input
                value={editingItem.post_power ?? ''}
                onChange={(e) => updateEditingItemField('post_power', e.target.value)}
                placeholder="power_id"
                className="h-8"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Post Effect</label>
              <Input
                value={editingItem.post_effect ?? ''}
                onChange={(e) => updateEditingItemField('post_effect', e.target.value)}
                placeholder="effect_id,delay,duration"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Requires HP/MP State</label>
              <Input
                value={editingItem.requires_hpmp_state ?? ''}
                onChange={(e) => updateEditingItemField('requires_hpmp_state', e.target.value)}
                placeholder="all,not_percent,100,ignore,0"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Requires Item</label>
              <Input
                value={editingItem.requires_item ?? ''}
                onChange={(e) => updateEditingItemField('requires_item', e.target.value)}
                placeholder="item_id"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">New State</label>
              <Input
                value={editingItem.new_state ?? ''}
                onChange={(e) => updateEditingItemField('new_state', e.target.value)}
                placeholder="instant"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Modifier Damage</label>
              <Input
                value={editingItem.modifier_damage ?? ''}
                onChange={(e) => updateEditingItemField('modifier_damage', e.target.value)}
                placeholder="multiply,175,175"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Lifespan</label>
              <Input
                value={editingItem.lifespan ?? ''}
                onChange={(e) => updateEditingItemField('lifespan', e.target.value)}
                placeholder="800ms"
                className="h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!editingItem.face}
                onChange={(e) => updateEditingItemField('face', e.target.checked)}
              />
              <label className="text-xs text-muted-foreground">Face</label>
            </div>
          </div>
        </CollapsibleSection>

        {/* Quest-only */}
        {isQuest && (
          <CollapsibleSection title="Quest Item Settings" icon={Key}>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id="quest_item_lock"
                checked={!!editingItem.quest_item}
                disabled
                className="h-4 w-4"
              />
              <label htmlFor="quest_item_lock" className="text-xs text-muted-foreground">Quest item (always on for this role)</label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Pickup Status</label>
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
        {isBook && (
          <CollapsibleSection title="Book / Lore" icon={Book}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Book File</label>
                <Input
                  value={editingItem.book}
                  onChange={(e) => updateEditingItemField('book', e.target.value)}
                  placeholder="books/lore.txt"
                  className="h-8"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground mt-6">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={editingItem.book_is_readable}
                  onChange={(e) => updateEditingItemField('book_is_readable', e.target.checked)}
                />
                Show "Read" instead of "Use"
              </label>
            </div>
          </CollapsibleSection>
        )}

        {/* Visual and Audio */}
        <CollapsibleSection title="Visual and Audio" icon={Volume2}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Sound FX</label>
              <Input
                value={editingItem.soundfx}
                onChange={(e) => updateEditingItemField('soundfx', e.target.value)}
                placeholder="sounds/item.ogg"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Step FX (for armor)</label>
              <Input
                value={editingItem.stepfx}
                onChange={(e) => updateEditingItemField('stepfx', e.target.value)}
                placeholder="step_fx_id"
                className="h-8"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Loot Animation</label>
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
                <label className="text-xs text-muted-foreground">Randomizer Definition</label>
                <Input
                  value={editingItem.randomizer_def}
                  onChange={(e) => updateEditingItemField('randomizer_def', e.target.value)}
                  placeholder="randomizer/def.txt"
                  className="h-8"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Loot Drops Max</label>
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
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t border-border/50 bg-background px-6 py-3 flex justify-between items-center">
        <div>
          {!showDeleteConfirm ? (
            <Tooltip content="Delete Item" side="top">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-xs font-medium text-destructive">Delete this item?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-[10px]"
                onClick={async () => {
                  if (onDeleteItem && editingItem) {
                    await onDeleteItem({ 
                      id: editingItem.id as number, 
                      name: editingItem.name as string, 
                      filePath: editingItem.filePath as string 
                    });
                    handleCloseItemEdit();
                  }
                  setShowDeleteConfirm(false);
                }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px]"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
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
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
        title="Drag to resize"
      >
        <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};

export default ItemEditDialog;
