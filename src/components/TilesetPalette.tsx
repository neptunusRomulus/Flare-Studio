import React, { useEffect, useCallback, useState, useRef } from 'react';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import usePreferences from '@/hooks/usePreferences';

type TilesetPaletteProps = {
  editor: TileMapEditor | null;
  activeLayer: TileLayer | null;
  tabTick: number;
  setTabTick: React.Dispatch<React.SetStateAction<number>>;
  brushTool: string;
  stampsState?: unknown;
  zoom?: number;
  setZoom?: React.Dispatch<React.SetStateAction<number>>;
  onSelectionChange?: (hasSelection: boolean, clearFn: () => void) => void;
};

// Selection state for multi-tile selection
interface TileSelection {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

const TILE_SIZE = 32; // Grid cell size in pixels
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

const TilesetPalette = ({
  editor,
  activeLayer,
  tabTick,
  setTabTick,
  brushTool,
  stampsState: _stampsState,
  zoom: externalZoom,
  setZoom: externalSetZoom,
  onSelectionChange
}: TilesetPaletteProps) => {
  void _stampsState;

  // Refs
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // State - use external zoom if provided, otherwise internal
  const [internalZoom, setInternalZoom] = useState<number>(1);
  const zoom = externalZoom ?? internalZoom;
  const setZoom = externalSetZoom ?? setInternalZoom;
  
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [selection, setSelection] = useState<TileSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [tilesetImage, setTilesetImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  // Refs for panning
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const selectionStartRef = useRef({ col: 0, row: 0 });
  
  const prefs = usePreferences();

  // Create a clear selection function to pass to parent
  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // Notify parent when selection changes - pass the clear function too
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selection !== null, clearSelection);
    }
  }, [selection, onSelectionChange, clearSelection]);

  // Refresh tileset palette from editor
  useEffect(() => {
    console.log('[DEBUG] TilesetPalette MAIN EFFECT TRIGGERED: editor=', !!editor, 'activeLayer=', activeLayer?.type, 'tabTick=', tabTick);
    
    if (!editor) return;
    console.log('[DEBUG] TilesetPalette useEffect: editor changed or activeLayer/tabTick changed, refreshing palette');
    console.log('[DEBUG] TilesetPalette: activeLayer =', activeLayer?.type, 'tabTick =', tabTick);
    
    // Get tileset image from editor and set up listeners for when it loads
    const fetchTilesetImage = () => {
      try {
        const layerType = activeLayer?.type;
        if (!layerType) return;
        
        // Try to get image from active tab
        const tabs = editor.getLayerTabs ? editor.getLayerTabs(layerType) : [];
        const activeTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(layerType) : null;
        console.log('[DEBUG] TilesetPalette.fetchTilesetImage: layerType=', layerType, 'activeTabId=', activeTabId, 'tabs.length=', tabs.length);
        const tab = tabs.find((t: { id: number }) => t.id === activeTabId);
        console.log('[DEBUG] TilesetPalette.fetchTilesetImage: tab found?', !!tab, 'tab.tileset?', !!(tab as unknown as { tileset?: unknown })?.tileset);
        
        if (tab && (tab as { tileset?: { image?: HTMLImageElement } }).tileset?.image) {
          const img = (tab as { tileset: { image: HTMLImageElement } }).tileset.image;
          console.log('[DEBUG] TilesetPalette.fetchTilesetImage: Found image on tab', { 
            complete: img.complete, 
            naturalWidth: img.naturalWidth, 
            naturalHeight: img.naturalHeight,
            width: img.width,
            height: img.height,
            src: img.src?.substring(0, 50)
          });
          
          // Set the image immediately
          setTilesetImage(img);
          
          // Only set size if image is complete and has dimensions
          // Otherwise, let the image load listener handle the size update
          if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
            console.log('[DEBUG] TilesetPalette.fetchTilesetImage: Image complete, setting size immediately');
            setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
          } else {
            console.log('[DEBUG] TilesetPalette.fetchTilesetImage: Image incomplete, deferring size to load listener');
            // Don't set imageSize here - let the load listener handle it
            // This prevents the canvas from being shown with 0 size
          }
        } else {
          console.log('[DEBUG] TilesetPalette.fetchTilesetImage: No image found on active tab');
          setTilesetImage(null);
          setImageSize({ width: 0, height: 0 });
        }
      } catch (err) {
        console.warn('[DEBUG] TilesetPalette: Failed to get tileset image', err);
      }
    };

    fetchTilesetImage();
    
    // Note: We no longer call editor.refreshTilePalette() here because it directly
    // manipulates the DOM which conflicts with React's reconciliation.
    // The canvas-based rendering is now handled entirely by React state.

    // Retry fetching tileset image in case it wasn't ready initially
    const t1 = setTimeout(() => {
      console.log('[DEBUG] TilesetPalette: Retrying fetchTilesetImage after 75ms');
      fetchTilesetImage();
    }, 75);
    const t2 = setTimeout(() => {
      console.log('[DEBUG] TilesetPalette: Retrying fetchTilesetImage after 300ms');
      fetchTilesetImage();
    }, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [editor, activeLayer, tabTick]);

  // Listen for when tileset image loads - updates size when ready
  useEffect(() => {
    if (!tilesetImage) return undefined;
    
    console.log('[DEBUG] TilesetPalette: Image effect triggered, complete=', tilesetImage.complete, 'size=', { w: tilesetImage.naturalWidth, h: tilesetImage.naturalHeight });
    
    // If image is already complete, schedule an update
    if (tilesetImage.complete) {
      if (tilesetImage.naturalWidth > 0 && tilesetImage.naturalHeight > 0) {
        console.log('[DEBUG] TilesetPalette: Image complete with dimensions');
        // Use a microtask to avoid synchronous setState in effect
        Promise.resolve().then(() => {
          setImageSize({
            width: tilesetImage.naturalWidth,
            height: tilesetImage.naturalHeight
          });
        });
      } else {
        console.log('[DEBUG] TilesetPalette: Image complete but has no dimensions, clearing');
        Promise.resolve().then(() => {
          setTilesetImage(null);
          setImageSize({ width: 0, height: 0 });
        });
      }
      return undefined;
    }
    
    // Image is still loading - listen for load event
    console.log('[DEBUG] TilesetPalette: Image is loading, setting up load listener');
    
    const handleLoad = () => {
      console.log('[DEBUG] TilesetPalette: Image load event fired, dimensions=', { 
        naturalWidth: tilesetImage.naturalWidth, 
        naturalHeight: tilesetImage.naturalHeight 
      });
      setImageSize({
        width: tilesetImage.naturalWidth,
        height: tilesetImage.naturalHeight
      });
    };
    
    const handleError = () => {
      console.warn('[DEBUG] TilesetPalette: Image load error');
      setTilesetImage(null);
      setImageSize({ width: 0, height: 0 });
    };
    
    tilesetImage.addEventListener('load', handleLoad);
    tilesetImage.addEventListener('error', handleError);
    
    return () => {
      tilesetImage.removeEventListener('load', handleLoad);
      tilesetImage.removeEventListener('error', handleError);
    };
  }, [tilesetImage]);

  // Draw the tileset with grid overlay on canvas
  const drawTilesetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tilesetImage) return;

    // Wait for image to be loaded before drawing
    if (!tilesetImage.complete || tilesetImage.naturalWidth === 0 || tilesetImage.naturalHeight === 0) {
      console.log('[DEBUG] TilesetPalette: drawTilesetCanvas skipped - image not ready');
      return;
    }

    if (imageSize.width === 0 || imageSize.height === 0) {
      console.log('[DEBUG] TilesetPalette: drawTilesetCanvas skipped - imageSize is 0');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match image
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;

    // Draw the tileset image
    ctx.drawImage(tilesetImage, 0, 0);

    // Draw grid overlay
    const cols = Math.ceil(imageSize.width / TILE_SIZE);
    const rows = Math.ceil(imageSize.height / TILE_SIZE);
    
    ctx.strokeStyle = prefs.isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let i = 0; i <= cols; i++) {
      const x = i * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, imageSize.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let i = 0; i <= rows; i++) {
      const y = i * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(imageSize.width, y + 0.5);
      ctx.stroke();
    }

    // Draw selection if present
    if (selection) {
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);

      const x = minCol * TILE_SIZE;
      const y = minRow * TILE_SIZE;
      const w = (maxCol - minCol + 1) * TILE_SIZE;
      const h = (maxRow - minRow + 1) * TILE_SIZE;

      // Selection fill
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(x, y, w, h);

      // Selection border
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
  }, [tilesetImage, imageSize, selection, prefs.isDarkMode]);

  // Redraw canvas when dependencies change
  useEffect(() => {
    drawTilesetCanvas();
  }, [drawTilesetCanvas]);

  // Keyboard handlers for spacebar to enable panning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
        setIsSpacePressed(true);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // Calculate grid position from mouse coordinates
  const getGridPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);

    const maxCol = Math.ceil(imageSize.width / TILE_SIZE) - 1;
    const maxRow = Math.ceil(imageSize.height / TILE_SIZE) - 1;

    return {
      col: Math.max(0, Math.min(col, maxCol)),
      row: Math.max(0, Math.min(row, maxRow))
    };
  }, [imageSize]);

  // Selection handlers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSpacePressed || isPanning) return; // Don't start selection while panning
    if (e.button !== 0) return; // Only left click

    const pos = getGridPosition(e);
    if (!pos) return;

    setIsSelecting(true);
    selectionStartRef.current = pos;
    setSelection({
      startCol: pos.col,
      startRow: pos.row,
      endCol: pos.col,
      endRow: pos.row
    });
  }, [getGridPosition, isSpacePressed, isPanning]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting) return;

    const pos = getGridPosition(e);
    if (!pos) return;

    setSelection(prev => prev ? {
      ...prev,
      endCol: pos.col,
      endRow: pos.row
    } : null);
  }, [getGridPosition, isSelecting]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isSelecting && selection && editor) {
      // Notify editor about the selection
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);

      const selectedTiles = {
        x: minCol * TILE_SIZE,
        y: minRow * TILE_SIZE,
        width: (maxCol - minCol + 1) * TILE_SIZE,
        height: (maxRow - minRow + 1) * TILE_SIZE,
        cols: maxCol - minCol + 1,
        rows: maxRow - minRow + 1
      };

      console.log('[DEBUG] TilesetPalette: Selected tiles', selectedTiles);
      
      // If editor has a method to handle tile selection, call it
      if (typeof (editor as unknown as { setTileSelection?: (sel: typeof selectedTiles) => void }).setTileSelection === 'function') {
        (editor as unknown as { setTileSelection: (sel: typeof selectedTiles) => void }).setTileSelection(selectedTiles);
      }
    }
    setIsSelecting(false);
  }, [isSelecting, selection, editor]);

  // Panning handlers
  const handleMouseDownPan = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Middle mouse button or space+left click for panning
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = { 
        x: e.clientX, 
        y: e.clientY, 
        scrollLeft: wrapper.scrollLeft, 
        scrollTop: wrapper.scrollTop 
      };
      wrapper.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }, [isSpacePressed]);

  const handleMouseMovePan = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    wrapper.scrollLeft = Math.max(0, panStartRef.current.scrollLeft - dx);
    wrapper.scrollTop = Math.max(0, panStartRef.current.scrollTop - dy);
  }, []);

  const handleMouseUpPan = useCallback(() => {
    if (!isPanningRef.current) return;
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.style.cursor = isSpacePressed ? 'grab' : '';
    isPanningRef.current = false;
    setIsPanning(false);
  }, [isSpacePressed]);

  // Update cursor when spacebar pressed
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.style.cursor = isSpacePressed ? 'grab' : '';
  }, [isSpacePressed]);

  // Wheel zoom handler - zoom with mouse wheel (no Ctrl needed)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    const onWheel = (evt: WheelEvent) => {
      // Prevent default scrolling in the tileset area and use for zooming
      evt.preventDefault();
      const delta = -evt.deltaY;
      const scaleFactor = delta > 0 ? 1.1 : 0.9;
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * scaleFactor)));
    };

    wrapper.addEventListener('wheel', onWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', onWheel as EventListener);
  }, [setZoom]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0 m-0">
      {/* Tab navigation */}
      {(() => {
        const activeLayerType = activeLayer?.type;
        const showTabs = activeLayerType === 'background' || activeLayerType === 'object';
        if (editor && activeLayerType) {
          const tabs = editor.getLayerTabs ? editor.getLayerTabs(activeLayerType) : [];
          const activeTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(activeLayerType) : null;
          console.log('[DEBUG UI] tabs for', activeLayerType, ':', tabs.length, 'tabs', JSON.stringify(tabs.map((t: { id: number; name?: string }) => ({ id: t.id, name: t.name }))));
          console.log('[DEBUG UI] activeTabId for', activeLayerType, ':', activeTabId);
        }
        if (!showTabs) return null;
        return (
          <div key={tabTick} className="flex items-center gap-2 px-2 py-2 overflow-visible">
            <div
              className={`flex-1 flex items-center gap-1 overflow-x-auto overflow-y-visible tabs-scroll ${(() => {
                try {
                  const tabs = editor && activeLayerType ? (editor.getLayerTabs ? editor.getLayerTabs(activeLayerType) : []) : [];
                  return tabs && tabs.length > 7 ? 'tabs-limited' : '';
                } catch { return ''; }
              })()}`}
              onWheel={(event: React.WheelEvent<HTMLDivElement>) => {
                const el = event.currentTarget as HTMLDivElement;
                if (el.scrollWidth > el.clientWidth) {
                  event.preventDefault();
                  el.scrollLeft += event.deltaY;
                }
              }}
            >
              {editor ? (
                (editor.getLayerTabs ? editor.getLayerTabs(activeLayerType!) : []).map((tab: { id: number; name?: string; }, idx: number) => (
                  <button
                    key={tab.id}
                    title={tab.name ?? `Tab ${idx + 1}`}
                    aria-label={tab.name ? `${tab.name} (Tab ${idx + 1})` : `Tab ${idx + 1}`}
                    className={`w-4 h-4 flex items-center justify-center rounded-full text-white text-[10px] font-semibold transition transform duration-150 ease-out ${editor && editor.getCurrentLayerType() === activeLayerType && editor.getActiveLayerTabId && editor.getActiveLayerTabId(activeLayerType) === tab.id ? 'bg-orange-600 opacity-100 scale-100 ring-2 ring-offset-0 ring-orange-600 relative z-10 focus:outline-none' : 'bg-orange-400/90 opacity-90 scale-95 hover:bg-orange-600 hover:scale-105 focus:outline-none'}`}
                    onClick={() => {
                      if (!editor) return;
                      editor.setActiveLayerTab(activeLayerType!, tab.id);
                      // Note: tabTick update triggers React-based refresh, no need for refreshTilePalette
                      setTabTick(t => t + 1);
                      setSelection(null); // Clear selection when switching tabs
                    }}
                  >
                    {idx + 1}
                  </button>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No tabs</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Main tileset palette area */}
      <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="tile-palette-container flex flex-col flex-1 min-h-0 overflow-hidden p-0 m-0">
          {/* Scrollable wrapper with panning support */}
          <div
            ref={wrapperRef}
            className="tile-palette flex-1 min-h-0 overflow-auto p-2"
            style={{ cursor: isSpacePressed ? 'grab' : 'default' }}
            onMouseDown={handleMouseDownPan}
            onMouseMove={handleMouseMovePan}
            onMouseUp={handleMouseUpPan}
            onMouseLeave={handleMouseUpPan}
          >
            {/* If we have a tileset image, show the interactive canvas-based selector */}
            {tilesetImage && imageSize.width > 0 ? (
              <div 
                className="tileset-selector relative inline-block"
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left'
                }}
              >
                {/* Canvas for tileset with grid and selection */}
                <canvas
                  ref={canvasRef}
                  className="tileset-canvas"
                  style={{ 
                    imageRendering: 'pixelated',
                    cursor: isSpacePressed ? 'grab' : 'crosshair',
                    display: 'block'
                  }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={() => {
                    if (isSelecting) {
                      handleCanvasMouseUp();
                    }
                  }}
                />
              </div>
            ) : (
              /* Empty state - no tileset loaded */
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center p-4">
                  <p>No tileset loaded</p>
                  <p className="text-xs mt-1">Import an image to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div data-brush-tool={brushTool} className="hidden"></div>
      </div>
    </div>
  );
};

export default TilesetPalette;
