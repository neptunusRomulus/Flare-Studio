import React from 'react';
import Tooltip from '@/components/ui/tooltip';

type Props = { onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void };

/** Shared east-south resize corner; label lives in a Tooltip, not a native title. */
const ResizeHandle = ({ onMouseDown }: Props) => (
  <Tooltip content="Drag to resize">
    <div
      onMouseDown={onMouseDown}
      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
    >
      <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
    </div>
  </Tooltip>
);

export default ResizeHandle;
