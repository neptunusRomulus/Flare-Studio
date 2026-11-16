import React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Square, X } from 'lucide-react';

type Props = {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
};

/** Window buttons used by the hover-reveal bar at the top edge (zen mode). */
export default function WindowControls({ onMinimize, onMaximize, onClose }: Props) {
  return (
    <div className="flex no-drag">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMinimize}
        className="h-7 w-7 rounded text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="Minimize"
      >
        <Minus className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onMaximize}
        className="h-7 w-7 rounded text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="Maximize"
      >
        <Square className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-7 w-7 rounded text-gray-500 hover:bg-gray-200 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
        aria-label="Close"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
