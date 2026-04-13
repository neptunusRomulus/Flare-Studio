import React from 'react';

type SpawnFieldOverlayProps = {
  active: boolean;
  onActivate: () => void;
  children: React.ReactNode;
};

const SpawnFieldOverlay = ({ active, onActivate, children }: SpawnFieldOverlayProps) => (
  <div className="relative">
    <div className={active ? '' : 'pointer-events-none'}>{children}</div>
    {!active && (
      <div
        className="absolute top-5 left-0 right-0 bottom-0 rounded-md bg-black/50 flex items-center justify-center cursor-pointer z-10 transition-opacity hover:bg-black/40"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onActivate(); }}
      >
        <span className="flex items-center gap-1 text-xs font-medium text-white/90">
          <span className="w-3 h-3 rounded-full bg-white/90 text-[10px] flex items-center justify-center">+</span>
          Add
        </span>
      </div>
    )}
  </div>
);

export default SpawnFieldOverlay;
