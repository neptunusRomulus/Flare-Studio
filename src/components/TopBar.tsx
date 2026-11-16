import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Undo2, Redo2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CanvasTipsButton, CanvasTipsPanel } from '@/components/CanvasTips';
import PlayButton, { type PlayButtonProps } from '@/components/PlayButton';

type Props = {
  toolbarExpanded: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: (event?: React.FocusEvent<HTMLDivElement>) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  tipsMinimized: boolean;
  setTipsMinimized: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
  isEnemyTabActive: boolean;
  play?: PlayButtonProps;
};

const TopBar: React.FC<Props> = ({
  toolbarExpanded,
  containerRef,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  handleUndo,
  handleRedo,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  tipsMinimized,
  setTipsMinimized,
  setShowHelp,
  isEnemyTabActive,
  play,
}) => (
  <div
    ref={containerRef}
    className="absolute top-2 right-2 z-10 flex items-center gap-2"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onFocus={onFocus}
    onBlur={onBlur}
    tabIndex={toolbarExpanded ? -1 : 0}
    aria-label="Map controls"
  >
    {play ? <PlayButton {...play} /> : null}
    <div className="relative">
      <div
        className={`flex items-center bg-white/90 dark:bg-neutral-900/90 border border-border rounded-full shadow-lg transition-all duration-300 ease-in-out ${toolbarExpanded ? 'px-2 py-1' : 'px-1 py-1'}`}
      >
        <div
          className={`flex items-center gap-1 transition-all duration-300 ease-out ${toolbarExpanded ? 'opacity-100' : 'opacity-90'}`}
        >
          <Tooltip content="Undo (Ctrl+Z)" side="bottom">
            <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-full" onClick={handleUndo}>
              <Undo2 className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Y)" side="bottom">
            <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-full" onClick={handleRedo}>
              <Redo2 className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Zoom the map in (wheel)" side="bottom">
            <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-full" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Zoom the map out (wheel)" side="bottom">
            <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-full" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Reset map zoom" side="bottom">
            <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-full" onClick={handleResetZoom}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </Tooltip>
          {isEnemyTabActive ? null : (
            <CanvasTipsButton
              tipsMinimized={tipsMinimized}
              setTipsMinimized={setTipsMinimized}
            />
          )}
        </div>
      </div>
      {isEnemyTabActive ? null : (
        <CanvasTipsPanel
          tipsMinimized={tipsMinimized}
          setTipsMinimized={setTipsMinimized}
          setShowHelp={setShowHelp}
          className="absolute inset-x-0 top-full"
        />
      )}
    </div>
  </div>
);

export default TopBar;
