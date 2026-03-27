import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Check, Sword, X } from 'lucide-react';
import { ITEM_ROLE_META, ITEM_ROLE_SELECTIONS, RESOURCE_SUBTYPE_META } from '@/editor/itemRoles';
import type { ItemResourceSubtype, ItemRole } from '@/editor/itemRoles';

type ItemDialogState = {
  name: string;
  role: ItemRole;
  resourceSubtype: ItemResourceSubtype;
};

type PendingDuplicateItem = {
  kind: 'same-role' | 'other-role';
  conflictRole: ItemRole;
  targetRole: ItemRole;
};

type ItemDialogProps = {
  itemDialogState: ItemDialogState | null;
  itemDialogError: string | null;
  pendingDuplicateItem: PendingDuplicateItem | null;
  onClose: () => void;
  onFieldChange: (key: keyof ItemDialogState, value: string) => void;
  onSubmit: () => void;
  onConfirmDuplicate: () => void;
  onClearDuplicate: () => void;
};

const ItemDialog = ({
  itemDialogState,
  itemDialogError,
  pendingDuplicateItem,
  onClose,
  onFieldChange,
  onSubmit,
  onConfirmDuplicate,
  onClearDuplicate
}: ItemDialogProps) => (
  <Dialog
    open={!!itemDialogState}
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    <DialogContent className="w-full sm:max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sword className="w-5 h-5 text-orange-500" />
          Add Item
        </DialogTitle>
        <DialogDescription>Create a new item definition.</DialogDescription>
      </DialogHeader>
      {itemDialogState && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={itemDialogState.name}
              onChange={(event) => onFieldChange('name', event.target.value)}
              placeholder="Health Potion"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">What is this item for?</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {ITEM_ROLE_SELECTIONS.map((roleOption) => {
                const isActive = itemDialogState.role === roleOption.id;
                const roleMeta = ITEM_ROLE_META[roleOption.id];
                return (
                  <button
                    key={roleOption.id}
                    type="button"
                    onClick={() => {
                      onFieldChange('role', roleOption.id);
                      if (roleOption.id !== 'resource') {
                        onFieldChange('resourceSubtype', '');
                      } else if (!itemDialogState.resourceSubtype) {
                        onFieldChange('resourceSubtype', 'material');
                      }
                    }}
                    className={`text-left border rounded-md px-3 py-2 transition-colors ${isActive ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30' : 'border-border hover:bg-muted/60'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.badgeClass}`}>
                        {roleMeta.label}
                      </span>
                      <Check className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100 text-orange-500' : 'opacity-0'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{roleOption.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {itemDialogState.role === 'resource' && (
            <div>
              <label className="block text-sm font-medium mb-1">Resource subtype</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(RESOURCE_SUBTYPE_META) as Array<Exclude<ItemResourceSubtype, ''>>).map((key) => {
                  const meta = RESOURCE_SUBTYPE_META[key];
                  const isActive = itemDialogState.resourceSubtype === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onFieldChange('resourceSubtype', key)}
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

          {itemDialogError && (
            <div className="text-sm text-red-500">
              {itemDialogError}
            </div>
          )}
        </div>
      )}
      <DialogFooter className="relative">
        {pendingDuplicateItem && (
          <div className="absolute -top-24 right-4 w-[280px]">
            <div className="rounded-md border border-amber-500/50 bg-background shadow-lg text-xs p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-foreground text-left">Heads up</div>
                <div className="mt-1 space-y-1 text-left">
                  {pendingDuplicateItem.kind === 'same-role' ? (
                    <div className="text-[11px] text-muted-foreground">
                      An item with this name already exists in this role.
                    </div>
                  ) : (
                    <>
                      <div className="text-[11px] text-muted-foreground leading-snug">
                        Same name in another role. Create anyway?
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-snug">
                        Existing: {ITEM_ROLE_META[pendingDuplicateItem.conflictRole]?.label || pendingDuplicateItem.conflictRole}<br />
                        New: {ITEM_ROLE_META[pendingDuplicateItem.targetRole]?.label || pendingDuplicateItem.targetRole}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearDuplicate}>
                  <X className="w-3.5 h-3.5" />
                </Button>
                {pendingDuplicateItem.kind === 'other-role' && (
                  <Button size="icon" className="h-7 w-7 bg-amber-500 text-white hover:bg-amber-600" onClick={onConfirmDuplicate}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          Add Item
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ItemDialog;
