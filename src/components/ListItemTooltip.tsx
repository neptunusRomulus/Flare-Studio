import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Mouse, MouseRight } from 'lucide-react';

const ListItemTooltip: React.FC<{ children: React.ReactNode; item: { id: number; name: string; description?: string }; showActions?: boolean }> = ({ children, item, showActions = true }) => {
  const content = (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium">{item.name}</div>
      {item.description && <div className="text-[10px] text-muted-foreground">{item.description}</div>}
      <div className="text-[9px] text-muted-foreground/40">ID: {item.id}</div>
      <div className="flex items-center gap-1 pt-0.5 border-t border-border/30">
        <Mouse className="w-3 h-3" />
        <span className="text-[10px]">to edit</span>
      </div>
      {showActions && (
      <div className="flex items-center gap-1">
        <MouseRight className="w-3 h-3" />
        <span className="text-[10px]">to see Actions</span>
      </div>
      )}
    </div>
  );

  return <Tooltip content={content} side="right">{children}</Tooltip>;
};

export default ListItemTooltip;
