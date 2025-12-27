import React from 'react';
import { Square } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

type Props = {
  hasSelection: boolean;
  selectionCount: number;
  handleFillSelection: () => void;
  handleDeleteSelection: () => void;
  handleClearSelection: () => void;
};

const SelectionInfo: React.FC<Props> = ({ hasSelection, selectionCount, handleFillSelection, handleDeleteSelection, handleClearSelection }) => {
  return (
    <div className={`absolute bottom-4 left-32 z-10 p-2 rounded-md text-xs flex items-center gap-3 transition-opacity duration-200 ${hasSelection ? 'opacity-100 pointer-events-auto bg-orange-600/90 border border-orange-500 text-white' : 'opacity-0 pointer-events-none'}`}>
      <div className="flex items-center gap-2 font-mono">
        <Square className="w-4 h-4 text-orange-200" />
        <span>{hasSelection ? `${selectionCount} tiles selected` : ''}</span>
      </div>
      <div className={`flex items-center gap-1 ${hasSelection ? '' : 'pointer-events-none'}`}>
        <Tooltip content="Fill selection with active tile">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
            onClick={handleFillSelection}
          >
            Fill
          </Button>
        </Tooltip>
        <Tooltip content="Delete selected tiles (DEL)">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
            onClick={handleDeleteSelection}
          >
            Delete
          </Button>
        </Tooltip>
        <Tooltip content="Clear selection (ESC)">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
            onClick={handleClearSelection}
          >
            Clear
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default SelectionInfo;
