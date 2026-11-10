import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Pencil, Copy, Trash2 } from 'lucide-react';

export type ElementType = 'npc' | 'enemy' | 'item' | 'event';

type ElementContextMenuProps = {
  elementType: ElementType;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: React.ReactNode;
};

const LABEL: Record<ElementType, string> = {
  npc: 'NPC',
  enemy: 'Enemy',
  item: 'Item',
  event: 'Event',
};

export default function ElementContextMenu({
  elementType,
  onEdit,
  onDuplicate,
  onDelete,
  children,
}: ElementContextMenuProps) {
  const label = LABEL[elementType];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[120px] p-0.5">
        <ContextMenuItem onSelect={onEdit} className="gap-1.5 text-xs px-2 py-1 h-6">
          <Pencil className="w-3 h-3" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate} className="gap-1.5 text-xs px-2 py-1 h-6">
          <Copy className="w-3 h-3" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator className="my-0.5" />
        <ContextMenuItem onSelect={onDelete} className="gap-1.5 text-xs px-2 py-1 h-6 text-destructive focus:text-destructive">
          <Trash2 className="w-3 h-3" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const MENU_CONTENT_CLASS = 'min-w-[120px] p-0.5 bg-popover text-popover-foreground rounded-md border shadow-md';
const MENU_ITEM_CLASS = 'relative flex cursor-default select-none items-center gap-1.5 rounded-sm text-xs px-2 py-1 h-6 outline-none hover:bg-accent hover:text-accent-foreground';

/** Same menu items as the sidebar, shown at a screen position (map pawns). */
export function ElementContextMenuPanel({
  open,
  x,
  y,
  onClose,
  onDuplicate,
  onDelete,
  onEdit,
}: {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`fixed z-50 ${MENU_CONTENT_CLASS}`}
      style={{ left: x, top: y }}
      role="menu"
    >
      {onEdit ? (
        <button type="button" className={`w-full ${MENU_ITEM_CLASS}`} role="menuitem" onClick={() => { onEdit(); onClose(); }}>
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      ) : null}
      <button type="button" className={`w-full ${MENU_ITEM_CLASS}`} role="menuitem" onClick={() => { onDuplicate(); onClose(); }}>
        <Copy className="w-3 h-3" />
        Duplicate
      </button>
      <div className="h-px bg-border my-0.5" />
      <button type="button" className={`w-full ${MENU_ITEM_CLASS} text-destructive focus:text-destructive`} role="menuitem" onClick={() => { onDelete(); onClose(); }}>
        <Trash2 className="w-3 h-3" />
        Delete
      </button>
    </div>
  );
}
