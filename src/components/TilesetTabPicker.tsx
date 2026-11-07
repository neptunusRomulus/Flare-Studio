import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { tabLabel } from '@/editor/tabLabel';

export type PickerTab = { id: number; name?: string; tileset?: { fileName?: string | null } | null };

export default function TilesetTabPicker({ tabs, activeId, onSelect }: { tabs: PickerTab[]; activeId: number | null; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!tabs.length) return <div className="text-xs text-muted-foreground">No tabs</div>;
  const activeIdx = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const active = tabs[activeIdx];
  const label = tabLabel(active, activeIdx);

  return (
    <div ref={rootRef} className="relative w-40 shrink-0">
      <Tooltip content={label}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="w-40 h-7 flex items-center gap-2 px-2 rounded-md border border-border bg-background hover:bg-accent text-xs text-foreground"
        >
          <span className="flex-1 min-w-0 truncate text-left">{label}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
        </button>
      </Tooltip>
      {open && (
        <ul role="listbox" className="absolute left-0 top-full mt-1 z-50 w-56 max-h-72 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === active.id;
            return (
              <li key={tab.id} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); if (!isActive) onSelect(tab.id); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                >
                  <span className="truncate">{tabLabel(tab, idx)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
