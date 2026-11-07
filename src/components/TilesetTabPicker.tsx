import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { tabLabel } from '@/editor/tabLabel';

export type PickerTab = { id: number; name?: string; tileset?: { fileName?: string | null } | null };

/** Tileset tab dropdown. The list is portaled to body with fixed positioning and opens upward, so sidebar overflow can't clip it. */
export default function TilesetTabPicker({ tabs, activeId, onSelect }: { tabs: PickerTab[]; activeId: number | null; onSelect: (id: number) => void }) {
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (!tabs.length) return <div className="text-xs text-muted-foreground">No tabs</div>;
  const activeIdx = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const active = tabs[activeIdx];
  const label = tabLabel(active, activeIdx);

  const toggle = () => {
    if (open || !triggerRef.current) { setAnchor(null); return; }
    const r = triggerRef.current.getBoundingClientRect();
    setAnchor({ left: r.left, bottom: window.innerHeight - r.top + 4 });
  };

  return (
    <>
      <Tooltip content={label} side="bottom">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          className="w-28 h-6 shrink-0 flex items-center gap-1 px-1.5 rounded-md border border-input bg-background hover:bg-accent text-xs text-foreground"
        >
          <span className="flex-1 min-w-0 truncate text-left">{label}</span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
        </button>
      </Tooltip>
      {anchor && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          style={{ position: 'fixed', left: anchor.left, bottom: anchor.bottom }}
          className="z-[1000] w-48 max-h-72 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          {tabs.map((tab, idx) => {
            const isActive = tab.id === active.id;
            return (
              <li key={tab.id} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => { setAnchor(null); if (!isActive) onSelect(tab.id); }}
                  className={`w-full flex items-center px-2 py-1.5 text-xs text-left ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                >
                  <span className="truncate">{tabLabel(tab, idx)}</span>
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}
