import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import ResizeHandle from '@/components/ResizeHandle';

type Props = {
  id: string;
  title: string;
  onClose: () => void;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
};

/** Shared floating editor chrome (drag, resize, close). */
export default function StudioWindow({
  id, title, onClose, children,
  initialWidth = 860, initialHeight = 620, minWidth = 560, minHeight = 400,
}: Props) {
  const { position, size, dialogRef, handleHeaderMouseDown, handleResizeMouseDown } = useDraggableResizable({
    id, initialWidth, initialHeight, minWidth, minHeight,
  });
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={dialogRef}
      className="fixed flex flex-col rounded-lg border border-border bg-background shadow-2xl overflow-hidden"
      style={{ left: position.x, top: position.y, width: size.width, height: size.height, zIndex: 60 }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border cursor-move select-none" onMouseDown={handleHeaderMouseDown}>
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      <ResizeHandle onMouseDown={handleResizeMouseDown} />
    </div>,
    document.body,
  );
}
