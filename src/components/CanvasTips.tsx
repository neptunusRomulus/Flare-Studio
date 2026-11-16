import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X, MousePointer2, Mouse, Move, Circle, SquareDashed } from 'lucide-react';
import { cn } from '@/lib/utils';

type TipsState = {
  tipsMinimized: boolean;
  setTipsMinimized: (v: boolean) => void;
};

type PanelProps = TipsState & {
  setShowHelp: (v: boolean) => void;
  className?: string;
};

export function CanvasTipsButton({ tipsMinimized, setTipsMinimized }: TipsState) {
  return (
    <Tooltip content="Canvas help" side="bottom">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-8 h-8 p-0 rounded-full transition-transform duration-200 hover:scale-110 focus-visible:scale-110"
        onClick={() => setTipsMinimized(!tipsMinimized)}
        aria-label={tipsMinimized ? 'Show canvas help' : 'Hide canvas help'}
        aria-expanded={!tipsMinimized}
      >
        <HelpCircle className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
}

export function CanvasTipsPanel({ tipsMinimized, setTipsMinimized, setShowHelp, className }: PanelProps) {
  if (tipsMinimized) return null;
  return (
    <div
      role="region"
      aria-label="Canvas help"
      className={cn(
        'relative z-30 mt-2 w-full p-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-border shadow-lg',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1 w-6 h-6 p-0"
        onClick={() => setTipsMinimized(true)}
        aria-label="Hide canvas help"
      >
        <X className="w-3 h-3" />
      </Button>

      <div className="space-y-2 pr-6">
        <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <MousePointer2 className="w-4 h-4 shrink-0" />
          <span>
            <kbd className="mr-1 rounded border border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-800 dark:text-gray-100">Left Click</kbd>
            to Paint
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <SquareDashed className="w-4 h-4 shrink-0" />
          <span>
            Hold
            {' '}
            <kbd className="mx-1 rounded border border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-800 dark:text-gray-100">CTRL</kbd>
            {' '}
            to Select
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <Move className="w-4 h-4 shrink-0" />
          <span>
            <kbd className="mr-1 rounded border border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-800 dark:text-gray-100">Spacebar</kbd>
            + Mouse to Pan
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <div className="relative shrink-0">
            <Mouse className="w-4 h-4" />
            <Circle className="w-2 h-2 absolute top-1 left-1.5 opacity-60" />
          </div>
          <span>
            <kbd className="mr-1 rounded border border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-800 dark:text-gray-100">Mouse Wheel</kbd>
            to Zoom
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-auto flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors w-full text-left mt-1 pt-1 border-t border-gray-100 dark:border-neutral-800"
          onClick={() => setShowHelp(true)}
        >
          <HelpCircle className="w-4 h-4 text-orange-400" />
          <span className="font-medium">Help</span>
        </Button>
      </div>
    </div>
  );
}
