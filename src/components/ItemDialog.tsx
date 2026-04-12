import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { AlertTriangle, Apple, Book, Check, Key, Layers, Package, Sheet, Sword, X, Coins } from 'lucide-react';
import { ITEM_ROLE_META, ITEM_ROLE_SELECTIONS } from '@/editor/itemRoles';
import type { ItemRole } from '@/editor/itemRoles';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';

type ItemDialogState = {
  name: string;
  role: ItemRole;
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
  onFieldChange: (key: 'name' | 'role', value: string) => void;
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
}: ItemDialogProps) => {
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'item_dialog', initialWidth: 450, initialHeight: 550, minWidth: 380, minHeight: 400 });

  useEffect(() => {
    if (!itemDialogState) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [itemDialogState, onClose]);

  if (!itemDialogState) return null;

  const getRoleIcon = (role: ItemRole) => {
    switch (role) {
      case 'equipment': return Sword;
      case 'consumable': return Apple;
      case 'quest': return Key;
      case 'resource': return Layers;
      case 'book': return Book;
      case 'loot_groups': return Sheet;
      default: return Sword;
    }
  };

  const getCategoryIconColor = (role: ItemRole, isActive: boolean) => {
    if (role === 'loot_groups') return 'text-white';
    switch (role) {
      case 'equipment': return isActive ? 'text-orange-600' : 'text-orange-500';
      case 'consumable': return isActive ? 'text-emerald-600' : 'text-emerald-500';
      case 'quest': return isActive ? 'text-amber-600' : 'text-amber-500';
      case 'resource': return isActive ? 'text-purple-600' : 'text-purple-500';
      case 'book': return isActive ? 'text-blue-600' : 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };



  const selectedRoleMeta = ITEM_ROLE_META[itemDialogState.role];

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
        className="flex items-center justify-between p-4 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <h3 className="font-semibold flex items-center gap-2">
          <Sword className="w-5 h-5 text-orange-500" />
          Add Item
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="w-6 h-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
            <label className="block text-sm font-medium mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={itemDialogState.name}
              onChange={(event) => onFieldChange('name', event.target.value)}
              placeholder="ex. Iron Helmet"
            />
          </div>


          <div>
            <div className="flex items-center justify-between gap-4 mb-2">
              <label className="block text-sm font-medium">Category</label>
              {selectedRoleMeta?.description ? (
                <span className="text-xs text-muted-foreground">{selectedRoleMeta.description}</span>
              ) : null}
            </div>
            <div className="inline-grid grid-cols-3 gap-2">
              {ITEM_ROLE_SELECTIONS.filter((roleOption) => roleOption.id !== 'loot_groups').map((roleOption) => {
                const isActive = itemDialogState.role === roleOption.id;
                const RoleIcon = getRoleIcon(roleOption.id);
                return (
                  <Tooltip key={roleOption.id} content={roleOption.label} side="top" className="h-9 w-9 inline-flex items-center justify-center">
                    <button
                      type="button"
                      aria-label={roleOption.label}
                      onClick={() => {
                        onFieldChange('role', roleOption.id);
                      }}
                      className={`flex aspect-square h-9 w-9 items-center justify-center rounded-md border transition-colors ${isActive ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30' : 'border-border hover:bg-muted/60'}`}
                    >
                      <RoleIcon className={`w-3.5 h-3.5 ${getCategoryIconColor(roleOption.id, isActive)}`} />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="block text-sm font-semibold mb-2">Item Groups</div>
            <div className="inline-grid grid-cols-3 gap-2">
              {ITEM_ROLE_SELECTIONS.filter((roleOption) => roleOption.id === 'loot_groups').map((roleOption) => {
                const isActive = itemDialogState.role === roleOption.id;
                const RoleIcon = getRoleIcon(roleOption.id);
                return (
                  <Tooltip key={roleOption.id} content={roleOption.label} side="top" className="h-9 w-9 inline-flex items-center justify-center">
                    <button
                      type="button"
                      aria-label={roleOption.label}
                      onClick={() => {
                        onFieldChange('role', roleOption.id);
                      }}
                      className={`flex aspect-square h-9 w-9 items-center justify-center rounded-md border transition-colors ${isActive ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30' : 'border-border hover:bg-muted/60'}`}
                    >
                      <RoleIcon className={`w-3.5 h-3.5 ${getCategoryIconColor(roleOption.id, isActive)}`} />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Resource subcategory selection removed: selecting 'resource' will not show subtype UI */}

          {itemDialogError && (
            <div className="text-sm text-red-500">
              {itemDialogError}
            </div>
          )}
      </div>

      <div className="flex items-center justify-end gap-2 p-4 border-t border-border relative">
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
        <Button size="icon" onClick={onSubmit} aria-label="Save item">
          <Check className="w-4 h-4" />
        </Button>
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

export default ItemDialog;
