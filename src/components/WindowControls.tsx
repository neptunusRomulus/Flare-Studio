import React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Square, X } from 'lucide-react';

type Props = {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
};

export default function WindowControls({ onMinimize, onMaximize, onClose }: Props) {
  return (
    <div className="flex no-drag">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMinimize}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
        aria-label="Minimize"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onMaximize}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
        aria-label="Maximize"
      >
        <Square className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
