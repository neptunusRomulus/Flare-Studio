import {
  TileLayer,
  TilesetInfo,
  MapObject,
  Tool,
  Orientation,
  Stamp,
  StampTile
} from '../types';

interface LayerTilesetEntry {
  image: HTMLImageElement | null;
  fileName: string | null;
  columns: number;
  rows: number;
  count: number;
  tileWidth?: number;
  tileHeight?: number;
  spacing?: number;
  margin?: number;
  sourcePath?: string | null;
}

interface GlobalTilesetInfo extends LayerTilesetEntry {
  id: string;
  layerType: string;
  fileName: string;
  count: number;
  tileWidth: number;
  tileHeight: number;
  spacing: number;
  margin: number;
  sourcePath: string | null;
  offset: number;
}

interface TilesetExportInfo {
  id: string;
  fileName: string;
  sourcePath: string | null;
  tileWidth: number;
  tileHeight: number;
  spacing: number;
  margin: number;
}

interface FlareExportOptions {
  pathOverrides?: Record<string, string>;
  mapName?: string;
}

export type SerializedDetectedTile = [number, {
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
  originX?: number;
  originY?: number;
}];

export interface SavedTilesetEntry {
  layerType?: string;
  fileName: string;
  name: string;
  columns?: number;
  rows?: number;
  count?: number;
  tileWidth?: number;
  tileHeight?: number;
  spacing?: number;
  margin?: number;
  sourcePath?: string | null;
  detectedTiles?: SerializedDetectedTile[];
}

export interface EditorProjectData {
  name?: string;
  width?: number;
  height?: number;
  tileSize?: number;
  layers?: TileLayer[];
  objects?: MapObject[];
  heroX?: number;
  heroY?: number;
  tilesets?: SavedTilesetEntry[];
  tilesetImages?: Record<string, string>;
  minimap?: string | null;
  version?: string;
  tileContentThreshold?: number;
  objectSeparationSensitivity?: number;
  detectedTileData?: SerializedDetectedTile[];
  isStartingMap?: boolean;
  lastSaved?: string;
}

const INTERNAL_TILESET_FILENAMES = new Set<string>(['collision_tileset.png']);
const COLLISION_LAYER_TYPE = 'collision';
const INTERNAL_COLLISION_TILESET = 'collision_tileset.png';
const COLLISION_BRUSH_TOOLTIPS: Record<number, string> = {
  1: 'Blocks all, very visible at minimap',
  2: 'Blocks ground units, less visible at minimap',
  3: 'Blocks all, not visible at minimap',
  4: 'Blocks ground units, not visible at minimap'
};

export class TileMapEditor {
  /**
   * Creates a settings.txt file in the project root folder for Flare compatibility.
   * Call this after export. Updates description with project name.
   */
  public exportSettingsTxt(projectRoot: string) {
    const fs = window.require ? window.require('fs') : null;
    if (!fs) {
      console.warn('fs module not available. Cannot write settings.txt');
      return;
    }
    const content = `#this file is necesserey to work this project run in flare. please do not remove it. -Ism\ndescription=${this.projectName || '--> Project Name comes here.'}\ngame=flare_studio_game\nversion=1.14\nengine_version_min=1.13.01\n`;
    const filePath = fs.existsSync(projectRoot) ? `${projectRoot}/settings.txt` : 'settings.txt';
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('settings.txt exported to', filePath);
    } catch (err) {
      console.error('Failed to write settings.txt:', err);
    }
  }
  public projectName: string = '';
  // Tileset image and metadata for legacy/global tileset usage
  public tilesetImage: HTMLImageElement | null = null;
  public tilesetFileName: string | null = null;
  public tilesetColumns: number = 0;
  public tilesetRows: number = 0;
  public tileCount: number = 0;

  // Stub: load a Flare-format TXT into the editor.
  // Implementing a full parser is optional; this stub exists to provide a typed
  // entry point so the renderer can call the loader without using `any`.
  // Parameters: the raw text contents of the .txt map file.
  public loadFlareMapTxt?(txt: string): void;

  public getTileCount(): number {
    return this.tileCount;
  }

  // Tile content detection settings
  public setTileContentThreshold(threshold: number): void {
    this.tileContentThreshold = Math.max(0, Math.min(255, threshold));
  }

  public getTileContentThreshold(): number {
    return this.tileContentThreshold;
  }

  // Force regeneration of tile palette with current settings
  public refreshTilePalette(preserveOrder: boolean = false): void {
    if (this.tilesetImage) {
      this.createTilePalette(preserveOrder);
    }
  }

  // Get information about detected tiles for debugging
  public getDetectedTileInfo(): Array<{gid: number, width: number, height: number, sourceX: number, sourceY: number}> {
    const tileInfo: Array<{gid: number, width: number, height: number, sourceX: number, sourceY: number}> = [];
    this.detectedTileData.forEach((data, gid) => {
      tileInfo.push({
        gid,
        width: data.width,
        height: data.height,
        sourceX: data.sourceX,
        sourceY: data.sourceY
      });
    });
    return tileInfo.sort((a, b) => a.gid - b.gid);
  }

  // Get detected tiles for a specific layer (for per-layer save/load)
  public getDetectedTilesForLayer(layerType: string): Array<[number, { sourceX: number; sourceY: number; width: number; height: number }]> {
    const layerTiles = this.layerTileData.get(layerType);
    if (layerTiles) {
      return Array.from(layerTiles.entries());
    }
    return [];
  }

  // Get the active GID for the current layer
  private getCurrentLayerActiveGid(): number {
    const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (activeLayer) {
      return this.layerActiveGid.get(activeLayer.type) || 0;
    }
    return 0;
  }

  // Set the active GID for the current layer
  private setCurrentLayerActiveGid(gid: number): void {
    const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (activeLayer) {
      this.layerActiveGid.set(activeLayer.type, gid);
      // Update global activeGid for UI consistency
      this.activeGid = gid;
      if (this.activeGidCallback) {
        try {
          this.activeGidCallback(this.activeGid);
        } catch (e) {
          console.warn('activeGidCallback error', e);
        }
      }
    }
  }

  // Brush management methods
  public mergeBrushes(brushIds: number[]): void {
    if (brushIds.length < 2) return;
    
    // Get the tile data for all selected brushes
    const brushesToMerge = brushIds
      .map(id => this.detectedTileData.get(id))
      .filter((brush): brush is NonNullable<typeof brush> => brush !== undefined);
      
    if (brushesToMerge.length !== brushIds.length) {
      throw new Error('Some selected brushes not found');
    }
    
    // Calculate the bounding box that encompasses all selected brushes
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;
    
    for (const brush of brushesToMerge) {
      minX = Math.min(minX, brush.sourceX);
      minY = Math.min(minY, brush.sourceY);
      maxX = Math.max(maxX, brush.sourceX + brush.width);
      maxY = Math.max(maxY, brush.sourceY + brush.height);
    }
    
    // Create merged brush data
    const mergedBrushData = {
      sourceX: minX,
      sourceY: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    
    // Convert Map to array to work with positions
    const brushArray = Array.from(this.detectedTileData.entries());
    
    // Find the position of the first selected brush (this will be where the merged brush goes)
    const firstBrushIndex = brushArray.findIndex(([id]) => brushIds.includes(id));
    
    // Remove all selected brushes from the array
    const filteredArray = brushArray.filter(([id]) => !brushIds.includes(id));
    
    // Insert the merged brush at the position of the first selected brush
    filteredArray.splice(firstBrushIndex, 0, [brushIds[0], mergedBrushData]);
    
    // Rebuild the map with sequential IDs
    this.detectedTileData.clear();
    filteredArray.forEach(([_, data], index) => {
      this.detectedTileData.set(index, data);
    });
    
    // Rebuild the tile palette to show the changes
    this.createTilePalette(true);
    
    // Mark as changed to trigger autosave
    this.markAsChanged(true);
    
    console.log(`Merged ${brushIds.length} brushes into new brush at position ${firstBrushIndex}`);
  }

  public separateBrush(brushId: number): void {
    console.log(`separateBrush called with brushId: ${brushId}`);
    
    const brushData = this.detectedTileData.get(brushId);
    if (!brushData) {
      console.error(`Brush ${brushId} not found`);
      throw new Error(`Brush ${brushId} not found`);
    }
    
    console.log(`Separating brush ${brushId} with data:`, brushData);
    
    // Convert Map to array to work with positions
    const brushArray = Array.from(this.detectedTileData.entries());
    
    // Find the position of the brush to separate
    const brushIndex = brushArray.findIndex(([id]) => id === brushId);
    
    // Remove the original brush from the array
    const filteredArray = brushArray.filter(([id]) => id !== brushId);
    
    // Try to re-detect individual objects within this brush area
    const newBrushes: Array<{sourceX: number, sourceY: number, width: number, height: number}> = [];
    
    if (this.tilesetImage) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = brushData.width;
      tempCanvas.height = brushData.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        // Draw the brush area to analyze
        tempCtx.drawImage(
          this.tilesetImage,
          brushData.sourceX, brushData.sourceY, brushData.width, brushData.height,
          0, 0, brushData.width, brushData.height
        );
        
        const imageData = tempCtx.getImageData(0, 0, brushData.width, brushData.height);
        const data = imageData.data;
        
        console.log(`Analyzing brush area: ${brushData.width}x${brushData.height}`);
        
        // First, try to find vertical separation lines (gaps between objects)
        const verticalGaps = this.findVerticalGaps(data, brushData.width, brushData.height);
        console.log(`Found vertical gaps:`, verticalGaps);
        
        if (verticalGaps.length > 0) {
          // Use vertical gaps to separate objects
          let lastX = 0;
          
          for (const gapX of verticalGaps) {
            if (gapX > lastX) {
              const segmentWidth = gapX - lastX;
              const bounds = this.findObjectBoundsInRegion(data, brushData.width, brushData.height, lastX, 0, segmentWidth, brushData.height);
              
              if (bounds && bounds.width > 0 && bounds.height > 0) {
                newBrushes.push({
                  sourceX: brushData.sourceX + bounds.x,
                  sourceY: brushData.sourceY + bounds.y,
                  width: bounds.width,
                  height: bounds.height
                });
              }
            }
            lastX = gapX + 1; // Skip the gap pixel
          }
          
          // Handle the last segment
          if (lastX < brushData.width) {
            const segmentWidth = brushData.width - lastX;
            const bounds = this.findObjectBoundsInRegion(data, brushData.width, brushData.height, lastX, 0, segmentWidth, brushData.height);
            
            if (bounds && bounds.width > 0 && bounds.height > 0) {
              newBrushes.push({
                sourceX: brushData.sourceX + bounds.x,
                sourceY: brushData.sourceY + bounds.y,
                width: bounds.width,
                height: bounds.height
              });
            }
          }
        } else {
          // Fallback to flood fill if no clear vertical gaps
          const visited = new Array(brushData.width * brushData.height).fill(false);
          
          for (let y = 0; y < brushData.height; y++) {
            for (let x = 0; x < brushData.width; x++) {
              const pixelIndex = y * brushData.width + x;
              
              if (visited[pixelIndex] || this.isPixelTransparent(data, x, y, brushData.width)) {
                continue;
              }
              
              console.log(`Starting flood fill at pixel (${x}, ${y})`);
              const objectData = this.floodFillObjectDataInRegion(
                data, brushData.width, brushData.height, x, y, visited
              );
              
              if (objectData && this.isValidObjectSize(objectData.bounds)) {
                console.log(`Found valid connected component:`, objectData);
                // Adjust coordinates back to original image space
                newBrushes.push({
                  sourceX: brushData.sourceX + objectData.bounds.x,
                  sourceY: brushData.sourceY + objectData.bounds.y,
                  width: objectData.bounds.width,
                  height: objectData.bounds.height
                });
              } else if (objectData) {
                console.log(`Found invalid connected component (too small):`, objectData);
              }
            }
          }
        }
      }
    }
    
    console.log(`Found ${newBrushes.length} new brushes from separation:`, newBrushes);
    
    // Check if we actually found multiple objects
    if (newBrushes.length <= 1) {
      console.log(`No separation needed - only found ${newBrushes.length} component(s)`);
      return; // Don't separate if we only found one component or none
    }
    
    // Insert the new brushes at the position where the original brush was
    newBrushes.forEach((brushData, index) => {
      filteredArray.splice(brushIndex + index, 0, [brushIndex + index, brushData]);
    });
    
    // Rebuild the map with sequential IDs
    this.detectedTileData.clear();
    filteredArray.forEach(([_, data], index) => {
      this.detectedTileData.set(index, data);
    });
    
    // Rebuild the tile palette to show the changes
    this.createTilePalette(true);
    
    // Mark as changed to trigger autosave
    this.markAsChanged(true);
    
    console.log(`Separated brush ${brushId} into ${newBrushes.length} new brushes`);
  }

  public removeBrush(brushId: number): void {
    console.log(`removeBrush called with brushId: ${brushId}`);
    console.log(`detectedTileData keys before removal:`, Array.from(this.detectedTileData.keys()));
    
    if (!this.detectedTileData.has(brushId)) {
      console.error(`Brush ${brushId} not found in detectedTileData`);
      throw new Error(`Brush ${brushId} not found`);
    }
    
    // Convert Map to array to work with positions
    const brushArray = Array.from(this.detectedTileData.entries());
    console.log(`brushArray before filtering:`, brushArray.map(([id, _]) => id));
    
    // Remove the brush with the specified ID
    const filteredArray = brushArray.filter(([id]) => id !== brushId);
    console.log(`filteredArray after filtering:`, filteredArray.map(([id, _]) => id));
    
    // Rebuild the map with sequential IDs
    this.detectedTileData.clear();
    filteredArray.forEach(([_, data], index) => {
      this.detectedTileData.set(index, data);
    });
    
    console.log(`detectedTileData keys after rebuild:`, Array.from(this.detectedTileData.keys()));
    
    // Rebuild the tile palette to show the changes
    this.createTilePalette(true);
    
    // Mark as changed to trigger autosave
    this.markAsChanged(true);
    
    console.log(`Removed brush ${brushId}`);
  }

  public reorderBrush(fromIndex: number, toIndex: number): void {
    // Convert Map to array, reorder, and convert back
    const brushArray = Array.from(this.detectedTileData.entries());
    
    if (fromIndex < 0 || fromIndex >= brushArray.length || toIndex < 0 || toIndex >= brushArray.length) {
      throw new Error('Invalid brush indices for reordering');
    }
    
    const [movedBrush] = brushArray.splice(fromIndex, 1);
    brushArray.splice(toIndex, 0, movedBrush);
    
    // Rebuild the map with new order and reassign IDs sequentially
    this.detectedTileData.clear();
    brushArray.forEach(([_oldId, data], newIndex) => {
      // Use newIndex as the new ID to maintain sequential order
      this.detectedTileData.set(newIndex, data);
    });
    
    // Rebuild the tile palette to reflect the new order
    this.createTilePalette(true);
    
    // Mark as changed to trigger autosave
    this.markAsChanged(true);
    
    console.log(`Reordered brush from index ${fromIndex} to ${toIndex}`);
  }

  private findVerticalGaps(data: Uint8ClampedArray, width: number, height: number): number[] {
    const gaps: number[] = [];
    
    // Check each column for vertical gaps
    for (let x = 1; x < width - 1; x++) { // Skip first and last columns
      let hasContent = false;
      
      // Check if this column has any content
      for (let y = 0; y < height; y++) {
        if (!this.isPixelTransparent(data, x, y, width)) {
          hasContent = true;
          break;
        }
      }
      
      // If column is completely transparent, check adjacent columns for content
      if (!hasContent) {
        let leftHasContent = false;
        let rightHasContent = false;
        
        // Check left column
        for (let y = 0; y < height; y++) {
          if (!this.isPixelTransparent(data, x - 1, y, width)) {
            leftHasContent = true;
            break;
          }
        }
        
        // Check right column
        for (let y = 0; y < height; y++) {
          if (!this.isPixelTransparent(data, x + 1, y, width)) {
            rightHasContent = true;
            break;
          }
        }
        
        // Only consider as a gap if there's content on both sides
        if (leftHasContent && rightHasContent) {
          gaps.push(x);
        }
      }
    }
    
    console.log(`Detected ${gaps.length} vertical gaps at columns:`, gaps);
    return gaps;
  }
  
  private findObjectBoundsInRegion(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    regionX: number,
    regionY: number,
    regionWidth: number,
    regionHeight: number
  ): { x: number; y: number; width: number; height: number } | null {
    let minX = regionX + regionWidth;
    let maxX = regionX;
    let minY = regionY + regionHeight;
    let maxY = regionY;
    let hasContent = false;
    
    // Find bounds of content within the specified region
    for (let y = regionY; y < regionY + regionHeight && y < imageHeight; y++) {
      for (let x = regionX; x < regionX + regionWidth && x < imageWidth; x++) {
        if (!this.isPixelTransparent(data, x, y, imageWidth)) {
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    if (!hasContent) {
      return null;
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  private floodFillObjectDataInRegion(
    data: Uint8ClampedArray,
    regionWidth: number,
    regionHeight: number,
    startX: number,
    startY: number,
    visited: boolean[]
  ): { bounds: { x: number; y: number; width: number; height: number }; pixels: Array<{x: number, y: number}> } | null {
    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixelCount = 0;
    const objectPixels: Array<{x: number, y: number}> = [];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      const {x, y} = current;
      
      if (x < 0 || x >= regionWidth || y < 0 || y >= regionHeight) continue;
      
      const pixelIndex = y * regionWidth + x;
      
      if (visited[pixelIndex] || this.isPixelTransparent(data, x, y, regionWidth)) {
        continue;
      }
      
      visited[pixelIndex] = true;
      pixelCount++;
      objectPixels.push({x, y});
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      stack.push({x: x + 1, y: y});
      stack.push({x: x - 1, y: y});
      stack.push({x: x, y: y + 1});
      stack.push({x: x, y: y - 1});
    }
    
    if (pixelCount === 0) return null;
    
    const padding = 1;
    const finalX = Math.max(0, minX - padding);
    const finalY = Math.max(0, minY - padding);
    const finalMaxX = Math.min(regionWidth - 1, maxX + padding);
    const finalMaxY = Math.min(regionHeight - 1, maxY + padding);
    
    return {
      bounds: {
        x: finalX,
        y: finalY,
        width: finalMaxX - finalX + 1,
        height: finalMaxY - finalY + 1
      },
      pixels: objectPixels
    };
  }
  private ctx!: CanvasRenderingContext2D;
  private mapCanvas: HTMLCanvasElement;
  private showMinimap: boolean = true;
  private isDarkMode: boolean = false;
  private debugMode: boolean = false;

  // Canvas management for cleanup
  private resizeObserver: ResizeObserver | null = null;
  private boundResizeHandler: (() => void) | null = null;
  
  // Canvas event handlers for cleanup
  private boundMouseDown: ((event: MouseEvent) => void) | null = null;
  private boundMouseMove: ((event: MouseEvent) => void) | null = null;
  private boundMouseUp: ((event: MouseEvent) => void) | null = null;
  private boundMouseLeave: ((event: MouseEvent) => void) | null = null;
  private boundWheel: ((event: WheelEvent) => void) | null = null;
  private boundContextMenu: ((event: Event) => void) | null = null;

  // State variables
  private mapWidth: number = 20;
  private mapHeight: number = 15;
  private mapName: string = 'Untitled Map';
  private readonly tileSizeX: number = 64;
  private readonly tileSizeY: number = 32;
  private readonly orientation: Orientation = 'isometric';
  
  // Tile detection settings
  private tileContentThreshold: number = 10; // Minimum alpha value to consider as content
  private objectSeparationSensitivity: number = 0.5; // 0 = merge everything, 1 = separate aggressively
  
  // Variable-sized tile information
  private detectedTileData: Map<number, {
    sourceX: number;
    sourceY: number;
    width: number;
    height: number;
    originX?: number;
    originY?: number;
  }> = new Map();

  // Layer-specific tileset management
  private layerTilesets: Map<string, LayerTilesetEntry> = new Map();
  private collisionTilesetLoading: boolean = false;
  private collisionTooltipEl: HTMLDivElement | null = null;
  private collisionTooltipHideTimeout: number | null = null;
  
  // Layer tab system: each layer type may have multiple tabs, each with its own tileset and detected tiles/brushes
  private nextLayerTabId: number = 1;
  private layerTabs: Map<string, Array<{
    id: number;
    name: string;
    tileset?: LayerTilesetEntry;
    detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>;
    brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>;
  }>> = new Map();

  // Active tab id per layer type
  private layerActiveTabId: Map<string, number> = new Map();
  
  // Per-layer detected tile data
  private layerTileData: Map<string, Map<number, {
    sourceX: number;
    sourceY: number;
    width: number;
    height: number;
    originX?: number;
    originY?: number;
  }>> = new Map();

  // Per-layer active tile selection
  private layerActiveGid: Map<string, number> = new Map();
  
  // Legacy tileset management (for backward compatibility)
  private tilesets: TilesetInfo[] = [];
  private tilesetTileWidth?: number;
  private tilesetTileHeight?: number;
  private tilesetSpacing?: number;
  private tilesetMargin?: number;
  private tilesetSourcePath: string | null = null;

  // Layer management
  private tileLayers: TileLayer[] = [];
  private activeLayerId: number | null = null;
  private nextLayerId: number = 1;

  // Collision and object management
  private collisionData: number[] = [];
  private objects: MapObject[] = [];
  private selectedObject: MapObject | null = null;
  private nextObjectId: number = 1;
  private selectedObjectId: number | null = null;
  private isDraggingActor: boolean = false;
  private draggingActorId: number | null = null;

  // Hero position management
  private heroX: number = 0;
  private heroY: number = 0;
  private isDraggingHero: boolean = false;
  private heroLastClickTime: number = 0;

  // Tool and interaction state
  private tool: Tool = 'tiles';
  private currentTool: 'brush' | 'eraser' | 'bucket' = 'brush';
  private currentSelectionTool: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular' = 'rectangular';
  private currentShapeTool: 'rectangle' | 'circle' | 'line' = 'rectangle';
  private currentStampMode: 'select' | 'create' | 'place' = 'select';
  private activeGid: number = 0;
  // Multi-selection of palette brushes when user holds Ctrl/Cmd and clicks
  private multiSelectedBrushes: Set<number> = new Set();
  private isMouseDown: boolean = false;

  // Selection state
  private selection: {
    active: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    tiles: Array<{x: number, y: number, gid: number}>;
  } = {
    active: false,
    startX: -1,
    startY: -1,
    endX: -1,
    endY: -1,
    tiles: []
  };
  private isSelecting: boolean = false;

  // Shape drawing state
  private shapeDrawing: {
    active: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    preview: Array<{x: number, y: number}>;
  } = {
    active: false,
    startX: -1,
    startY: -1,
    endX: -1,
    endY: -1,
    preview: []
  };
  private isDrawingShape: boolean = false;

  // Hover state
  private hoverX: number = -1;
  private hoverY: number = -1;

  // Zoom and pan state
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private lastPanX: number = 0;
  private lastPanY: number = 0;
  private spacePressed: boolean = false;

  // History system for undo/redo
  private history: Array<{ layers: TileLayer[], objects: MapObject[] }> = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;
  private isApplyingHistory: boolean = false;

  // Auto-save system
  private hasUnsavedChanges: boolean = false;
  private autoSaveTimeout: number | null = null;
  private lastSaveTimestamp: number = 0;
  private autoSaveCallback: (() => void) | null = null;
  private saveStatusCallback: ((status: 'saving' | 'saved' | 'error' | 'unsaved') => void) | null = null;
  // Callback to notify React app about active GID changes
  private activeGidCallback: ((gid: number) => void) | null = null;
  private readonly AUTO_SAVE_DELAY = 8000; // 8 seconds for tile changes
  private readonly IMMEDIATE_SAVE_DELAY = 2000; // 2 seconds for critical changes
  private autoSaveEnabled: boolean = true;

  private ensureCollisionTileset(): void {
    if (this.layerTilesets.has(COLLISION_LAYER_TYPE) || this.collisionTilesetLoading) {
      return;
    }

    const resolvedPath = this.resolveInternalAssetPath(INTERNAL_COLLISION_TILESET);
    if (!resolvedPath) {
      console.warn('Unable to resolve collision tileset asset path');
      return;
    }

    this.collisionTilesetLoading = true;

    const image = new Image();
    image.onload = () => {
      const columns = Math.max(1, Math.floor(image.width / this.tileSizeX));
      const rows = Math.max(1, Math.floor(image.height / this.tileSizeY));
      const count = Math.max(1, columns * rows);

      this.layerTilesets.set(COLLISION_LAYER_TYPE, {
        image,
        fileName: INTERNAL_COLLISION_TILESET,
        columns,
        rows,
        count,
        tileWidth: this.tileSizeX,
        tileHeight: this.tileSizeY,
        spacing: 0,
        margin: 0,
        sourcePath: resolvedPath
      });

      this.collisionTilesetLoading = false;

      if (this.getCurrentLayerType() === COLLISION_LAYER_TYPE) {
        this.updateCurrentTileset(COLLISION_LAYER_TYPE);
        this.draw();
      }
    };

    image.onerror = (error) => {
      console.warn('Failed to load default collision tileset.', error);
      this.collisionTilesetLoading = false;
    };

    image.src = resolvedPath;
  }


  private clearCollisionBrushTooltipHideTimeout(): void {
    if (this.collisionTooltipHideTimeout !== null) {
      window.clearTimeout(this.collisionTooltipHideTimeout);
      this.collisionTooltipHideTimeout = null;
    }
  }

  private getCollisionTooltipElement(): HTMLDivElement | null {
    if (typeof document === 'undefined') {
      return null;
    }

    if (!this.collisionTooltipEl) {
      const el = document.createElement('div');
      el.dataset.collisionTooltip = 'true';
      el.setAttribute('role', 'tooltip');
      el.setAttribute('aria-hidden', 'true');
      el.style.position = 'fixed';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '9999';
      el.style.maxWidth = '260px';
      el.style.padding = '6px 10px';
      el.style.fontSize = '12px';
      el.style.lineHeight = '1.2';
      el.style.fontWeight = '500';
      el.style.color = '#f5f5f5';
      el.style.background = 'rgba(15, 15, 16, 0.92)';
      el.style.border = '1px solid rgba(255, 255, 255, 0.08)';
      el.style.borderRadius = '8px';
      el.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.35)';
      el.style.backdropFilter = 'blur(4px)';
      el.style.opacity = '0';
      el.style.transform = 'translateY(0)';
      el.style.transition = 'opacity 120ms ease, transform 120ms ease';
      el.style.whiteSpace = 'nowrap';
      el.style.display = 'none';
      document.body.appendChild(el);
      this.collisionTooltipEl = el;
    }

    return this.collisionTooltipEl;
  }

  private positionCollisionBrushTooltip(tooltipEl: HTMLDivElement, wrapper: HTMLElement, event?: MouseEvent): boolean {
    const margin = 12;
    const rect = wrapper.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const cursorX = event ? event.clientX : rect.left + rect.width / 2;
    let top = (event ? event.clientY : rect.top) - tooltipEl.offsetHeight - margin;
    let below = false;

    if (top < margin) {
      below = true;
      top = (event ? event.clientY : rect.bottom) + margin;
    }

    let left = cursorX - tooltipEl.offsetWidth / 2;
    if (left < margin) {
      left = margin;
    } else if (left + tooltipEl.offsetWidth > vw - margin) {
      left = vw - margin - tooltipEl.offsetWidth;
    }

    if (top + tooltipEl.offsetHeight > vh - margin) {
      top = Math.max(margin, vh - margin - tooltipEl.offsetHeight);
    }

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;

    return below;
  }

  private showCollisionBrushTooltip(wrapper: HTMLElement, text: string, event: MouseEvent): void {
    const tooltipEl = this.getCollisionTooltipElement();
    if (!tooltipEl) {
      return;
    }

    this.clearCollisionBrushTooltipHideTimeout();
    tooltipEl.textContent = text;
    tooltipEl.setAttribute('aria-hidden', 'false');
    tooltipEl.style.display = 'block';
    tooltipEl.style.opacity = '0';

    const below = this.positionCollisionBrushTooltip(tooltipEl, wrapper, event);
    tooltipEl.style.transform = `translateY(${below ? '6px' : '-6px'})`;

    requestAnimationFrame(() => {
      tooltipEl.style.opacity = '1';
      tooltipEl.style.transform = 'translateY(0)';
    });
  }

  private updateCollisionBrushTooltipPosition(wrapper: HTMLElement, event: MouseEvent): void {
    const tooltipEl = this.collisionTooltipEl;
    if (!tooltipEl || tooltipEl.style.display === 'none') {
      return;
    }

    this.clearCollisionBrushTooltipHideTimeout();
    this.positionCollisionBrushTooltip(tooltipEl, wrapper, event);
    tooltipEl.style.transform = 'translateY(0)';
  }

  private getLayerTilesetOrFallback(layerType: string): LayerTilesetEntry | null {
    const existing = this.layerTilesets.get(layerType);
    if (existing && existing.image) {
      return existing;
    }

    if (layerType === 'background' && this.tilesetImage && this.tilesetFileName) {
      const columns = this.tilesetColumns || Math.max(1, Math.floor(this.tilesetImage.width / this.tileSizeX));
      const rows = this.tilesetRows || Math.max(1, Math.floor(this.tilesetImage.height / this.tileSizeY));
      const count = this.tileCount || Math.max(1, columns * rows);
      const tileWidth = this.tilesetTileWidth ?? Math.round(this.tilesetImage.width / Math.max(columns, 1));
      const tileHeight = this.tilesetTileHeight ?? Math.round(this.tilesetImage.height / Math.max(rows, 1));

      return {
        image: this.tilesetImage,
        fileName: this.tilesetFileName,
        columns,
        rows,
        count,
        tileWidth,
        tileHeight,
        spacing: this.tilesetSpacing ?? 0,
        margin: this.tilesetMargin ?? 0,
        sourcePath: this.tilesetSourcePath ?? null
      };
    }

    return existing ?? null;
  }

  private hideCollisionBrushTooltip(immediate: boolean = false): void {
    const tooltipEl = this.collisionTooltipEl;
    if (!tooltipEl) {
      return;
    }

    this.clearCollisionBrushTooltipHideTimeout();

    tooltipEl.setAttribute('aria-hidden', 'true');
    tooltipEl.style.opacity = '0';

    if (immediate) {
      tooltipEl.style.display = 'none';
      return;
    }

    this.collisionTooltipHideTimeout = window.setTimeout(() => {
      if (this.collisionTooltipEl === tooltipEl) {
        tooltipEl.style.display = 'none';
      }
      this.collisionTooltipHideTimeout = null;
    }, 150);
  }

  private snapshotLayerGids(): Map<string, { unique: number[]; nonZeroCount: number }> {
    const snapshot = new Map<string, { unique: number[]; nonZeroCount: number }>();
    for (const layer of this.tileLayers) {
      const uniqueSet = new Set<number>();
      let nonZeroCount = 0;
      for (const gid of layer.data) {
        if (gid > 0) {
          nonZeroCount++;
          uniqueSet.add(gid);
        }
      }
      snapshot.set(layer.type, { unique: Array.from(uniqueSet).sort((a, b) => a - b), nonZeroCount });
    }
    return snapshot;
  }

  private logLayerGidChanges(
    before: Map<string, { unique: number[]; nonZeroCount: number }>,
    after: Map<string, { unique: number[]; nonZeroCount: number }>,
    sourceLayerType: string
  ): void {
    for (const [layerType, afterInfo] of after.entries()) {
      if (layerType === sourceLayerType) {
        continue;
      }
      const beforeInfo = before.get(layerType);
      if (!beforeInfo) {
        continue;
      }
      const uniqueChanged =
        beforeInfo.unique.length !== afterInfo.unique.length ||
        beforeInfo.unique.some((value, index) => value !== afterInfo.unique[index]);
      const countChanged = beforeInfo.nonZeroCount !== afterInfo.nonZeroCount;

      if (uniqueChanged || countChanged) {
        console.warn('[GID DEBUG]', {
          sourceLayerType,
          layerType,
          before: beforeInfo,
          after: afterInfo
        });
      }
    }
  }



  constructor(mapCanvas: HTMLCanvasElement) {
    this.mapCanvas = mapCanvas;
    this.initializeCanvas();
    this.initializeState();
    this.bindEvents();
    this.createDefaultLayers();
    
    // Save initial state for undo/redo
    this.saveState();
    
    this.draw();
  }

  // Internal helper to update activeGid and notify callback
  private updateActiveGid(gid: number): void {
    this.activeGid = gid;
    if (this.activeGidCallback) {
      try {
        this.activeGidCallback(this.activeGid);
      } catch (e) {
        console.warn('activeGidCallback error', e);
      }
    }
  }

  // Allow external code (React) to observe active GID changes
  public setActiveGidCallback(cb: ((gid: number) => void) | null): void {
    this.activeGidCallback = cb;
    // Immediately notify with current value if callback provided
    if (cb) {
      try {
        cb(this.activeGid);
      } catch (e) {
        console.warn('setActiveGidCallback initial callback error', e);
      }
    }
  }

  private initializeCanvas(): void {
    const ctx = this.mapCanvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Unable to get canvas context');
    }

    this.ctx = ctx;

    // Set up canvas properties
    this.ctx.imageSmoothingEnabled = false;
    
    // Clean up previous observers if they exist
    this.cleanupCanvasObservers();
    
    // Set canvas dimensions to fill the available container
    this.resizeCanvas();
    
    // Create bound resize handler to allow proper cleanup
    this.boundResizeHandler = () => this.resizeCanvas();
    
    // Listen for window resize to adjust canvas size
    window.addEventListener('resize', this.boundResizeHandler);
    
    // Use ResizeObserver for more accurate container size tracking
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      if (this.mapCanvas.parentElement) {
        this.resizeObserver.observe(this.mapCanvas.parentElement);
      }
    }
  }

  private cleanupCanvasObservers(): void {
    // Clean up previous resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Clean up previous window resize listener
    if (this.boundResizeHandler) {
      window.removeEventListener('resize', this.boundResizeHandler);
      this.boundResizeHandler = null;
    }
  }

  private cleanupCanvasEvents(): void {
    // Clean up canvas-specific event listeners
    if (this.boundMouseDown) {
      this.mapCanvas.removeEventListener('mousedown', this.boundMouseDown);
      this.boundMouseDown = null;
    }
    
    if (this.boundMouseMove) {
      this.mapCanvas.removeEventListener('mousemove', this.boundMouseMove);
      this.boundMouseMove = null;
    }
    
    if (this.boundMouseUp) {
      this.mapCanvas.removeEventListener('mouseup', this.boundMouseUp);
      this.boundMouseUp = null;
    }
    
    if (this.boundMouseLeave) {
      this.mapCanvas.removeEventListener('mouseleave', this.boundMouseLeave);
      this.boundMouseLeave = null;
    }
    
    if (this.boundWheel) {
      this.mapCanvas.removeEventListener('wheel', this.boundWheel);
      this.boundWheel = null;
    }
    
    if (this.boundContextMenu) {
      this.mapCanvas.removeEventListener('contextmenu', this.boundContextMenu);
      this.boundContextMenu = null;
    }
  }

  private resizeCanvas(): void {
    const container = this.mapCanvas.parentElement;
    if (container) {
      // Use requestAnimationFrame to ensure proper sizing after layout changes
      requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        // Ensure we don't exceed container bounds
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        
        // Only update if dimensions actually changed to avoid unnecessary redraws
        if (this.mapCanvas.width !== width || this.mapCanvas.height !== height) {
          this.mapCanvas.width = width;
          this.mapCanvas.height = height;
          
          // Redraw after resize
          this.draw();
        }
      });
    }
  }

  private initializeState(): void {
    // Initialize collision data
    this.collisionData = new Array(this.mapWidth * this.mapHeight).fill(0);
  }

  private bindEvents(): void {
    // Clean up any existing canvas event listeners first
    this.cleanupCanvasEvents();
    
    // Create bound handlers
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundMouseLeave = this.handleMouseLeave.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundContextMenu = (e) => e.preventDefault();
    
    // Mouse events for the main canvas
    this.mapCanvas.addEventListener('mousedown', this.boundMouseDown);
    this.mapCanvas.addEventListener('mousemove', this.boundMouseMove);
    this.mapCanvas.addEventListener('mouseup', this.boundMouseUp);
    this.mapCanvas.addEventListener('mouseleave', this.boundMouseLeave);
    this.mapCanvas.addEventListener('contextmenu', this.boundContextMenu);
    
    // Zoom events
    this.mapCanvas.addEventListener('wheel', this.boundWheel);
    
    // Keyboard events for panning (need to be on document for spacebar)
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Focus the canvas to receive keyboard events
    this.mapCanvas.tabIndex = 0;
  }

  private createDefaultLayers(): void {
    // Create all 6 layers in the correct order (NPC -> Enemy -> Event -> Collision -> Object -> Background)
    this.tileLayers = [
      {
        id: 1,
        name: 'NPC Layer',
        type: 'npc',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 2,
        name: 'Enemy Layer',
        type: 'enemy',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 3,
        name: 'Event Layer',
        type: 'event',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 4,
        name: 'Collision Layer',
        type: 'collision',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 5,
        name: 'Object Layer',
        type: 'object',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 6,
        name: 'Background Layer',
        type: 'background',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      }
    ];
    
    // Set the background layer as active by default
    this.activeLayerId = 6;
    this.nextLayerId = 7;
    this.sortLayersByPriority();
    // Initialize layer tabs for background and object with one tab each
    try {
      // Clear any previous tab data
      this.layerTabs.clear();
      this.layerActiveTabId.clear();
      // Create one tab for object and background if those layers exist
      const hasObject = this.tileLayers.some(l => l.type === 'object');
      const hasBackground = this.tileLayers.some(l => l.type === 'background');
      if (hasObject) {
        const id = this.createLayerTab('object');
        this.setActiveLayerTab('object', id);
      }
      if (hasBackground) {
        const id = this.createLayerTab('background');
        this.setActiveLayerTab('background', id);
      }
    } catch (e) {
      console.warn('Failed to initialize default layer tabs', e);
    }

    this.ensureCollisionTileset();
  }

  private getDraggableActorAt(x: number, y: number): MapObject | null {
    if (x < 0 || y < 0) return null;
    return this.objects.find(obj => obj.x === x && obj.y === y && this.actorUsesPlaceholder(obj)) || null;
  }

  private handleActorDrag(x: number, y: number): void {
    if (!this.isDraggingActor || this.draggingActorId === null) return;
    if (x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) return;

    const actor = this.objects.find(obj => obj.id === this.draggingActorId);
    if (!actor) return;
    if (actor.x === x && actor.y === y) return;

    this.updateMapObject(actor.id, { x, y });
    this.draw();
  }

  private handleMouseDown(event: MouseEvent): void {
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.spacePressed) {
      // Start panning
      this.isPanning = true;
      this.lastPanX = x;
      this.lastPanY = y;
      this.mapCanvas.style.cursor = 'grabbing';
    } else {
      // Normal tile editing or selection
      this.isMouseDown = true;
      const tileCoords = this.screenToTile(x, y);
      if (tileCoords) {
        // Check if clicking on hero position
        if (this.isHeroAtPosition(tileCoords.x, tileCoords.y)) {
          this.handleHeroClick(tileCoords.x, tileCoords.y, event);
          return;
        }

        const actorAtPosition = this.getDraggableActorAt(tileCoords.x, tileCoords.y);
        if (actorAtPosition) {
          this.isDraggingActor = true;
          this.draggingActorId = actorAtPosition.id;
          this.selectedObject = actorAtPosition;
          this.selectedObjectId = actorAtPosition.id;
          return;
        }

        if (this.tool === 'tiles') {
          this.handleTileClick(tileCoords.x, tileCoords.y, event.button === 2);
        } else if (this.tool === 'selection') {
          this.handleSelectionStart(tileCoords.x, tileCoords.y, event.button === 2);
        } else if (this.tool === 'shape') {
          this.handleShapeStart(tileCoords.x, tileCoords.y, event.button === 2);
        } else if (this.tool === 'eyedropper') {
          const sampledGid = this.handleEyedropper(tileCoords.x, tileCoords.y);
          if (sampledGid) {
            // Eyedropper was successful, no need to continue with mouse down
            this.isMouseDown = false;
          }
        } else if (this.tool === 'stamp') {
          this.handleStampClick(tileCoords.x, tileCoords.y, event.button === 2);
        }
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isPanning && this.spacePressed) {
      // Handle panning
      const deltaX = x - this.lastPanX;
      const deltaY = y - this.lastPanY;
      this.setPan(deltaX, deltaY);
      this.lastPanX = x;
      this.lastPanY = y;
    } else {
      // Normal hover and tile editing
      const tileCoords = this.screenToTile(x, y);
      if (tileCoords) {
        this.hoverX = tileCoords.x;
        this.hoverY = tileCoords.y;
        
        // Check if there's an object at hover position and update cursor
        this.updateCursorForHover();
        
        // Update stamp preview position
        if (this.tool === 'stamp' && this.currentStampMode === 'place' && this.activeStamp) {
          this.stampPreview.x = tileCoords.x;
          this.stampPreview.y = tileCoords.y;
          this.stampPreview.visible = true;
        }
        
        if (this.isMouseDown && !this.spacePressed) {
          if (this.isDraggingHero) {
            // Update hero position while dragging
            this.setHeroPosition(tileCoords.x, tileCoords.y);
          } else if (this.isDraggingActor) {
            this.handleActorDrag(tileCoords.x, tileCoords.y);
          } else if (this.tool === 'tiles') {
            this.handleTileClick(tileCoords.x, tileCoords.y, false);
          } else if (this.isSelecting) {
            this.handleSelectionDrag(tileCoords.x, tileCoords.y);
          } else if (this.isDrawingShape) {
            this.handleShapeDrag(tileCoords.x, tileCoords.y);
          }
        }
      }
    }
    
    this.draw();
  }

  private handleMouseUp(): void {
    if (this.isSelecting) {
      this.handleSelectionEnd();
    } else if (this.isDrawingShape) {
      this.handleShapeEnd();
    }
    
    // Stop hero dragging
    if (this.isDraggingHero) {
      this.isDraggingHero = false;
    }

    if (this.isDraggingActor) {
      this.isDraggingActor = false;
      this.draggingActorId = null;
    }

    this.isMouseDown = false;
    this.isPanning = false;
  }

  private handleMouseLeave(): void {
    // Hide tooltip when mouse leaves canvas
    this.hideObjectTooltip();
    // Reset hover coordinates
    this.hoverX = -1;
    this.hoverY = -1;
    this.isDraggingActor = false;
    this.draggingActorId = null;
    this.draw();
  }

  private handleHeroClick(_x: number, _y: number, _event: MouseEvent): void {
    const currentTime = Date.now();
    
    // Check for double-click (within 300ms)
    if (currentTime - this.heroLastClickTime < 300) {
      // Double-click detected - open hero edit dialog
      this.openHeroEditDialog();
    } else {
      // Single click - start dragging
      this.isDraggingHero = true;
    }
    
    this.heroLastClickTime = currentTime;
  }

  private openHeroEditDialog(): void {
    if (this.heroEditCallback) {
      this.heroEditCallback(
        this.heroX,
        this.heroY,
        this.mapWidth,
        this.mapHeight,
        (x: number, y: number) => {
          this.setHeroPosition(x, y);
        }
      );
    } else {
      // Fallback to alert if no callback is set
      alert(`Hero position: (${this.heroX}, ${this.heroY}). Set up hero edit dialog in React component.`);
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.zoom * zoomFactor);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      this.spacePressed = true;
      this.mapCanvas.style.cursor = 'grab';
    }
    
    // Undo/Redo shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.code) {
        case 'KeyZ':
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl+Shift+Z = Redo (alternative)
            this.redo();
          } else {
            // Ctrl+Z = Undo
            this.undo();
          }
          break;
        case 'KeyY':
          // Ctrl+Y = Redo
          event.preventDefault();
          this.redo();
          break;
        case 'KeyA':
          event.preventDefault();
          this.selectAll();
          break;
      }
    }
    
    // Other shortcuts
    switch (event.code) {
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.deleteSelection();
        break;
      case 'Escape':
        event.preventDefault();
        this.clearSelection();
        // Also cancel shape drawing if in progress
        if (this.isDrawingShape) {
          this.shapeDrawing.active = false;
          this.isDrawingShape = false;
          this.shapeDrawing.preview = [];
          this.draw();
        }
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      this.spacePressed = false;
      this.mapCanvas.style.cursor = 'crosshair';
    }
  }

  private screenToTile(screenX: number, screenY: number): { x: number, y: number } | null {
    // Convert screen coordinates to world coordinates first
    const worldCoords = this.screenToWorld(screenX, screenY);
    
    // Cast a ray from the mouse position to find which tile diamond it hits
    return this.raycastToTile(worldCoords.x, worldCoords.y);
  }

  private handleStampClick(x: number, y: number, isRightClick: boolean): void {
    if (isRightClick) {
      // Right-click clears stamp preview
      this.stampPreview.visible = false;
      this.draw();
      return;
    }

    if (this.currentStampMode === 'create') {
      // Start selection for creating a stamp
      this.handleSelectionStart(x, y, isRightClick);
    } else if (this.currentStampMode === 'place' && this.activeStamp) {
      // Place the active stamp
      this.placeStamp(x, y);
    }
  }

  private handleTileClick(x: number, y: number, isRightClick: boolean): void {
    if (this.activeLayerId !== null) {
      const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (layer) {
        const index = y * this.mapWidth + x;
        const currentValue = layer.data[index];
        let newValue: number;

        // Get the active GID for the current layer
        const currentLayerActiveGid = this.getCurrentLayerActiveGid();

        // Determine the action based on right-click or current tool
        if (isRightClick) {
          // Right-click always acts as eraser
          newValue = 0;
        } else {
          // Left-click behavior depends on current tool
          switch (this.currentTool) {
            case 'brush':
              // Don't paint if no tile is selected (activeGid is 0)
              if (currentLayerActiveGid === 0 && this.multiSelectedBrushes.size === 0) {
                return; // Exit early, don't paint anything
              }

              // If multiple brushes are selected, stamp them as a block
              if (this.multiSelectedBrushes.size > 1) {
                this.saveState();
                this.placeMultiSelectionAt(x, y);
                this.markAsChanged();
                return;
              }

              newValue = currentLayerActiveGid;
              break;
            case 'eraser':
              newValue = 0;
              break;
            case 'bucket':
              // Don't bucket fill if no tile is selected (activeGid is 0)
              if (currentLayerActiveGid === 0) {
                return; // Exit early, don't paint anything
              }
              // Bucket fill uses a different approach
              if (currentValue !== currentLayerActiveGid) {
                this.saveState();
                this.bucketFill(layer, x, y, currentLayerActiveGid);
                this.markAsChanged();
                this.draw(); // Immediately reflect changes
              }
              return; // Exit early for bucket fill
            default:
              // Don't paint if no tile is selected (activeGid is 0)
              if (currentLayerActiveGid === 0) {
                return; // Exit early, don't paint anything
              }
              newValue = currentLayerActiveGid;
              break;
          }
        }
        
        // Only save state and apply change if the value is actually changing
        if (currentValue !== newValue) {
          this.saveState();
          
          // Debug: Log layer information
          console.log(`Painting on layer: ${layer.name} (ID: ${layer.id}, Type: ${layer.type})`);
          console.log(`Position: (${x}, ${y}), Index: ${index}`);
          console.log(`Current value: ${currentValue}, New value: ${newValue}`);
          console.log(`Active GID for this layer: ${currentLayerActiveGid}`);
          
          layer.data[index] = newValue;
          
          // Handle object creation/removal based on layer type
          if (layer.type === 'event' || layer.type === 'enemy' || layer.type === 'npc' || layer.type === 'object') {
            if (newValue > 0) {
              // Create object when placing tile
              this.createObjectFromTile(x, y, layer.type, newValue);
            } else {
              // Remove object when erasing tile
              this.removeObjectAtPosition(x, y);
            }
          }
          
          this.markAsChanged();
          this.draw(); // Immediately reflect changes
        }
      }
    }
  }

  // Selection event handlers
  private handleSelectionStart(x: number, y: number, isRightClick: boolean): void {
    if (isRightClick) {
      // Right-click clears selection
      this.clearSelection();
      return;
    }

    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return;

    this.selection.startX = x;
    this.selection.startY = y;
    this.selection.endX = x;
    this.selection.endY = y;

    // For instant selection tools (magic wand, same tile), execute immediately
    if (this.currentSelectionTool === 'magic-wand') {
      this.selectMagicWand(layer, x, y);
      this.draw();
    } else if (this.currentSelectionTool === 'same-tile') {
      this.selectSameTile(layer, x, y);
      this.draw();
    } else {
      // For drag-based tools (rectangular, circular), start selection
      this.isSelecting = true;
    }
  }

  private handleSelectionDrag(x: number, y: number): void {
    if (!this.isSelecting) return;

    this.selection.endX = x;
    this.selection.endY = y;
    this.draw(); // Update preview
  }

  private handleSelectionEnd(): void {
    if (!this.isSelecting) return;

    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return;

    // Execute the selection based on tool type
    if (this.currentSelectionTool === 'rectangular') {
      this.selectRectangular(layer, this.selection.startX, this.selection.startY, this.selection.endX, this.selection.endY);
    } else if (this.currentSelectionTool === 'circular') {
      this.selectCircular(layer, this.selection.startX, this.selection.startY, this.selection.endX, this.selection.endY);
    }

    this.isSelecting = false;
    this.draw();
  }

  // Shape event handlers
  private handleShapeStart(x: number, y: number, isRightClick: boolean): void {
    if (isRightClick) {
      // Right-click cancels shape drawing
      this.shapeDrawing.active = false;
      this.isDrawingShape = false;
      this.draw();
      return;
    }

    this.shapeDrawing.active = true;
    this.shapeDrawing.startX = x;
    this.shapeDrawing.startY = y;
    this.shapeDrawing.endX = x;
    this.shapeDrawing.endY = y;
    this.shapeDrawing.preview = [];
    this.isDrawingShape = true;
  }

  private handleShapeDrag(x: number, y: number): void {
    if (!this.isDrawingShape) return;

    this.shapeDrawing.endX = x;
    this.shapeDrawing.endY = y;

    // Update preview based on shape type
    switch (this.currentShapeTool) {
      case 'rectangle':
        this.shapeDrawing.preview = this.drawRectangleShape(
          this.shapeDrawing.startX, this.shapeDrawing.startY,
          this.shapeDrawing.endX, this.shapeDrawing.endY
        );
        break;
      case 'circle':
        this.shapeDrawing.preview = this.drawCircleShape(
          this.shapeDrawing.startX, this.shapeDrawing.startY,
          this.shapeDrawing.endX, this.shapeDrawing.endY
        );
        break;
      case 'line':
        this.shapeDrawing.preview = this.drawLineShape(
          this.shapeDrawing.startX, this.shapeDrawing.startY,
          this.shapeDrawing.endX, this.shapeDrawing.endY
        );
        break;
    }

    this.draw(); // Update preview
  }

  private handleShapeEnd(): void {
    if (!this.isDrawingShape) return;

    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return;

    // Get the active GID for the current layer
    const currentLayerActiveGid = this.getCurrentLayerActiveGid();

    // Apply the shape to the layer
    if (this.shapeDrawing.preview.length > 0 && currentLayerActiveGid > 0) {
      this.saveState();
      
      this.shapeDrawing.preview.forEach(point => {
        const index = point.y * this.mapWidth + point.x;
        layer.data[index] = currentLayerActiveGid;
      });

      this.markAsChanged();
    }

    this.shapeDrawing.active = false;
    this.isDrawingShape = false;
    this.shapeDrawing.preview = [];
    this.draw();
  }

  // Eyedropper functionality
  private handleEyedropper(x: number, y: number): number | null {
    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return null;

    if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
      const index = y * this.mapWidth + x;
      const gid = layer.data[index];
      
      if (gid > 0) {
        // Set the active GID for the current layer
        this.setCurrentLayerActiveGid(gid);
        this.updateTilePaletteSelection();
        
        // Switch back to brush tool automatically
        this.tool = 'tiles';
        this.currentTool = 'brush';
        this.mapCanvas.style.cursor = 'crosshair';
        
        // Notify the UI that we switched back to brush
        if (this.eyedropperCallback) {
          this.eyedropperCallback();
        }
        
        return gid;
      }
    }
    
    return null;
  }

  private updateTilePaletteSelection(): void {
    // Update the active GID display
    const activeGidSpan = document.getElementById('activeGid');
    if (activeGidSpan) {
      activeGidSpan.textContent = this.activeGid.toString();
    }

    // Update tile palette visual selection
    const tiles = document.querySelectorAll('.tile-palette .tile');
    tiles.forEach((tile, index) => {
      const tileElement = tile as HTMLElement;
      if (index === this.activeGid - 1) {
        tileElement.classList.add('selected');
        tileElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        tileElement.classList.remove('selected');
      }
    });
  }

  private draw(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    
    // Save context state
    this.ctx.save();
    
    // Apply zoom and pan transformations to the drawing context
    // Note: We don't apply transformations here since they're already applied in mapToScreen()
    
    // Draw grid
    this.drawGrid();
    
    // Draw tiles
    this.drawTiles();
    
    // Draw hover
    if (this.hoverX >= 0 && this.hoverY >= 0) {
      this.drawHover();
    }
    
    // Draw selection
    this.drawSelection();
    
    // Draw hero position marker
    this.drawHeroPosition();

    // Draw NPC/enemy placeholders when no tile assigned
    this.drawActorPlaceholders();

    // Draw shape preview
    this.drawShapePreview();
    
    // Restore context state
    this.ctx.restore();
    
    // Update mini map (not affected by zoom/pan)
    this.drawMiniMap();
    
    // Draw stamp preview
    this.drawStampPreview();
    
    // Draw debug info if enabled
    this.drawDebugInfo();
  }

  // Coordinate transformation methods for isometric rendering with zoom and pan
  private mapToScreen(mapX: number, mapY: number): { x: number, y: number } {
    // Calculate the basic isometric screen coordinates (top point of diamond)
    const screenX = (mapX - mapY) * (this.tileSizeX / 2);
    const screenY = (mapX + mapY) * (this.tileSizeY / 2);
    
    // Apply zoom and pan transformations
    const offsetX = this.mapCanvas.width / 2 + this.panX;
    const offsetY = 100 + this.panY;
    
    return {
      x: (screenX + offsetX) * this.zoom,
      y: (screenY + offsetY) * this.zoom
    };
  }

  private screenToMap(screenX: number, screenY: number): { x: number, y: number } {
    // Apply inverse transformations in reverse order
    // First, apply inverse zoom
    const unzoomedX = screenX / this.zoom;
    const unzoomedY = screenY / this.zoom;
    
    // Then, apply inverse offset
    const offsetX = this.mapCanvas.width / 2 + this.panX;
    const offsetY = 100 + this.panY;
    const adjustedX = unzoomedX - offsetX;
    const adjustedY = unzoomedY - offsetY;
    
    // Offset from center back to corner (move from center to corner for calculation)
    const cornerX = adjustedX - (this.tileSizeX / 2);
    const cornerY = adjustedY - (this.tileSizeY / 2);
    
    // Convert to map coordinates using inverse isometric transformation
    // Forward: screenX = (mapX - mapY) * (tileSizeX / 2), screenY = (mapX + mapY) * (tileSizeY / 2)
    // Inverse: solve for mapX and mapY
    const halfTileX = this.tileSizeX / 2;
    const halfTileY = this.tileSizeY / 2;
    
    const mapX = (cornerX / halfTileX + cornerY / halfTileY) / 2;
    const mapY = (cornerY / halfTileY - cornerX / halfTileX) / 2;
    
    return {
      x: Math.floor(mapX),
      y: Math.floor(mapY)
    };
  }

  // Ray casting methods for accurate tile picking
  private screenToWorld(screenX: number, screenY: number): { x: number, y: number } {
    // This must exactly reverse the mapToScreen transformation
    // mapToScreen: (centeredWorld + offset) * zoom = screen
    // screenToWorld: screen / zoom - offset = centeredWorld
    
    const unzoomedX = screenX / this.zoom;
    const unzoomedY = screenY / this.zoom;
    
    const offsetX = this.mapCanvas.width / 2 + this.panX;
    const offsetY = 100 + this.panY;
    
    // This gives us the centered world coordinates (matching mapToScreen output format)
    return {
      x: unzoomedX - offsetX,
      y: unzoomedY - offsetY
    };
  }

  private raycastToTile(worldX: number, worldY: number): { x: number, y: number } | null {
    // Simple brute force approach for accuracy - check all tiles
    // This is more reliable than trying to optimize with estimates
    const candidates: Array<{ x: number, y: number, distance: number }> = [];
    
    // Convert world position to screen for distance calculations
    const worldScreen = this.worldToScreen(worldX, worldY);
    
    for (let tileY = 0; tileY < this.mapHeight; tileY++) {
      for (let tileX = 0; tileX < this.mapWidth; tileX++) {
        if (this.isPointInTileDiamond(worldX, worldY, tileX, tileY)) {
          // Calculate distance from mouse to tile center in screen space
          const tileScreen = this.mapToScreen(tileX, tileY);
          const distance = Math.sqrt(
            Math.pow(worldScreen.x - tileScreen.x, 2) + 
            Math.pow(worldScreen.y - tileScreen.y, 2)
          );
          candidates.push({ x: tileX, y: tileY, distance });
        }
      }
    }
    
    // Return the closest tile if any candidates found
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      return { x: candidates[0].x, y: candidates[0].y };
    }
    
    return null;
  }

  private isPointInTileDiamond(worldX: number, worldY: number, tileX: number, tileY: number): boolean {
    // Use the exact same positioning as the debug grid and tile rendering
    const screenPos = this.mapToScreen(tileX, tileY);
    
    // Convert world coordinates to screen coordinates for comparison
    const worldScreen = this.worldToScreen(worldX, worldY);
    
    // Calculate local coordinates relative to the tile center
    const localX = worldScreen.x - screenPos.x;
    const localY = worldScreen.y - screenPos.y;
    
    // Check if point is inside diamond using the diamond equation
    // For a diamond centered at origin with half-widths w and h:
    // |x/w| + |y/h| <= 1
    const halfWidth = (this.tileSizeX / 2) * this.zoom;
    const halfHeight = (this.tileSizeY / 2) * this.zoom;
    
    // Use slightly smaller diamond for better edge detection and avoid floating point edge cases
    const tolerance = 0.90; // Shrink diamond by 10% to avoid edge cases
    
    const normalizedX = Math.abs(localX / halfWidth);
    const normalizedY = Math.abs(localY / halfHeight);
    
    return (normalizedX + normalizedY) <= tolerance;
  }

  private tileToWorld(tileX: number, tileY: number): { x: number, y: number } {
    // Return the basic isometric coordinates (no centering offset)
    return {
      x: (tileX - tileY) * (this.tileSizeX / 2),
      y: (tileX + tileY) * (this.tileSizeY / 2)
    };
  }

  private worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
    const offsetX = this.mapCanvas.width / 2 + this.panX;
    const offsetY = 100 + this.panY;
    
    return {
      x: (worldX + offsetX) * this.zoom,
      y: (worldY + offsetY) * this.zoom
    };
  }

  // Debug methods
  private drawDebugInfo(): void {
    if (!this.debugMode) return;
    
    // Draw diamond boundaries for all tiles using EXACTLY the same logic as drawHover
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    this.ctx.lineWidth = 1;
    
    for (let tileY = 0; tileY < this.mapHeight; tileY++) {
      for (let tileX = 0; tileX < this.mapWidth; tileX++) {
        // Use the exact same positioning logic as drawHover
        const screenPos = this.mapToScreen(tileX, tileY);
        const halfTileX = (this.tileSizeX / 2) * this.zoom;
        const halfTileY = (this.tileSizeY / 2) * this.zoom;
        
        // Draw diamond shape using the same exact pattern as hover
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        this.ctx.closePath();
        this.ctx.stroke();
        
        // ALSO draw where the tile image would actually be positioned
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        this.ctx.lineWidth = 1;
        
  // Calculate where the tile image is actually drawn (matching drawTile logic)
  const scaledTileX = this.tileSizeX * this.zoom;
  const scaledTileY = this.tileSizeY * this.zoom;
  const groundY = screenPos.y + halfTileY;
  const destX = screenPos.x - (scaledTileX / 2);
  const destY = groundY - scaledTileY;
        
        // Draw rectangle showing where the tile image is actually placed
        this.ctx.strokeRect(destX, destY, scaledTileX, scaledTileY);
        
        // Reset color for coordinates
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        
        // Draw tile coordinates
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${tileX},${tileY}`, screenPos.x, screenPos.y);
      }
    }
  }

  public toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    this.draw();
  }

  public getDebugMode(): boolean {
    return this.debugMode;
  }

  // Zoom and pan methods
  public setZoom(newZoom: number): void {
    this.zoom = Math.max(0.1, Math.min(5, newZoom)); // Clamp between 0.1x and 5x
    this.draw();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public zoomIn(): void {
    this.setZoom(this.zoom * 1.2);
  }

  public zoomOut(): void {
    this.setZoom(this.zoom / 1.2);
  }

  public resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.draw();
  }

  public toggleMinimap(): void {
    this.showMinimap = !this.showMinimap;
    this.draw();
  }

  // During sidebar open/close animations we can avoid recomputing minimap
  // coordinates to prevent jitter. When this flag is true the drawMiniMap
  // function will reuse the last computed coordinates until transitions end.
  private sidebarTransitioning: boolean = false;
  private lastMiniMapPos: { x: number; y: number } | null = null;

  public setSidebarTransitioning(flag: boolean): void {
    this.sidebarTransitioning = !!flag;
    if (!this.sidebarTransitioning) {
      // Clear cache when transition finishes so next draw computes fresh pos
      this.lastMiniMapPos = null;
    }
  }

  public setPan(deltaX: number, deltaY: number): void {
    this.panX += deltaX;
    this.panY += deltaY;
    this.draw();
  }

  // Public method to trigger canvas resize
  public resizeCanvasToContainer(): void {
    this.resizeCanvas();
  }

  private drawGrid(): void {
    // Use different grid colors based on dark mode
    this.ctx.strokeStyle = this.isDarkMode ? '#666' : '#999';
    this.ctx.lineWidth = Math.max(1, Math.min(3, 2 / this.zoom)); // Make lines more visible
    this.ctx.globalAlpha = 0.8; // Slightly transparent
    
    // Draw diamond-shaped grid cells for isometric view
    for (let mapY = 0; mapY < this.mapHeight; mapY++) {
      for (let mapX = 0; mapX < this.mapWidth; mapX++) {
        const screenPos = this.mapToScreen(mapX, mapY);
        const halfTileX = (this.tileSizeX / 2) * this.zoom;
        const halfTileY = (this.tileSizeY / 2) * this.zoom;
        
        // Draw diamond outline for each cell
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        this.ctx.closePath();
        this.ctx.stroke();
      }
    }
    
    this.ctx.globalAlpha = 1; // Reset alpha
  }

  private drawTiles(): void {
    // Render layers in reverse priority order so higher priority layers appear on top
    // Background (priority 6) renders first, collision (priority 4) renders later and appears on top
    const layersReversed = [...this.tileLayers].reverse();
    
    for (const layer of layersReversed) {
      if (!layer.visible) continue;
      
      // Get the tileset for this layer type (falling back to the primary tileset for background)
      const layerTileset = this.getLayerTilesetOrFallback(layer.type);

      if (!layerTileset || !layerTileset.image) {
        // Skip this layer if it has no tileset
        continue;
      }
      
      // Set layer transparency
      this.ctx.globalAlpha = layer.transparency || 1.0;
      
      // Get layer-specific tile data
      const layerTileData = this.layerTileData.get(layer.type) || new Map();
      
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          const gid = layer.data[index];
          
          if (gid > 0) {
            this.drawTileFromLayer(x, y, gid, layerTileset, layerTileData);
          }
        }
      }
    }
    
    // Reset alpha for other drawing operations
    this.ctx.globalAlpha = 1.0;
  }

  private drawTileFromLayer(
    x: number, 
    y: number, 
    gid: number, 
    layerTileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number },
    layerTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>
  ): void {
    if (!layerTileset.image || gid <= 0) return;
    
    // Check if we have variable-sized tile data for this gid in this layer
    const tileData = layerTileData.get(gid);
    
  let sourceX: number, sourceY: number, tileWidth: number, tileHeight: number;
  let originX: number | undefined, originY: number | undefined;
    
    if (tileData) {
      // Use variable-sized tile data
      sourceX = tileData.sourceX;
      sourceY = tileData.sourceY;
      tileWidth = tileData.width;
      tileHeight = tileData.height;
      originX = (tileData as { originX?: number; originY?: number }).originX;
      originY = (tileData as { originX?: number; originY?: number }).originY;
    } else {
      // Fallback to fixed grid layout using layer's tileset properties
      const tileIndex = gid - 1;
      sourceX = (tileIndex % layerTileset.columns) * this.tileSizeX;
      sourceY = Math.floor(tileIndex / layerTileset.columns) * this.tileSizeY;
      tileWidth = this.tileSizeX;
      tileHeight = this.tileSizeY;
    }
    
  // Use isometric screen coordinates with zoom applied
  const screenPos = this.mapToScreen(x, y);
  const scaledTileX = tileWidth * this.zoom;
  const scaledTileY = tileHeight * this.zoom;

  // Compute ground (base) position for the tile diamond. We want the
  // bottom-center of the sprite to sit on the tile base (so sprites don't
  // appear to "float" above the grid lines). screenPos is the diamond
  // center, so bottom of the diamond is screenPos.y + halfTileY.
  const halfTileY = (this.tileSizeY / 2) * this.zoom;
  const groundY = screenPos.y + halfTileY;

  // Determine origin (fallback to center-bottom behavior if not present)
  const finalOriginX = (typeof originX === 'number') ? originX : Math.floor(tileWidth / 2);
  const finalOriginY = (typeof originY === 'number') ? originY : tileHeight; // default to bottom

  // Draw image so its origin point aligns to the tile ground anchor
  const destX = screenPos.x - (finalOriginX * this.zoom);
  const destY = groundY - (finalOriginY * this.zoom);
    
    this.ctx.drawImage(
      layerTileset.image,
      sourceX, sourceY, tileWidth, tileHeight,
      destX, destY, scaledTileX, scaledTileY
    );
  }

  private drawTile(x: number, y: number, gid: number): void {
    if (!this.tilesetImage || gid <= 0) return;
    
    // Check if we have variable-sized tile data for this gid
    const tileData = this.detectedTileData.get(gid);
    
  let sourceX: number, sourceY: number, tileWidth: number, tileHeight: number;
  let originX: number | undefined, originY: number | undefined;
    
    if (tileData) {
      // Use variable-sized tile data
      sourceX = tileData.sourceX;
      sourceY = tileData.sourceY;
      tileWidth = tileData.width;
      tileHeight = tileData.height;
      originX = (tileData as { originX?: number; originY?: number }).originX;
      originY = (tileData as { originX?: number; originY?: number }).originY;
    } else {
      // Fallback to fixed grid layout
      const tileIndex = gid - 1;
      sourceX = (tileIndex % this.tilesetColumns) * this.tileSizeX;
      sourceY = Math.floor(tileIndex / this.tilesetColumns) * this.tileSizeY;
      tileWidth = this.tileSizeX;
      tileHeight = this.tileSizeY;
    }
    
  // Use isometric screen coordinates with zoom applied
  const screenPos = this.mapToScreen(x, y);
  const scaledTileX = tileWidth * this.zoom;
  const scaledTileY = tileHeight * this.zoom;

  // Compute ground (base) position for the tile diamond. We want the
  // bottom-center of the sprite to sit on the tile base (so sprites don't
  // appear to "float" above the grid lines). screenPos is the diamond
  // center, so bottom of the diamond is screenPos.y + halfTileY.
  const halfTileY = (this.tileSizeY / 2) * this.zoom;
  const groundY = screenPos.y + halfTileY;

  // Determine origin (fallback to center-bottom behavior if not present)
  const finalOriginX = (typeof originX === 'number') ? originX : Math.floor(tileWidth / 2);
  const finalOriginY = (typeof originY === 'number') ? originY : tileHeight; // default to bottom

  // Draw image so its origin point aligns to the tile ground anchor
  const destX = screenPos.x - (finalOriginX * this.zoom);
  const destY = groundY - (finalOriginY * this.zoom);
    
    this.ctx.drawImage(
      this.tilesetImage,
      sourceX, sourceY, tileWidth, tileHeight,
      destX, destY, scaledTileX, scaledTileY
    );
  }

  private drawHover(): void {
    const screenPos = this.mapToScreen(this.hoverX, this.hoverY);
    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;
    
    // Check if we're hovering over an object on an interactive layer
    const activeLayer = this.getActiveLayer();
    const interactiveLayers = ['enemy', 'npc', 'object', 'event', 'background'];
    const hasObjectAtPosition = activeLayer && 
                               interactiveLayers.includes(activeLayer.type) && 
                               this.getObjectsAtPosition(this.hoverX, this.hoverY).length > 0;
    
    if (hasObjectAtPosition) {
      // Draw orange glow effect for objects
      this.ctx.save();
      
      // Create orange glow with multiple layers
      const glowLayers = [
        { color: 'rgba(255, 107, 0, 0.1)', width: 8 },
        { color: 'rgba(255, 107, 0, 0.2)', width: 6 },
        { color: 'rgba(255, 107, 0, 0.3)', width: 4 },
        { color: 'rgba(255, 107, 0, 0.5)', width: 2 }
      ];
      
      // Draw glow layers from largest to smallest
      glowLayers.forEach(layer => {
        this.ctx.strokeStyle = layer.color;
        this.ctx.lineWidth = Math.max(1, Math.min(layer.width, layer.width / this.zoom));
        this.ctx.shadowColor = '#ff6b00';
        this.ctx.shadowBlur = Math.max(2, Math.min(10, layer.width / this.zoom));
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        this.ctx.closePath();
        this.ctx.stroke();
      });
      
      // Draw bright orange border
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#ff6b00';
      this.ctx.lineWidth = Math.max(1, Math.min(3, 3 / this.zoom));
      
      this.ctx.beginPath();
      this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
      this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
      this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
      this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
      this.ctx.closePath();
      this.ctx.stroke();
      
      this.ctx.restore();
    } else {
      // Default blue hover outline
      this.ctx.strokeStyle = '#007acc';
      this.ctx.lineWidth = Math.max(1, Math.min(3, 2 / this.zoom)); // Scale line width inversely with zoom, but constrain to 1-3px
      
      this.ctx.beginPath();
      this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
      this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
      this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
      this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
      this.ctx.closePath();
      this.ctx.stroke();
    }
  }

  private drawSelection(): void {
    // Draw selection preview for drag-based tools
    if (this.isSelecting && (this.currentSelectionTool === 'rectangular' || this.currentSelectionTool === 'circular')) {
      this.ctx.strokeStyle = '#ff6b00';
      this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
      this.ctx.setLineDash([5, 5]);

      if (this.currentSelectionTool === 'rectangular') {
        this.drawRectangularSelectionPreview();
      } else if (this.currentSelectionTool === 'circular') {
        this.drawCircularSelectionPreview();
      }

      this.ctx.setLineDash([]); // Reset line dash
    }

    // Draw active selection
    if (this.selection.active && this.selection.tiles.length > 0) {
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
      
      // Draw outline around each selected tile
      this.selection.tiles.forEach(tile => {
        const screenPos = this.mapToScreen(tile.x, tile.y);
        const halfTileX = (this.tileSizeX / 2) * this.zoom;
        const halfTileY = (this.tileSizeY / 2) * this.zoom;
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        this.ctx.closePath();
        this.ctx.stroke();
      });
    }
  }

  private drawRectangularSelectionPreview(): void {
    const minX = Math.min(this.selection.startX, this.selection.endX);
    const maxX = Math.max(this.selection.startX, this.selection.endX);
    const minY = Math.min(this.selection.startY, this.selection.endY);
    const maxY = Math.max(this.selection.startY, this.selection.endY);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
          const screenPos = this.mapToScreen(x, y);
          const halfTileX = (this.tileSizeX / 2) * this.zoom;
          const halfTileY = (this.tileSizeY / 2) * this.zoom;
          
          this.ctx.beginPath();
          this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
          this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
          this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
          this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
          this.ctx.closePath();
          this.ctx.stroke();
        }
      }
    }
  }

  private drawCircularSelectionPreview(): void {
    const radius = Math.sqrt(Math.pow(this.selection.endX - this.selection.startX, 2) + Math.pow(this.selection.endY - this.selection.startY, 2));

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const distance = Math.sqrt(Math.pow(x - this.selection.startX, 2) + Math.pow(y - this.selection.startY, 2));
        if (distance <= radius) {
          const screenPos = this.mapToScreen(x, y);
          const halfTileX = (this.tileSizeX / 2) * this.zoom;
          const halfTileY = (this.tileSizeY / 2) * this.zoom;
          
          this.ctx.beginPath();
          this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
          this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
          this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
          this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
          this.ctx.closePath();
          this.ctx.stroke();
        }
      }
    }
  }

  private drawShapePreview(): void {
    if (!this.isDrawingShape || this.shapeDrawing.preview.length === 0) return;

    this.ctx.strokeStyle = '#0099ff';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
    this.ctx.setLineDash([3, 3]);

    // Draw preview outline around each tile in the shape
    this.shapeDrawing.preview.forEach(point => {
      const screenPos = this.mapToScreen(point.x, point.y);
      const halfTileX = (this.tileSizeX / 2) * this.zoom;
      const halfTileY = (this.tileSizeY / 2) * this.zoom;
      
      this.ctx.beginPath();
      this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
      this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
      this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
      this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
      this.ctx.closePath();
      this.ctx.stroke();
    });

    this.ctx.setLineDash([]); // Reset line dash
  }

  private drawHeroPosition(): void {
    // Draw the hero position marker as a fully orange filled cell
    const screenPos = this.mapToScreen(this.heroX, this.heroY);
    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;
    
    this.ctx.save();
    
    // Check if mouse is hovering over hero position
    const isHovering = this.hoverX === this.heroX && this.hoverY === this.heroY;
    
    if (isHovering) {
      // Draw orange glow effect when hovering
      const glowLayers = [
        { color: 'rgba(255, 107, 0, 0.1)', width: 8 },
        { color: 'rgba(255, 107, 0, 0.2)', width: 6 },
        { color: 'rgba(255, 107, 0, 0.3)', width: 4 },
        { color: 'rgba(255, 107, 0, 0.5)', width: 2 }
      ];
      
      // Draw glow layers from largest to smallest
      glowLayers.forEach(layer => {
        this.ctx.strokeStyle = layer.color;
        this.ctx.lineWidth = Math.max(1, Math.min(layer.width, layer.width / this.zoom));
        this.ctx.shadowColor = '#ff6b00';
        this.ctx.shadowBlur = Math.max(2, Math.min(10, layer.width / this.zoom));
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        this.ctx.closePath();
        this.ctx.stroke();
      });
    }
    
    // Reset shadow settings
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    
    // Draw filled orange diamond
    this.ctx.fillStyle = '#ff6b00';
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw bright orange border
    this.ctx.strokeStyle = '#ff8c00';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    this.ctx.closePath();
    this.ctx.stroke();
    
    // Draw hero icon in the center
    this.drawHeroIcon(screenPos.x, screenPos.y);
    
    this.ctx.restore();
  }

  private drawHeroIcon(centerX: number, centerY: number): void {
    const iconSize = Math.max(12, Math.min(20, 16 * this.zoom));
    const halfSize = iconSize / 2;

    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;

    // Draw user/hero icon (simplified person silhouette)
    // Head (circle)
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY - halfSize * 0.6, halfSize * 0.25, 0, Math.PI * 2);
    this.ctx.fill();

    // Body (rounded rectangle)
    this.ctx.beginPath();
    this.ctx.roundRect(
      centerX - halfSize * 0.3, 
      centerY - halfSize * 0.2, 
      halfSize * 0.6, 
      halfSize * 0.8, 
      halfSize * 0.15
    );
    this.ctx.fill();

    this.ctx.restore();
  }

  private getActorLayerType(object: MapObject): 'npc' | 'enemy' | null {
    if (object.type === 'npc' || object.category === 'npc') {
      return 'npc';
    }
    if (object.type === 'enemy' || object.category === 'enemy' || object.category === 'creature' || object.type === 'creature') {
      return object.category === 'npc' ? 'npc' : 'enemy';
    }
    return null;
  }

  private getActorLayerByType(type: 'npc' | 'enemy'): TileLayer | null {
    return this.tileLayers.find(layer => layer.type === type) || null;
  }

  private actorUsesPlaceholder(object: MapObject): boolean {
    const actorLayerType = this.getActorLayerType(object);
    if (!actorLayerType) return false;
    const layer = this.getActorLayerByType(actorLayerType);
    if (!layer) return false;
    const index = object.y * this.mapWidth + object.x;
    if (index < 0 || index >= layer.data.length) return false;
    return layer.data[index] === 0;
  }

  private drawActorPlaceholders(): void {
    for (const object of this.objects) {
      if (!this.actorUsesPlaceholder(object)) {
        continue;
      }
      const actorLayerType = this.getActorLayerType(object);
      if (actorLayerType) {
        this.drawActorPlaceholder(object, actorLayerType);
      }
    }
  }

  private drawActorPlaceholder(object: MapObject, actorType: 'npc' | 'enemy'): void {
    const screenPos = this.mapToScreen(object.x, object.y);
    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;

    this.ctx.save();

    const isHovering = this.hoverX === object.x && this.hoverY === object.y;
    const isDragging = this.isDraggingActor && this.draggingActorId === object.id;
    if (isHovering || isDragging) {
      const glowLayers = [
        { color: 'rgba(255, 107, 0, 0.1)', width: 8 },
        { color: 'rgba(255, 107, 0, 0.2)', width: 6 },
        { color: 'rgba(255, 107, 0, 0.3)', width: 4 },
        { color: 'rgba(255, 107, 0, 0.5)', width: 2 }
      ];

      glowLayers.forEach(layer => {
        this.ctx.strokeStyle = layer.color;
        this.ctx.lineWidth = Math.max(1, Math.min(layer.width, layer.width / this.zoom));
        this.ctx.shadowColor = '#ff6b00';
        this.ctx.shadowBlur = Math.max(2, Math.min(10, layer.width / this.zoom));

        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
        this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
        this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
        this.ctx.closePath();
        this.ctx.stroke();
      });
    }

    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    this.ctx.fillStyle = '#ff6b00';
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = '#ff8c00';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
    this.ctx.closePath();
    this.ctx.stroke();

    this.drawActorIcon(screenPos.x, screenPos.y, actorType);

    this.ctx.restore();
  }

  private drawActorIcon(centerX: number, centerY: number, actorType: 'npc' | 'enemy'): void {
    const fontSize = Math.max(10, Math.min(18, 14 * this.zoom));
    const label = actorType === 'npc' ? 'N' : 'E';

    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, centerX, centerY);
    this.ctx.restore();
  }

  private drawStampPreview(): void {
    if (!this.stampPreview.visible || !this.activeStamp) return;

    this.ctx.strokeStyle = '#00ff00';
    this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
    this.ctx.setLineDash([3, 3]);

    // Draw preview outline for the stamp area
    for (let dy = 0; dy < this.activeStamp.height; dy++) {
      for (let dx = 0; dx < this.activeStamp.width; dx++) {
        const x = this.stampPreview.x + dx;
        const y = this.stampPreview.y + dy;
        
        if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
          const screenPos = this.mapToScreen(x, y);
          const halfTileX = (this.tileSizeX / 2) * this.zoom;
          const halfTileY = (this.tileSizeY / 2) * this.zoom;
          
          // Draw diamond shape for preview
          this.ctx.beginPath();
          this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
          this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
          this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
          this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }
      }
    }

    this.ctx.setLineDash([]); // Reset line dash
  }

  private drawMiniMap(): void {
    if (!this.showMinimap) return;

    // Minimap dimensions and position (bottom-right corner)
    const minimapWidth = 150;
    const minimapHeight = 120;
    const padding = 10;
    // Anchor minimap to the screen's bottom-right corner so it doesn't
    // shift during layout transitions (sidebar open/close). We compute the
    // desired minimap position in screen coordinates and convert it to the
    // canvas coordinate space by subtracting the canvas container's top-left.
    const containerRect = this.mapCanvas.getBoundingClientRect();
    const screenX = window.innerWidth - minimapWidth - padding;
    const screenY = window.innerHeight - minimapHeight - padding;
    // Convert to canvas-local coordinates
    let x = Math.floor(screenX - containerRect.left);
    let y = Math.floor(screenY - containerRect.top);
    // Clamp inside canvas to avoid drawing outside if the canvas is smaller
    x = Math.max(0, Math.min(this.mapCanvas.width - minimapWidth, x));
    y = Math.max(0, Math.min(this.mapCanvas.height - minimapHeight, y));
    // Update cached pos as well for compatibility with any other logic
    this.lastMiniMapPos = { x, y };

    // Save current context state
    this.ctx.save();

    // Draw minimap background and border with rounded corners
    const outerPad = 5;
    const outerX = x - outerPad;
    const outerY = y - outerPad;
    const outerW = minimapWidth + outerPad * 2;
    const outerH = minimapHeight + outerPad * 2;
    const outerRadius = Math.min(12, Math.floor(Math.min(outerW, outerH) / 6));

    const innerRadius = Math.min(8, Math.floor(Math.min(minimapWidth, minimapHeight) / 8));

    // helper to create rounded rect path
    const roundedRectPath = (rx: number, ry: number, rw: number, rh: number, rr: number) => {
      const r = Math.max(0, Math.min(rr, Math.min(rw, rh) / 2));
      this.ctx.beginPath();
      this.ctx.moveTo(rx + r, ry);
      this.ctx.lineTo(rx + rw - r, ry);
      this.ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      this.ctx.lineTo(rx + rw, ry + rh - r);
      this.ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      this.ctx.lineTo(rx + r, ry + rh);
      this.ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      this.ctx.lineTo(rx, ry + r);
      this.ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      this.ctx.closePath();
    };

    // Outer background (slightly transparent)
    this.ctx.fillStyle = this.isDarkMode ? 'rgba(42, 42, 42, 0.9)' : 'rgba(0, 0, 0, 0.7)';
    roundedRectPath(outerX, outerY, outerW, outerH, outerRadius);
    this.ctx.fill();

    // Inner minimap background
    this.ctx.fillStyle = this.isDarkMode ? '#2a2a2a' : '#f0f0f0';
    roundedRectPath(x, y, minimapWidth, minimapHeight, innerRadius);
    this.ctx.fill();

    // Draw border with rounded corners
    this.ctx.strokeStyle = this.isDarkMode ? '#999' : '#333';
    this.ctx.lineWidth = 1;
    roundedRectPath(x, y, minimapWidth, minimapHeight, innerRadius);
    this.ctx.stroke();

    // Calculate crisp integer tile pixel size to ensure squares (disable fractional scaling)
    // We choose the largest integer tile size that fits both directions.
    const maxTileWidth = Math.floor(minimapWidth / this.mapWidth) || 1;
    const maxTileHeight = Math.floor(minimapHeight / this.mapHeight) || 1;
    const tilePixel = Math.max(1, Math.min(maxTileWidth, maxTileHeight));

    // Recompute centered offsets using integer math so tiles align to pixel grid
    const mapPixelWidth = this.mapWidth * tilePixel;
    const mapPixelHeight = this.mapHeight * tilePixel;
    const offsetX = x + Math.floor((minimapWidth - mapPixelWidth) / 2);
    const offsetY = y + Math.floor((minimapHeight - mapPixelHeight) / 2);

  // Disable smoothing for pixel-perfect minimap (modern engines)
  this.ctx.imageSmoothingEnabled = false;

    // Draw tiles in orthogonal (top-down) view using square pixels
    for (let layerIndex = 0; layerIndex < this.tileLayers.length; layerIndex++) {
      const layer = this.tileLayers[layerIndex];
      if (!layer.visible) continue;

      for (let tileY = 0; tileY < this.mapHeight; tileY++) {
        for (let tileX = 0; tileX < this.mapWidth; tileX++) {
          const index = tileY * this.mapWidth + tileX;
          const gid = layer.data[index];

          if (gid > 0) {
            const pixelX = offsetX + tileX * tilePixel;
            const pixelY = offsetY + tileY * tilePixel;

            // Use a stable color mapping per GID but slightly desaturated for minimap clarity
            const hue = (gid * 137.5) % 360;
            this.ctx.fillStyle = `hsl(${hue}, 55%, ${layerIndex === 0 ? '45%' : '60%'})`;
            this.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
          }
        }
      }
    }

    // Optional subtle grid for clarity when tiles are large enough
    if (tilePixel >= 3) {
      this.ctx.strokeStyle = this.isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
      this.ctx.lineWidth = 0.5;
      for (let ty = 0; ty < this.mapHeight; ty++) {
        for (let tx = 0; tx < this.mapWidth; tx++) {
          const gx = offsetX + tx * tilePixel + 0.25;
          const gy = offsetY + ty * tilePixel + 0.25;
          this.ctx.strokeRect(gx, gy, tilePixel - 0.5, tilePixel - 0.5);
        }
      }
    }

    // Restore context state
    this.ctx.restore();
  }

  // Public methods for React to interact with
  public handleFileUpload(file: File, type: 'tileset' | 'layerTileset'): void {
    if (type === 'tileset') {
      // Legacy tileset upload
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.tilesetImage = img;
          this.tilesetFileName = file.name;
          const columns = Math.max(1, Math.floor(img.width / this.tileSizeX));
          const rows = Math.max(1, Math.floor(img.height / this.tileSizeY));
          this.tilesetColumns = columns;
          this.tilesetRows = rows;
          this.tileCount = columns * rows;
          this.tilesetTileWidth = columns > 0 ? Math.round(img.width / columns) : this.tileSizeX;
          this.tilesetTileHeight = rows > 0 ? Math.round(img.height / rows) : this.tileSizeY;
          this.tilesetSpacing = 0;
          this.tilesetMargin = 0;
          this.tilesetSourcePath = this.extractFileSourcePath(file);
          this.createTilePalette();
          this.draw();
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else if (type === 'layerTileset') {
      // Layer-specific tileset upload
      const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (activeLayer) {
        this.setLayerTileset(activeLayer.type, file);
      }
    }
  }

  private createTilePalette(preserveOrder: boolean = false): void {
    const container = document.getElementById('tilesContainer');
    if (!container || !this.tilesetImage) return;
    
    container.innerHTML = '';
    
    this.hideCollisionBrushTooltip(true);

    const activePaletteLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    const isCollisionPalette = activePaletteLayer?.type === COLLISION_LAYER_TYPE;

    let tilesToRender: Array<{index: number, sourceX: number, sourceY: number, width: number, height: number}>;
    
    if (preserveOrder && this.detectedTileData.size > 0) {
      // Use existing ordered data
      tilesToRender = Array.from(this.detectedTileData.entries()).map(([index, data]) => ({
        index, // This is now the current Map key (sequential)
        sourceX: data.sourceX,
        sourceY: data.sourceY,
        width: data.width,
        height: data.height
      }));
    } else {
      // Clear previous tile data and detect new tiles
      this.detectedTileData.clear();
      
      // Detect tiles with variable sizes
      const detectedTiles = this.detectVariableSizedTiles();
      
      tilesToRender = detectedTiles.map(tile => {
        // Store tile data for later use in drawing
        this.detectedTileData.set(tile.index, {
          sourceX: tile.sourceX,
          sourceY: tile.sourceY,
          width: tile.width,
          height: tile.height,
          originX: Math.floor(tile.width / 2),
          originY: tile.height
        });
        return tile;
      });
      
      // Also store the detected tiles in the current layer's data
      const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (activeLayer) {
        const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
        for (const [gid, data] of this.detectedTileData.entries()) {
          layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
        }
        this.layerTileData.set(activeLayer.type, layerTileMap);
        console.log(`Stored ${layerTileMap.size} newly detected tiles for layer type: ${activeLayer.type}`);
      }
    }
    
  let validTileIndex = 0;

  // Helper to find the brush-tool state element. Prefer a stable id added by React
  // (`brushToolState`) but fall back to the data attribute selector for backward
  // compatibility.
  const getBrushToolEl = () => document.getElementById('brushToolState') || document.querySelector('[data-brush-tool]');
    
    for (const tile of tilesToRender) {
      const canvas = document.createElement('canvas');
      canvas.width = tile.width;
      canvas.height = tile.height;
      canvas.width = tile.width;
      canvas.height = tile.height;
      canvas.className = 'palette-tile';
      
      // Add size information as CSS custom properties for consistent display
      canvas.style.setProperty('--tile-width', `${tile.width}px`);
      canvas.style.setProperty('--tile-height', `${tile.height}px`);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          this.tilesetImage,
          tile.sourceX, tile.sourceY, tile.width, tile.height,
          0, 0, tile.width, tile.height
        );

        // Draw a small visual marker at the center of the sprite for palette preview
        // (Note: exported game origin remains bottom-center so sprites align to ground;
        // palette marker is purely visual and centered so tall sprites appear intuitively)
        const originX = Math.floor(tile.width / 2);
        const originY = Math.floor(tile.height / 2);
        ctx.strokeStyle = 'rgba(255,0,0,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(originX - 3, originY);
        ctx.lineTo(originX + 3, originY);
        ctx.moveTo(originX, originY - 3);
        ctx.lineTo(originX, originY + 3);
        ctx.stroke();
      }
      
      // Create a wrapper div for brush management features
      const wrapper = document.createElement('div');
      wrapper.className = 'brush-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.margin = '2px';
      
      const tooltipText = isCollisionPalette ? COLLISION_BRUSH_TOOLTIPS[tile.index] : undefined;
      
      // Add selection number overlay for merge tool
      const selectionNumber = document.createElement('div');
      selectionNumber.className = 'selection-number';
      selectionNumber.style.position = 'absolute';
      selectionNumber.style.top = '2px';
      selectionNumber.style.left = '2px';
      selectionNumber.style.background = 'red';
      selectionNumber.style.color = 'white';
      selectionNumber.style.borderRadius = '50%';
      selectionNumber.style.width = '16px';
      selectionNumber.style.height = '16px';
      selectionNumber.style.fontSize = '10px';
      selectionNumber.style.display = 'none';
      selectionNumber.style.alignItems = 'center';
      selectionNumber.style.justifyContent = 'center';
      selectionNumber.style.fontWeight = 'bold';
      selectionNumber.style.zIndex = '10';
      
      // Add remove overlay for remove tool
      const removeOverlay = document.createElement('div');
      removeOverlay.className = 'remove-overlay';
      removeOverlay.style.position = 'absolute';
      removeOverlay.style.top = '0';
      removeOverlay.style.left = '0';
      removeOverlay.style.right = '0';
      removeOverlay.style.bottom = '0';
      removeOverlay.style.background = 'rgba(255, 0, 0, 0.7)';
      removeOverlay.style.display = 'none';
      removeOverlay.style.alignItems = 'center';
      removeOverlay.style.justifyContent = 'center';
      removeOverlay.style.fontSize = '24px';
      removeOverlay.style.color = 'white';
      removeOverlay.style.cursor = 'pointer';
      removeOverlay.style.zIndex = '10';
      removeOverlay.textContent = '✕';
      
      // Add separate icon for separate tool
      const separateIcon = document.createElement('div');
      separateIcon.className = 'separate-icon';
      separateIcon.style.position = 'absolute';
      separateIcon.style.top = '50%';
      separateIcon.style.left = '50%';
      separateIcon.style.transform = 'translate(-50%, -50%)';
      separateIcon.style.display = 'none';
      separateIcon.style.alignItems = 'center';
      separateIcon.style.justifyContent = 'center';
      separateIcon.style.background = 'none';
      separateIcon.style.color = 'white';
      separateIcon.style.zIndex = '2';
      separateIcon.style.pointerEvents = 'none';
      separateIcon.style.width = '24px';
      separateIcon.style.height = '24px';
      separateIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
          <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
          <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
        </svg>
      `;
      
      // Add merge icon for merge tool
      const mergeIcon = document.createElement('div');
      mergeIcon.className = 'merge-icon';
      mergeIcon.style.position = 'absolute';
      mergeIcon.style.top = '50%';
      mergeIcon.style.left = '50%';
      mergeIcon.style.transform = 'translate(-50%, -50%)';
      mergeIcon.style.display = 'none';
      mergeIcon.style.alignItems = 'center';
      mergeIcon.style.justifyContent = 'center';
      mergeIcon.style.background = 'none';
      mergeIcon.style.color = 'white';
      mergeIcon.style.zIndex = '2';
      mergeIcon.style.pointerEvents = 'none';
      mergeIcon.style.width = '24px';
      mergeIcon.style.height = '24px';
      mergeIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m8 6 4-4 4 4"></path>
          <path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"></path>
          <path d="m20 22-6.828-6.828A4 4 0 0 1 12 12.3"></path>
        </svg>
      `;
      
      // Add click handler to the remove overlay
      removeOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Remove overlay clicked for tile index: ${tile.index}`);
        this.handleBrushRemove(tile.index);
      });
      
      canvas.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();

        const brushToolElement = getBrushToolEl();
        const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';

        console.log(`Tile clicked! Index: ${tile.index}, Current brush tool: ${currentBrushTool}`);

        if (currentBrushTool === 'merge') {
          // Keep merge UI but do not auto-merge; allow manual merge via tool
          console.log('Handling merge tool selection (no auto-merge)');
          this.handleBrushMerge(tile.index, wrapper);
          return;
        }

        if (currentBrushTool === 'separate') {
          console.log('Handling separate tool');
          this.handleBrushSeparate(tile.index);
          return;
        }

        if (currentBrushTool === 'remove') {
          console.log('Handling remove tool');
          this.handleBrushRemove(tile.index);
          return;
        }

        // Normal tile selection - support Ctrl/Cmd multi-select of palette tiles
        const isCtrl = (e.ctrlKey || e.metaKey);
        if (isCtrl) {
          // Toggle inclusion in multi-selected set
          if (this.multiSelectedBrushes.has(tile.index)) {
            this.multiSelectedBrushes.delete(tile.index);
          } else {
            this.multiSelectedBrushes.add(tile.index);
          }

          // If there's exactly one selected, set it active; otherwise keep active as first
          if (this.multiSelectedBrushes.size === 1) {
            const only = Array.from(this.multiSelectedBrushes.values())[0];
            this.setCurrentLayerActiveGid(only);
          }
          this.updateActiveTile();
          return;
        }

        // Single selection: clear multi-selection and select this tile
        this.multiSelectedBrushes.clear();
        this.setCurrentLayerActiveGid(tile.index);
        this.updateActiveTile();
      });
      
      // Add drag and drop functionality for move tool
      wrapper.draggable = false; // Will be set to true when move tool is active
      
      wrapper.addEventListener('dragstart', (e) => {
        const brushToolElement = getBrushToolEl();
        const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';

        if (currentBrushTool === 'move') {
          wrapper.style.opacity = '0.5';
          e.dataTransfer!.effectAllowed = 'move';
          e.dataTransfer!.setData('text/plain', tile.index.toString());
          this.dispatchBrushEvent('dragstart', tile.index);
        } else {
          e.preventDefault();
        }
      });
      
      wrapper.addEventListener('dragend', (_e) => {
        wrapper.style.opacity = '1';
        this.dispatchBrushEvent('dragend', tile.index);
      });
      
      wrapper.addEventListener('dragover', (e) => {
        const brushToolElement = getBrushToolEl();
        const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';

        if (currentBrushTool === 'move') {
          e.preventDefault();
          e.dataTransfer!.dropEffect = 'move';
          wrapper.style.borderTop = '3px solid #007acc';
        }
      });
      
      wrapper.addEventListener('dragleave', (_e) => {
        wrapper.style.borderTop = '';
      });
      
      wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.style.borderTop = '';

        const brushToolElement = getBrushToolEl();
        const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';

        if (currentBrushTool === 'move') {
          const draggedTileIndex = parseInt(e.dataTransfer!.getData('text/plain'));
          const targetTileIndex = tile.index;

          if (draggedTileIndex !== targetTileIndex) {
            this.dispatchBrushEvent('drop', { from: draggedTileIndex, to: targetTileIndex });
          }
        }
      });
      
      // Update draggable property and classes when brush tool changes
      const updateBrushToolState = () => {
        const brushToolElement = getBrushToolEl();
        const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';

        // Reset all tool-specific classes
        wrapper.classList.remove('separate-mode', 'merge-mode', 'merge-selected-first', 'merge-selected-second');
        wrapper.draggable = false;
        wrapper.style.cursor = '';
        wrapper.title = '';

        // Add tile index for tracking
        wrapper.setAttribute('data-tile-index', tile.index.toString());

        if (currentBrushTool === 'move') {
          wrapper.draggable = true;
          wrapper.style.cursor = 'move';
          wrapper.title = 'Drag to reorder';
        } else if (currentBrushTool === 'separate') {
          wrapper.classList.add('separate-mode');
          wrapper.style.cursor = 'pointer';
          wrapper.title = 'Click to separate';
        } else if (currentBrushTool === 'merge') {
          wrapper.classList.add('merge-mode');
          wrapper.style.cursor = 'pointer';
          wrapper.title = 'Click to merge (max 2 brushes)';
        }
      };
      
      // Initial setup
      updateBrushToolState();
      
      // Listen for brush tool changes
      const observer = new MutationObserver(() => {
        updateBrushToolState();
      });
      
      const brushToolElement = getBrushToolEl();
      if (brushToolElement) {
        observer.observe(brushToolElement, { attributes: true, attributeFilter: ['data-brush-tool'] });
      }
      
      // Add hover effects for remove tool
      wrapper.addEventListener('mouseenter', (event) => {
        const brushToolElement = document.querySelector('[data-brush-tool]');
        const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';
        
        if (currentBrushTool === 'remove') {
          removeOverlay.style.display = 'flex';
        }
        
        if (tooltipText) {
          this.showCollisionBrushTooltip(wrapper, tooltipText, event as MouseEvent);
        }
      });
      
      wrapper.addEventListener('mouseleave', () => {
        removeOverlay.style.display = 'none';
        if (tooltipText) {
          this.hideCollisionBrushTooltip();
        }
      });
      
      if (tooltipText) {
        wrapper.addEventListener('mousemove', (event) => {
          this.updateCollisionBrushTooltipPosition(wrapper, event as MouseEvent);
        });
      }
      
  // Add data attributes to track tile properties
  canvas.setAttribute('data-tile-index', tile.index.toString());
  canvas.setAttribute('data-tile-width', tile.width.toString());
  canvas.setAttribute('data-tile-height', tile.height.toString());
  canvas.setAttribute('data-source-x', tile.sourceX.toString());
  canvas.setAttribute('data-source-y', tile.sourceY.toString());
  // Expose origin info for later use
  canvas.setAttribute('data-origin-x', Math.floor(tile.width / 2).toString());
  // Expose the visual center for previews; note exporter uses bottom-center origin
  canvas.setAttribute('data-origin-y', Math.floor(tile.height / 2).toString());
      
      wrapper.appendChild(canvas);
      wrapper.appendChild(selectionNumber);
      wrapper.appendChild(removeOverlay);
      wrapper.appendChild(separateIcon);
      wrapper.appendChild(mergeIcon);
      container.appendChild(wrapper);
      validTileIndex++;
    }
    
    console.log(`Created ${validTileIndex} variable-sized tiles from tileset`);
  }

  // Brush management interaction handlers
  private handleBrushMerge(tileIndex: number, wrapper: HTMLElement): void {
    // Get all currently selected brushes for merge
    const firstSelected = document.querySelector('.merge-selected-first');
    const secondSelected = document.querySelector('.merge-selected-second');
    
    // If this brush is already selected, deselect it
    if (wrapper.classList.contains('merge-selected-first') || wrapper.classList.contains('merge-selected-second')) {
      wrapper.classList.remove('merge-selected-first', 'merge-selected-second');
      return;
    }
    
    if (!firstSelected) {
      // This is the first selection - add orange stroke
      wrapper.classList.add('merge-selected-first');
    } else if (!secondSelected) {
      // This is the second selection - add orange fill and merge icon.
      // Auto-merge disabled: user must explicitly trigger merge (e.g. via UI button).
      wrapper.classList.add('merge-selected-second');
      // Do not auto-merge here; keep both selections so user can confirm/adjust.
    } else {
      // Already have 2 selected, ignore further selections
      return;
    }
  }

  private performMerge(firstTileIndex: number, secondTileIndex: number): void {
    console.log(`Merging tiles ${firstTileIndex} and ${secondTileIndex}`);
    
    try {
      // Call the editor's merge brush method
      this.mergeBrushes([firstTileIndex, secondTileIndex]);
      console.log(`Successfully merged brushes ${firstTileIndex} and ${secondTileIndex}`);
    } catch (error) {
      console.error('Failed to merge brushes:', error);
    }
  }

  private handleBrushSeparate(tileIndex: number): void {
    this.dispatchBrushEvent('separate', tileIndex);
  }

  private handleBrushRemove(tileIndex: number): void {
    console.log(`handleBrushRemove called with tileIndex: ${tileIndex}`);
    this.dispatchBrushEvent('remove', tileIndex);
  }

  private dispatchBrushEvent(action: string, data: number | { from: number; to: number }): void {
    const event = new CustomEvent('brushAction', {
      detail: typeof data === 'number' ? { action, tileIndex: data } : { action, ...data }
    });
    document.dispatchEvent(event);
  }

  private detectVariableSizedTiles(): Array<{
    index: number;
    sourceX: number;
    sourceY: number;
    width: number;
    height: number;
  }> {
    if (!this.tilesetImage) return [];
    
    const detectedTiles: Array<{
      index: number;
      sourceX: number;
      sourceY: number;
      width: number;
      height: number;
    }> = [];
    
    // Create a temporary canvas for analysis
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.tilesetImage.width;
    tempCanvas.height = this.tilesetImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return [];
    
    // Draw the entire tileset to analyze
    tempCtx.drawImage(this.tilesetImage, 0, 0);
    
    // Get image data for analysis
    const imageData = tempCtx.getImageData(0, 0, this.tilesetImage.width, this.tilesetImage.height);
    const data = imageData.data;
    
    // Create a visited mask to track processed pixels
    const visited = new Array(this.tilesetImage.width * this.tilesetImage.height).fill(false);
    
    let tileIndex = 1;
    
    // First pass: detect all connected components
    const allObjects: Array<{
      bounds: { x: number; y: number; width: number; height: number };
      pixels: Array<{x: number, y: number}>;
    }> = [];
    
    for (let y = 0; y < this.tilesetImage.height; y++) {
      for (let x = 0; x < this.tilesetImage.width; x++) {
        const pixelIndex = y * this.tilesetImage.width + x;
        
        if (visited[pixelIndex] || this.isPixelTransparent(data, x, y, this.tilesetImage.width)) {
          continue;
        }
        
        const objectData = this.floodFillObjectData(data, this.tilesetImage.width, this.tilesetImage.height, x, y, visited);
        
        if (objectData && this.isValidObjectSize(objectData.bounds)) {
          allObjects.push(objectData);
        }
      }
    }
    
    // Second pass: intelligently split objects that should be separate
    for (const obj of allObjects) {
      const splitObjects = this.intelligentObjectSplit(obj);
      
      for (const splitObj of splitObjects) {
        detectedTiles.push({
          index: tileIndex++,
          sourceX: splitObj.x,
          sourceY: splitObj.y,
          width: splitObj.width,
          height: splitObj.height
        });
      }
    }
    
    return detectedTiles;
  }

  private isPixelTransparent(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
    const index = (y * width + x) * 4 + 3; // Alpha channel
    return data[index] <= this.tileContentThreshold;
  }

  private floodFillObjectData(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    startX: number,
    startY: number,
    visited: boolean[]
  ): { bounds: { x: number; y: number; width: number; height: number }; pixels: Array<{x: number, y: number}> } | null {
    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixelCount = 0;
    const objectPixels: Array<{x: number, y: number}> = [];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      const {x, y} = current;
      
      // Check bounds
      if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) continue;
      
      const pixelIndex = y * imageWidth + x;
      
      // Skip if already visited or transparent
      if (visited[pixelIndex] || this.isPixelTransparent(data, x, y, imageWidth)) {
        continue;
      }
      
      // Mark as visited
      visited[pixelIndex] = true;
      pixelCount++;
      objectPixels.push({x, y});
      
      // Update bounds
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Add neighboring pixels to stack (8-connectivity for initial detection)
      stack.push({x: x + 1, y: y});
      stack.push({x: x - 1, y: y});
      stack.push({x: x, y: y + 1});
      stack.push({x: x, y: y - 1});
      stack.push({x: x + 1, y: y + 1});
      stack.push({x: x + 1, y: y - 1});
      stack.push({x: x - 1, y: y + 1});
      stack.push({x: x - 1, y: y - 1});
    }
    
    if (pixelCount === 0) return null;
    
    // Add small padding around the object
    const padding = 1;
    const finalX = Math.max(0, minX - padding);
    const finalY = Math.max(0, minY - padding);
    const finalMaxX = Math.min(imageWidth - 1, maxX + padding);
    const finalMaxY = Math.min(imageHeight - 1, maxY + padding);
    
    return {
      bounds: {
        x: finalX,
        y: finalY,
        width: finalMaxX - finalX + 1,
        height: finalMaxY - finalY + 1
      },
      pixels: objectPixels
    };
  }

  private intelligentObjectSplit(objectData: {
    bounds: { x: number; y: number; width: number; height: number };
    pixels: Array<{x: number, y: number}>;
  }): Array<{ x: number; y: number; width: number; height: number }> {
    const { bounds, pixels } = objectData;
    const { width, height } = bounds;
    
    // Calculate object characteristics
    const area = pixels.length;
    const boundingArea = width * height;
    const density = area / boundingArea;
    // const aspectRatio = Math.max(width / height, height / width);
    
    // Determine if this looks like a repeating pattern (multiple similar objects)
    const gridSize = Math.max(this.tileSizeX, this.tileSizeY);
    const shouldSplitHorizontally = this.shouldSplitDirection(pixels, bounds, 'horizontal', gridSize);
    const shouldSplitVertically = this.shouldSplitDirection(pixels, bounds, 'vertical', gridSize);
    
    // Check for specific object types
    const isFloorPattern = this.isFloorPattern(bounds, pixels);
    const isVerticalWall = this.isVerticalWall(bounds, pixels);
    const isHorizontalWall = this.isHorizontalWall(bounds, pixels);
    
    console.log(`Object analysis: ${width}x${height}, density: ${density.toFixed(2)}, floor: ${isFloorPattern}, vWall: ${isVerticalWall}, hWall: ${isHorizontalWall}`);
    
    // Case 1: Floor/ground patterns - always split into individual tiles
    if (isFloorPattern) {
      console.log('Detected floor/ground pattern - splitting into individual tiles');
      return this.splitObjectByGrid(objectData, 'horizontal');
    }
    
    // Case 2: Vertical walls or tall structures - keep as single object
    if (isVerticalWall) {
      console.log('Detected vertical wall/structure - keeping as single tile');
      return [bounds];
    }
    
    // Case 3: Horizontal walls - keep as single object  
    if (isHorizontalWall) {
      console.log('Detected horizontal wall - keeping as single tile');
      return [bounds];
    }
    
    // Case 4: Multiple similar objects arranged horizontally
    if (shouldSplitHorizontally && width > this.tileSizeX * 1.5) {
      console.log('Splitting horizontal arrangement into individual objects');
      return this.splitObjectByGrid(objectData, 'horizontal');
    }
    
    // Case 5: Multiple similar objects arranged vertically (but not walls)
    if (shouldSplitVertically && height > this.tileSizeY * 1.5 && !this.isLikelySingleVerticalObject(bounds, pixels)) {
      console.log('Splitting vertical arrangement into individual objects');
      return this.splitObjectByGrid(objectData, 'vertical');
    }
    
    // Case 6: Large sparse objects - likely multiple separate items
    if (density < 0.4 && boundingArea > gridSize * gridSize * 2) {
      console.log('Splitting sparse large object');
      return this.splitObjectByDensity(objectData);
    }
    
    // Case 7: Objects that span multiple tile-sized regions but aren't walls
    if ((width > this.tileSizeX * 1.8 || height > this.tileSizeY * 1.8) && 
        !isVerticalWall && !isHorizontalWall && density < 0.8) {
      console.log('Splitting large non-wall object into tile-sized pieces');
      return this.splitObjectByGrid(objectData, width > height ? 'horizontal' : 'vertical');
    }
    
    // Default: keep as single object
    console.log('Keeping as single object');
    return [bounds];
  }

  private isVerticalWall(bounds: { x: number; y: number; width: number; height: number }, pixels: Array<{x: number, y: number}>): boolean {
    const { width, height } = bounds;
    
    // Vertical walls are typically:
    // 1. Taller than they are wide (aspect ratio > 1.5)
    // 2. Have good density (substantial object)
    // 3. Don't have clear horizontal separation patterns
    // 4. Have consistent width throughout their height
    
    const aspectRatio = height / width;
    const density = pixels.length / (width * height);
    
    // Must be significantly taller than wide
    if (aspectRatio < 1.5) return false;
    
    // Must have substantial content
    if (density < 0.5) return false;
    
    // Check for consistent width (vertical walls don't vary much in width)
    const hasConsistentWidth = this.hasConsistentVerticalWidth(pixels, bounds);
    
    // Check if it's NOT a stack of separate objects
    const hasVerticalContinuity = this.hasVerticalContinuity(pixels, bounds);
    
    // Additional check: tall and relatively narrow objects are likely walls
    const isTallAndNarrow = height > this.tileSizeY * 1.5 && width <= this.tileSizeX * 1.2;
    
    return (hasConsistentWidth && hasVerticalContinuity) || 
           (isTallAndNarrow && density > 0.6);
  }

  private isHorizontalWall(bounds: { x: number; y: number; width: number; height: number }, pixels: Array<{x: number, y: number}>): boolean {
    const { width, height } = bounds;
    
    // Horizontal walls are typically:
    // 1. Wider than they are tall (aspect ratio > 2)
    // 2. Have good density
    // 3. Have consistent height throughout their width
    // 4. Don't show clear repeating patterns
    
    const aspectRatio = width / height;
    const density = pixels.length / (width * height);
    
    // Must be significantly wider than tall
    if (aspectRatio < 2) return false;
    
    // Must have substantial content and be tall enough to be a wall
    if (density < 0.6 || height < this.tileSizeY * 0.7) return false;
    
    // Check for consistent height
    const hasConsistentHeight = this.hasConsistentHorizontalHeight(pixels, bounds);
    
    // Check if it's NOT a series of separate objects
    const hasHorizontalContinuity = this.hasHorizontalContinuity(pixels, bounds);
    
    return hasConsistentHeight && hasHorizontalContinuity;
  }

  private isLikelySingleVerticalObject(bounds: { x: number; y: number; width: number; height: number }, pixels: Array<{x: number, y: number}>): boolean {
    // Check if this is likely a single tall object rather than stacked objects
    const { width, height } = bounds;
    const density = pixels.length / (width * height);
    
    // High density objects are likely single objects
    if (density > 0.7) return true;
    
    // Check for vertical continuity
    return this.hasVerticalContinuity(pixels, bounds);
  }

  private hasConsistentVerticalWidth(pixels: Array<{x: number, y: number}>, bounds: { x: number; y: number; width: number; height: number }): boolean {
    const { y: minY, height } = bounds;
    const segmentHeight = Math.max(1, Math.floor(height / 5)); // Divide into 5 segments
    
    const widths: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const segmentY = minY + (i * segmentHeight);
      const segmentEndY = Math.min(segmentY + segmentHeight, minY + height);
      
      let leftMost = Number.MAX_SAFE_INTEGER;
      let rightMost = Number.MIN_SAFE_INTEGER;
      let hasPixels = false;
      
      for (const pixel of pixels) {
        if (pixel.y >= segmentY && pixel.y < segmentEndY) {
          leftMost = Math.min(leftMost, pixel.x);
          rightMost = Math.max(rightMost, pixel.x);
          hasPixels = true;
        }
      }
      
      if (hasPixels) {
        widths.push(rightMost - leftMost + 1);
      }
    }
    
    if (widths.length < 2) return false;
    
    // Check if widths are consistent (low variance)
    const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
    const variance = widths.reduce((sum, w) => sum + Math.pow(w - avgWidth, 2), 0) / widths.length;
    const stdDev = Math.sqrt(variance);
    
    return avgWidth > 0 && (stdDev / avgWidth) < 0.3; // Less than 30% variation
  }

  private hasConsistentHorizontalHeight(pixels: Array<{x: number, y: number}>, bounds: { x: number; y: number; width: number; height: number }): boolean {
    const { x: minX, width } = bounds;
    const segmentWidth = Math.max(1, Math.floor(width / 5)); // Divide into 5 segments
    
    const heights: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const segmentX = minX + (i * segmentWidth);
      const segmentEndX = Math.min(segmentX + segmentWidth, minX + width);
      
      let topMost = Number.MAX_SAFE_INTEGER;
      let bottomMost = Number.MIN_SAFE_INTEGER;
      let hasPixels = false;
      
      for (const pixel of pixels) {
        if (pixel.x >= segmentX && pixel.x < segmentEndX) {
          topMost = Math.min(topMost, pixel.y);
          bottomMost = Math.max(bottomMost, pixel.y);
          hasPixels = true;
        }
      }
      
      if (hasPixels) {
        heights.push(bottomMost - topMost + 1);
      }
    }
    
    if (heights.length < 2) return false;
    
    // Check if heights are consistent
    const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    const variance = heights.reduce((sum, h) => sum + Math.pow(h - avgHeight, 2), 0) / heights.length;
    const stdDev = Math.sqrt(variance);
    
    return avgHeight > 0 && (stdDev / avgHeight) < 0.3;
  }

  private hasVerticalContinuity(pixels: Array<{x: number, y: number}>, bounds: { x: number; y: number; width: number; height: number }): boolean {
    const { y: minY, height } = bounds;
    const segmentHeight = Math.max(1, Math.floor(height / 10));
    
    let continuousSegments = 0;
    let totalSegments = 0;
    
    for (let y = minY; y < minY + height; y += segmentHeight) {
      const segmentEndY = Math.min(y + segmentHeight, minY + height);
      let hasPixelsInSegment = false;
      
      for (const pixel of pixels) {
        if (pixel.y >= y && pixel.y < segmentEndY) {
          hasPixelsInSegment = true;
          break;
        }
      }
      
      if (hasPixelsInSegment) {
        continuousSegments++;
      }
      totalSegments++;
    }
    
    // At least 70% of vertical segments should have content for good continuity
    return totalSegments > 0 && (continuousSegments / totalSegments) >= 0.7;
  }

  private hasHorizontalContinuity(pixels: Array<{x: number, y: number}>, bounds: { x: number; y: number; width: number; height: number }): boolean {
    const { x: minX, width } = bounds;
    const segmentWidth = Math.max(1, Math.floor(width / 10));
    
    let continuousSegments = 0;
    let totalSegments = 0;
    
    for (let x = minX; x < minX + width; x += segmentWidth) {
      const segmentEndX = Math.min(x + segmentWidth, minX + width);
      let hasPixelsInSegment = false;
      
      for (const pixel of pixels) {
        if (pixel.x >= x && pixel.x < segmentEndX) {
          hasPixelsInSegment = true;
          break;
        }
      }
      
      if (hasPixelsInSegment) {
        continuousSegments++;
      }
      totalSegments++;
    }
    
    // At least 70% of horizontal segments should have content for good continuity
    return totalSegments > 0 && (continuousSegments / totalSegments) >= 0.7;
  }

  private isFloorPattern(bounds: { x: number; y: number; width: number; height: number }, pixels: Array<{x: number, y: number}>): boolean {
    const { width, height } = bounds;
    
    // Floor patterns are typically:
    // 1. Relatively thin (height much less than a full tile)
    // 2. Horizontal and repeating
    // 3. Have a specific density pattern
    
    // Check if height suggests a floor tile (thin horizontal element)
    const isFloorHeight = height <= this.tileSizeY * 0.6; // Less than 60% of tile height
    
    // Check if width suggests multiple tiles
    const isMultipleTileWidth = width > this.tileSizeX * 1.3;
    
    // Check density pattern - floor tiles often have gaps between repetitions
    const hasRepeatingPattern = this.hasRepeatingHorizontalPattern(pixels, bounds);
    
    // Additional check: look for diamond-like shapes (isometric floor tiles)
    const isDiamondLike = this.hasDiamondLikeShape(pixels, bounds);
    
    return (isFloorHeight && isMultipleTileWidth) || 
           (hasRepeatingPattern && isMultipleTileWidth) ||
           (isDiamondLike && isMultipleTileWidth);
  }

  private hasRepeatingHorizontalPattern(pixels: Array<{x: number, y: number}>, bounds: { x: number; y: number; width: number; height: number }): boolean {
    const { x: minX, width } = bounds;
    const segmentWidth = this.tileSizeX;
    const segments = Math.floor(width / segmentWidth);
    
    if (segments < 2) return false;
    
    // Analyze density in each segment
    const segmentDensities: number[] = [];
    
    for (let i = 0; i < segments; i++) {
      const segmentStart = minX + (i * segmentWidth);
      const segmentEnd = segmentStart + segmentWidth;
      
      let segmentPixels = 0;
      for (const pixel of pixels) {
        if (pixel.x >= segmentStart && pixel.x < segmentEnd) {
          segmentPixels++;
        }
      }
      segmentDensities.push(segmentPixels);
    }
    
    // Check if densities are similar (indicating repeating pattern)
    const avgDensity = segmentDensities.reduce((a, b) => a + b, 0) / segmentDensities.length;
    const variance = segmentDensities.reduce((sum, density) => sum + Math.pow(density - avgDensity, 2), 0) / segmentDensities.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Low standard deviation relative to average suggests repeating pattern
    return avgDensity > 0 && (standardDeviation / avgDensity) < 0.5;
  }

  private hasDiamondLikeShape(pixels: Array<{x: number, y: number}>, bounds: { x: number; y: number; width: number; height: number }): boolean {
    const { y: minY, height } = bounds;
    
    // For diamond shapes, expect more pixels in the middle rows than at the edges
    const rowDensities: number[] = [];
    
    for (let y = 0; y < height; y++) {
      let rowPixels = 0;
      for (const pixel of pixels) {
        if (pixel.y === minY + y) {
          rowPixels++;
        }
      }
      rowDensities.push(rowPixels);
    }
    
    if (rowDensities.length < 3) return false;
    
    // Check if middle rows have more pixels than edge rows (diamond characteristic)
    const edgeRows = Math.floor(rowDensities.length * 0.2);
    const middleStart = Math.floor(rowDensities.length * 0.3);
    const middleEnd = Math.floor(rowDensities.length * 0.7);
    
    const edgeDensity = (rowDensities.slice(0, edgeRows).reduce((a, b) => a + b, 0) + 
                        rowDensities.slice(-edgeRows).reduce((a, b) => a + b, 0)) / (edgeRows * 2 || 1);
    
    const middleDensity = rowDensities.slice(middleStart, middleEnd).reduce((a, b) => a + b, 0) / (middleEnd - middleStart || 1);
    
    return middleDensity > edgeDensity * 1.2; // Middle should be at least 20% denser
  }

  private shouldSplitDirection(
    pixels: Array<{x: number, y: number}>,
    bounds: { x: number; y: number; width: number; height: number },
    direction: 'horizontal' | 'vertical',
    gridSize: number
  ): boolean {
    const { x: minX, y: minY, width, height } = bounds;
    
    if (direction === 'horizontal') {
      // Check for gaps that suggest separate objects
      const columnDensities: number[] = [];
      const step = Math.max(1, Math.floor(width / (width / gridSize)));
      
      for (let x = 0; x < width; x += step) {
        let columnPixels = 0;
        for (const pixel of pixels) {
          if (pixel.x >= minX + x && pixel.x < minX + x + step) {
            columnPixels++;
          }
        }
        columnDensities.push(columnPixels);
      }
      
      // Look for significant gaps between dense areas
      let gapCount = 0;
      let denseRegions = 0;
      const avgDensity = columnDensities.reduce((a, b) => a + b, 0) / columnDensities.length;
      
      for (let i = 0; i < columnDensities.length; i++) {
        if (columnDensities[i] < avgDensity * 0.3) {
          gapCount++;
        } else if (columnDensities[i] > avgDensity * 0.7) {
          denseRegions++;
        }
      }
      
      return denseRegions >= 2 && gapCount >= 1;
    } else {
      // Similar logic for vertical
      const rowDensities: number[] = [];
      const step = Math.max(1, Math.floor(height / (height / gridSize)));
      
      for (let y = 0; y < height; y += step) {
        let rowPixels = 0;
        for (const pixel of pixels) {
          if (pixel.y >= minY + y && pixel.y < minY + y + step) {
            rowPixels++;
          }
        }
        rowDensities.push(rowPixels);
      }
      
      let gapCount = 0;
      let denseRegions = 0;
      const avgDensity = rowDensities.reduce((a, b) => a + b, 0) / rowDensities.length;
      
      for (let i = 0; i < rowDensities.length; i++) {
        if (rowDensities[i] < avgDensity * 0.3) {
          gapCount++;
        } else if (rowDensities[i] > avgDensity * 0.7) {
          denseRegions++;
        }
      }
      
      return denseRegions >= 2 && gapCount >= 1;
    }
  }

  private splitObjectByGrid(
    objectData: { bounds: { x: number; y: number; width: number; height: number }; pixels: Array<{x: number, y: number}> },
    direction: 'horizontal' | 'vertical'
  ): Array<{ x: number; y: number; width: number; height: number }> {
    const { bounds } = objectData;
    const results: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    if (direction === 'horizontal') {
      // Split into vertical strips based on tile size
      const stripWidth = this.tileSizeX;
      for (let x = bounds.x; x < bounds.x + bounds.width; x += stripWidth) {
        const stripBounds = this.findContentInRegion(objectData.pixels, {
          x: x,
          y: bounds.y,
          width: Math.min(stripWidth, bounds.x + bounds.width - x),
          height: bounds.height
        });
        
        if (stripBounds) {
          results.push(stripBounds);
        }
      }
    } else {
      // Split into horizontal strips based on tile size
      const stripHeight = this.tileSizeY;
      for (let y = bounds.y; y < bounds.y + bounds.height; y += stripHeight) {
        const stripBounds = this.findContentInRegion(objectData.pixels, {
          x: bounds.x,
          y: y,
          width: bounds.width,
          height: Math.min(stripHeight, bounds.y + bounds.height - y)
        });
        
        if (stripBounds) {
          results.push(stripBounds);
        }
      }
    }
    
    return results.length > 0 ? results : [bounds];
  }

  private splitObjectByDensity(
    objectData: { bounds: { x: number; y: number; width: number; height: number }; pixels: Array<{x: number, y: number}> }
  ): Array<{ x: number; y: number; width: number; height: number }> {
    // For sparse objects, try to find clusters of pixels
    const { bounds } = objectData;
    const gridSize = Math.min(this.tileSizeX, this.tileSizeY);
    const results: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    // Divide into grid regions and find content in each
    for (let y = bounds.y; y < bounds.y + bounds.height; y += gridSize) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += gridSize) {
        const regionBounds = this.findContentInRegion(objectData.pixels, {
          x: x,
          y: y,
          width: Math.min(gridSize, bounds.x + bounds.width - x),
          height: Math.min(gridSize, bounds.y + bounds.height - y)
        });
        
        if (regionBounds) {
          results.push(regionBounds);
        }
      }
    }
    
    return results.length > 0 ? results : [bounds];
  }

  private findContentInRegion(
    pixels: Array<{x: number, y: number}>,
    region: { x: number; y: number; width: number; height: number }
  ): { x: number; y: number; width: number; height: number } | null {
    let minX = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;
    let hasContent = false;
    
    for (const pixel of pixels) {
      if (pixel.x >= region.x && pixel.x < region.x + region.width &&
          pixel.y >= region.y && pixel.y < region.y + region.height) {
        minX = Math.min(minX, pixel.x);
        maxX = Math.max(maxX, pixel.x);
        minY = Math.min(minY, pixel.y);
        maxY = Math.max(maxY, pixel.y);
        hasContent = true;
      }
    }
    
    if (!hasContent) return null;
    
    // Add padding
    const padding = 1;
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: maxX - minX + 1 + (padding * 2),
      height: maxY - minY + 1 + (padding * 2)
    };
  }

  private isValidObjectSize(bounds: { x: number; y: number; width: number; height: number }): boolean {
    // Filter out very small objects (likely noise or artifacts)
    const minSize = 8;
    const maxSize = Math.max(this.tilesetImage?.width || 512, this.tilesetImage?.height || 512);
    
    return bounds.width >= minSize && 
           bounds.height >= minSize && 
           bounds.width <= maxSize && 
           bounds.height <= maxSize &&
           (bounds.width * bounds.height) >= (minSize * minSize);
  }

  // Add method to adjust sensitivity for object separation
  public setObjectSeparationSensitivity(sensitivity: number): void {
    // sensitivity: 0 = merge everything connected, 1 = separate more aggressively
    this.objectSeparationSensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  public getObjectSeparationSensitivity(): number {
    return this.objectSeparationSensitivity;
  }

  private tileHasContent(ctx: CanvasRenderingContext2D): boolean {
    try {
      const imageData = ctx.getImageData(0, 0, this.tileSizeX, this.tileSizeY);
      const data = imageData.data;
      
      // Check for any non-transparent pixels
      // Look for pixels with alpha > threshold (to account for anti-aliasing)
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > this.tileContentThreshold) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      // If we can't read the image data (e.g., CORS issues), assume it has content
      console.warn('Could not analyze tile content, assuming tile has content:', error);
      return true;
    }
  }

  private updateActiveTile(): void {
    const activeGidSpan = document.getElementById('activeGid');
    if (activeGidSpan) {
      activeGidSpan.textContent = this.activeGid.toString();
    }
    
    // Update selected tile visual
    const tiles = document.querySelectorAll('.palette-tile');
    tiles.forEach(tile => {
      tile.classList.remove('selected', 'multi-selected');
      const idx = parseInt(tile.getAttribute('data-tile-index') || '0');
      if (idx === this.activeGid && this.activeGid > 0) {
        tile.classList.add('selected');
      }
      if (this.multiSelectedBrushes.has(idx)) {
        tile.classList.add('multi-selected');
      }
    });
  }

  public resizeMap(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    
    // Resize layer data
    for (const layer of this.tileLayers) {
      const newData = new Array(width * height).fill(0);
      for (let y = 0; y < Math.min(height, this.mapHeight); y++) {
        for (let x = 0; x < Math.min(width, this.mapWidth); x++) {
          const oldIndex = y * this.mapWidth + x;
          const newIndex = y * width + x;
          if (oldIndex < layer.data.length) {
            newData[newIndex] = layer.data[oldIndex];
          }
        }
      }
      layer.data = newData;
    }
    
    this.draw();

    // Trigger immediate auto-save for critical changes
    this.markAsChanged(true);
  }

  public addLayer(name: string, type: 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc'): boolean {
    // Check if layer type already exists
    const existingLayer = this.tileLayers.find(layer => layer.type === type);
    if (existingLayer) {
      return false; // Layer type already exists
    }

    // Save state before adding layer
    this.saveState();

    const newLayer = {
      id: this.nextLayerId++,
      name: name,
      type: type,
      data: new Array(this.mapWidth * this.mapHeight).fill(0),
      visible: true,
      transparency: 1.0 // Default to fully opaque
    };
    
    // Add layer and sort by type priority
    this.tileLayers.push(newLayer);
    this.sortLayersByPriority();
    this.activeLayerId = newLayer.id;
    this.draw();

    // Trigger immediate auto-save for critical changes
    this.markAsChanged(true);

    return true; // Successfully added
  }

  private sortLayersByPriority(): void {
    const typePriority: Record<string, number> = {
      'npc': 1,
      'enemy': 2,
      'event': 3,
      'collision': 4,
      'object': 5,
      'background': 6
    };

    this.tileLayers.sort((a, b) => {
      return typePriority[a.type] - typePriority[b.type];
    });
  }

  public deleteLayer(layerId: number): boolean {
    if (this.tileLayers.length <= 1) {
      return false; // Cannot delete the last layer
    }
    
    const layerIndex = this.tileLayers.findIndex(l => l.id === layerId);
    if (layerIndex !== -1) {
      // Save state before deleting layer
      this.saveState();
      
      this.tileLayers.splice(layerIndex, 1);
      
      // Set active layer to the first available layer
      if (this.activeLayerId === layerId) {
        this.activeLayerId = this.tileLayers.length > 0 ? this.tileLayers[0].id : null;
      }
      this.draw();

      // Trigger immediate auto-save for critical changes
      this.markAsChanged(true);

      return true; // Successfully deleted
    }
    return false; // Layer not found
  }

  public setActiveLayer(layerId: number): void {
    this.activeLayerId = layerId;
    
    // Update tileset for the new active layer
    const activeLayer = this.tileLayers.find(l => l.id === layerId);
    if (activeLayer) {
      this.updateCurrentTileset(activeLayer.type);
    }
    
    this.draw();
  }

  public toggleLayerVisibility(layerId: number): void {
    const layer = this.tileLayers.find(l => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      this.draw();
    }
  }

  public setLayerTransparency(layerId: number, transparency: number): void {
    const layer = this.tileLayers.find(l => l.id === layerId);
    if (layer) {
      layer.transparency = Math.max(0, Math.min(1, transparency)); // Clamp between 0 and 1
      this.draw();
    }
  }

  public setMapName(name: string | null | undefined): void {
    if (typeof name === 'string') {
      const trimmed = name.trim();
      this.mapName = trimmed.length > 0 ? trimmed : 'Untitled Map';
    } else {
      this.mapName = 'Untitled Map';
    }
  }

  public getMapName(): string {
    return this.mapName;
  }

  public setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    
    // Reinitialize collision data
    this.collisionData = new Array(width * height).fill(0);
    
    // Resize all existing layers
    this.tileLayers.forEach(layer => {
      const oldData = layer.data;
      layer.data = new Array(width * height).fill(0);
      
      // Copy existing data if possible
      for (let y = 0; y < Math.min(height, 15); y++) { // 15 was the old default height
        for (let x = 0; x < Math.min(width, 20); x++) { // 20 was the old default width
          const oldIndex = y * 20 + x; // Old width
          const newIndex = y * width + x; // New width
          if (oldIndex < oldData.length) {
            layer.data[newIndex] = oldData[oldIndex];
          }
        }
      }
    });
    
    this.draw();
  }

  public renameLayer(layerId: number, newName: string): void {
    const layer = this.tileLayers.find(l => l.id === layerId);
    if (layer) {
      layer.name = newName;
    }
  }

  public changeLayerType(layerId: number, newType: 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc', newName: string): boolean {
    const layer = this.tileLayers.find(l => l.id === layerId);
    if (layer) {
      layer.type = newType;
      layer.name = newName;
      this.sortLayersByPriority();
      return true;
    }
    return false;
  }

  public setLayerType(layerId: number, newType: 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc'): void {
    const layer = this.tileLayers.find(l => l.id === layerId);
    if (layer) {
      layer.type = newType;
      this.sortLayersByPriority();
    }
  }

  public getLayers(): TileLayer[] {
    return this.tileLayers;
  }

  public getActiveLayerId(): number | null {
    return this.activeLayerId;
  }

  public getHoverCoordinates(): { x: number; y: number } | null {
    if (this.hoverX >= 0 && this.hoverY >= 0) {
      return { x: this.hoverX, y: this.hoverY };
    }
    return null;
  }

  public getActiveLayer(): TileLayer | null {
    if (this.activeLayerId !== null) {
      return this.tileLayers.find(l => l.id === this.activeLayerId) || null;
    }
    return null;
  }

  // Tool management methods
  public setCurrentTool(tool: 'brush' | 'eraser' | 'bucket'): void {
    this.currentTool = tool;
    this.tool = 'tiles'; // Set main tool mode to tiles for brush tools
  }

  public getCurrentTool(): 'brush' | 'eraser' | 'bucket' {
    return this.currentTool;
  }

  // Selection tool management methods
  public setCurrentSelectionTool(tool: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular'): void {
    this.currentSelectionTool = tool;
    this.tool = 'selection'; // Set main tool mode to selection
  }

  public getCurrentSelectionTool(): 'rectangular' | 'magic-wand' | 'same-tile' | 'circular' {
    return this.currentSelectionTool;
  }

  // Shape tool management methods
  public setCurrentShapeTool(tool: 'rectangle' | 'circle' | 'line'): void {
    this.currentShapeTool = tool;
    this.tool = 'shape'; // Set main tool mode to shape
  }

  public getCurrentShapeTool(): 'rectangle' | 'circle' | 'line' {
    return this.currentShapeTool;
  }

  // Eyedropper tool management methods
  public setEyedropperTool(): void {
    this.tool = 'eyedropper';
    this.mapCanvas.style.cursor = 'crosshair'; // Will be updated to eyedropper cursor
  }

  public isEyedropperActive(): boolean {
    return this.tool === 'eyedropper';
  }

  // Callback for when eyedropper switches back to brush tool
  private eyedropperCallback: (() => void) | null = null;
  private objectsChangedCallback: ((objects: MapObject[]) => void) | null = null;

  // Stamp tool state
  private stamps: Map<string, import('../types').Stamp> = new Map();
  private activeStamp: import('../types').Stamp | null = null;
  private stampPreview: { x: number; y: number; visible: boolean } = { x: 0, y: 0, visible: false };
  private stampCallback: ((stamps: import('../types').Stamp[]) => void) | null = null;
  private heroEditCallback: ((currentX: number, currentY: number, mapWidth: number, mapHeight: number, onConfirm: (x: number, y: number) => void) => void) | null = null;

  public setEyedropperCallback(callback: (() => void) | null): void {
    this.eyedropperCallback = callback;
  }

  public setObjectsChangedCallback(callback: ((objects: MapObject[]) => void) | null): void {
    this.objectsChangedCallback = callback;
    if (callback) {
      callback(this.getMapObjects());
    }
  }

  // Stamp tool management methods
  public setStampTool(): void {
    this.tool = 'stamp';
    this.mapCanvas.style.cursor = 'crosshair';
    this.stampPreview.visible = false;
  }

  public isStampActive(): boolean {
    return this.tool === 'stamp';
  }

  public setCurrentStampMode(mode: 'select' | 'create' | 'place'): void {
    this.currentStampMode = mode;
    this.stampPreview.visible = mode === 'place' && this.activeStamp !== null;
    this.draw();
  }

  public getCurrentStampMode(): 'select' | 'create' | 'place' {
    return this.currentStampMode;
  }

  public createStampFromSelection(name: string): boolean {
    if (!this.selection.active || this.selection.tiles.length === 0) {
      return false;
    }

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const tile of this.selection.tiles) {
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x);
      maxY = Math.max(maxY, tile.y);
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Create stamp tiles with relative positions
    const stampTiles: import('../types').StampTile[] = [];
    
    // Use current active layer for stamps
    const currentLayerId = this.activeLayerId || 0;
    
    for (const tile of this.selection.tiles) {
      if (tile.gid > 0) {
        stampTiles.push({
          tileId: tile.gid,
          layerId: currentLayerId,
          x: tile.x - minX,
          y: tile.y - minY
        });
      }
    }

    const stamp: import('../types').Stamp = {
      id: Date.now().toString(),
      name,
      width,
      height,
      tiles: stampTiles
    };

    this.stamps.set(stamp.id, stamp);
    this.clearSelection();
    
    // Notify callback about stamp changes
    if (this.stampCallback) {
      this.stampCallback(Array.from(this.stamps.values()));
    }

    return true;
  }

  public setActiveStamp(stampId: string | null): void {
    if (stampId && this.stamps.has(stampId)) {
      this.activeStamp = this.stamps.get(stampId)!;
      this.currentStampMode = 'place';
      this.stampPreview.visible = true;
    } else {
      this.activeStamp = null;
      this.stampPreview.visible = false;
    }
    this.draw();
  }

  public getStamps(): import('../types').Stamp[] {
    return Array.from(this.stamps.values());
  }

  public deleteStamp(stampId: string): boolean {
    if (this.stamps.has(stampId)) {
      this.stamps.delete(stampId);
      if (this.activeStamp && this.activeStamp.id === stampId) {
        this.activeStamp = null;
        this.stampPreview.visible = false;
      }
      
      // Notify callback about stamp changes
      if (this.stampCallback) {
        this.stampCallback(Array.from(this.stamps.values()));
      }
      
      this.draw();
      return true;
    }
    return false;
  }

  public setStampCallback(callback: ((stamps: import('../types').Stamp[]) => void) | null): void {
    this.stampCallback = callback;
  }

  public setHeroEditCallback(callback: ((currentX: number, currentY: number, mapWidth: number, mapHeight: number, onConfirm: (x: number, y: number) => void) => void) | null): void {
    this.heroEditCallback = callback;
  }

  private placeStamp(gridX: number, gridY: number): void {
    if (!this.activeStamp) return;

    // Check if placement is within bounds
    if (gridX < 0 || gridY < 0 || 
        gridX + this.activeStamp.width > this.mapWidth || 
        gridY + this.activeStamp.height > this.mapHeight) {
      return;
    }

    // Place each tile from the stamp
    for (const stampTile of this.activeStamp.tiles) {
      const targetX = gridX + stampTile.x;
      const targetY = gridY + stampTile.y;
      const targetIndex = targetY * this.mapWidth + targetX;

      // Find the target layer by ID, or use current active layer
      let targetLayer = this.tileLayers.find(l => l.id === stampTile.layerId);
      
      if (!targetLayer && this.activeLayerId !== null) {
        // If layer doesn't exist, use the active layer
        targetLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      }

      if (targetLayer) {
        targetLayer.data[targetIndex] = stampTile.tileId;
      }
    }

    this.saveState();
    this.draw();
  }

  /**
   * Build a simple stamp layout from the currently multi-selected brushes.
   * This arranges selected tiles into a compact grid (row-major) where each
   * cell corresponds to one map tile (using grid cell units). The tileIds
   * are placed in the order they were selected.
   */
  private buildStampFromMultiSelection(): Stamp | null {
    if (this.multiSelectedBrushes.size === 0) return null;
    const gids = Array.from(this.multiSelectedBrushes.values());
    const n = gids.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    const tiles: StampTile[] = [];
    for (let i = 0; i < n; i++) {
      const gid = gids[i];
      const sx = i % cols;
      const sy = Math.floor(i / cols);
      tiles.push({ tileId: gid, layerId: this.activeLayerId ?? 0, x: sx, y: sy });
    }

    return {
      id: `multiselection-${Date.now()}`,
      name: 'MultiSelectStamp',
      width: cols,
      height: rows,
      tiles
    };
  }

  private placeMultiSelectionAt(gridX: number, gridY: number): void {
    const stamp = this.buildStampFromMultiSelection();
    if (!stamp) return;

    // Place each tile relative to gridX/gridY
    for (const t of stamp.tiles) {
      const targetX = gridX + t.x;
      const targetY = gridY + t.y;
      if (targetX < 0 || targetY < 0 || targetX >= this.mapWidth || targetY >= this.mapHeight) continue;
      const index = targetY * this.mapWidth + targetX;
      const layer = this.tileLayers.find(l => l.id === (t.layerId || this.activeLayerId));
      if (layer) {
        layer.data[index] = t.tileId;
      }
    }

    this.saveState();
    this.draw();
  }

  public clearSelection(): void {
    this.selection.active = false;
    this.selection.tiles = [];
    this.draw();
  }

  public hasActiveSelection(): boolean {
    return this.selection.active && this.selection.tiles.length > 0;
  }

  public getSelection(): Array<{x: number, y: number, gid: number}> {
    return [...this.selection.tiles];
  }

  // Selection operations
  public selectAll(): void {
    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return;

    this.selection.tiles = [];
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        const gid = layer.data[index];
        this.selection.tiles.push({x, y, gid});
      }
    }
    this.selection.active = true;
    this.draw();
  }

  public deleteSelection(): void {
    if (!this.selection.active || this.selection.tiles.length === 0) return;

    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return;

    this.saveState();
    
    // Clear all selected tiles
    this.selection.tiles.forEach(tile => {
      const index = tile.y * this.mapWidth + tile.x;
      layer.data[index] = 0;
    });

    this.clearSelection();
    this.markAsChanged();
    this.draw();
  }

  public fillSelection(): void {
    if (!this.selection.active || this.selection.tiles.length === 0 || this.activeGid === 0) return;

    const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!layer) return;

    this.saveState();
    
    // Fill all selected tiles with active GID
    this.selection.tiles.forEach(tile => {
      const index = tile.y * this.mapWidth + tile.x;
      layer.data[index] = this.activeGid;
    });

    this.markAsChanged();
    this.draw();
  }

  // Bucket fill implementation using flood fill algorithm
  private bucketFill(layer: TileLayer, startX: number, startY: number, newValue: number): void {
    const targetValue = layer.data[startY * this.mapWidth + startX];
    
    // If the target value is the same as new value, no need to fill
    if (targetValue === newValue) {
      return;
    }

    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    const visited = new Set<number>();

    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      const index = y * this.mapWidth + x;

      // Check bounds and if already visited
      if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight || visited.has(index)) {
        continue;
      }

      // Check if this tile matches the target value
      if (layer.data[index] !== targetValue) {
        continue;
      }

      // Mark as visited and fill
      visited.add(index);
      layer.data[index] = newValue;

      // Add neighboring tiles to stack
      stack.push({x: x + 1, y: y});
      stack.push({x: x - 1, y: y});
      stack.push({x: x, y: y + 1});
      stack.push({x: x, y: y - 1});
    }
  }

  // Selection algorithms
  private selectRectangular(layer: TileLayer, startX: number, startY: number, endX: number, endY: number): void {
    this.selection.tiles = [];
    
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
          const index = y * this.mapWidth + x;
          const gid = layer.data[index];
          this.selection.tiles.push({x, y, gid});
        }
      }
    }
    
    this.selection.active = true;
  }

  private selectMagicWand(layer: TileLayer, startX: number, startY: number): void {
    const targetGid = layer.data[startY * this.mapWidth + startX];
    this.selection.tiles = [];
    
    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    const visited = new Set<number>();

    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      const index = y * this.mapWidth + x;

      if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight || visited.has(index)) {
        continue;
      }

      if (layer.data[index] !== targetGid) {
        continue;
      }

      visited.add(index);
      this.selection.tiles.push({x, y, gid: targetGid});

      stack.push({x: x + 1, y: y});
      stack.push({x: x - 1, y: y});
      stack.push({x: x, y: y + 1});
      stack.push({x: x, y: y - 1});
    }
    
    this.selection.active = true;
  }

  private selectSameTile(layer: TileLayer, startX: number, startY: number): void {
    const targetGid = layer.data[startY * this.mapWidth + startX];
    this.selection.tiles = [];

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        if (layer.data[index] === targetGid) {
          this.selection.tiles.push({x, y, gid: targetGid});
        }
      }
    }
    
    this.selection.active = true;
  }

  private selectCircular(layer: TileLayer, centerX: number, centerY: number, endX: number, endY: number): void {
    this.selection.tiles = [];
    
    const radius = Math.sqrt(Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2));

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        if (distance <= radius) {
          const index = y * this.mapWidth + x;
          const gid = layer.data[index];
          this.selection.tiles.push({x, y, gid});
        }
      }
    }
    
    this.selection.active = true;
  }

  // Shape drawing algorithms
  private drawRectangleShape(startX: number, startY: number, endX: number, endY: number): Array<{x: number, y: number}> {
    const points: Array<{x: number, y: number}> = [];
    
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    // Draw rectangle outline
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Only draw the border of the rectangle
        if (x === minX || x === maxX || y === minY || y === maxY) {
          if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
            points.push({x, y});
          }
        }
      }
    }
    
    return points;
  }

  private drawCircleShape(centerX: number, centerY: number, endX: number, endY: number): Array<{x: number, y: number}> {
    const points: Array<{x: number, y: number}> = [];
    const radius = Math.sqrt(Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2));

    // Bresenham's circle algorithm adapted for outline
    for (let angle = 0; angle < 360; angle += 1) {
      const radians = (angle * Math.PI) / 180;
      const x = Math.round(centerX + radius * Math.cos(radians));
      const y = Math.round(centerY + radius * Math.sin(radians));
      
      if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
        // Avoid duplicate points
        if (!points.some(p => p.x === x && p.y === y)) {
          points.push({x, y});
        }
      }
    }
    
    return points;
  }

  private drawLineShape(startX: number, startY: number, endX: number, endY: number): Array<{x: number, y: number}> {
    const points: Array<{x: number, y: number}> = [];

    // Bresenham's line algorithm
    const dx = Math.abs(endX - startX);
    const dy = Math.abs(endY - startY);
    const sx = startX < endX ? 1 : -1;
    const sy = startY < endY ? 1 : -1;
    let err = dx - dy;

    let x = startX;
    let y = startY;

    let finished = false;
    while (!finished) {
      if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
        points.push({x, y});
      }

      if (x === endX && y === endY) {
        finished = true;
        continue;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return points;
  }

  private resolveInternalAssetPath(fileName: string): string {
    if (typeof window === 'undefined') {
      return fileName;
    }

    try {
      const url = new URL(fileName, window.location.href);
      return url.toString();
    } catch {
      return fileName;
    }
  }

  private normalizePath(input: string): string {
    return input.replace(/\\/g, '/');
  }

  private isInternalTilesetFile(fileName: string | null | undefined): boolean {
    return !!fileName && INTERNAL_TILESET_FILENAMES.has(fileName.toLowerCase());
  }

  private extractFileSourcePath(file: File): string | null {
    const candidate = (file as File & { path?: string }).path;
    if (candidate && typeof candidate === 'string') {
      return this.normalizePath(candidate);
    }
    if (file.name) {
      return file.name;
    }
    return null;
  }

  // Layer-specific tileset management
  public setLayerTileset(layerType: string, file: File): void {
    const gidSnapshotBefore = this.snapshotLayerGids();
    const image = new Image();
    image.onload = () => {
      const columns = Math.max(1, Math.floor(image.width / this.tileSizeX));
      const rows = Math.max(1, Math.floor(image.height / this.tileSizeY));
      const count = Math.max(1, columns * rows);
      const tileWidth = columns > 0 ? Math.round(image.width / columns) : this.tileSizeX;
      const tileHeight = rows > 0 ? Math.round(image.height / rows) : this.tileSizeY;
      const sourcePath = this.extractFileSourcePath(file);

      this.layerTilesets.set(layerType, {
        image,
        fileName: file.name,
        columns,
        rows,
        count,
        tileWidth,
        tileHeight,
        spacing: 0,
        margin: 0,
        sourcePath
      });

      // Update current tileset if this is the active layer
      const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (activeLayer && activeLayer.type === layerType) {
        this.updateCurrentTileset(layerType);
      }

      const gidSnapshotAfter = this.snapshotLayerGids();
      this.logLayerGidChanges(gidSnapshotBefore, gidSnapshotAfter, layerType);
    };
    image.src = URL.createObjectURL(file);
  }

  public getCurrentLayerType(): string | null {
    const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    return activeLayer ? activeLayer.type : null;
  }

  public hasLayerTileset(layerType: string): boolean {
    return this.layerTilesets.has(layerType);
  }

  // Tab management API
  public createLayerTab(layerType: string, name?: string): number {
  const tabs = this.layerTabs.get(layerType) || [];
  const id = this.nextLayerTabId++;
  const tab = { id, name: name || `Tab ${tabs.length + 1}` };
    tabs.push(tab);
    this.layerTabs.set(layerType, tabs);
    // If no active tab set for this layer, set this one
    if (!this.layerActiveTabId.has(layerType)) {
      this.layerActiveTabId.set(layerType, id);
    }
    return id;
  }

  public getLayerTabs(layerType: string) {
    return this.layerTabs.get(layerType) || [];
  }

  public setActiveLayerTab(layerType: string, tabId: number): void {
    this.layerActiveTabId.set(layerType, tabId);
    // When switching active tab, update current tileset/palette to reflect tab's tileset if present
    const tabs = this.layerTabs.get(layerType);
    if (tabs) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab && tab.tileset && tab.tileset.image) {
        const columns = tab.tileset.columns ?? (tab.tileset.image ? Math.max(1, Math.floor(tab.tileset.image.width / this.tileSizeX)) : 1);
        const rows = tab.tileset.rows ?? (tab.tileset.image ? Math.max(1, Math.floor(tab.tileset.image.height / this.tileSizeY)) : 1);
        const count = tab.tileset.count ?? Math.max(1, columns * rows);
        const tileWidth = tab.tileset.tileWidth ?? (tab.tileset.image ? Math.round(tab.tileset.image.width / columns) : this.tileSizeX);
        const tileHeight = tab.tileset.tileHeight ?? (tab.tileset.image ? Math.round(tab.tileset.image.height / rows) : this.tileSizeY);
        this.layerTilesets.set(layerType, {
          image: tab.tileset.image,
          fileName: tab.tileset.fileName ?? null,
          columns,
          rows,
          count,
          tileWidth,
          tileHeight,
          spacing: tab.tileset.spacing ?? 0,
          margin: tab.tileset.margin ?? 0,
          sourcePath: tab.tileset.sourcePath ?? null
        });
        // Load detected tiles from tab if present
        if (tab.detectedTiles) {
          this.detectedTileData.clear();
          for (const [gid, data] of tab.detectedTiles.entries()) {
            this.detectedTileData.set(gid, data);
          }
        }
        this.updateCurrentTileset(layerType);
      } else {
        // No tileset for this tab -> clear current tileset
        this.layerTilesets.delete(layerType);
        this.updateCurrentTileset(layerType);
      }
    }
  }

  public importBrushImageToLayerTab(layerType: string, tabId: number, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const tabs = this.layerTabs.get(layerType) || [];
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return reject(new Error('Tab not found'));
        if (!tab.brushes) tab.brushes = [];
        tab.brushes.push({ image: img as HTMLImageElement, fileName: file.name, width: img.width, height: img.height });
        const columns = Math.max(1, Math.floor(img.width / this.tileSizeX));
        const rows = Math.max(1, Math.floor(img.height / this.tileSizeY));
        const count = Math.max(1, columns * rows);
        const tileWidth = columns > 0 ? Math.round(img.width / columns) : this.tileSizeX;
        const tileHeight = rows > 0 ? Math.round(img.height / rows) : this.tileSizeY;
        const sourcePath = this.extractFileSourcePath(file);
        // If this tab has no tileset, optionally set it as tileset for quick use
        if (!tab.tileset) {
          tab.tileset = {
            image: img as HTMLImageElement,
            fileName: file.name,
            columns,
            rows,
            count,
            tileWidth,
            tileHeight,
            spacing: 0,
            margin: 0,
            sourcePath
          };
        } else {
          // Update tileset metadata so it stays in sync with latest import
          tab.tileset.image = img as HTMLImageElement;
          tab.tileset.fileName = file.name;
          tab.tileset.columns = columns;
          tab.tileset.rows = rows;
          tab.tileset.count = count;
          tab.tileset.tileWidth = tileWidth;
          tab.tileset.tileHeight = tileHeight;
          tab.tileset.spacing = 0;
          tab.tileset.margin = 0;
          tab.tileset.sourcePath = sourcePath;
        }
        // If this tab is active for the layer, update current tileset/palette
        const activeTabId = this.layerActiveTabId.get(layerType);
        if (activeTabId === tabId) {
          this.setActiveLayerTab(layerType, tabId);
        }
        resolve();
      };
      img.onerror = (_e) => reject(new Error('Failed to load brush image'));
      img.src = URL.createObjectURL(file);
    });
  }

  public removeLayerTab(layerType: string, tabId: number): void {
    const tabs = this.layerTabs.get(layerType) || [];
    const idx = tabs.findIndex(t => t.id === tabId);
    console.info(`removeLayerTab called for layer=${layerType} tabId=${tabId} (found idx=${idx})`);
    if (idx !== -1) {
      const removed = tabs.splice(idx, 1);
      console.info('removeLayerTab removed:', removed);
      this.layerTabs.set(layerType, tabs);
      // If removed active tab, set another as active
      const active = this.layerActiveTabId.get(layerType);
      if (active === tabId) {
        if (tabs.length > 0) {
          // Use setActiveLayerTab so the editor updates the current tileset/palette immediately
          try {
            this.setActiveLayerTab(layerType, tabs[0].id);
          } catch (e) {
            // Fallback to direct set if something unexpected happens
            console.warn('setActiveLayerTab failed during removeLayerTab fallback to direct set:', e);
            this.layerActiveTabId.set(layerType, tabs[0].id);
            this.updateCurrentTileset(layerType);
          }
        } else {
          this.layerActiveTabId.delete(layerType);
          // No tabs left -> clear tileset for this layer
          this.layerTilesets.delete(layerType);
          this.updateCurrentTileset(layerType);
        }
      }
    } else {
      console.warn(`removeLayerTab: tab id ${tabId} not found in layer ${layerType}. Current tabs:`, tabs.map(t=>t.id));
    }
  }

  public getActiveLayerTabId(layerType: string): number | null {
    return this.layerActiveTabId.get(layerType) || null;
  }

  public updateCurrentTileset(layerType: string): void {
    const tileset = this.getLayerTilesetOrFallback(layerType);
    if (tileset) {
      this.tilesetImage = tileset.image;
      this.tilesetFileName = tileset.fileName;
      this.tilesetColumns = tileset.columns;
      this.tilesetRows = tileset.rows;
      this.tileCount = tileset.count;
      this.tilesetTileWidth = tileset.tileWidth ?? this.tileSizeX;
      this.tilesetTileHeight = tileset.tileHeight ?? this.tileSizeY;
      this.tilesetSpacing = tileset.spacing ?? 0;
      this.tilesetMargin = tileset.margin ?? 0;
      this.tilesetSourcePath = tileset.sourcePath ?? this.tilesetSourcePath;
      
      // Update the global detectedTileData to match this layer's tiles
      const layerTiles = this.layerTileData.get(layerType);
      this.detectedTileData.clear();
      if (layerTiles) {
        for (const [gid, data] of layerTiles.entries()) {
          this.detectedTileData.set(gid, data);
        }
      }
      
  // Restore the active GID for this layer
  const layerActiveGid = this.layerActiveGid.get(layerType) || 0;
  this.updateActiveGid(layerActiveGid);
      
      this.createTilePalette();
    } else {
      // Clear current tileset if no tileset for this layer type
      this.tilesetImage = null;
      this.tilesetFileName = null;
      this.tilesetColumns = 0;
      this.tilesetRows = 0;
      this.tileCount = 0;
      this.detectedTileData.clear();
  this.updateActiveGid(0);
      this.clearTilePalette();
    }
  }

  private clearTilePalette(): void {
    const container = document.getElementById('tilesContainer');
    if (container) {
      container.innerHTML = '';
    }
    this.hideCollisionBrushTooltip(true);
  }

  public clearLayer(): void {
    if (this.activeLayerId !== null) {
      const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (layer) {
        layer.data.fill(0);
      }
    }
    this.draw();
  }

  public removeLayerTileset(): void {
    const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (activeLayer) {
      const layerType = activeLayer.type;
      
      // Remove from layer tilesets
      this.layerTilesets.delete(layerType);
      
      // Remove layer tile data
      this.layerTileData.delete(layerType);
      
      // Clear current tileset display if this was the active layer
      this.tilesetImage = null;
      this.tilesetFileName = null;
      this.tilesetColumns = 0;
      this.tilesetRows = 0;
      this.tileCount = 0;
      this.detectedTileData.clear();
      this.activeGid = 0;
      this.clearTilePalette();
      
      this.draw();
    }
  }

  // Flare export system
  public exportFlareMap(): void {
    if (!this.tilesetImage || !this.tilesetFileName) {
      alert('Please load a tileset first before exporting.');
      return;
    }

    // Generate both the map TXT and tilesetdefs.txt with enhanced Flare compatibility
    const mapTxt = this.generateFlareMapTxt();
    const tilesetDef = this.generateFlareTilesetDef();

    // Create and download map.txt
    this.downloadFile(mapTxt, 'map.txt', 'text/plain');
    
    // Create and download tilesetdefs/tileset.txt
    this.downloadFile(tilesetDef, 'tileset.txt', 'text/plain');
    
    console.log('Flare-compatible map exported successfully!');
    console.log('📁 Files exported:');
    console.log('  • map.txt (place in maps/ folder)');
    console.log('  • tileset.txt (place in tilesetdefs/ folder)');
    console.log('🎮 Format: Fully compatible with Flare Engine');
    
    // Log global tileset mapping for debugging
    this.logGlobalTilesetMapping();
  }

  // Debug helper: Log the global tileset mapping
  private logGlobalTilesetMapping(): void {
    console.log('??? Global Tileset Mapping:');
    const globalTilesets = this.collectGlobalTilesets();
    for (const tileset of globalTilesets) {
      const endOffset = tileset.offset + tileset.count - 1;
      console.log(`  ${tileset.fileName} (${tileset.layerType}): IDs ${tileset.offset}-${endOffset} (${tileset.count} tiles)`);
    }
  }

  // Silent auto-save export (no alerts, no downloads)
  public autoSaveExport(): boolean {
    // Don't auto-save if there's no tileset or no meaningful data
    if (!this.tilesetImage || !this.tilesetFileName) {
      return false; // Nothing to save yet
    }

    // Check if there's any actual tile data to save
    const hasData = this.tileLayers.some(layer => 
      layer.data.some(tile => tile !== 0)
    );

    if (!hasData) {
      return false; // No meaningful data to save
    }

    try {
      // Save to localStorage only for auto-save
      this.saveToLocalStorage();
      return true;
    } catch (error) {
      console.warn('Auto-save failed:', error);
      return false;
    }
  }

  private collectGlobalTilesets(): GlobalTilesetInfo[] {
    const results: GlobalTilesetInfo[] = [];
    const added = new Set<string>();

    const pushTileset = (entry: {
      layerType: string;
      fileName: string | null;
      count: number;
      columns: number;
      rows: number;
      tileWidth: number;
      tileHeight: number;
      spacing: number;
      margin: number;
      sourcePath: string | null;
      image: HTMLImageElement | null;
    }) => {
      if (!entry.fileName) {
        return;
      }

      if (this.isInternalTilesetFile(entry.fileName)) {
        return;
      }
      const uniqueKey = `${entry.fileName}:${entry.sourcePath ?? ''}`;
      if (added.has(uniqueKey)) {
        return;
      }
      const columns = Math.max(1, entry.columns);
      const rows = Math.max(1, entry.rows);
      const count = Math.max(1, entry.count);
      const tileWidth = Math.max(1, entry.tileWidth || this.tileSizeX);
      const tileHeight = Math.max(1, entry.tileHeight || this.tileSizeY);
      const spacing = entry.spacing ?? 0;
      const margin = entry.margin ?? 0;

      results.push({
        id: uniqueKey || entry.fileName,
        layerType: entry.layerType,
        fileName: entry.fileName,
        count,
        columns,
        rows,
        tileWidth,
        tileHeight,
        spacing,
        margin,
        sourcePath: entry.sourcePath,
        image: entry.image,
        offset: 0
      });

      added.add(uniqueKey);
    };

    if (this.tilesetFileName && this.tileCount > 0 && !this.isInternalTilesetFile(this.tilesetFileName)) {
      const columns = this.tilesetColumns || (this.tilesetImage ? Math.max(1, Math.floor(this.tilesetImage.width / this.tileSizeX)) : 1);
      const rows = this.tilesetRows || (this.tilesetImage ? Math.max(1, Math.floor(this.tilesetImage.height / this.tileSizeY)) : 1);
      const tileWidth = this.tilesetTileWidth ?? (this.tilesetImage ? Math.round(this.tilesetImage.width / Math.max(columns, 1)) : this.tileSizeX);
      const tileHeight = this.tilesetTileHeight ?? (this.tilesetImage ? Math.round(this.tilesetImage.height / Math.max(rows, 1)) : this.tileSizeY);
      const count = Math.max(1, this.tileCount);
      pushTileset({
        layerType: 'main',
        fileName: this.tilesetFileName,
        count,
        columns,
        rows,
        tileWidth,
        tileHeight,
        spacing: this.tilesetSpacing ?? 0,
        margin: this.tilesetMargin ?? 0,
        sourcePath: this.tilesetSourcePath,
        image: this.tilesetImage
      });
    }

    for (const [layerType, tileset] of this.layerTilesets.entries()) {
      if (!tileset.fileName || this.isInternalTilesetFile(tileset.fileName)) {
        continue;
      }
      const columns = tileset.columns ?? (tileset.image ? Math.max(1, Math.floor(tileset.image.width / this.tileSizeX)) : 1);
      const rows = tileset.rows ?? (tileset.image ? Math.max(1, Math.floor(tileset.image.height / this.tileSizeY)) : 1);
      const count = tileset.count ?? Math.max(1, columns * rows);
      const tileWidth = tileset.tileWidth ?? (tileset.image ? Math.round(tileset.image.width / Math.max(columns, 1)) : this.tileSizeX);
      const tileHeight = tileset.tileHeight ?? (tileset.image ? Math.round(tileset.image.height / Math.max(rows, 1)) : this.tileSizeY);
      pushTileset({
        layerType,
        fileName: tileset.fileName,
        count,
        columns,
        rows,
        tileWidth,
        tileHeight,
        spacing: tileset.spacing ?? 0,
        margin: tileset.margin ?? 0,
        sourcePath: tileset.sourcePath ?? null,
        image: tileset.image ?? null
      });
    }

    const layerPriority: Record<string, number> = {
      collision: 0,
      main: 1,
      background: 2,
      object: 3,
      event: 4,
      enemy: 5,
      npc: 6
    };

    results.sort((a, b) => {
      const pa = layerPriority[a.layerType] ?? 99;
      const pb = layerPriority[b.layerType] ?? 99;
      if (pa !== pb) return pa - pb;
      const fa = (a.fileName || '').toLowerCase();
      const fb = (b.fileName || '').toLowerCase();
      if (fa < fb) return -1;
      if (fa > fb) return 1;
      return 0;
    });

    let currentOffset = 1;
    for (const entry of results) {
      entry.offset = currentOffset;
      currentOffset += Math.max(1, entry.count);
    }

    return results;
  }

  private resolveTilesetExportPath(info: GlobalTilesetInfo, overrides?: Record<string, string>): string {
    const candidates: string[] = [];
    if (info.id) candidates.push(info.id);
    if (info.sourcePath) candidates.push(info.sourcePath);
    if (info.fileName) candidates.push(info.fileName);

    if (overrides) {
      for (const candidate of candidates) {
        if (candidate && overrides[candidate]) {
          return this.normalizePath(overrides[candidate]);
        }
      }
    }

    if (info.sourcePath) {
      const normalized = this.normalizePath(info.sourcePath);
      if (/[/\\]/.test(normalized)) {
        return normalized;
      }
    }

    if (info.fileName) {
      return `images/tilesets/${info.fileName}`;
    }

    return 'tileset.png';
  }

  public generateFlareMapTxt(options: FlareExportOptions = {}): string {
    const lines: string[] = [];

    lines.push(`[header]`);
    lines.push(`width=${this.mapWidth}`);
    lines.push(`height=${this.mapHeight}`);
    lines.push(`tilewidth=${this.tileSizeX}`);
    lines.push(`tileheight=${this.tileSizeY}`);
    lines.push(`orientation=isometric`);
    lines.push(`hero_pos=${this.heroX},${this.heroY}`);
    lines.push(`music=music/default_theme.ogg`);
    // Use the exported tilesetdefs/tileset_mapname.txt for this map
    const sanitizedMapName = (this.mapName || 'Map_Name')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_');
    lines.push(`tileset=tilesetdefs/tileset_${sanitizedMapName}.txt`);
    const mapTitle = (options.mapName && options.mapName.trim())
      || this.mapName
      || (this.tilesetFileName ? this.tilesetFileName.replace(/\.[^/.]+$/, '') : 'Untitled Map');
    lines.push(`title=${mapTitle}`);
    lines.push('');

    const globalTilesets = this.collectGlobalTilesets();
    const mapTilesets = globalTilesets.filter(t => t.fileName && !this.isInternalTilesetFile(t.fileName));
    const tilesetOffsets = new Map<string, number>();
    for (const tileset of mapTilesets) {
      if (!tileset.fileName) continue;
      if (!tilesetOffsets.has(tileset.fileName)) {
        tilesetOffsets.set(tileset.fileName, tileset.offset);
      }
    }

    lines.push(`[tilesets]`);
    // Always use the exported/copy location for the tileset image
    for (const tileset of mapTilesets) {
      if (!tileset.fileName) continue;
      // Use relative path to images/tilesets folder from map file
      const exportPath = `images/tilesets/${tileset.fileName}`;
      lines.push(`tileset=${exportPath},${tileset.tileWidth},${tileset.tileHeight},${tileset.spacing},${tileset.margin}`);
    }
    lines.push('');

    const flareLayerOrder = ['background', 'object', 'collision'];

    for (const layerType of flareLayerOrder) {
      const layer = this.tileLayers.find(l => l.type === layerType && l.visible);
      if (!layer) continue;

      lines.push(`[layer]`);
      lines.push(`type=${layer.type}`);
      lines.push(`data=`);

      const layerTileset = this.getLayerTilesetOrFallback(layerType);
      const isCollisionLayer = layerType === COLLISION_LAYER_TYPE;
      const offsetKey = !isCollisionLayer ? layerTileset?.fileName ?? null : null;
      const tilesetOffset = offsetKey ? tilesetOffsets.get(offsetKey) : undefined;

      for (let y = 0; y < this.mapHeight; y++) {
        const row: string[] = [];
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          const localTileId = layer.data[index];
          let globalTileId = 0;
          if (localTileId > 0) {
            if (tilesetOffset !== undefined && tilesetOffset >= 1) {
              globalTileId = tilesetOffset + (localTileId - 1);
            } else {
              globalTileId = localTileId;
            }
          }
          row.push(globalTileId.toString());
        }
        lines.push(row.join(','));
      }
      lines.push('');
    }

    const events = this.objects.filter(obj => obj.type === 'event');
    for (const event of events) {
      lines.push(`[event]`);
      lines.push(`# ${event.name}`);
      lines.push(`type=event`);
      lines.push(`location=${event.x},${event.y},${event.width},${event.height}`);

      if (event.activate) lines.push(`activate=${event.activate}`);
      if (event.hotspot) lines.push(`hotspot=${event.hotspot}`);
      if (event.intermap) lines.push(`intermap=${event.intermap}`);
      if (event.loot) lines.push(`loot=${event.loot}`);
      if (event.soundfx) lines.push(`soundfx=${event.soundfx}`);
      if (event.mapmod) lines.push(`mapmod=${event.mapmod}`);
      if (event.repeat !== undefined) lines.push(`repeat=${event.repeat}`);
      if (event.tooltip) lines.push(`tooltip=${event.tooltip}`);

      for (const [key, value] of Object.entries(event.properties)) {
        lines.push(`${key}=${value}`);
      }

      lines.push('');
    }

    const enemies = this.objects.filter(obj => obj.type === 'enemy');
    for (const enemy of enemies) {
      lines.push(`[enemy]`);
      lines.push(`type=enemy`);
      lines.push(`location=${enemy.x},${enemy.y},${enemy.width},${enemy.height}`);

      if (enemy.category) lines.push(`category=${enemy.category}`);
      if (enemy.level) lines.push(`level=${enemy.level}`);
      if (enemy.number) lines.push(`number=${enemy.number}`);
      if (enemy.wander_radius !== undefined) lines.push(`wander_radius=${enemy.wander_radius}`);

      for (const [key, value] of Object.entries(enemy.properties)) {
        lines.push(`${key}=${value}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  public generateFlareTilesetDef(_options: FlareExportOptions = {}): string {
    const lines: string[] = [];

    const globalTilesets = this.collectGlobalTilesets();
    const exportedTilesets = globalTilesets.filter(t => t.fileName && !this.isInternalTilesetFile(t.fileName));
    if (exportedTilesets.length === 0) {
      return '# No tilesets found - please load tilesets before exporting\n';
    }

    // Use relative path to images/tilesets folder from tilesetdefs
    for (const tileset of exportedTilesets) {
      if (!tileset.fileName) continue;
      const exportPath = `images/tilesets/${tileset.fileName}`;
      lines.push(`img=${exportPath}`);
    }
    lines.push('');

    // Build a lookup of detected tiles (global + per-layer) so we can export
    // accurate per-tile bounds and origins when tiles are variable-sized.
    const detectedLookup = new Map<number, { sourceX: number; sourceY: number; width: number; height: number }>();

    // Global detected tiles (legacy)
    if (this.detectedTileData && this.detectedTileData.size > 0) {
      for (const [gid, data] of this.detectedTileData.entries()) {
        detectedLookup.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height });
      }
    }

    const exportedOffsetByFile = new Map<string, number>();
    for (const tileset of exportedTilesets) {
      if (tileset.fileName && !exportedOffsetByFile.has(tileset.fileName)) {
        exportedOffsetByFile.set(tileset.fileName, tileset.offset);
      }
    }

    // Per-layer detected tiles
    for (const [layerType, layerMap] of this.layerTileData.entries()) {
      const layerTileset = this.getLayerTilesetOrFallback(layerType);
      const fileName = layerTileset?.fileName ?? null;
      if (!fileName || this.isInternalTilesetFile(fileName)) {
        continue;
      }
      const baseOffset = exportedOffsetByFile.get(fileName);
      for (const [gid, data] of layerMap.entries()) {
        const globalKey = baseOffset !== undefined ? baseOffset + gid - 1 : gid;
        if (!detectedLookup.has(globalKey)) {
          detectedLookup.set(globalKey, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height });
        }
      }
    }

    for (const tileset of exportedTilesets) {
      const columns = Math.max(1, tileset.columns);
      const tileWidth = tileset.tileWidth || this.tileSizeX;
      const tileHeight = tileset.tileHeight || this.tileSizeY;

      for (let i = 0; i < tileset.count; i++) {
        const globalId = tileset.offset + i;

        const detected = detectedLookup.get(globalId) || detectedLookup.get(i + 1);
        let left_x: number;
        let top_y: number;
        let width: number;
        let height: number;
        let offset_x: number;
        let offset_y: number;

        if (detected) {
          left_x = detected.sourceX;
          top_y = detected.sourceY;
          width = detected.width;
          height = detected.height;
          // Use bottom-center anchor for detected sprites so they align to ground
          offset_x = Math.floor(width / 2);
          offset_y = height;
        } else {
          left_x = (i % columns) * tileWidth;
          top_y = Math.floor(i / columns) * tileHeight;
          width = tileWidth;
          height = tileHeight;
          // For grid-based tiles default to bottom-center as well
          offset_x = Math.floor(width / 2);
          offset_y = height;
        }

        lines.push(`tile=${globalId},${left_x},${top_y},${width},${height},${offset_x},${offset_y}`);
      }
    }

    return lines.join('\n');
  }

  public getTilesetExportInfo(): TilesetExportInfo[] {
    return this.collectGlobalTilesets().map(tileset => ({
      id: tileset.id,
      fileName: tileset.fileName,
      sourcePath: tileset.sourcePath,
      tileWidth: tileset.tileWidth,
      tileHeight: tileset.tileHeight,
      spacing: tileset.spacing,
      margin: tileset.margin
    }));
  }

  /**
   * Parse the contents of a Flare-style tilesetdefs TXT and populate
   * the editor's detected tile data so rendering/export are consistent.
   * If layerType is provided, tile entries will be stored in that layer's
   * per-layer tile map; otherwise they will be applied to the active layer.
   */
  public parseTilesetDefContent(content: string, layerType?: string): void {
    if (!content) return;

    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const parsed: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }> = new Map();

    for (const line of lines) {
      if (line.startsWith('#')) continue;
      if (line.startsWith('img=')) continue;

      if (line.startsWith('tile=')) {
        const rest = line.substring('tile='.length);
        const parts = rest.split(',').map(p => p.trim());
        // Expected: id,left,top,width,height,origin_x,origin_y (origin optional)
        if (parts.length >= 5) {
          const id = parseInt(parts[0], 10);
          const left = parseInt(parts[1], 10);
          const top = parseInt(parts[2], 10);
          const width = parseInt(parts[3], 10);
          const height = parseInt(parts[4], 10);
          const originX = parts[5] !== undefined ? parseInt(parts[5], 10) : Math.floor(width / 2);
          const originY = parts[6] !== undefined ? parseInt(parts[6], 10) : height;

          if (!Number.isNaN(id) && !Number.isNaN(left) && !Number.isNaN(top) && !Number.isNaN(width) && !Number.isNaN(height)) {
            parsed.set(id, { sourceX: left, sourceY: top, width, height, originX, originY });
          }
        }
      }
    }

    // Merge into global detectedTileData and per-layer map
    if (parsed.size > 0) {
      // Clear current detected data for clarity
      this.detectedTileData.clear();
      for (const [id, data] of parsed.entries()) {
        this.detectedTileData.set(id, data);
      }

      const targetLayer = layerType || this.getCurrentLayerType();
      if (targetLayer) {
        const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
        for (const [id, data] of parsed.entries()) {
          layerTileMap.set(id, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
        }
        this.layerTileData.set(targetLayer, layerTileMap);
      }

      // Rebuild palette and redraw
      this.createTilePalette(true);
      this.draw();
    }
  }

  /**
   * Parse a PNG tileset image using a base grid (default 64x32) and generate
   * Flare `tile=` definitions. Also populates the palette with generated tiles
   * so they can be selected as brushes.
   *
   * This method slices the image by the provided grid and assigns sequential
   * tile IDs starting at 1 (per-image). origin_x and origin_y are by default
   * width/2 and height/2 so that the tile's visual center is used. For larger
   * sprites that occupy multiple grid cells, callers may pass a custom grid or
   * you can later merge/adjust brushes in the editor UI.
   */
  public parseAndExportTileset(img: HTMLImageElement, mapName: string, gridW: number = 64, gridH: number = 32): void {
    if (!img) return;

    const columns = Math.max(1, Math.floor(img.width / gridW));
    const rows = Math.max(1, Math.floor(img.height / gridH));

    const lines: string[] = [];

    // Header with img path — exporter expects images/tilesets folder
    const fileName = this.guessFileNameFromImage(img);
    lines.push(`img=images/tilesets/${fileName}`);
    lines.push('');

    // Reset detected tile data for this tileset
    this.detectedTileData.clear();

    // Prefer automatic detection of actual sprite objects so we export the
    // full non-transparent bounding boxes rather than fixed grid cells.
    const detectedTiles = this.detectVariableSizedTiles();

    if (detectedTiles.length > 0) {
      let gid = 1;
      for (const tile of detectedTiles) {
        const left_x = tile.sourceX;
        const top_y = tile.sourceY;
        const width = tile.width;
        const height = tile.height;
        const origin_x = Math.floor(width / 2);
        const origin_y = height; // bottom anchor

        // Save to detectedTileData so the rest of the editor can use these
        this.detectedTileData.set(gid, { sourceX: left_x, sourceY: top_y, width, height, originX: origin_x, originY: origin_y });

        lines.push(`tile=${gid},${left_x},${top_y},${width},${height},${origin_x},${origin_y}`);
        gid++;
      }
    } else {
      // Fallback to grid slicing if detection returned nothing
      let gid = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const left_x = c * gridW;
          const top_y = r * gridH;
          const width = gridW;
          const height = gridH;
          const origin_x = Math.floor(width / 2);
          const origin_y = height;

          this.detectedTileData.set(gid, { sourceX: left_x, sourceY: top_y, width, height, originX: origin_x, originY: origin_y });

          lines.push(`tile=${gid},${left_x},${top_y},${width},${height},${origin_x},${origin_y}`);
          gid++;
        }
      }
    }

    // Compose filename for tilesetdefs file adjacent to image
    const sanitized = (mapName || 'tileset').replace(/[<>:"/\\|?*]/g, '_').trim();
    const tilesetDefName = `tileset_${sanitized}.txt`;

    const content = lines.join('\n');
    // Try to save next to the PNG when running inside Electron (fs available)
    try {
      const rq = (window as unknown as { require?: (name: string) => unknown }).require;
      if (typeof rq === 'function') {
        const fs = rq('fs') as { writeFileSync?: (p: string, d: string, enc?: string) => void };
        const path = rq('path') as { dirname?: (p: string) => string; join?: (...parts: string[]) => string };
        // Try to determine image source path
        let imagePath: string | null = null;
        if ((img as HTMLImageElement & { dataset?: DOMStringMap }).dataset && (img as HTMLImageElement & { dataset?: DOMStringMap }).dataset['sourcePath']) {
          imagePath = (img as HTMLImageElement & { dataset?: DOMStringMap }).dataset['sourcePath'] as string;
        } else if (typeof img.src === 'string' && img.src.startsWith('file://')) {
          imagePath = img.src.replace('file://', '');
        } else if (this.tilesetSourcePath) {
          imagePath = this.tilesetSourcePath;
        }

        if (imagePath) {
          if (path && typeof path.dirname === 'function' && typeof path.join === 'function' && fs && typeof fs.writeFileSync === 'function') {
            const dir = path.dirname(imagePath);
            const outPath = path.join(dir, tilesetDefName);
            fs.writeFileSync(outPath, content, 'utf8');
            console.log('Tileset defs saved to', outPath);
          } else {
            // Missing fs/path functions, fallback to download
            this.downloadFile(content, tilesetDefName, 'text/plain');
          }
        } else {
          // Fallback to download
          this.downloadFile(content, tilesetDefName, 'text/plain');
        }
      } else {
        this.downloadFile(content, tilesetDefName, 'text/plain');
      }
    } catch (err) {
      console.warn('Could not write tilesetdefs to disk, falling back to download:', err);
      this.downloadFile(content, tilesetDefName, 'text/plain');
    }

    // Now update the UI palette with newly detected tiles
    // If there is an active layer, store per-layer tile data as well
    const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (activeLayer) {
      const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
      for (const [k, v] of this.detectedTileData.entries()) {
        layerTileMap.set(k, { sourceX: v.sourceX, sourceY: v.sourceY, width: v.width, height: v.height, originX: v.originX, originY: v.originY });
      }
      this.layerTileData.set(activeLayer.type, layerTileMap);
    }

    // Rebuild palette UI using existing method
    this.createTilePalette(true);
  }

  private guessFileNameFromImage(img: HTMLImageElement): string {
    // Try to use dataset or src path to extract filename, fallback to timestamp
    try {
      const src = img.src || '';
      // If consumer attached a filename in dataset, prefer it (loose check)
      // Use index signature to avoid 'any' cast lint errors
  const ds = (img as HTMLImageElement & { dataset?: DOMStringMap }).dataset;
  if (ds && typeof ds['filename'] === 'string' && ds['filename']!.length > 0) return ds['filename'] as string;
      const m = src.match(/[^/\\]+\.(png|jpg|jpeg|webp)$/i);
      if (m) return m[0];
      return `tileset_${Date.now()}.png`;
    } catch (e) {
      return `tileset_${Date.now()}.png`;
    }
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // History management methods
  private saveState(): void {
    if (this.isApplyingHistory) return;

    // Deep copy current state
    const stateCopy = {
      layers: this.tileLayers.map(layer => ({
        ...layer,
        data: [...layer.data]
      })),
      objects: this.objects.map(obj => ({ ...obj }))
    };

    // Remove any history beyond current index
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Add new state
    this.history.push(stateCopy);
    this.historyIndex = this.history.length - 1;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }

    // Mark as changed for auto-save (normal delay for undo/redo states)
    this.markAsChanged(false);
  }

  private deepCopyLayers(layers: TileLayer[]): TileLayer[] {
    return layers.map(layer => ({
      ...layer,
      data: [...layer.data]
    }));
  }

  private deepCopyObjects(objects: MapObject[]): MapObject[] {
    return objects.map(obj => ({ ...obj }));
  }

  public undo(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.applyHistoryState();
    }
  }

  public redo(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.applyHistoryState();
    }
  }

  private applyHistoryState(): void {
    if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      this.isApplyingHistory = true;
      
      const state = this.history[this.historyIndex];
      
      // Restore layers
      this.tileLayers = this.deepCopyLayers(state.layers);
      
      // Restore objects
      this.objects = this.deepCopyObjects(state.objects);
      this.notifyObjectsChanged();
      
      // Redraw
      this.draw();
      
      this.isApplyingHistory = false;
    }
  }

  // Auto-save system methods
  public setAutoSaveCallback(callback: (() => void) | null): void {
    this.autoSaveCallback = callback;
  }

  public setSaveStatusCallback(callback: ((status: 'saving' | 'saved' | 'error' | 'unsaved') => void) | null): void {
    this.saveStatusCallback = callback;
  }

  public setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled = enabled;
    if (!enabled && this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
  }

  public setDarkMode(isDark: boolean): void {
    this.isDarkMode = isDark;
    this.draw(); // Redraw to apply new grid colors
  }

  private markAsChanged(immediate: boolean = false): void {
    if (!this.autoSaveEnabled) return;

    this.hasUnsavedChanges = true;
    this.updateSaveStatus('unsaved');

    // Clear existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // Schedule auto-save with appropriate delay
    const delay = immediate ? this.IMMEDIATE_SAVE_DELAY : this.AUTO_SAVE_DELAY;
    this.autoSaveTimeout = window.setTimeout(() => {
      this.performAutoSave();
    }, delay);
  }

  private async performAutoSave(): Promise<void> {
    if (!this.hasUnsavedChanges) return;

    try {
      this.updateSaveStatus('saving');
      
      // Perform silent auto-save
      const success = this.autoSaveExport();
      
      if (success) {
        // Call external save callback if provided (for additional saving)
        if (this.autoSaveCallback) {
          await this.autoSaveCallback();
        }
        
        this.hasUnsavedChanges = false;
        this.lastSaveTimestamp = Date.now();
        this.updateSaveStatus('saved');
      } else {
        // No meaningful data to save yet, but don't show error
        this.updateSaveStatus('saved');
      }
      
      // Clear the timeout
      this.autoSaveTimeout = null;
    } catch (error) {
      console.error('Auto-save failed:', error);
      this.updateSaveStatus('error');
      
      // Retry after a longer delay
      this.autoSaveTimeout = window.setTimeout(() => {
        this.performAutoSave();
      }, 15000); // 15 seconds retry delay
    }
  }

  private saveToLocalStorage(): void {
    try {
      const backupData = {
        timestamp: Date.now(),
        mapWidth: this.mapWidth,
        mapHeight: this.mapHeight,
        layers: this.tileLayers,
        objects: this.objects,
        heroX: this.heroX,
        heroY: this.heroY,
        tilesetFileName: this.tilesetFileName,
        tilesetImage: this.tilesetImage ? this.canvasToDataURL(this.tilesetImage) : null,
        tileSizeX: this.tileSizeX,
        tileSizeY: this.tileSizeY,
        mapName: this.mapName,
        // Save brush data for proper restoration
        detectedTileData: Array.from(this.detectedTileData.entries()),
        tileContentThreshold: this.tileContentThreshold,
        objectSeparationSensitivity: this.objectSeparationSensitivity
      };
      
      localStorage.setItem('tilemap_autosave_backup', JSON.stringify(backupData));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }
  
  // Helper method to convert image to data URL
  private canvasToDataURL(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    }
    return '';
  }

  // Generate a small top-down minimap as a PNG data URL for saving with the project
  private generateMinimapDataUrl(): string {
    try {
      // Target max dimensions for the minimap image
      const targetW = 160;
      const targetH = 120;

      // Determine pixel size for each map tile
      const tilePixel = Math.max(1, Math.floor(Math.min(targetW / Math.max(1, this.mapWidth), targetH / Math.max(1, this.mapHeight))));
      const canvasW = this.mapWidth * tilePixel;
      const canvasH = this.mapHeight * tilePixel;

      const c = document.createElement('canvas');
      c.width = canvasW;
      c.height = canvasH;
      const ctx = c.getContext('2d');
      if (!ctx) return '';

      ctx.imageSmoothingEnabled = false;

      // Fill with background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Draw tiles per layer using a consistent color mapping
      for (let li = 0; li < this.tileLayers.length; li++) {
        const layer = this.tileLayers[li];
        if (!layer.visible) continue;
        for (let y = 0; y < this.mapHeight; y++) {
          for (let x = 0; x < this.mapWidth; x++) {
            const idx = y * this.mapWidth + x;
            const gid = layer.data[idx];
            if (gid > 0) {
              const hue = (gid * 137.5) % 360;
              ctx.fillStyle = `hsl(${hue},55%,${li === 0 ? '45%' : '60%'})`;
              ctx.fillRect(x * tilePixel, y * tilePixel, tilePixel, tilePixel);
            }
          }
        }
      }

      return c.toDataURL('image/png');
    } catch (e) {
      console.warn('generateMinimapDataUrl failed', e);
      return '';
    }
  }

  public loadFromLocalStorage(): boolean {
    try {
      const backupData = localStorage.getItem('tilemap_autosave_backup');
      if (!backupData) return false;

      const data = JSON.parse(backupData);
      
      // Check if backup is recent (within last 24 hours)
      const age = Date.now() - data.timestamp;
      if (age > 24 * 60 * 60 * 1000) return false;

      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.tileLayers = data.layers;
      const loadedObjects = this.normalizeLoadedObjects(data.objects);
      this.objects = loadedObjects;
      this.nextObjectId = this.calculateNextObjectId(loadedObjects);
      this.notifyObjectsChanged();
      this.tilesetFileName = data.tilesetFileName;
      if (typeof data.mapName === 'string') {
        this.setMapName(data.mapName);
      } else if (this.tilesetFileName) {
        this.setMapName(this.tilesetFileName.replace(/\.[^/.]+$/, ''));
      } else {
        this.setMapName('Untitled Map');
      }

      // Restore hero position if available
      if (data.heroX !== undefined && data.heroY !== undefined) {
        this.heroX = Math.max(0, Math.min(data.heroX, this.mapWidth - 1));
        this.heroY = Math.max(0, Math.min(data.heroY, this.mapHeight - 1));
      } else {
        this.heroX = 0;
        this.heroY = 0;
      }

      // Restore brush-related settings if available
      if (data.tileContentThreshold !== undefined) {
        this.tileContentThreshold = data.tileContentThreshold;
      }
      if (data.objectSeparationSensitivity !== undefined) {
        this.objectSeparationSensitivity = data.objectSeparationSensitivity;
      }

      // Restore detectedTileData if available
      if (data.detectedTileData) {
        this.detectedTileData.clear();
        for (const [key, value] of data.detectedTileData) {
          this.detectedTileData.set(key, value);
        }
      }

      // Restore tileset image if available
      if (data.tilesetImage) {
        const img = new Image();
        img.onload = () => {
          this.tilesetImage = img;
          // Reconstruct tileset metadata
          this.tilesetColumns = Math.floor(img.width / this.tileSizeX);
          this.tilesetRows = Math.floor(img.height / this.tileSizeY);
          this.tileCount = this.tilesetColumns * this.tilesetRows;
          
          // Create tile palette using preserved brush data if available
          if (data.detectedTileData && data.detectedTileData.length > 0) {
            // Use preserved brush data - don't regenerate
            this.createTilePalette(true);
          } else {
            // Generate new brush data from tileset
            this.createTilePalette();
          }
          
          // Restore previously selected tile highlight if any
          this.updateActiveTile();
          this.draw();
        };
        img.src = data.tilesetImage;
      }

      this.ensureCollisionTileset();
      this.draw();
      return true;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return false;
    }
  }

  public clearLocalStorageBackup(): void {
    localStorage.removeItem('tilemap_autosave_backup');
  }

  // Save complete project data
  public async saveProjectData(projectPath: string): Promise<boolean> {
    try {
      console.log('=== SAVE PROJECT DATA DEBUG ===');
      console.log('Project path:', projectPath);
      console.log('Number of layer tilesets:', this.layerTilesets.size);
      
      const tilesetImages: Record<string, string> = {};
      const tilesets: SavedTilesetEntry[] = [];
      
      // Save all layer-specific tilesets
      console.log('=== SAVING LAYER TILESETS ===');
      for (const [layerType, tileset] of this.layerTilesets.entries()) {
        if (!tileset.image || !tileset.fileName) {
          console.log(`No tileset image for layer ${layerType}`);
          continue;
        }
        if (this.isInternalTilesetFile(tileset.fileName)) {
          console.log(`Skipping internal tileset for layer ${layerType}: ${tileset.fileName}`);
          continue;
        }
        console.log(`Saving tileset for layer ${layerType}: ${tileset.fileName}`);
        const dataURL = this.canvasToDataURL(tileset.image);
        tilesetImages[tileset.fileName] = dataURL;
        
        tilesets.push({
          layerType: layerType,
          fileName: tileset.fileName,
          name: tileset.fileName.replace(/\.[^/.]+$/, ''),
          columns: tileset.columns,
          rows: tileset.rows,
          count: tileset.count,
          tileWidth: tileset.tileWidth ?? this.tileSizeX,
          tileHeight: tileset.tileHeight ?? this.tileSizeY,
          spacing: tileset.spacing ?? 0,
          margin: tileset.margin ?? 0,
          sourcePath: tileset.sourcePath ?? null,
          // Save per-layer detected tile data
          detectedTiles: this.getDetectedTilesForLayer(layerType)
        });
        
        console.log(`Saved tileset: ${tileset.fileName} (${dataURL.length} bytes)`);
      }
      
      // Fallback: save legacy tileset if no layer tilesets exist but main tileset does
      if (this.layerTilesets.size === 0 && this.tilesetImage && this.tilesetFileName) {
        console.log('Saving legacy tileset:', this.tilesetFileName);
        const dataURL = this.canvasToDataURL(this.tilesetImage);
        tilesetImages[this.tilesetFileName] = dataURL;
        tilesets.push({
          fileName: this.tilesetFileName,
          name: this.tilesetFileName.replace(/\.[^/.]+$/, ''),
          tileWidth: this.tilesetTileWidth ?? this.tileSizeX,
          tileHeight: this.tilesetTileHeight ?? this.tileSizeY,
          spacing: this.tilesetSpacing ?? 0,
          margin: this.tilesetMargin ?? 0,
          sourcePath: this.tilesetSourcePath,
          detectedTiles: Array.from(this.detectedTileData.entries())
        });
      }

  const projectData: EditorProjectData = {
        name: this.mapName || (this.tilesetFileName ? this.tilesetFileName.replace(/\.[^/.]+$/, '') : 'Untitled Map'),
        width: this.mapWidth,
        height: this.mapHeight,
        tileSize: 64,
        layers: this.tileLayers,
        objects: this.objects,
        heroX: this.heroX,
        heroY: this.heroY,
        tilesets: tilesets,
        tilesetImages,
  // Small minimap image (data URL) for welcome thumbnails and quick previews
  minimap: this.generateMinimapDataUrl(),
        version: "1.0",
        // Global settings
        tileContentThreshold: this.tileContentThreshold,
        objectSeparationSensitivity: this.objectSeparationSensitivity
      };

      console.log('Project data prepared:', {
        name: projectData.name,
  tilesetCount: Object.keys(projectData.tilesetImages || {}).length,
  layerCount: (projectData.layers || []).length,
        layerTilesetCount: tilesets.length
      });

      // Save using Electron API if available
      if (window.electronAPI?.saveMapProject) {
        console.log('Saving via Electron API...');
  // Ensure name is always a string for ProjectMapData type
        const safeProjectData = {
          ...projectData,
          name: projectData.name || 'Untitled Map',
          width: projectData.width ?? 20,
          height: projectData.height ?? 15,
          tileSize: projectData.tileSize ?? 32,
          layers: projectData.layers || [],
          objects: projectData.objects || [],
          tilesets: projectData.tilesets || [],
          tilesetImages: projectData.tilesetImages || {},
          version: projectData.version || '1.0'
        };
        const success = await window.electronAPI.saveMapProject(projectPath, safeProjectData);
        console.log('Electron save result:', success);
        return success;
      } else {
        console.log('Falling back to localStorage save...');
        // Fallback for web - just save to localStorage
        this.saveToLocalStorage();
        return true;
      }
    } catch (error) {
      console.error('Error saving project data:', error);
      return false;
    }
  }

  private updateSaveStatus(status: 'saving' | 'saved' | 'error' | 'unsaved'): void {
    if (this.saveStatusCallback) {
      this.saveStatusCallback(status);
    }
  }

  public getUnsavedChanges(): boolean {
    return this.hasUnsavedChanges;
  }

  public getLastSaveTime(): number {
    return this.lastSaveTimestamp;
  }

  // Force immediate save
  public forceSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    this.performAutoSave();
  }

  // Object management methods
  private notifyObjectsChanged(): void {
    if (this.objectsChangedCallback) {
      this.objectsChangedCallback(this.getMapObjects());
    }
  }

  private calculateNextObjectId(objects: MapObject[]): number {
    if (!objects.length) {
      return 1;
    }
    return objects.reduce((maxId, obj) => Math.max(maxId, typeof obj.id === 'number' ? obj.id : 0), 0) + 1;
  }

  private normalizeLoadedObjects(objects: MapObject[] | null | undefined): MapObject[] {
    if (!Array.isArray(objects)) {
      return [];
    }

    return objects.map((object, index) => {
      const normalized: MapObject = {
        ...object,
        id: typeof object.id === 'number' && !Number.isNaN(object.id) ? object.id : index + 1,
        width: typeof object.width === 'number' && object.width > 0 ? object.width : 1,
        height: typeof object.height === 'number' && object.height > 0 ? object.height : 1,
        properties: object.properties || {}
      };

      if (normalized.category === 'npc' || normalized.type === 'npc') {
        normalized.category = 'npc';
        normalized.type = 'npc';
        normalized.wander_radius = 0;
      } else if (normalized.category === 'enemy' || normalized.category === 'creature' || normalized.type === 'enemy') {
        normalized.type = 'enemy';
        normalized.category = normalized.category || 'enemy';
      }

      return normalized;
    });
  }

  public addMapObject(type: 'event' | 'enemy', x: number, y: number, width: number = 1, height: number = 1): MapObject {
    const object: MapObject = {
      id: this.nextObjectId++,
      name: `${type}_${this.nextObjectId - 1}`,
      type: type,
      x: x,
      y: y,
      width: width,
      height: height,
      properties: {}
    };

    // Set default properties based on type
    if (type === 'event') {
      object.activate = 'on_trigger';
      object.hotspot = 'location';
      object.tooltip = 'Event';
    } else if (type === 'enemy') {
      object.category = 'enemy';
      object.level = 1;
      object.number = 1;
      object.wander_radius = 4;
    }

    this.objects.push(object);
    this.saveState();
    this.notifyObjectsChanged();
    return object;
  }

  public removeMapObject(objectId: number): boolean {
    const index = this.objects.findIndex(obj => obj.id === objectId);
    if (index >= 0) {
      this.objects.splice(index, 1);
      if (this.selectedObject?.id === objectId) {
        this.selectedObject = null;
      }
      this.saveState();
      this.notifyObjectsChanged();
      return true;
    }
    return false;
  }

  public updateMapObject(objectId: number, updates: Partial<MapObject>): boolean {
    const object = this.objects.find(obj => obj.id === objectId);
    if (object) {
      Object.assign(object, updates);
      this.saveState();
      this.notifyObjectsChanged();
      return true;
    }
    return false;
  }

  public getMapObjects(): MapObject[] {
    return [...this.objects];
  }

  public getObjectsAtPosition(x: number, y: number): MapObject[] {
    return this.objects.filter(obj => obj.x === x && obj.y === y);
  }

  public isHeroAtPosition(x: number, y: number): boolean {
    return this.heroX === x && this.heroY === y;
  }

  public setHeroPosition(x: number, y: number): void {
    this.heroX = Math.max(0, Math.min(x, this.mapWidth - 1));
    this.heroY = Math.max(0, Math.min(y, this.mapHeight - 1));
    this.saveState();
    this.draw();
  }

  public getHeroPosition(): { x: number, y: number } {
    return { x: this.heroX, y: this.heroY };
  }

  private updateCursorForHover(): void {
    // Check if we're hovering over the hero position
    if (this.isHeroAtPosition(this.hoverX, this.hoverY)) {
      this.mapCanvas.style.cursor = 'move';
      this.showHeroTooltip();
      return;
    }

    const actorPlaceholder = this.getDraggableActorAt(this.hoverX, this.hoverY);
    if (actorPlaceholder) {
      const actorLayerType = this.getActorLayerType(actorPlaceholder);
      if (actorLayerType) {
        this.mapCanvas.style.cursor = 'move';
        this.showActorTooltip(actorPlaceholder, actorLayerType);
        return;
      }
    }

    // Check if we're hovering over an object on an interactive layer
    const activeLayer = this.getActiveLayer();
    const interactiveLayers = ['enemy', 'npc', 'object', 'event', 'background'];
    
    if (activeLayer && interactiveLayers.includes(activeLayer.type)) {
      const objectsAtPosition = this.getObjectsAtPosition(this.hoverX, this.hoverY);
      if (objectsAtPosition.length > 0) {
        this.mapCanvas.style.cursor = 'pointer';
        this.showObjectTooltip(objectsAtPosition[0]);
        return;
      }
    }
    
    // Default cursor behavior
    if (this.spacePressed) {
      this.mapCanvas.style.cursor = this.isPanning ? 'grabbing' : 'grab';
    } else {
      this.mapCanvas.style.cursor = 'crosshair';
    }
    this.hideObjectTooltip();
  }

  private showObjectTooltip(object: MapObject): void {
    // Create or update tooltip
    let tooltip = document.getElementById('object-tooltip') as HTMLElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'object-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.background = 'rgba(0, 0, 0, 0.35)'; // 65% transparent (35% opacity)
      tooltip.style.color = 'white';
      tooltip.style.padding = '4px 6px'; // Reduced padding
      tooltip.style.borderRadius = '3px'; // Slightly smaller border radius
      tooltip.style.fontSize = '11px'; // Smaller font size
      tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; // Editor's font
      tooltip.style.lineHeight = '1.2'; // Tighter line height
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '1000';
      tooltip.style.border = '1px solid rgba(255, 107, 0, 0.8)'; // Semi-transparent border
      tooltip.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'; // Smaller shadow
      tooltip.style.backdropFilter = 'blur(2px)'; // Add subtle blur effect
      document.body.appendChild(tooltip);
    }

    // Mouse icon SVG (from Lucide React) - smaller version
    const mouseIcon = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <rect x="5" y="2" width="14" height="20" rx="7"/>
        <path d="M12 6v4"/>
      </svg>
    `;

    // Update tooltip content with tighter spacing
    const typeDisplay = object.type === 'enemy' ? object.category || 'enemy' : object.type;
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 2px; color: #ff6b00; font-size: 10px;">
        ${mouseIcon}Double click to edit
      </div>
      <div style="font-weight: bold; margin-bottom: 1px;">${object.name || 'Unnamed'}</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.9);">Type: ${typeDisplay}</div>
    `;

    // Position tooltip near mouse cursor
    const rect = this.mapCanvas.getBoundingClientRect();
    const screenPos = this.mapToScreen(this.hoverX, this.hoverY);
    
    tooltip.style.left = `${rect.left + screenPos.x + 20}px`;
    tooltip.style.top = `${rect.top + screenPos.y - 10}px`;
    tooltip.style.display = 'block';
  }

  private showActorTooltip(object: MapObject, actorType: 'npc' | 'enemy'): void {
    let tooltip = document.getElementById('object-tooltip') as HTMLElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'object-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.background = 'rgba(0, 0, 0, 0.35)';
      tooltip.style.color = 'white';
      tooltip.style.padding = '4px 6px';
      tooltip.style.borderRadius = '3px';
      tooltip.style.fontSize = '11px';
      tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      tooltip.style.lineHeight = '1.2';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '1000';
      tooltip.style.border = '1px solid rgba(255, 107, 0, 0.8)';
      tooltip.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
      tooltip.style.backdropFilter = 'blur(2px)';
      document.body.appendChild(tooltip);
    }

    const mouseIcon = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <rect x="5" y="2" width="14" height="20" rx="7"/>
        <path d="M12 6v4"/>
      </svg>
    `;

    const label = actorType === 'npc' ? 'NPC' : 'Enemy';
    const name = object.name || label;

    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 2px; color: #ff6b00; font-size: 10px;">
        ${mouseIcon}Drag to move
      </div>
      <div style="font-weight: bold; margin-bottom: 1px;">${name}</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.9);">Type: ${label}</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.9);">Double click to edit</div>
    `;

    const rect = this.mapCanvas.getBoundingClientRect();
    const screenPos = this.mapToScreen(this.hoverX, this.hoverY);
    tooltip.style.left = `${rect.left + screenPos.x + 20}px`;
    tooltip.style.top = `${rect.top + screenPos.y - 10}px`;
    tooltip.style.display = 'block';
  }

  private hideObjectTooltip(): void {
    const tooltip = document.getElementById('object-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  private showHeroTooltip(): void {
    // Create or update hero tooltip
    let tooltip = document.getElementById('object-tooltip') as HTMLElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'object-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.background = 'rgba(0, 0, 0, 0.35)'; // 65% transparent (35% opacity)
      tooltip.style.color = 'white';
      tooltip.style.padding = '4px 6px'; // Reduced padding
      tooltip.style.borderRadius = '3px'; // Slightly smaller border radius
      tooltip.style.fontSize = '11px'; // Smaller font size
      tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; // Editor's font
      tooltip.style.lineHeight = '1.2'; // Tighter line height
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '1000';
      tooltip.style.border = '1px solid rgba(255, 107, 0, 0.8)'; // Semi-transparent border
      tooltip.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'; // Smaller shadow
      tooltip.style.backdropFilter = 'blur(2px)'; // Add subtle blur effect
      document.body.appendChild(tooltip);
    }

    // Mouse icon SVG (from Lucide React) - smaller version
    const mouseIcon = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <rect x="5" y="2" width="14" height="20" rx="7"/>
        <path d="M12 6v4"/>
      </svg>
    `;

    // Update tooltip content with hero-specific information
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 2px; color: #ff6b00; font-size: 10px;">
        ${mouseIcon}Double click to edit or drag to move
      </div>
      <div style="font-weight: bold; margin-bottom: 1px;">Hero Position</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.9);">Position: (${this.heroX}, ${this.heroY})</div>
    `;

    // Position tooltip near mouse cursor
    const rect = this.mapCanvas.getBoundingClientRect();
    const screenPos = this.mapToScreen(this.hoverX, this.hoverY);
    
    tooltip.style.left = `${rect.left + screenPos.x + 20}px`;
    tooltip.style.top = `${rect.top + screenPos.y - 10}px`;
    tooltip.style.display = 'block';
  }

  private createObjectFromTile(x: number, y: number, layerType: string, _gid: number): void {
    console.log(`Creating object from tile at (${x}, ${y}) for layer type: ${layerType}`);
    
    // Check if there's already an object at this position
    const existingObject = this.objects.find(obj => obj.x === x && obj.y === y);
    if (existingObject) {
      console.log(`Found existing object at (${x}, ${y}), updating instead of creating new one`);
      // Update existing object instead of creating a new one
      const updates: Partial<MapObject> = {
        name: `${layerType}_${x}_${y}`,
        type: layerType === 'npc' ? 'npc' : layerType,
      };
      this.updateMapObject(existingObject.id, updates);
      return;
    }

    // Create new object based on layer type
    let objectType: 'event' | 'enemy';
    if (layerType === 'event') {
      objectType = 'event';
    } else if (layerType === 'enemy' || layerType === 'npc' || layerType === 'object') {
      objectType = 'enemy'; // NPCs and objects are treated as enemies in Flare
    } else {
      console.log(`Unsupported layer type: ${layerType}`);
      return; // Unsupported layer type
    }

    console.log(`Creating new ${objectType} object at (${x}, ${y})`);

    // Create the object using the existing addMapObject method
    const newObject = this.addMapObject(objectType, x, y, 1, 1);
    
    console.log(`Created object with ID: ${newObject.id}`);
    
    // Set appropriate defaults based on type
    const updates: Partial<MapObject> = {
      name: `${layerType}_${x}_${y}`,
      category: objectType === 'event' ? 'block' : (layerType === 'npc' ? 'npc' : (layerType === 'object' ? 'object' : 'creature')),
    };
    
    if (layerType === 'npc') {
      updates.type = 'npc';
    } else if (layerType === 'enemy') {
      updates.type = 'enemy';
    }

    if (objectType === 'enemy') {
      updates.level = 1;
      updates.number = 1;
      updates.wander_radius = (layerType === 'npc' || layerType === 'object') ? 0 : 4; // NPCs and objects don't wander
    } else {
      updates.activate = 'on_trigger';
      updates.hotspot = '0,0,1,1';
    }
    
    this.updateMapObject(newObject.id, updates);
  }

  private removeObjectAtPosition(x: number, y: number): void {
    const objectAtPosition = this.objects.find(obj => obj.x === x && obj.y === y);
    if (objectAtPosition) {
      this.removeMapObject(objectAtPosition.id);
    }
  }

  public selectObject(objectId: number): MapObject | null {
    const object = this.objects.find(obj => obj.id === objectId);
    this.selectedObject = object || null;
    return this.selectedObject;
  }

  public getSelectedObject(): MapObject | null {
    return this.selectedObject;
  }

  // Reset editor for a new project - clears all data and localStorage
  public resetForNewProject(): void {
    // Clear localStorage backup to prevent loading old data
    this.clearLocalStorageBackup();
    
    // Reset all tile data
    this.tilesetImage = null;
    this.tilesetFileName = null;
    this.mapName = 'Untitled Map';
    this.tilesetColumns = 0;
    this.tilesetRows = 0;
    this.tileCount = 0;
    this.detectedTileData.clear();
    
    // Clear tile palette
    this.clearTilePalette();
    
    // Reset layer data
    this.tileLayers = [];
    this.activeLayerId = null;
    this.nextLayerId = 1;
    
    // Reset objects
    this.objects = [];
    this.nextObjectId = 1;
    this.selectedObjectId = null;
    this.notifyObjectsChanged();
    
    // Reset hero position
    this.heroX = 0;
    this.heroY = 0;
    this.isDraggingHero = false;
    
    // Reset layer-specific tilesets
    this.layerTilesets.clear();
    
    // Reset legacy tileset data
    this.tilesets = [];
    
    // Reset collision data
    this.collisionData = [];
    
    // Reset selection and drawing state
    this.selection = {
      active: false,
      startX: -1,
      startY: -1,
      endX: -1,
      endY: -1,
      tiles: []
    };
    this.isSelecting = false;
    
    this.shapeDrawing = {
      active: false,
      startX: -1,
      startY: -1,
      endX: -1,
      endY: -1,
      preview: []
    };
    this.isDrawingShape = false;
    
    // Reset stamp data
    this.stamps.clear();
    this.activeStamp = null;
    this.stampPreview = { x: 0, y: 0, visible: false };
    
    // Reset auto-save state
    this.hasUnsavedChanges = false;
    this.lastSaveTimestamp = 0;
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    // Create default layers for new project
    this.createDefaultLayers();
    
    // Clear undo/redo history and save initial state
    this.history = [];
    this.historyIndex = -1;
    this.saveState();
    
    // Clear canvas explicitly and redraw
    this.ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    this.draw();
  }

  // Load project data from saved configuration
  public loadProjectData(projectData: EditorProjectData): void {
    try {
      this.setMapName(typeof projectData.name === 'string' ? projectData.name : 'Untitled Map');
      console.log('=== LOADING PROJECT DATA IN EDITOR ===');
      console.log('Project data:', {
        hasLayers: !!(projectData.layers && projectData.layers.length > 0),
        layerCount: projectData.layers ? projectData.layers.length : 0,
        hasObjects: !!(projectData.objects && projectData.objects.length > 0),
        objectCount: projectData.objects ? projectData.objects.length : 0,
        width: projectData.width,
        height: projectData.height,
        hasTilesets: !!(projectData.tilesets && projectData.tilesets.length > 0),
        tilesetCount: projectData.tilesets ? projectData.tilesets.length : 0
      });
      
      // Restore brush-related settings and mapping if available
      if (projectData.tileContentThreshold !== undefined) {
        this.tileContentThreshold = projectData.tileContentThreshold;
      }
      if (projectData.objectSeparationSensitivity !== undefined) {
        this.objectSeparationSensitivity = projectData.objectSeparationSensitivity;
      }

      // Clear existing layer tilesets
      this.layerTilesets.clear();
      
      // Load tilesets first (both legacy and per-layer)
      if (projectData.tilesets && Array.isArray(projectData.tilesets)) {
        console.log('Loading tilesets:', projectData.tilesets.length);
        
        let loadedCount = 0;
        const totalTilesets = projectData.tilesets.length;
        
        for (const tilesetData of projectData.tilesets) {
          if (tilesetData.fileName && projectData.tilesetImages && projectData.tilesetImages[tilesetData.fileName]) {
            const dataURL = projectData.tilesetImages[tilesetData.fileName];
            
            // Load the tileset image
            const img = new Image();
            img.onload = () => {
              console.log(`Tileset ${tilesetData.fileName} loaded for layer: ${tilesetData.layerType || 'legacy'}`);
              
              const columns = tilesetData.columns || Math.max(1, Math.floor(img.width / this.tileSizeX));
              const rows = tilesetData.rows || Math.max(1, Math.floor(img.height / this.tileSizeY));
              const count = tilesetData.count || Math.max(1, columns * rows);
              const tileWidth = tilesetData.tileWidth || Math.round(img.width / Math.max(columns, 1));
              const tileHeight = tilesetData.tileHeight || Math.round(img.height / Math.max(rows, 1));

              const tilesetInfo = {
                image: img,
                fileName: tilesetData.fileName,
                columns,
                rows,
                count,
                tileWidth,
                tileHeight,
                spacing: tilesetData.spacing ?? 0,
                margin: tilesetData.margin ?? 0,
                sourcePath: tilesetData.sourcePath ?? null
              };
              
              if (tilesetData.layerType) {
                // Per-layer tileset - store in the correct layer
                this.layerTilesets.set(tilesetData.layerType, tilesetInfo);
                console.log(`Set tileset for layer type ${tilesetData.layerType}`);
              } else {
                // Legacy tileset - assign to active layer or fallback
                this.tilesetImage = img;
                this.tilesetFileName = tilesetData.fileName;
                this.tilesetColumns = tilesetInfo.columns;
                this.tilesetRows = tilesetInfo.rows;
                this.tileCount = tilesetInfo.count;
                this.tilesetTileWidth = tilesetInfo.tileWidth;
                this.tilesetTileHeight = tilesetInfo.tileHeight;
                this.tilesetSpacing = tilesetInfo.spacing ?? 0;
                this.tilesetMargin = tilesetInfo.margin ?? 0;
                this.tilesetSourcePath = tilesetInfo.sourcePath ?? this.tilesetSourcePath;
                
                // Also assign to current active layer if no layer-specific tileset exists
                const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
                if (activeLayer && !this.layerTilesets.has(activeLayer.type)) {
                  this.layerTilesets.set(activeLayer.type, tilesetInfo);
                  console.log(`Assigned legacy tileset to active layer: ${activeLayer.type}`);
                }
              }
              
              // Restore per-layer detected tile data if available
              if (tilesetData.detectedTiles && Array.isArray(tilesetData.detectedTiles)) {
                console.log(`Restoring ${tilesetData.detectedTiles.length} detected tiles for ${tilesetData.layerType || 'legacy'}`);
                
                if (tilesetData.layerType) {
                  // Store tiles specifically for this layer type
                  const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
                  for (const [gid, data] of tilesetData.detectedTiles) {
                    const d = data as { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number };
                    layerTileMap.set(gid, { sourceX: d.sourceX, sourceY: d.sourceY, width: d.width, height: d.height, originX: d.originX, originY: d.originY });
                  }
                  this.layerTileData.set(tilesetData.layerType, layerTileMap);
                  console.log(`Stored ${layerTileMap.size} tiles for layer type: ${tilesetData.layerType}`);
                } else {
                  // Legacy detected tiles - store in global and current active layer
                  this.detectedTileData.clear();
                  for (const [gid, data] of tilesetData.detectedTiles) {
                    const d = data as { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number };
                    this.detectedTileData.set(gid, { sourceX: d.sourceX, sourceY: d.sourceY, width: d.width, height: d.height, originX: d.originX, originY: d.originY });
                  }
                  
                  // Also store in the active layer's tile data
                  const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
                  if (activeLayer) {
                    const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
                    for (const [gid, data] of tilesetData.detectedTiles) {
                      const d = data as { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number };
                      layerTileMap.set(gid, { sourceX: d.sourceX, sourceY: d.sourceY, width: d.width, height: d.height, originX: d.originX, originY: d.originY });
                    }
                    this.layerTileData.set(activeLayer.type, layerTileMap);
                  }
                }
              }
              
              // Check if all tilesets are loaded
              loadedCount++;
              if (loadedCount === totalTilesets) {
                console.log('All tilesets loaded, updating UI for active layer');
                // Update the current tileset UI to show the active layer's tileset
                const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
                if (activeLayer) {
                  this.updateCurrentTileset(activeLayer.type);
                }
              }
            };
            img.src = dataURL;
          } else {
            // No image data for this tileset, still count it as "loaded"
            loadedCount++;
            if (loadedCount === totalTilesets) {
              console.log('All tilesets processed, updating UI for active layer');
              const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
              if (activeLayer) {
                this.updateCurrentTileset(activeLayer.type);
              }
            }
          }
        }
      }

      // Fallback: restore legacy detectedTileData if no tilesets but detectedTileData exists
      if (projectData.detectedTileData && Array.isArray(projectData.detectedTileData)) {
        this.detectedTileData.clear();
        for (const [gid, data] of projectData.detectedTileData) {
          this.detectedTileData.set(gid, data);
        }
      }
      
      // Load layer data if available
      if (projectData.layers && projectData.layers.length > 0) {
        console.log('Loading layers:', projectData.layers.length);
        this.tileLayers = [...projectData.layers]; // Create new array
        
        // Ensure we have a valid active layer
        if (this.tileLayers.length > 0) {
          // Set the first layer as active if no active layer is set
          if (!this.activeLayerId || !this.tileLayers.find(l => l.id === this.activeLayerId)) {
            this.activeLayerId = this.tileLayers[0].id;
            console.log('Set active layer to:', this.activeLayerId);
          }
        }
      } else {
        console.log('No layers found in project data, creating default layers');
        this.createDefaultLayers();
      }
      
      // Load object data if available
      const normalizedObjects = this.normalizeLoadedObjects(projectData.objects);
      console.log('Loading objects:', normalizedObjects.length);
      this.objects = normalizedObjects;
      this.nextObjectId = this.calculateNextObjectId(normalizedObjects);
      this.notifyObjectsChanged();
      
      // Set dimensions if provided
      if (projectData.width && projectData.height) {
        console.log('Setting map dimensions:', projectData.width, 'x', projectData.height);
        this.mapWidth = projectData.width;
        this.mapHeight = projectData.height;
      }
      
      // Load hero position if provided, otherwise default to (0,0)
      if (projectData.heroX !== undefined && projectData.heroY !== undefined) {
        console.log('Loading hero position:', projectData.heroX, ',', projectData.heroY);
        this.heroX = Math.max(0, Math.min(projectData.heroX, this.mapWidth - 1));
        this.heroY = Math.max(0, Math.min(projectData.heroY, this.mapHeight - 1));
      } else {
        console.log('No hero position found, defaulting to (0,0)');
        this.heroX = 0;
        this.heroY = 0;
      }
      
      this.ensureCollisionTileset();
      console.log('Project data loaded successfully');
      this.draw();
    } catch (error) {
      console.error('Error loading project data:', error);
    }
  }

  // Load tileset from data URL
  public async loadTilesetFromDataURL(dataURL: string, fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Loading tileset from dataURL:', fileName, 'Length:', dataURL.length);
      const img = new Image();
      img.onload = () => {
        console.log('Tileset image loaded successfully:', img.width, 'x', img.height);
        
        // Store the tileset image and properties
        this.tilesetImage = img;
        this.tilesetFileName = fileName;
        
        // Calculate tileset properties
        this.tilesetColumns = Math.floor(img.width / this.tileSizeX);
        this.tilesetRows = Math.floor(img.height / this.tileSizeY);
        this.tileCount = this.tilesetColumns * this.tilesetRows;
        
        console.log('Tileset properties:', {
          columns: this.tilesetColumns,
          rows: this.tilesetRows,
          tileCount: this.tileCount
        });
        
        // Get the current active layer type
        const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
        if (activeLayer) {
          console.log('Setting tileset for active layer type:', activeLayer.type);
          
          // Store the tileset for the current layer type
          this.layerTilesets.set(activeLayer.type, {
            image: img,
            fileName: fileName,
            columns: this.tilesetColumns,
            rows: this.tilesetRows,
            count: this.tileCount
          });
          
          // Check if this layer already has saved tile data
          const hasLayerTileData = this.layerTileData.has(activeLayer.type);
          console.log(`Layer ${activeLayer.type} has existing tile data:`, hasLayerTileData);
          
          if (!hasLayerTileData) {
            // Clear the global detected tile data for fresh detection
            this.detectedTileData.clear();
          } else {
            // Load the existing tile data for this layer into global scope
            const layerTiles = this.layerTileData.get(activeLayer.type);
            this.detectedTileData.clear();
            if (layerTiles) {
              for (const [gid, data] of layerTiles.entries()) {
                this.detectedTileData.set(gid, data);
              }
            }
          }
        } else {
          console.log('No active layer found, storing as global tileset');
        }
        
        // Preserve existing detected tile mapping if it was loaded from project data  
        const hasLayerTileData = activeLayer ? this.layerTileData.has(activeLayer.type) : false;
        
        // Create the tile palette (preserve order if mapping exists)
        this.createTilePalette(hasLayerTileData);
        
        console.log('Tile detection completed, detected tiles:', this.detectedTileData.size);
        
        this.draw();
        console.log('Tileset loaded and palette created');
        resolve();
      };
      img.onerror = (e) => {
        console.error('Failed to load tileset image:', e);
        reject(new Error('Failed to load tileset from data URL'));
      };
      img.src = dataURL;
    });
  }

  // Debug method to log layer data
  public debugLayerData(): void {
    console.log('=== LAYER DATA DEBUG ===');
    for (const layer of this.tileLayers) {
      const nonZeroTiles = layer.data.filter(gid => gid > 0).length;
      const layerTileset = this.layerTilesets.get(layer.type);
      console.log(`Layer ${layer.name} (${layer.type}): ${nonZeroTiles} painted tiles, has tileset: ${!!layerTileset?.image}`);
    }
  }

  // Public method to redraw canvas
  public redraw(): void {
    this.draw();
  }

  // Getter methods for map dimensions
  public getMapWidth(): number {
    return this.mapWidth;
  }

  public getMapHeight(): number {
    return this.mapHeight;
  }

  // Method to update canvas reference when DOM element changes
  public updateCanvas(newCanvas: HTMLCanvasElement): void {
    console.log('TileMapEditor: Updating canvas reference and rebinding events');
    
    // Clean up observers and events from the old canvas
    this.cleanupCanvasObservers();
    this.cleanupCanvasEvents();
    
    // Update canvas reference
    this.mapCanvas = newCanvas;
    
    // Reinitialize with new canvas (this will set up observers)
    this.initializeCanvas();
    
    // Rebind canvas events (this will set up mouse/wheel events)
    this.bindEvents();
    
    // Refresh the tile palette to restore tileset brushes
    this.refreshTilePalette(true);
    
    // Redraw to restore the content
    this.draw();
    
    console.log('TileMapEditor: Canvas update complete - events rebound');
  }
}
