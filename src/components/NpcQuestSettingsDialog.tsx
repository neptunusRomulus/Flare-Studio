import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Check, Save, X } from 'lucide-react';
import type { ItemSummary } from '@/utils/items';
import type { MapObject } from '@/types';

type NpcQuestSettingsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  itemsList: ItemSummary[];
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
};

const NpcQuestSettingsDialog = ({
  isOpen,
  onClose,
  itemsList,
  getEditingObjectProperty,
  updateEditingObjectProperty,
}: NpcQuestSettingsDialogProps) => {
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'npc_quest_settings_dialog', initialWidth: 700, initialHeight: 520, minWidth: 560, minHeight: 420 });

  if (!isOpen) return null;

  const currentSelectedItemId = Number(getEditingObjectProperty('quest_loot', '').split(',')[2]);

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
          <Check className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Quest Settings</h3>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Requires Status</label>
            <Input
              className="h-10 text-sm"
              value={getEditingObjectProperty('questRequiresStatus', '')}
              onChange={(e) => updateEditingObjectProperty('questRequiresStatus', e.target.value || null)}
              placeholder="e.g. quest_started"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Set Status On Accept</label>
            <Input
              className="h-10 text-sm"
              value={getEditingObjectProperty('questSetStatus', '')}
              onChange={(e) => updateEditingObjectProperty('questSetStatus', e.target.value || null)}
              placeholder="e.g. quest_accepted"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Quest Loot</label>
          <Input
            className="h-10 text-sm"
            value={getEditingObjectProperty('quest_loot', '')}
            onChange={(e) => updateEditingObjectProperty('quest_loot', e.target.value || null)}
            placeholder="status,not_status,item_id"
          />
          <p className="text-xs text-muted-foreground mt-1">Format: status,not_status,item_id (one line per entry).</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Quest Reward Item</p>
              <p className="text-xs text-muted-foreground">Select an item created in the Items layer.</p>
            </div>
            <div className="text-xs text-muted-foreground">Selected: #{Number.isFinite(currentSelectedItemId) ? currentSelectedItemId : 'none'}</div>
          </div>

          {itemsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items available. Create items in the Items layer to use them as quest rewards.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {itemsList.map((item) => {
                const selected = currentSelectedItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const [status = '', notStatus = ''] = getEditingObjectProperty('quest_loot', '').split(',').map((part) => part.trim());
                      updateEditingObjectProperty('quest_loot', `${status},${notStatus},${item.id}`);
                    }}
                    className={`text-left rounded-md border p-3 transition-all ${selected ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40' : 'border-border bg-muted/20 hover:bg-muted/50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{item.name || `Item ${item.id}`}</span>
                      <span className="text-[11px] text-muted-foreground">#{item.id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{item.category || 'Unknown'} · {item.role}</div>
                  </button>
                );
              })}
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
    </div>,
    document.body,
  );
};

export default NpcQuestSettingsDialog;
