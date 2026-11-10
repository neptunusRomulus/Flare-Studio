import React from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { Loader2, MapPin, X } from 'lucide-react';
import type { NpcInstance } from '@/editor/npcInstances';

type NpcInstancesDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  npcName: string;
  instances: NpcInstance[];
  loading?: boolean;
};

/** Where a given NPC is placed across the project: one row per map + coordinates. */
const NpcInstancesDialog = ({ isOpen, onClose, npcName, instances, loading = false }: NpcInstancesDialogProps) => {
  const { position, size, dialogRef, handleHeaderMouseDown, handleResizeMouseDown } = useDraggableResizable({
    id: 'npc_instances_dialog',
    initialWidth: 380,
    initialHeight: 380,
    minWidth: 320,
    minHeight: 220,
  });

  if (!isOpen) return null;

  const frame = (
    <div
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 70,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
          <h3 className="font-semibold truncate">NPC instances</h3>
          <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-semibold shrink-0">
            {instances.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-transparent" onClick={onClose}>
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="px-4 pt-3 pb-2 border-b border-border/60">
        <div className="text-sm font-medium text-foreground truncate">{npcName || 'NPC'}</div>
        <div className="text-[11px] text-muted-foreground">Number of NPC instances total</div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning maps…
          </div>
        ) : instances.length === 0 ? (
          <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
            This NPC is not placed on any map yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {instances.map((instance) => (
              <li
                key={`${instance.mapFile}:${instance.x},${instance.y}:${instance.file}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2"
              >
                <span className="flex items-center gap-2 min-w-0 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{instance.mapTitle}</span>
                </span>
                <span className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground border border-border/70">
                  {instance.x}, {instance.y}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
        title="Drag to resize"
      >
        <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
      </div>
    </div>
  );

  return createPortal(frame, document.body);
};

export default NpcInstancesDialog;
