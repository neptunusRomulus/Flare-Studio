import type { MouseEvent as ReactMouseEvent, ReactNode, Ref } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import ResizeHandle from '@/components/ResizeHandle';

type Props = {
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  dialogRef: Ref<HTMLDivElement>;
  onHeaderMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onResizeMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

/** The floating window around every event form: drag bar, scrolling body, save button, resize grip. */
export default function EventDialogFrame({
  title, position, size, dialogRef, onHeaderMouseDown, onResizeMouseDown, onClose, onSave, children,
}: Props) {
  return (
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
        className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center justify-between cursor-move select-none"
        onMouseDown={onHeaderMouseDown}
      >
        <h3 className="text-lg font-semibold flex-1">{title}</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 text-foreground/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
        {children}
      </div>

      <div className="sticky bottom-0 border-t border-border/50 bg-background px-6 py-3 flex justify-end">
        <Tooltip content="Save event">
          <Button
            size="icon"
            onClick={onSave}
            className="h-7 w-7 text-foreground/80 hover:text-foreground hover:bg-muted"
          >
            <Save className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      <ResizeHandle onMouseDown={onResizeMouseDown} />
    </div>
  );
}
