import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Mouse, MouseRight } from 'lucide-react';

const tooltipContent = (
  <div className="flex flex-col gap-1 text-xs">
    <div className="flex items-center gap-1.5">
      <Mouse className="w-3 h-3" />
      <span>to edit</span>
    </div>
    <div className="flex items-center gap-1.5">
      <MouseRight className="w-3 h-3" />
      <span>to see Actions</span>
    </div>
  </div>
);

const ListItemTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Tooltip content={tooltipContent} side="right">
    {children}
  </Tooltip>
);

export default ListItemTooltip;
