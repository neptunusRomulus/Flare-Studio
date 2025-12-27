import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X, MousePointer2, Mouse, Move, Circle } from 'lucide-react';

type Props = {
  tipsMinimized: boolean;
  setTipsMinimized: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
  isEnemyTabActive: boolean;
};

const CanvasTips: React.FC<Props> = ({ tipsMinimized, setTipsMinimized, setShowHelp, isEnemyTabActive }) => {
  if (isEnemyTabActive) return null;
  return (
    <div className="absolute top-4 left-4 z-20">
      <div
        className={`absolute inset-0 transition-all duration-300 ${tipsMinimized ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'}`}
      >
        <Tooltip content="Click to see help" side="right">
          <button
            className="w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-900 rounded-full border border-border shadow-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all duration-200 hover:scale-105"
            onClick={() => setTipsMinimized(false)}
            aria-label="Show help tips"
          >
            <HelpCircle className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </Tooltip>
      </div>

      <div
        className={`p-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-border shadow-lg transition-all duration-300 origin-top-left ${tipsMinimized ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'}`}
      >
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 w-6 h-6 p-0"
          onClick={() => setTipsMinimized(true)}
        >
          <X className="w-3 h-3" />
        </Button>

        <div className="space-y-2 pr-6">
          <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <MousePointer2 className="w-4 h-4" />
            <span>Left Click to Paint</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <Mouse className="w-4 h-4" />
            <span>Right Click to Delete</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <Move className="w-4 h-4" />
            <span>Spacebar + Mouse to Pan</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <div className="relative">
              <Mouse className="w-4 h-4" />
              <Circle className="w-2 h-2 absolute top-1 left-1.5 opacity-60" />
            </div>
            <span>Mouse Wheel to Zoom In-Out</span>
          </div>
          <button
            className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors w-full text-left mt-1 pt-1 border-t border-gray-100 dark:border-neutral-800"
            onClick={() => setShowHelp(true)}
          >
            <HelpCircle className="w-4 h-4 text-orange-400" />
            <span className="font-medium">Help and Documentation</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasTips;
