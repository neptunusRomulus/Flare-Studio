import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  title: string;
  changedCount?: number;
  children: React.ReactNode;
  /** Keep a fixed min-height when collapsed so expanding siblings doesn't jump the layout. */
  defaultOpen?: boolean;
};

/** Nested Advanced accordion row. Collapsed by default; shows " · N" when there are non-default values. */
const NpcAdvancedSubSection = ({ title, changedCount = 0, children, defaultOpen = false }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-border/70 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2.5 py-1.5 flex items-center gap-2 text-xs font-semibold hover:bg-muted/40 rounded-md text-left"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        <span>
          {title}
          {!open && changedCount > 0 ? ` · ${changedCount}` : ''}
        </span>
      </button>
      {open && <div className="space-y-2 px-2.5 pb-2.5">{children}</div>}
    </div>
  );
};

export default NpcAdvancedSubSection;
