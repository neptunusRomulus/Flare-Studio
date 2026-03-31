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
        <ContextMenuItem onClick={onEdit} className="gap-1.5 text-xs px-2 py-1 h-6">
          <Pencil className="w-3 h-3" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate} className="gap-1.5 text-xs px-2 py-1 h-6">
          <Copy className="w-3 h-3" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator className="my-0.5" />
        <ContextMenuItem onClick={onDelete} className="gap-1.5 text-xs px-2 py-1 h-6 text-destructive focus:text-destructive">
          <Trash2 className="w-3 h-3" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
