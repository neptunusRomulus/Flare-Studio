import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Plus, X, Tag } from 'lucide-react';

type StatusEditDialogProps = {
  open: boolean;
  onClose: () => void;
};

const StatusEditDialog = ({ open, onClose }: StatusEditDialogProps) => {
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown
  } = useDraggableResizable({ id: 'status_edit_dialog', initialWidth: 760, initialHeight: 520 });

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

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
        zIndex: 50,
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center gap-2 cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <Tag className="w-5 h-5 text-orange-500 flex-shrink-0" />
        <h3 className="text-lg font-semibold flex-1">Edit Status</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 text-foreground/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status Tag</label>
              <Input placeholder="status_tag" className="h-10" disabled />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Input placeholder="NPC / Quest / Item / Event / Power / Enemy / World" className="h-10" disabled />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea
                placeholder="Optional description"
                disabled
                className="min-h-[120px] w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-xs uppercase tracking-[0.2em] mb-2">Status editor placeholder</p>
          <p>This dialog is a visual placeholder for the new status editor. Data and save behavior will be implemented later.</p>
        </div>
      </div>

      <div className="border-t border-border/50 px-6 py-3 flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="default" size="sm" disabled>
          <Plus className="w-3 h-3 mr-1" />
          Save Status
        </Button>
      </div>

      <div
        className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeMouseDown}
      />
    </div>,
    document.body,
  );
};

export default StatusEditDialog;
