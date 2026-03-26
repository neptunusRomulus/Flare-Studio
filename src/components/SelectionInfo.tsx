import React from 'react';
import { Eraser, MousePointerBan, PaintBucket, SlidersHorizontal, Square } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import EventDialog from '@/components/EventDialog';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type Props = {
  editor: TileMapEditor | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  hasSelection: boolean;
  selectionCount: number;
  handleFillSelection: () => void;
  handleDeleteSelection: () => void;
  handleClearSelection: () => void;
};

type OverlayPosition = {
  left: number;
  top: number;
};

const SelectionInfo: React.FC<Props> = ({
  editor,
  canvasRef,
  containerRef,
  hasSelection,
  selectionCount,
  handleFillSelection,
  handleDeleteSelection,
  handleClearSelection
}) => {
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<OverlayPosition>({ left: 16, top: 16 });
  const [eventDialogOpen, setEventDialogOpen] = React.useState(false);
  const [eventLocation, setEventLocation] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!hasSelection || !editor) return;

    const updatePosition = () => {
      const selection = editor.getSelection();
      if (!selection.length) return;

      const firstCell = selection[0];
      const tilePoint = editor.getTileScreenPosition(firstCell.x, firstCell.y);
      const containerEl = containerRef.current;
      const canvasEl = canvasRef.current;
      const popoverEl = popoverRef.current;

      if (!containerEl || !canvasEl || !popoverEl) return;

      const containerRect = containerEl.getBoundingClientRect();
      const canvasRect = canvasEl.getBoundingClientRect();
      const popoverWidth = popoverEl.offsetWidth;
      const popoverHeight = popoverEl.offsetHeight;

      const anchorX = canvasRect.left - containerRect.left + tilePoint.x;
      const anchorY = canvasRect.top - containerRect.top + tilePoint.y;

      const margin = 8;
      const desiredTop = anchorY - popoverHeight - 14;
      const desiredLeft = anchorX - popoverWidth / 2;

      const clampedTop = Math.max(margin, Math.min(desiredTop, containerEl.clientHeight - popoverHeight - margin));
      const clampedLeft = Math.max(margin, Math.min(desiredLeft, containerEl.clientWidth - popoverWidth - margin));

      setPosition((prev) => {
        if (Math.abs(prev.left - clampedLeft) < 0.5 && Math.abs(prev.top - clampedTop) < 0.5) {
          return prev;
        }
        return { left: clampedLeft, top: clampedTop };
      });
    };

    updatePosition();
    const intervalId = window.setInterval(updatePosition, 100);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('resize', updatePosition);
    };
  }, [editor, hasSelection, selectionCount, canvasRef, containerRef]);

  const handleOpenEventDialog = () => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (selection.length > 0) {
      const firstCell = selection[0];
      setEventLocation({ x: firstCell.x, y: firstCell.y });
      setEventDialogOpen(true);
    }
  };

  return (
    <div
      ref={popoverRef}
      style={{ left: position.left, top: position.top }}
      className={`absolute z-10 rounded-md border border-border/70 bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur-sm transition-opacity duration-150 ${hasSelection ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-sm border border-border/80 bg-muted/40 px-1.5 py-1 text-xs font-medium text-foreground">
          <Square className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{hasSelection ? selectionCount : ''}</span>
        </div>

        <Tooltip content="Configure events for this location">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-foreground/80 hover:bg-muted hover:text-foreground"
            onClick={handleOpenEventDialog}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip
          content={(
            <span className="inline-flex items-center gap-2">
              <span>Fill selection with active tile</span>
              <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">ENTER</kbd>
            </span>
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-foreground/80 hover:bg-muted hover:text-foreground"
            onClick={handleFillSelection}
          >
            <PaintBucket className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip
          content={(
            <span className="inline-flex items-center gap-2">
              <span>Delete selected tiles</span>
              <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">DEL</kbd>
            </span>
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-foreground/80 hover:bg-muted hover:text-foreground"
            onClick={handleDeleteSelection}
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip
          content={(
            <span className="inline-flex items-center gap-2">
              <span>Clear selection</span>
              <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">ESC</kbd>
            </span>
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-foreground/80 hover:bg-muted hover:text-foreground"
            onClick={handleClearSelection}
          >
            <MousePointerBan className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      <EventDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} eventLocation={eventLocation} />
    </div>
  );
};

export default SelectionInfo;
