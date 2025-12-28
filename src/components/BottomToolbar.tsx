import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import {
  Circle,
  Eraser,
  PaintBucket,
  Paintbrush2,
  Pen,
  Pipette,
  Square,
  Shapes,
  Mouse,
  Stamp,
  Target,
  Wand2,
  X
} from 'lucide-react';

import StampsPanel from './StampsPanel';

type StampEntry = {
  id: string;
  name: string;
  width: number;
  height: number;
};

type BottomToolbarProps = {
  bottomToolbarExpanded: boolean;
  setBottomToolbarNode: (node: HTMLDivElement | null) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  selectedTool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper';
  handleSelectTool: (tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => void;
  showBrushOptions: boolean;
  handleShowBrushOptions: () => void;
  handleHideBrushOptions: () => void;
  selectedBrushTool: 'brush' | 'bucket' | 'eraser' | 'clear';
  setSelectedBrushTool: React.Dispatch<React.SetStateAction<'brush' | 'bucket' | 'eraser' | 'clear'>>;
  showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
  hideTooltip: () => void;
  setShowClearLayerDialog: React.Dispatch<React.SetStateAction<boolean>>;
  
  showSelectionOptions: boolean;
  handleShowSelectionOptions: () => void;
  handleHideSelectionOptions: () => void;
  selectedSelectionTool: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular';
  setSelectedSelectionTool: React.Dispatch<React.SetStateAction<'rectangular' | 'magic-wand' | 'same-tile' | 'circular'>>;
  
  showShapeOptions: boolean;
  handleShowShapeOptions: () => void;
  handleHideShapeOptions: () => void;
  selectedShapeTool: 'rectangle' | 'circle' | 'line';
  setSelectedShapeTool: React.Dispatch<React.SetStateAction<'rectangle' | 'circle' | 'line'>>;
  
  stampMode: 'select' | 'create' | 'place';
  setStampMode: React.Dispatch<React.SetStateAction<'select' | 'create' | 'place'>>;
  newStampName: string;
  setNewStampName: React.Dispatch<React.SetStateAction<string>>;
  handleCreateStamp: () => void;
  stamps: StampEntry[];
  selectedStamp: string | null;
  handleStampSelect: (id: string) => void;
  handleDeleteStamp: (id: string) => void;
  stampsState?: unknown;
};

const BottomToolbar = ({
  bottomToolbarExpanded,
  setBottomToolbarNode,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  selectedTool,
  handleSelectTool,
  showBrushOptions,
  handleShowBrushOptions,
  handleHideBrushOptions,
  selectedBrushTool,
  setSelectedBrushTool,
  showTooltipWithDelay,
  hideTooltip,
  setShowClearLayerDialog,
  showSelectionOptions,
  handleShowSelectionOptions,
  handleHideSelectionOptions,
  selectedSelectionTool,
  setSelectedSelectionTool,
  showShapeOptions,
  handleShowShapeOptions,
  handleHideShapeOptions,
  selectedShapeTool,
  setSelectedShapeTool,
  stampMode,
  setStampMode,
  newStampName,
  setNewStampName,
  handleCreateStamp,
  stamps,
  selectedStamp,
  handleStampSelect,
  handleDeleteStamp
}: BottomToolbarProps) => {
  const renderBrushIcon = () => {
    switch (selectedBrushTool) {
      case 'bucket':
        return <PaintBucket className="w-4 h-4" />;
      case 'eraser':
        return <Eraser className="w-4 h-4" />;
      default:
        return <Paintbrush2 className="w-4 h-4" />;
    }
  };

  const renderSelectionIcon = () => {
    switch (selectedSelectionTool) {
      case 'magic-wand':
        return <Wand2 className="w-4 h-4" />;
      case 'same-tile':
        return <Target className="w-4 h-4" />;
      case 'circular':
        return <Circle className="w-4 h-4" />;
      default:
        return <Mouse className="w-4 h-4" />;
    }
  };

  const renderShapeIcon = () => {
    switch (selectedShapeTool) {
      case 'circle':
        return <Circle className="w-4 h-4" />;
      case 'line':
        return <Pen className="w-4 h-4" />;
      default:
        return <Shapes className="w-4 h-4" />;
    }
  };

  return (
  <div
    ref={setBottomToolbarNode}
    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onFocus={onFocus}
    onBlur={onBlur}
    tabIndex={bottomToolbarExpanded ? -1 : 0}
    aria-label="Tool selection"
  >
    <div
      className={`flex items-center bg-white/90 dark:bg-neutral-900/90 border border-border rounded-full shadow-md transition-all duration-300 ease-in-out ${bottomToolbarExpanded ? 'gap-1 px-2 py-1' : 'gap-0 px-1 py-1'}`}
    >
      <div
        className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'brush' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Button
          variant={selectedTool === 'brush' ? 'default' : 'ghost'}
          size="sm"
          className="w-7 h-7 p-1 rounded-full tool-button"
          onClick={() => handleSelectTool('brush')}
          onMouseEnter={(event) => {
            handleShowBrushOptions();
            showTooltipWithDelay('Brush Tool', event.currentTarget);
          }}
          onMouseLeave={() => {
            handleHideBrushOptions();
            hideTooltip();
          }}
        >
          {renderBrushIcon()}
        </Button>

        {showBrushOptions && (
          <div
            className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
            onMouseEnter={handleShowBrushOptions}
            onMouseLeave={handleHideBrushOptions}
          >
            <Button
              variant={selectedBrushTool === 'brush' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button"
              onClick={() => setSelectedBrushTool('brush')}
              onMouseEnter={(event) => showTooltipWithDelay('Brush Tool', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <Paintbrush2 className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedBrushTool === 'bucket' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button"
              onClick={() => setSelectedBrushTool('bucket')}
              onMouseEnter={(event) => showTooltipWithDelay('Bucket Fill', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <PaintBucket className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedBrushTool === 'eraser' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button"
              onClick={() => setSelectedBrushTool('eraser')}
              onMouseEnter={(event) => showTooltipWithDelay('Eraser', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <Eraser className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedBrushTool === 'clear' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button border-red-500 hover:border-red-600 hover:bg-red-50"
              onClick={() => setShowClearLayerDialog(true)}
              onMouseEnter={(event) => showTooltipWithDelay('Clear Layer', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <X className="w-3 h-3 text-red-500" />
            </Button>
          </div>
        )}
      </div>

      <div
        className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'selection' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Button
          variant={selectedTool === 'selection' ? 'default' : 'ghost'}
          size="sm"
          className="w-7 h-7 p-1 rounded-full tool-button"
          onClick={() => handleSelectTool('selection')}
          onMouseEnter={(event) => {
            handleShowSelectionOptions();
            showTooltipWithDelay('Selection Tool', event.currentTarget);
          }}
          onMouseLeave={() => {
            handleHideSelectionOptions();
            hideTooltip();
          }}
        >
          {renderSelectionIcon()}
        </Button>

        {showSelectionOptions && (
          <div
            className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
            onMouseEnter={handleShowSelectionOptions}
            onMouseLeave={handleHideSelectionOptions}
          >
            <Button
              variant={selectedSelectionTool === 'rectangular' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button"
              onClick={() => setSelectedSelectionTool('rectangular')}
              onMouseEnter={(event) => showTooltipWithDelay('Rectangular Selection', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <Square className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedSelectionTool === 'magic-wand' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button"
              onClick={() => setSelectedSelectionTool('magic-wand')}
              onMouseEnter={(event) => showTooltipWithDelay('Magic Wand', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <Wand2 className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedSelectionTool === 'same-tile' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button"
              onClick={() => setSelectedSelectionTool('same-tile')}
              onMouseEnter={(event) => showTooltipWithDelay('Select Same Tile', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <Target className="w-3 h-3" />
            </Button>
            <Button
              variant={selectedSelectionTool === 'circular' ? 'default' : 'ghost'}
              size="sm"
              className="w-6 h-6 p-1 rounded-full sub-tool-button"
              onClick={() => setSelectedSelectionTool('circular')}
              onMouseEnter={(event) => showTooltipWithDelay('Circular Select', event.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <Circle className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      <div
        className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'shape' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Button
          variant={selectedTool === 'shape' ? 'default' : 'ghost'}
          size="sm"
          className="w-7 h-7 p-1 rounded-full tool-button"
          onClick={() => handleSelectTool('shape')}
          onMouseEnter={(event) => { handleShowShapeOptions(); showTooltipWithDelay('Shape Tool', event.currentTarget); }}
          onMouseLeave={() => { handleHideShapeOptions(); hideTooltip(); }}
        >
          {renderShapeIcon()}
        </Button>

        {showShapeOptions && (
          <div
            className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
            onMouseEnter={handleShowShapeOptions}
            onMouseLeave={handleHideShapeOptions}
          >
            <Tooltip content="Rectangle Shape">
              <Button
                variant={selectedShapeTool === 'rectangle' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => setSelectedShapeTool('rectangle')}
              >
                <Square className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Circle Shape">
              <Button
                variant={selectedShapeTool === 'circle' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => setSelectedShapeTool('circle')}
              >
                <Circle className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Line Shape">
              <Button
                variant={selectedShapeTool === 'line' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => setSelectedShapeTool('line')}
              >
                <Pen className="w-3 h-3" />
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      <div
        className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'stamp' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Button
          variant={selectedTool === 'stamp' ? 'default' : 'ghost'}
          size="sm"
          className="w-7 h-7 p-1 rounded-full tool-button"
          onClick={() => handleSelectTool('stamp')}
          onMouseEnter={(event) => showTooltipWithDelay('Stamp Tool - Group tiles into a stamp and place them together', event.currentTarget)}
          onMouseLeave={hideTooltip}
        >
          <Stamp className="w-3 h-3" />
        </Button>

        {selectedTool === 'stamp' && (
          <StampsPanel
            stampMode={stampMode}
            setStampMode={setStampMode}
            newStampName={newStampName}
            setNewStampName={setNewStampName}
            handleCreateStamp={handleCreateStamp}
            stamps={stamps}
            selectedStamp={selectedStamp}
            handleStampSelect={handleStampSelect}
            handleDeleteStamp={handleDeleteStamp}
          />
        )}
      </div>

      <div
        className={`flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'eyedropper' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Button
          variant={selectedTool === 'eyedropper' ? 'default' : 'ghost'}
          size="sm"
          className="w-7 h-7 p-1 rounded-full tool-button"
          onClick={() => handleSelectTool('eyedropper')}
          onMouseEnter={(event) => showTooltipWithDelay('Eyedropper Tool - Pick a tile from the map to reuse', event.currentTarget)}
          onMouseLeave={hideTooltip}
        >
          <Pipette className="w-3 h-3" />
        </Button>
      </div>
    </div>
    </div>
    );
  };

  export default BottomToolbar;
