import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Tooltip from '@/components/ui/tooltip';
import type { FlareLaunchMode } from '@/hooks/useFlareEngine';
import { ChevronDown, Play } from 'lucide-react';
import { FieldHint } from '@/components/ui/field-hint';

export type PlayButtonProps = {
  isRunning: boolean;
  lastError: string | null;
  hasProject: boolean;
  hasMap: boolean;
  onLaunch: (mode: FlareLaunchMode) => void;
};

/** Round green play control. Main click launches the current map; the chevron opens New Game. */
export default function PlayButton({ isRunning, lastError, hasProject, hasMap, onLaunch }: PlayButtonProps) {
  const [open, setOpen] = useState(false);
  const canPlayMap = hasProject && hasMap && !isRunning;
  const canNewGame = hasProject && !isRunning;
  const playClass = isRunning
    ? 'bg-orange-400 hover:bg-orange-400 text-white cursor-wait'
    : 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 text-white';

  const launch = (mode: FlareLaunchMode) => {
    setOpen(false);
    onLaunch(mode);
  };

  return (
    <div className="flex items-center no-drag">
      <Tooltip content={isRunning ? 'Flare engine is running' : 'Play Current Map'} side="bottom">
        <Button
          type="button"
          size="icon"
          disabled={isRunning}
          onClick={() => { if (canPlayMap) launch('current-map'); }}
          aria-label={isRunning ? 'Flare engine is running' : 'Play Current Map'}
          className={`h-8 w-8 rounded-l-full rounded-r-none shadow-sm ${playClass}`}
        >
          {isRunning ? (
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </Button>
      </Tooltip>
      <Popover open={open} onOpenChange={(next) => { if (!isRunning) setOpen(next); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            disabled={isRunning}
            aria-label="More play options"
            className={`h-8 w-6 rounded-l-none rounded-r-full border-l border-white/25 shadow-sm ${playClass}`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-56 p-1">
          <Button
            type="button"
            variant="ghost"
            disabled={!canPlayMap}
            onClick={() => launch('current-map')}
            className="h-auto w-full justify-start rounded-sm px-2 py-1.5 text-left"
          >
            <FieldHint hint="Save and launch into this map">
              <div className="font-medium">Play Current Map</div>
            </FieldHint>
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!canNewGame}
            onClick={() => launch('new-game')}
            className="h-auto w-full justify-start rounded-sm px-2 py-1.5 text-left"
          >
            <FieldHint hint="Save and play from the beginning">
              <div className="font-medium">New Game</div>
            </FieldHint>
          </Button>
          {lastError ? (
            <p className="px-2 py-1.5 text-xs text-destructive">{lastError}</p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
