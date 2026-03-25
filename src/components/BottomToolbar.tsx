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
  X,
  SquareDashed
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
  setShowClearLayerDialog: React.Dispatch<React.SetStateAction<boolean>>;
  
  showSelectionOptions: boolean;
  handleShowSelectionOptions: () => void;
  handleHideSelectionOptions: () => void;
  selectedSelectionTool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular';
  setSelectedSelectionTool: React.Dispatch<React.SetStateAction<'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular'>>;
  
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
      case 'multi-cell':
        return <SquareDashed className="w-4 h-4" />;
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
        <Tooltip content="Brush Tool" side="left">
          <Button
            variant={selectedTool === 'brush' ? 'default' : 'ghost'}
            size="sm"
            className="w-7 h-7 p-1 rounded-full tool-button"
            onClick={() => handleSelectTool('brush')}
            onMouseEnter={() => {
              handleShowBrushOptions();
            }}
            onMouseLeave={() => {
              handleHideBrushOptions();
            }}
          >
            {renderBrushIcon()}
          </Button>
        </Tooltip>

        {showBrushOptions && (
          <div
            className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ animation: 'fadeInUp 0.2s ease-out' }}
            onMouseEnter={handleShowBrushOptions}
            onMouseLeave={handleHideBrushOptions}
          >
            <Tooltip content="Brush" side="top">
              <Button
                variant={selectedBrushTool === 'brush' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedBrushTool('brush'); handleSelectTool('brush'); }}
              >
                <Paintbrush2 className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Bucket Fill" side="top">
              <Button
                variant={selectedBrushTool === 'bucket' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedBrushTool('bucket'); handleSelectTool('brush'); }}
              >
                <PaintBucket className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Eraser" side="top">
              <Button
                variant={selectedBrushTool === 'eraser' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedBrushTool('eraser'); handleSelectTool('brush'); }}
              >
                <Eraser className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Clear Layer" side="top">
              <Button
                variant={selectedBrushTool === 'clear' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button border-red-500 hover:border-red-600 hover:bg-red-50"
                onClick={() => { setShowClearLayerDialog(true); handleSelectTool('brush'); }}
              >
                <X className="w-3 h-3 text-red-500" />
              </Button>
            </Tooltip> 
          </div>
        )}
      </div>

      <div
        className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'selection' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Tooltip content="Selection Tool" side="left">
          <Button
            variant={selectedTool === 'selection' ? 'default' : 'ghost'}
            size="sm"
            className="w-7 h-7 p-1 rounded-full tool-button"
            onClick={() => handleSelectTool('selection')}
            onMouseEnter={() => {
              handleShowSelectionOptions();
            }}
            onMouseLeave={() => {
              handleHideSelectionOptions();
            }}
          >
            {renderSelectionIcon()}
          </Button>
        </Tooltip>

        {showSelectionOptions && (
          <div
            className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ animation: 'fadeInUp 0.2s ease-out' }}
            onMouseEnter={handleShowSelectionOptions}
            onMouseLeave={handleHideSelectionOptions}
          >
            <Tooltip content="Rectangle" side="top">
              <Button
                variant={selectedSelectionTool === 'rectangular' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedSelectionTool('rectangular'); handleSelectTool('selection'); }}
              >
                <Square className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Multi-Cell" side="top">
              <Button
                variant={selectedSelectionTool === 'multi-cell' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedSelectionTool('multi-cell'); handleSelectTool('selection'); }}
              >
                <SquareDashed className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Magic Wand" side="top">
              <Button
                variant={selectedSelectionTool === 'magic-wand' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedSelectionTool('magic-wand'); handleSelectTool('selection'); }}
              >
                <Wand2 className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Select Same Tile" side="top">
              <Button
                variant={selectedSelectionTool === 'same-tile' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedSelectionTool('same-tile'); handleSelectTool('selection'); }}
              >
                <Target className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Circle" side="top">
              <Button
                variant={selectedSelectionTool === 'circular' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedSelectionTool('circular'); handleSelectTool('selection'); }}
              >
                <Circle className="w-3 h-3" />
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      <div
        className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'shape' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Tooltip content="Shape Tool" side="left">
          <Button
            variant={selectedTool === 'shape' ? 'default' : 'ghost'}
            size="sm"
            className="w-7 h-7 p-1 rounded-full tool-button"
            onClick={() => handleSelectTool('shape')}
            onMouseEnter={() => { handleShowShapeOptions(); }}
            onMouseLeave={() => { handleHideShapeOptions(); }}
          >
            {renderShapeIcon()}
          </Button>
        </Tooltip>

        {showShapeOptions && (
          <div
            className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ animation: 'fadeInUp 0.2s ease-out' }}
            onMouseEnter={handleShowShapeOptions}
            onMouseLeave={handleHideShapeOptions}
          >
            <Tooltip content="Rectangle">
              <Button
                variant={selectedShapeTool === 'rectangle' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedShapeTool('rectangle'); handleSelectTool('shape'); }}
              >
                <Square className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Circle">
              <Button
                variant={selectedShapeTool === 'circle' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedShapeTool('circle'); handleSelectTool('shape'); }}
              >
                <Circle className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Line">
              <Button
                variant={selectedShapeTool === 'line' ? 'default' : 'ghost'}
                size="sm"
                className="w-6 h-6 p-1 rounded-full sub-tool-button"
                onClick={() => { setSelectedShapeTool('line'); handleSelectTool('shape'); }}
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
        <Tooltip content="Stamp Tool" side="left">
          <Button
            variant={selectedTool === 'stamp' ? 'default' : 'ghost'}
            size="sm"
            className="w-7 h-7 p-1 rounded-full tool-button"
            onClick={() => handleSelectTool('stamp')}
          >
            <Stamp className="w-3 h-3" />
          </Button>
        </Tooltip>

        {selectedTool === 'stamp' && (
          <StampsPanel
            stampMode={stampMode}
            setStampMode={(m) => { setStampMode(m); handleSelectTool('stamp'); }}
            newStampName={newStampName}
            setNewStampName={setNewStampName}
            handleCreateStamp={handleCreateStamp}
            stamps={stamps}
            selectedStamp={selectedStamp}
            handleStampSelect={(id) => { handleStampSelect(id); handleSelectTool('stamp'); }}
            handleDeleteStamp={handleDeleteStamp}
          />
        )}
      </div>

      <div
        className={`flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'eyedropper' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
      >
        <Tooltip content="Eyedropper" side="left">
          <Button
            variant={selectedTool === 'eyedropper' ? 'default' : 'ghost'}
            size="sm"
            className="w-7 h-7 p-1 rounded-full tool-button"
            onClick={() => handleSelectTool('eyedropper')}
          >
            <Pipette className="w-3 h-3" />
          </Button>
        </Tooltip>
      </div>
    </div>
    </div>
    );
  };

  export default BottomToolbar;
