import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { AlertTriangle, Book, Box, Check, Coins, Gift, HelpCircle, Shield, Sparkles, Sword, Tag, Volume2, Zap } from 'lucide-react';
import { RESOURCE_SUBTYPE_META } from '@/editor/itemRoles';
import type { ItemResourceSubtype } from '@/editor/itemRoles';

type EditingItem = any;

type ItemEditDialogProps = {
  showItemEditDialog: boolean;
  editingItem: EditingItem | null;
  updateEditingItemField: (key: string, value: any) => void;
  handleCloseItemEdit: () => void;
  handleSaveItemEdit: () => void;
};

const ItemEditDialog = ({
  showItemEditDialog,
  editingItem,
  updateEditingItemField,
  handleCloseItemEdit,
  handleSaveItemEdit
}: ItemEditDialogProps) => (
  <Dialog open={showItemEditDialog} onOpenChange={(open) => !open && handleCloseItemEdit()}>
    <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
      <DialogHeader className="mb-2">
        <DialogTitle className="flex items-center gap-2">
          <Sword className="w-5 h-5 text-orange-500" />
          Edit Item: {editingItem?.name || 'Unknown'}
        </DialogTitle>
      </DialogHeader>
      
      {editingItem && (
        <div className="flex-1 overflow-y-auto pr-2 minimal-scroll">
          {(() => {
            const role = editingItem.role || 'unspecified';
            const isUnspecified = role === 'unspecified';
            const isEquipment = role === 'equipment' || isUnspecified;
            const isConsumable = role === 'consumable';
            const isQuest = role === 'quest';
            const isResource = role === 'resource';
            const isBook = role === 'book';
            return (
          <div className="space-y-4 pb-4">
          {/* Basic Identifier Properties */}
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-500" />
              Basic Identifier Properties
            </h4>
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
                        className="h-16"
                      />
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
          </div>

          {/* Trade and Inventory Properties */}
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Coins className="w-4 h-4 text-orange-500" />
          Trade and Inventory Properties
        </h4>
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
                        <Tooltip content="0 = vendors won’t buy this item (unsellable)." side="right">
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
          </div>

          {/* Resource-specific */}
          {isResource && (
            <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Box className="w-4 h-4 text-orange-500" />
                Resource
              </h4>
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
            </div>
          )}

          {/* Equipment and Requirement Properties */}
          {isEquipment && (
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" />
              Equipment and Requirements
            </h4>
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
          </div>
          )}

          {/* Status and Effect Properties (Bonuses) */}
          {isEquipment && (
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Bonuses and Effects
            </h4>
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
          </div>
          )}

              {/* Usage and Power Properties */}
              {(isEquipment || isConsumable) && (
              <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" />
              Usage and Power (TODO IN FUTURE)
            </h4>
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
                {/* TODO: When equipment power presets are finalized, add configuration controls here. */}
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
          </div>
          )}

          {/* Quest-only */}
          {isQuest && (
            <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Quest Item Settings
              </h4>
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
            </div>
          )}

          {/* Book / Lore */}
          {isBook && (
            <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Book className="w-4 h-4 text-orange-500" />
                Book / Lore
              </h4>
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
                  Show &quot;Read&quot; instead of &quot;Use&quot;
                </label>
              </div>
            </div>
          )}

          {/* Visual and Audio Properties */}
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-orange-500" />
              Visual and Audio
            </h4>
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
          </div>

          {/* Randomization and Loot Properties */}
          {!isQuest && (
          <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Gift className="w-4 h-4 text-orange-500" />
              Randomization and Loot
            </h4>
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
          </div>
          )}

          </div>
            );
          })()}
        </div>
      )}
      
      <DialogFooter className="pt-2 border-t">
        <Button variant="outline" onClick={handleCloseItemEdit}>
          Cancel
        </Button>
        <Button onClick={handleSaveItemEdit} className="bg-orange-500 hover:bg-orange-600 text-white">
          Save Item
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ItemEditDialog;
