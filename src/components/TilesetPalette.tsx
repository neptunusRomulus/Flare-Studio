import React, { useEffect, useCallback, useState, useRef, useLayoutEffect, useMemo } from 'react';
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

// Default grid cell size; will be overridden by tileset/tab metadata when available
const DEFAULT_TILE_WIDTH = 64; // Grid cell width in pixels
const DEFAULT_TILE_HEIGHT = 32; // Grid cell height in pixels
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
  const [tileSize, setTileSize] = useState({ width: DEFAULT_TILE_WIDTH, height: DEFAULT_TILE_HEIGHT });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  // Track the visible wrapper size so we can ensure the tileset viewport
  // remains at least as large as the palette area regardless of image size.
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const [selectedTileInfo, setSelectedTileInfo] = useState<{ gid: number; description?: string } | null>(null);
  
  // Refs for panning
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const selectionStartRef = useRef({ col: 0, row: 0 });
  
  const prefs = usePreferences();
  
  // Collision tile descriptions
  const COLLISION_TILE_DESCRIPTIONS = useMemo(() => ({
    1: 'Full Collision: Nothing will able to pass from this cell.',
    2: 'Ground Collision: Only flying units will pass from this cell',
    3: 'Hidden Full Collision: Same as "Full Collision" but not visible on map.',
    4: 'Hidden Ground Collision: Same as "Ground Collision" but not visible on map.'
  }), []);

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
    
    if (!editor) return;
    
    // Get tileset image from editor and set up listeners for when it loads
    const fetchTilesetImage = () => {
      try {
        const layerType = activeLayer?.type;
        if (!layerType) return;
        
        // Try to get image from active tab
        const tabs = editor.getLayerTabs ? editor.getLayerTabs(layerType) : [];
        const activeTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(layerType) : null;
        const tab = tabs.find((t: { id: number }) => t.id === activeTabId);
        
        if (tab && (tab as { tileset?: { image?: HTMLImageElement } }).tileset?.image) {
          const img = (tab as { tileset: { image: HTMLImageElement } }).tileset.image;
          
          // Set the image immediately
          setTilesetImage(img);
          // If the tab's tileset provides explicit tile sizes, use them for palette math
          try {
            const tabTileset = (tab as { tileset?: { tileWidth?: number; tileHeight?: number } }).tileset;
            const tw = tabTileset?.tileWidth;
            const th = tabTileset?.tileHeight;
            if (typeof tw === 'number' && tw > 0 && typeof th === 'number' && th > 0) {
              setTileSize({ width: tw, height: th });
            } else {
              setTileSize({ width: DEFAULT_TILE_WIDTH, height: DEFAULT_TILE_HEIGHT });
            }
          } catch (_e) { void _e; }
          
          // Only set size if image is complete and has dimensions
          // Otherwise, let the image load listener handle the size update
          if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
            setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
          } else {
            // Don't set imageSize here - let the load listener handle it
            // This prevents the canvas from being shown with 0 size
          }
        } else {
          // Fallback: for layers without tabs (like collision), get the tileset from editor's global tilesetImage
          const editorTilesetImage = (editor as unknown as { tilesetImage?: HTMLImageElement | null }).tilesetImage;
          if (editorTilesetImage) {
            setTilesetImage(editorTilesetImage);
            setTileSize({ width: DEFAULT_TILE_WIDTH, height: DEFAULT_TILE_HEIGHT });
            if (editorTilesetImage.complete && editorTilesetImage.naturalWidth > 0 && editorTilesetImage.naturalHeight > 0) {
              setImageSize({ width: editorTilesetImage.naturalWidth, height: editorTilesetImage.naturalHeight });
            }
          } else {
            setTilesetImage(null);
            setImageSize({ width: 0, height: 0 });
          }
        }
      } catch (_err) { void _err; }
    };

    fetchTilesetImage();
    
    // Note: We no longer call editor.refreshTilePalette() here because it directly
    // manipulates the DOM which conflicts with React's reconciliation.
    // The canvas-based rendering is now handled entirely by React state.

    // Retry fetching tileset image in case it wasn't ready initially.
    // Images loaded from data URLs are async; retries catch frames where the
    // Image element exists but hasn't fired onload yet.
    const t1 = setTimeout(fetchTilesetImage, 75);
    const t2 = setTimeout(fetchTilesetImage, 300);
    const t3 = setTimeout(fetchTilesetImage, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [editor, activeLayer, tabTick]);

  // Listen for when tileset image loads - updates size when ready
  useEffect(() => {
    if (!tilesetImage) return undefined;
    
    
    // If image is already complete, schedule an update
    if (tilesetImage.complete) {
      if (tilesetImage.naturalWidth > 0 && tilesetImage.naturalHeight > 0) {
        // Use a microtask to avoid synchronous setState in effect
        Promise.resolve().then(() => {
          setImageSize({
            width: tilesetImage.naturalWidth,
            height: tilesetImage.naturalHeight
          });
        });
      } else {
        Promise.resolve().then(() => {
          setTilesetImage(null);
          setImageSize({ width: 0, height: 0 });
        });
      }
      return undefined;
    }
    
    // Image is still loading - listen for load event
    
    const handleLoad = () => {
      setImageSize({
        width: tilesetImage.naturalWidth,
        height: tilesetImage.naturalHeight
      });
    };
    
    const handleError = () => {
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
      return;
    }

    if (imageSize.width === 0 || imageSize.height === 0) {
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
    const cols = Math.ceil(imageSize.width / tileSize.width);
    const rows = Math.ceil(imageSize.height / tileSize.height);
    
    ctx.strokeStyle = prefs.isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.8;

    // Draw vertical lines
    for (let i = 0; i <= cols; i++) {
      const x = i * tileSize.width;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, imageSize.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let i = 0; i <= rows; i++) {
      const y = i * tileSize.height;
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

      const x = minCol * tileSize.width;
      const y = minRow * tileSize.height;
      const w = (maxCol - minCol + 1) * tileSize.width;
      const h = (maxRow - minRow + 1) * tileSize.height;

      // Selection fill - light blue background
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fillRect(x, y, w, h);

      // Selection border - solid blue
      ctx.strokeStyle = 'rgba(59, 130, 246, 1)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
  }, [tilesetImage, imageSize, selection, prefs.isDarkMode, tileSize.width, tileSize.height]);

  // Redraw canvas when dependencies change
  useEffect(() => {
    drawTilesetCanvas();
  }, [drawTilesetCanvas]);

  // Track wrapper size with a ResizeObserver so we can keep the tileset
  // selector box at least as large as the viewport (users will zoom/pan).
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => setWrapperSize({ width: wrapper.clientWidth, height: wrapper.clientHeight });
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [wrapperRef]);

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

    const col = Math.floor(x / tileSize.width);
    const row = Math.floor(y / tileSize.height);

    const maxCol = Math.ceil(imageSize.width / tileSize.width) - 1;
    const maxRow = Math.ceil(imageSize.height / tileSize.height) - 1;

    return {
      col: Math.max(0, Math.min(col, maxCol)),
      row: Math.max(0, Math.min(row, maxRow))
    };
  }, [imageSize, tileSize.width, tileSize.height]);

  // Selection handlers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSpacePressed || isPanning) return; // Don't start selection while panning
    if (e.button !== 0) return; // Only left click

    const pos = getGridPosition(e);
    if (!pos) return;

    // Normal single/drag selection only
    setIsSelecting(true);
    selectionStartRef.current = pos;
    setSelection({
      startCol: pos.col,
      startRow: pos.row,
      endCol: pos.col,
      endRow: pos.row
    });
  }, [getGridPosition, isSpacePressed, isPanning, isSelecting]);

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
    if (!isSelecting || !selection) {
      setIsSelecting(false);
      return;
    }

    // Check if this was a single click (start and end are the same)
    const isSingleClick = selection.startCol === selection.endCol && selection.startRow === selection.endRow;

    if (isSingleClick && editor) {
      // Single click: set the active GID for this tile
      // Calculate the GID based on tileset columns
      const tilesetCols = Math.ceil(imageSize.width / tileSize.width);
      const gid = selection.startRow * tilesetCols + selection.startCol + 1; // GID is 1-indexed
      
      // Set tile info with description if this is collision layer
      const isCollisionLayer = activeLayer?.type === 'collision';
      if (isCollisionLayer) {
        setSelectedTileInfo({
          gid,
          description: COLLISION_TILE_DESCRIPTIONS[gid as keyof typeof COLLISION_TILE_DESCRIPTIONS]
        });
      }
      
      // Clear multiSelectedBrushes when selecting a single tile
      // This ensures we don't paint old multi-selection when we want a single brush
      const editorAny = editor as unknown as Record<string, unknown>;
      if (typeof editorAny.clearMultiSelectedBrushes === 'function') {
        (editorAny.clearMultiSelectedBrushes as () => void)();
      } else if (typeof editorAny.multiSelectedBrushes === 'object') {
        const multiSet = editorAny.multiSelectedBrushes as Set<number>;
        multiSet.clear();
      }
      
      // Now set the active GID for this single tile
      if (typeof (editor as unknown as { setActiveGid?: (gid: number) => void }).setActiveGid === 'function') {
        (editor as unknown as { setActiveGid: (gid: number) => void }).setActiveGid(gid);
      }
      
      // Switch back to brush tool and tiles mode (setCurrentTool sets both)
      if (typeof (editor as unknown as { setCurrentTool?: (tool: string) => void }).setCurrentTool === 'function') {
        (editor as unknown as { setCurrentTool: (tool: string) => void }).setCurrentTool('brush');
      }
      
      // Force tile palette refresh to update the UI
      if (typeof (editor as unknown as { updateTilePaletteSelection?: () => void }).updateTilePaletteSelection === 'function') {
        (editor as unknown as { updateTilePaletteSelection: () => void }).updateTilePaletteSelection();
      }
    } else if (!isSingleClick && editor && selection) {
      // Drag selection: create a stamp from selected tiles
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);

      const selectedTiles = {
        x: minCol * tileSize.width,
        y: minRow * tileSize.height,
        width: (maxCol - minCol + 1) * tileSize.width,
        height: (maxRow - minRow + 1) * tileSize.height,
        tileWidth: tileSize.width,
        tileHeight: tileSize.height,
        cols: maxCol - minCol + 1,
        rows: maxRow - minRow + 1
      };
      
      // Also populate multiSelectedBrushes with all selected tiles
      const editorAny = editor as unknown as Record<string, unknown>;
      if (typeof editorAny.multiSelectedBrushes === 'object') {
        const multiSet = editorAny.multiSelectedBrushes as Set<number>;
        multiSet.clear();
        const tilesetCols = Math.ceil(imageSize.width / tileSize.width);
        
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            const gid = row * tilesetCols + col + 1; // GID is 1-indexed
            multiSet.add(gid);
          }
        }
      }
      
      // If editor has a method to handle tile selection, call it
      if (typeof (editor as unknown as { setTileSelection?: (sel: typeof selectedTiles) => void }).setTileSelection === 'function') {
        (editor as unknown as { setTileSelection: (sel: typeof selectedTiles) => void }).setTileSelection(selectedTiles);
      }
      
      // Clear selected tile info for multi-selection
      setSelectedTileInfo(null);
    }

    setIsSelecting(false);
    // Also reset panning state if stuck to allow map clicks
    isPanningRef.current = false;
    // Keep selection visible - don't clear it
    // The selection will persist until the user makes a new selection or clears it
  }, [isSelecting, selection, editor, imageSize.width, tileSize.width, tileSize.height, activeLayer?.type, COLLISION_TILE_DESCRIPTIONS]);

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
    <div className="flex-1 flex flex-col min-h-0 overflow-visible p-0 m-0">
      {/* Tab navigation */}
      {(() => {
        const activeLayerType = activeLayer?.type;
        const showTabs = activeLayerType === 'background' || activeLayerType === 'object';
        if (!showTabs) return null;
        return (
          <div key={tabTick} className="flex items-center gap-2 px-2 py-2 overflow-visible">
            <div
              className={`flex-1 flex items-center gap-1 overflow-x-auto overflow-y-visible py-1 tabs-scroll ${(() => {
                try {
                  const tabs = editor && activeLayerType ? (editor.getLayerTabs ? editor.getLayerTabs(activeLayerType) : []) : [];
                  return tabs && tabs.length > 5 ? 'tabs-limited' : '';
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
                    className="tab-number"
                    onClick={() => {
                      if (!editor) return;
                      editor.setActiveLayerTab(activeLayerType!, tab.id);
                      setTabTick(t => t + 1);
                      setSelection(null);
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
            className="tile-palette relative flex-1 min-h-0 overflow-auto p-2"
            style={{ cursor: isSpacePressed ? 'grab' : 'default' }}
            onMouseDown={handleMouseDownPan}
            onMouseMove={handleMouseMovePan}
            onMouseUp={handleMouseUpPan}
            onMouseLeave={handleMouseUpPan}
          >
            {/* If we have a tileset image, show the interactive canvas-based selector */}
              {tilesetImage && imageSize.width > 0 ? (
              <div 
                className="tileset-selector"
                style={{ 
                  // Ensure selector box is at least as large as the wrapper viewport
                  // so small images don't collapse the visible area. We compute
                  // display dimensions in CSS pixels (before zoom) and then
                  // scale the whole selector by `zoom` using transform.
                  width: Math.max(imageSize.width, Math.max(1, Math.floor(wrapperSize.width / (zoom || 1)))),
                  height: Math.max(imageSize.height, Math.max(1, Math.floor(wrapperSize.height / (zoom || 1)))),
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  left: 0,
                  top: 0
                }}
              >
                {/* Canvas for tileset with grid and selection. We position the canvas
                    at top-left of the selector so blank area (if any) remains visible
                    for panning/zooming. */}
                <canvas
                  ref={canvasRef}
                  className="tileset-canvas"
                  style={{ 
                    imageRendering: 'pixelated',
                    cursor: isSpacePressed ? 'grab' : 'crosshair',
                    display: 'block',
                    position: 'absolute',
                    left: 0,
                    top: 0
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

      {/* Selected tile info display */}
      {selectedTileInfo?.description && (
        <div className="px-3 py-2 bg-accent/50 border-t border-border text-sm text-foreground">
          {selectedTileInfo.description}
        </div>
      )}
    </div>
  );
};

export default TilesetPalette;
