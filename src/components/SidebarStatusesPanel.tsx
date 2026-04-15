import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Box, Clock, GitBranch, Globe, Locate, Plus, Sparkles, Users } from 'lucide-react';

type StatusCategoryId = 'npc' | 'quest' | 'item' | 'event' | 'power' | 'enemy' | 'world';

type StatusCategory = {
  id: StatusCategoryId;
  label: string;
  icon: React.ReactNode;
};

const STATUS_CATEGORIES: StatusCategory[] = [
  { id: 'npc', label: 'NPC', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'quest', label: 'Quest', icon: <GitBranch className="w-3.5 h-3.5" /> },
  { id: 'item', label: 'Item', icon: <Box className="w-3.5 h-3.5" /> },
  { id: 'event', label: 'Event', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'power', label: 'Power', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'enemy', label: 'Enemy', icon: <Locate className="w-3.5 h-3.5" /> },
  { id: 'world', label: 'World', icon: <Globe className="w-3.5 h-3.5" /> },
];

const getCategoryHeaderStyles = (categoryId: StatusCategoryId) => {
  switch (categoryId) {
    case 'npc': return 'text-sky-500/80 hover:bg-sky-500/10';
    case 'quest': return 'text-amber-500/80 hover:bg-amber-500/10';
    case 'item': return 'text-lime-500/80 hover:bg-lime-500/10';
    case 'event': return 'text-violet-500/80 hover:bg-violet-500/10';
    case 'power': return 'text-fuchsia-500/80 hover:bg-fuchsia-500/10';
    case 'enemy': return 'text-rose-500/80 hover:bg-rose-500/10';
    case 'world': return 'text-cyan-500/80 hover:bg-cyan-500/10';
    default: return 'text-muted-foreground hover:bg-muted/30';
  }
};

const getCategoryColor = (categoryId: StatusCategoryId) => {
  switch (categoryId) {
    case 'npc': return 'text-sky-500';
    case 'quest': return 'text-amber-500';
    case 'item': return 'text-lime-500';
    case 'event': return 'text-violet-500';
    case 'power': return 'text-fuchsia-500';
    case 'enemy': return 'text-rose-500';
    case 'world': return 'text-cyan-500';
    default: return 'text-muted-foreground';
  }
};

type SidebarStatusesPanelProps = {
  onAddStatus: () => void;
};

const SidebarStatusesPanel = ({ onAddStatus }: SidebarStatusesPanelProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<StatusCategoryId>>(new Set());

  const toggleCategory = (categoryId: StatusCategoryId) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 border border-dashed border-border rounded-md overflow-y-auto">
        <div className="flex flex-col gap-0.5 px-1 py-1">
          {STATUS_CATEGORIES.map((category) => {
            const isExpanded = expandedCategories.has(category.id);
            return (
              <div key={category.id} className="flex flex-col w-full">
                <button
                  type="button"
                  className={`flex items-center gap-2 py-2 px-2 rounded transition-colors w-full ${getCategoryHeaderStyles(category.id)}`}
                  onClick={() => toggleCategory(category.id)}
                >
                  <span className={`w-5 h-5 flex items-center justify-center rounded-md ${isExpanded ? 'bg-white/10' : 'bg-white/5'}`}>
                    {category.icon}
                  </span>
                  <span className="flex-1 text-xs font-medium truncate">{category.label}</span>
                  <span className="text-[10px] opacity-70">(0)</span>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="rounded-md border border-border/50 bg-muted/50 px-3 py-3 text-[11px] text-muted-foreground italic">
                    No statuses exist yet in this category.
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center py-2">
        <Tooltip content="Add Status" side="bottom">
          <Button
            variant="default"
            size="sm"
            aria-label="Add Status"
            className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onAddStatus();
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            Status
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default SidebarStatusesPanel;
