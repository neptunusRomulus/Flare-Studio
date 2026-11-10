import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { Plus } from 'lucide-react';

export type SearchablePaletteEntry = {
  id: string;
  label: string;
  tooltip?: string;
  searchText?: string;
};

type Props = {
  buttonLabel?: string;
  placeholder?: string;
  entries: SearchablePaletteEntry[];
  onSelect: (id: string) => void;
  emptyText?: string;
};

/** Searchable "+ Add property" menu shared by NPC properties and quest step conditions. */
const SearchablePalette = ({
  buttonLabel = 'Add property',
  placeholder = 'Search properties…',
  entries,
  onSelect,
  emptyText = 'No matches',
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const hay = `${entry.label} ${entry.tooltip || ''} ${entry.searchText || ''}`.toLowerCase();
      return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part));
    });
  }, [entries, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="h-7 px-2 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex items-center gap-1"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="w-3.5 h-3.5" />
        {buttonLabel}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-md border border-border bg-background shadow-md overflow-hidden">
          <Input
            ref={inputRef}
            className="h-8 text-xs rounded-none border-0 border-b border-border"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</p>
            ) : (
              visible.map((entry) => (
                <Tooltip key={entry.id} content={entry.tooltip || entry.label}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => {
                      onSelect(entry.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {entry.label}
                  </button>
                </Tooltip>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchablePalette;
