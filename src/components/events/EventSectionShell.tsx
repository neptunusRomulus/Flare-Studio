import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  id: string;
};

/** Collapsible card used by every section of the event dialog. */
export default function EventSectionShell({ title, icon: Icon, isExpanded, onToggle, children, id }: Props) {
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden mb-4 shadow-sm" id={`section-${id}`}>
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className="w-full h-auto flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 transition-colors select-none rounded-none font-normal"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold tracking-wide">{title}</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </Button>
      {isExpanded && <div className="p-4 bg-background border-t border-border/10 animate-in slide-in-from-top-2 duration-200">{children}</div>}
    </div>
  );
}
