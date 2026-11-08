import React from 'react';
import { Plus } from 'lucide-react';

type SpawnFieldOverlayProps = {
  active: boolean;
  onActivate: () => void;
  children: React.ReactNode;
};

/** When inactive, keeps the label visible and shows a dashed empty slot with a small + instead of a dark overlay. */
const SpawnFieldOverlay = ({ active, onActivate, children }: SpawnFieldOverlayProps) => (
  <div className="relative">
    <div className={active ? '' : 'pointer-events-none'}>{children}</div>
    {!active && (
      <button
        type="button"
        onClick={onActivate}
        aria-label="Add field"
        className="absolute top-5 left-0 right-0 bottom-0 z-10 flex min-h-7 items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background/80 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

export default SpawnFieldOverlay;
