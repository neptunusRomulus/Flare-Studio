import {
  TileLayer,
  TilesetInfo,
  MapObject,
  Tool,
  Orientation,
  Stamp,
  StampTile,
  AssetRecord,
  ObjectInstance,
  PaintMode
} from '../types';
import { TileDetector } from './tileDetection';

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
  originX?: number;
  originY?: number;
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
  // Persist per-layer tab layout so each map can restore its own tab/palette state
  // Now includes per-tab painted data arrays to preserve painting data across tabs
  layerTabs?: Record<string, Array<{ id: number; name?: string; data?: number[]; tileset?: SavedTilesetEntry; detectedTiles?: SerializedDetectedTile[] }>>;
  // Persist which tab id was active per layer type
  layerActiveTabId?: Record<string, number>;
  // Persist active layer selection for tab switching
  activeLayerId?: number | null;
  minimap?: string | null;
  minimapMode?: 'orthogonal' | 'isometric';
  version?: string;
  tileContentThreshold?: number;
  objectSeparationSensitivity?: number;
  detectedTileData?: SerializedDetectedTile[];
  isStartingMap?: boolean;
  lastSaved?: string;
  // Serialized sprite objects placed on object/background layers (multi-cell palette paintings)
  placedSpriteObjects?: Record<string, Array<{
    id: number;
    anchorX: number;
    anchorY: number;
    gid: number;
    tilesetKey: string | null;
    width: number;
    height: number;
    sourceX: number;
    sourceY: number;
  }>>;
  // Schema versioning for backward-compatible migrations
  dataSchemaVersion?: string; // e.g., "1.0" (legacy), "1.1" (profiles), future "2.0"
  dataSchemaRevision?: number; // incremental counter within a version for refinements
  // Phase 1: Asset records and object instances (non-breaking additions)
  assetRecords?: Array<AssetRecord>;  // Serialized asset definitions
  objectInstances?: Array<ObjectInstance>; // Serialized placed objects
  paintMode?: PaintMode;  // Current paint mode (ground/object)
}

const INTERNAL_TILESET_FILENAMES = new Set<string>(['collision-tile.png', 'collision_tileset.png']);
const COLLISION_LAYER_TYPE = 'collision';

export class TileMapEditor {
  public isStartingMap: boolean = false;
  public activeEventPreview: { x: number; y: number; width: number; height: number } | null = null;
  public activeHotspotPreview: { x: number; y: number; width: number; height: number } | null = null;
  private enemyCategories: string[] = [];

  public setActiveEventPreview(preview: { x: number; y: number; width: number; height: number } | null): void {
    const changed = JSON.stringify(this.activeEventPreview) !== JSON.stringify(preview);
    this.activeEventPreview = preview;
    if (changed) this.draw();
  }

  public setActiveHotspotPreview(preview: { x: number; y: number; width: number; height: number } | null): void {
    const changed = JSON.stringify(this.activeHotspotPreview) !== JSON.stringify(preview);
    this.activeHotspotPreview = preview;
    if (changed) this.draw();
  }
  /**
   * Creates a settings.txt file in the project root folder for Flare compatibility.
   * Call this after export. Updates description with project name.
   */
  public exportSettingsTxt(projectRoot: string) {
    const w = window as unknown as { require?: (module: string) => unknown };
    const fs = w.require ? w.require('fs') as { existsSync: (path: string) => boolean, writeFileSync: (path: string, content: string, encoding: string) => void } : null;
    if (!fs) {
      
      return;
    }
    const content = `#this file is necesserey to work this project run in flare. please do not remove it. -Ism\ndescription=${this.projectName || '--> Project Name comes here.'}\ngame=flare_studio_game\nversion=1.14\nengine_version_min=1.13.01\n`;
    const filePath = fs.existsSync(projectRoot) ? `${projectRoot}/settings.txt` : 'settings.txt';
    try {
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (_err) {
      void _err;
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

  // Enemy categories (project-scoped, in-memory)
  public getEnemyCategories(): string[] {
    return [...this.enemyCategories];
  }

  public setEnemyCategories(categories: string[]): void {
    const deduped = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    this.enemyCategories = deduped;
  }

  public addEnemyCategory(name: string): string[] {
    const trimmed = name.trim();
    if (!trimmed) return this.getEnemyCategories();
    if (!this.enemyCategories.includes(trimmed)) {
      this.enemyCategories = [...this.enemyCategories, trimmed];
    }
    return this.getEnemyCategories();
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

      // After palette is created, ensure any tab tileset origin overlay is rendered for user placement
      try {
        const container = document.getElementById('tilesContainer');
        if (container) {
          // Remove any leftover overlays or full-image/grid nodes, since
          // the palette rendering path now owns adding the grid/image.
          const prev = container.querySelectorAll('.tileset-overlay, .tileset-grid-overlay, .tileset-full-image, .tileset-grid-spacer');
          prev.forEach(n => n.remove());
        }
      } catch (_e) { void _e; }
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
        } catch (_e) { void _e; }
      }
      // Clear any multi-tile selection when a single tile is selected
      this.clearSelection();
      // Force redraw to ensure selection highlight is cleared
      this.draw();
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
        const verticalGaps = this.tileDetector.findVerticalGaps(data, brushData.width, brushData.height);
        console.log(`Found vertical gaps:`, verticalGaps);
        
        if (verticalGaps.length > 0) {
          // Use vertical gaps to separate objects
          let lastX = 0;
          
          for (const gapX of verticalGaps) {
            if (gapX > lastX) {
              const segmentWidth = gapX - lastX;
              const bounds = this.tileDetector.findObjectBoundsInRegion(data, brushData.width, brushData.height, lastX, 0, segmentWidth, brushData.height);
              
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
            const bounds = this.tileDetector.findObjectBoundsInRegion(data, brushData.width, brushData.height, lastX, 0, segmentWidth, brushData.height);
            
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
              
              if (visited[pixelIndex] || this.tileDetector.isPixelTransparent(data, x, y, brushData.width)) {
                continue;
              }
              
              console.log(`Starting flood fill at pixel (${x}, ${y})`);
              const objectData = this.tileDetector.floodFillObjectDataInRegion(
                data, brushData.width, brushData.height, x, y, visited
              );
              
              if (objectData && brushData.width >= 8 && brushData.height >= 8) {
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

  private ctx!: CanvasRenderingContext2D;
  private tileDetector!: TileDetector;
  private mapCanvas: HTMLCanvasElement;
  private showMinimap: boolean = true;
  private minimapMode: 'orthogonal' | 'isometric' = 'isometric';
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
  private boundKeyDown: ((event: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((event: KeyboardEvent) => void) | null = null;

  // State variables
  private mapWidth: number = 20;
  private mapHeight: number = 15;
  private mapName: string = 'Untitled Map';
  private currentProjectPath: string | null = null;
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
  
  // Project-level tileset storage - preserves imported tilesets across all maps in the project
  private projectTilesets: Map<string, LayerTilesetEntry> = new Map();
  
  // PERSISTENT tileset image cache - survives tab switches
  // Key format: "projectPath|mapName|layerType_tabId" -> { image: HTMLImageElement, dataUrl: string }
  private static tilesetImageCache: Map<string, { image: HTMLImageElement; dataUrl: string }> = new Map();
  
  private collisionTilesetLoading: boolean = false;
  private collisionTooltipEl: HTMLDivElement | null = null;
  private collisionTooltipHideTimeout: number | null = null;
  
  // Layer tab system: each layer type may have multiple tabs, each with its own tileset, detected tiles/brushes, AND painted data
  private nextLayerTabId: number = 1;
  private layerTabs: Map<string, Array<{
    id: number;
    name: string;
    data?: number[]; // Painted tile data specific to this tab
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

  // Per-layer, per-cell tileset key (stores the tileset fileName used for each cell)
  // Key: layerType -> Array of length mapWidth*mapHeight with fileName or null
  private layerCellTilesetKey: Map<string, Array<string | null>> = new Map();

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
  private isDraggingEvent: boolean = false;
  private draggingEventObjectId: number | null = null;
    private hoveredEventIndex: number = 0;
  // These are rendered as single sprites, not per-cell tiles
  // Key: layerType, Value: array of placed objects
  private placedSpriteObjects: Map<string, Array<{
    id: number;
    anchorX: number;  // Grid cell X (anchor/footprint position)
    anchorY: number;  // Grid cell Y
    gid: number;      // The primary tile gid (for looking up sprite data)
    tilesetKey: string | null;  // Which tileset this sprite came from
    width: number;    // Sprite width in pixels
    height: number;   // Sprite height in pixels
    sourceX: number;  // Source X in tileset
    sourceY: number;  // Source Y in tileset
  }>> = new Map();
  private nextSpriteObjectId: number = 1;

  // Phase 1: Asset Record and Object Instance storage containers (non-breaking additions)
  // These run in parallel with legacy placedSpriteObjects during migration
  private assetRecords: Map<string, AssetRecord> = new Map();      // id -> AssetRecord
  private objectInstances: Map<string, ObjectInstance> = new Map(); // id -> ObjectInstance
  // Phase 8: Spatial index for fast instance lookups by occupied grid cell
  private objectInstanceCellIndex: Map<string, Set<string>> = new Map(); // "x,y" -> instance ids
  private objectInstanceIndexCells: Map<string, string[]> = new Map();   // instance id -> occupied cell keys
  private nextAssetRecordId: number = 1;
  private nextObjectInstanceId: number = 1;
  private paintMode: 'ground' | 'object' = 'ground';               // Current paint mode

  // Hero position management
  private heroX: number = 0;
  private heroY: number = 0;
  private isDraggingHero: boolean = false;
  private clickStartX: number = 0;
  private clickStartY: number = 0;
  private hasMovedSinceClick: boolean = false;

  // Tool and interaction state
  private tool: Tool = 'tiles';
  private currentTool: 'brush' | 'eraser' | 'bucket' = 'brush';
  private currentSelectionTool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular' = 'rectangular';
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

  // NPC drag hover state (for external drag-drop from NPC list)
  private npcDragHoverX: number = -1;
  private npcDragHoverY: number = -1;

  // Event drag hover state (for external drag-drop from Event list)
  private eventDragHoverX: number = -1;
  private eventDragHoverY: number = -1;

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
  // Callback to notify about undo stack changes (for persistence)
  private undoStateChangeCallback: (() => void) | null = null;
  private readonly AUTO_SAVE_DELAY = 8000; // 8 seconds for tile changes
  private readonly IMMEDIATE_SAVE_DELAY = 2000; // 2 seconds for critical changes
  private autoSaveEnabled: boolean = true;

  // Save locking to prevent edits during save
  private isSaveLocked: boolean = false;
  private saveLockCallback: ((locked: boolean) => void) | null = null;

  // Tab-switching flag: true while the grid is cleared and the next map is loading.
  // Auto-save checks this and skips to prevent overwriting a previous map with an empty grid.
  private isTabSwitching: boolean = false;
  
  // Manual save callback (called when user presses Ctrl+S)
  private manualSaveCallback: (() => Promise<void>) | null = null;

  private ensureCollisionTileset(): void {
    if (this.layerTilesets.has(COLLISION_LAYER_TYPE) || this.collisionTilesetLoading) {
      return;
    }
    // Load collision tileset if not already loaded
    this.loadDefaultCollisionTileset();
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
    // Collision layer NEVER uses tabs - always use built-in tileset
    if (layerType === COLLISION_LAYER_TYPE) {
      const existing = this.layerTilesets.get(layerType);
      if (existing && existing.image) {
        return existing;
      }
      return null;
    }
    
    // PREFER the active tab's tileset for this layer (per-map scoping)
    const activeTabId = this.layerActiveTabId.get(layerType);
    if (activeTabId) {
      const tabs = this.layerTabs.get(layerType) || [];
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.tileset && activeTab.tileset.image) {
        return activeTab.tileset;
      }
    }

    // Fallback to shared layerTilesets (used during restore/load operations)
    const existing = this.layerTilesets.get(layerType);
    if (existing && existing.image) {
      return existing;
    }

    // Legacy global tileset fallback (for backward compatibility)
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

  /**
   * Generate a cache key for tileset images.
   * Format: "projectPath|mapName|layerType_tabId"
   */
  private getTilesetCacheKey(layerType: string, tabId: number): string {
    const projectPath = this.currentProjectPath || 'local';
    const mapName = this.mapName || 'untitled';
    return `${projectPath}|${mapName}|${layerType}_tab${tabId}`;
  }

  /**
   * Store a tileset image in the persistent cache.
   */
  private cacheTilesetImage(layerType: string, tabId: number, image: HTMLImageElement, dataUrl: string): void {
    const key = this.getTilesetCacheKey(layerType, tabId);
    TileMapEditor.tilesetImageCache.set(key, { image, dataUrl });
  }

  /**
   * Retrieve a tileset image from the persistent cache.
   */
  private getCachedTilesetImage(layerType: string, tabId: number): { image: HTMLImageElement; dataUrl: string } | null {
    const key = this.getTilesetCacheKey(layerType, tabId);
    const cached = TileMapEditor.tilesetImageCache.get(key);
    if (cached) {
      return cached;
    }
    return null;
  }

  /**
   * Check if a tileset image exists in cache.
   */
  private hasCachedTilesetImage(layerType: string, tabId: number): boolean {
    const key = this.getTilesetCacheKey(layerType, tabId);
    return TileMapEditor.tilesetImageCache.has(key);
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
        void uniqueChanged;
      }
    }
  }



  constructor(mapCanvas: HTMLCanvasElement) {
    this.mapCanvas = mapCanvas;
    this.tileDetector = new TileDetector({
      tileSizeX: this.tileSizeX,
      tileSizeY: this.tileSizeY,
      contentThreshold: this.tileContentThreshold,
      objectSeparationSensitivity: this.objectSeparationSensitivity
    });
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
      } catch (_e) { void _e; }
    }
  }

  // Allow external code (React) to observe active GID changes
  public setActiveGidCallback(cb: ((gid: number) => void) | null): void {
    this.activeGidCallback = cb;
    // Immediately notify with current value if callback provided
    if (cb) {
      try {
        cb(this.activeGid);
      } catch (_e) { void _e; }
    }
  }

  // Public method to set the active GID for the current layer
  public setActiveGid(gid: number): void {
    // Hide stamp preview when selecting a single tile
    this.stampPreview.visible = false;
    // Clear multi-selected brushes so single tile painting works correctly
    this.multiSelectedBrushes.clear();
    // Clear active stamp so we use single tile painting, not stamp placement
    this.activeStamp = null;
    this.currentStampMode = 'select';
    // Set tool to tiles mode for brush painting
    this.tool = 'tiles';
    this.setCurrentLayerActiveGid(gid);
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

    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown, true);
      this.boundKeyDown = null;
    }

    if (this.boundKeyUp) {
      window.removeEventListener('keyup', this.boundKeyUp, true);
      this.boundKeyUp = null;
    }
  }

  private resizeCanvas(): void {
    const container = this.mapCanvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      // Ensure we don't exceed container bounds, with minimum fallback dimensions
      const width = Math.max(400, Math.floor(rect.width));
      const height = Math.max(300, Math.floor(rect.height));
      
      // Only update if dimensions actually changed to avoid unnecessary redraws
      if (this.mapCanvas.width !== width || this.mapCanvas.height !== height) {
        this.mapCanvas.width = width;
        this.mapCanvas.height = height;
        
        // Redraw after resize
        this.draw();
      }
    } else {
      // Fallback if no container is found
      const width = 400;
      const height = 300;
      if (this.mapCanvas.width !== width || this.mapCanvas.height !== height) {
        this.mapCanvas.width = width;
        this.mapCanvas.height = height;
        this.draw();
      }
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
    
    // Keyboard events on window capture so shortcuts stay reliable across focus shifts.
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', this.boundKeyDown, true);
    window.addEventListener('keyup', this.boundKeyUp, true);
    
    // Focus the canvas to receive keyboard events
    this.mapCanvas.tabIndex = 0;
  }

  private createDefaultLayers(): void {
    // Create all 8 layers in the correct order (Rules -> Items -> NPC -> Enemy -> Event -> Collision -> Object -> Background)
    this.tileLayers = [
      {
        id: 1,
        name: 'Rules',
        type: 'rules',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 9,
        name: 'Actions',
        type: 'actions',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 2,
        name: 'Items',
        type: 'items',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 3,
        name: 'NPC Layer',
        type: 'npc',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 4,
        name: 'Enemy Layer',
        type: 'enemy',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 5,
        name: 'Event Layer',
        type: 'event',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 6,
        name: 'Collision Layer',
        type: 'collision',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 7,
        name: 'Object Layer',
        type: 'object',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      },
      {
        id: 8,
        name: 'Background Layer',
        type: 'background',
        data: new Array(this.mapWidth * this.mapHeight).fill(0),
        visible: true,
        transparency: 1.0
      }
    ];
    
    // Set the background layer as active by default
    this.activeLayerId = 8;
    this.nextLayerId = 10;
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
    } catch (_e) { void _e; }

    // Load collision tileset as default for every project
    this.loadDefaultCollisionTileset();

    // Initialize per-layer cell tileset key arrays
    for (const l of this.tileLayers) {
      const arr = new Array(this.mapWidth * this.mapHeight).fill(null);
      this.layerCellTilesetKey.set(l.type, arr);
    }
  }

  private loadDefaultCollisionTileset(): void {
    const candidates = Array.from(INTERNAL_TILESET_FILENAMES);
    if (candidates.length === 0) {
      return;
    }

    const image = new Image();

    const loadCandidate = (index: number): void => {
      if (index >= candidates.length) {
        this.collisionTilesetLoading = false;
        return;
      }

      const candidateFile = candidates[index];
      const resolvedPath = this.resolveInternalAssetPath(candidateFile);
      if (!resolvedPath) {
        loadCandidate(index + 1);
        return;
      }

      image.onload = () => {
        const columns = Math.max(1, Math.floor(image.width / this.tileSizeX));
        const rows = Math.max(1, Math.floor(image.height / this.tileSizeY));
        const count = Math.max(1, columns * rows);

        this.layerTilesets.set(COLLISION_LAYER_TYPE, {
          image,
          fileName: candidateFile,
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

        // If collision layer is currently active, refresh the palette
        if (this.getCurrentLayerType() === COLLISION_LAYER_TYPE) {
          this.updateCurrentTileset(COLLISION_LAYER_TYPE);
          this.refreshTilePalette(true);
          this.draw();
        }
      };

      image.onerror = (_error) => {
        void _error;
        loadCandidate(index + 1);
      };

      this.collisionTilesetLoading = true;
      image.src = resolvedPath;
    };

    loadCandidate(0);
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

    // NPC pawns cannot occupy the same cell as another NPC
    if (actor.type === 'npc') {
      const conflict = this.objects.find(obj => obj.type === 'npc' && obj.id !== actor.id && obj.x === x && obj.y === y);
      if (conflict) return;
    }

    this.updateMapObject(actor.id, { x, y });
    this.draw();
  }

  private handleEventDrag(x: number, y: number): void {
    if (!this.isDraggingEvent || this.draggingEventObjectId === null) return;
    if (x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) return;

    const ev = this.objects.find(obj => obj.id === this.draggingEventObjectId);
    if (!ev) return;
    if (ev.x === x && ev.y === y) return;

    // Update position and recalculate location property
    const updates: Partial<MapObject> = { x, y };
    const props = { ...ev.properties };
    if (props.location) {
      props.location = `${x},${y},${ev.width},${ev.height}`;
    }
    if (props.hotspot) {
      // Keep hotspot relative: reset to event origin
      props.hotspot = `${x},${y},${ev.width},${ev.height}`;
    }
    updates.properties = props;
    this.updateMapObject(ev.id, updates);
    this.draw();
  }

  private handleMouseDown(event: MouseEvent): void {
    // Prevent editing while save is in progress
    if (this.isSaveLocked) {
      return;
    }

    this.clickStartX = event.clientX;
    this.clickStartY = event.clientY;
    this.hasMovedSinceClick = false;

    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Ignore clicks on the minimap
    if (this.showMinimap && this.lastMiniMapBounds) {
      const { x: mapX, y: mapY, w, h } = this.lastMiniMapBounds;
      
      // Check for minimap resizer click (top-left corner, including outer padding)
      const resizerSize = 24;
      if (x >= mapX - 5 && x <= mapX + resizerSize && y >= mapY - 5 && y <= mapY + resizerSize) {
        this.isResizingMinimap = true;
        this.lastMinimapResizeX = x;
        this.lastMinimapResizeY = y;
        return;
      }
      
      if (x >= mapX - 5 && x <= mapX + w + 5 && y >= mapY - 5 && y <= mapY + h + 5) {
        if (this.spacePressed) {
          this.isMinimapPanning = true;
          this.lastMinimapPanX = x;
          this.lastMinimapPanY = y;
          this.mapCanvas.style.cursor = 'grabbing';
        }
        return;
      }
    }

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
          this.isDraggingHero = true;
          return;
        }

        const actorAtPosition = this.getDraggableActorAt(tileCoords.x, tileCoords.y);
        if (actorAtPosition) {
          // Right-click on NPC/actor - show delete confirmation
          if (event.button === 2 && actorAtPosition.type === 'npc' && this.npcRightClickCallback) {
            this.isMouseDown = false;
            // Get screen position of the actor for popup placement
            const actorScreenPos = this.mapToScreen(actorAtPosition.x, actorAtPosition.y);
            // Convert to canvas-relative screen coordinates
            const canvasRect = this.mapCanvas.getBoundingClientRect();
            const screenX = canvasRect.left + actorScreenPos.x;
            const screenY = canvasRect.top + actorScreenPos.y;
            this.npcRightClickCallback(actorAtPosition.id, screenX, screenY);
            return;
          }
          
          // Left-click - start dragging
          this.isDraggingActor = true;
          this.draggingActorId = actorAtPosition.id;
          this.selectedObject = actorAtPosition;
          this.selectedObjectId = actorAtPosition.id;
          return;
        }

        // Check for event object at this position (single-click to drag/edit)
        const eventsAtPosition = this.objects.filter(
          obj => obj.type === 'event' && obj.x >= 0 && obj.y >= 0 &&
            tileCoords.x >= obj.x && tileCoords.x < obj.x + obj.width &&
            tileCoords.y >= obj.y && tileCoords.y < obj.y + obj.height
        );
        if (eventsAtPosition.length > 0 && event.button === 0) {
          // Use hoveredEventIndex to pick the correct event when multiple share a cell
          const idx = eventsAtPosition.length > 1 ? Math.min(this.hoveredEventIndex, eventsAtPosition.length - 1) : 0;
          const eventAtPosition = eventsAtPosition[idx];
          // Start dragging event - single click edit is now handled in mouseup if not dragged
          this.isDraggingEvent = true;
          this.draggingEventObjectId = eventAtPosition.id;
          this.selectedObject = eventAtPosition;
          this.selectedObjectId = eventAtPosition.id;
          return;
        }

        if (this.tool === 'tiles') {
          if (event.button === 2 && this.cellRightClickCallback) {
            // Right-click on tile cell - show context menu
            this.isMouseDown = false;
            const screenX = event.clientX;
            const screenY = event.clientY;
            this.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
            return;
          }
          this.handleTileClick(tileCoords.x, tileCoords.y, event.button === 2);
        } else if (this.tool === 'selection') {
          if (event.button === 2 && this.cellRightClickCallback) {
            // Right-click on tile cell - show context menu
            this.isMouseDown = false;
            const screenX = event.clientX;
            const screenY = event.clientY;
            this.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
            return;
          }
          this.handleSelectionStart(tileCoords.x, tileCoords.y, event.button === 2);
        } else if (this.tool === 'shape') {
          if (event.button === 2 && this.cellRightClickCallback) {
            // Right-click on tile cell - show context menu
            this.isMouseDown = false;
            const screenX = event.clientX;
            const screenY = event.clientY;
            this.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
            return;
          }
          this.handleShapeStart(tileCoords.x, tileCoords.y, event.button === 2);
        } else if (this.tool === 'eyedropper') {
          const sampledGid = this.handleEyedropper(tileCoords.x, tileCoords.y);
          if (sampledGid) {
            // Eyedropper was successful, no need to continue with mouse down
            this.isMouseDown = false;
          }
        } else if (this.tool === 'stamp') {
          if (event.button === 2 && this.cellRightClickCallback) {
            // Right-click on tile cell - show context menu
            this.isMouseDown = false;
            const screenX = event.clientX;
            const screenY = event.clientY;
            this.cellRightClickCallback(tileCoords.x, tileCoords.y, screenX, screenY);
            return;
          }
          this.handleStampClick(tileCoords.x, tileCoords.y, event.button === 2);
        }
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isMouseDown) {
      const dx = Math.abs(event.clientX - this.clickStartX);
      const dy = Math.abs(event.clientY - this.clickStartY);
      if (dx > 3 || dy > 3) {
        this.hasMovedSinceClick = true;
      }
    }

    const rect = this.mapCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isResizingMinimap) {
      this.mapCanvas.style.cursor = 'nwse-resize';
      // The cursor moving left/up means we are pulling the top-left corner out, increasing the minimap scale
      // The cursor moving right/down means shrinking the minimap.
      // Easiest heuristic: drag distance along the diagonal. Or just take X diff.
      // Actually, standard resize from top-left: dragging left makes it wider. So -deltaX or -deltaY.
      const deltaX = x - this.lastMinimapResizeX;
      const deltaY = y - this.lastMinimapResizeY;
      
      // Compute scaling based on movement. 150px is baseline width.
      // -deltaX increases the width.
      // Minimap width = 150 * scale. 
      // Diff in scale = -deltaX / 150. Average with -deltaY / 120.
      const scaleDiff = ((-deltaX / 150) + (-deltaY / 120)) / 2;
      
      let newScale = this.minimapWindowScale + scaleDiff;
      // Clamp between 0.5 and 3.0 like EngineSettingsDialog
      newScale = Math.max(0.5, Math.min(3.0, newScale));
      
      this.setMinimapWindowScale(newScale);
      
      this.lastMinimapResizeX = x;
      this.lastMinimapResizeY = y;
      
      return;
    }

    if (this.showMinimap && this.lastMiniMapBounds) {
      const { x: mapX, y: mapY } = this.lastMiniMapBounds;
      const resizerSize = 24;
      if (x >= mapX - 5 && x <= mapX + resizerSize && y >= mapY - 5 && y <= mapY + resizerSize) {
        this.mapCanvas.style.cursor = 'nwse-resize';
        // Hide object tooltip if any
        this.hideObjectTooltip();
        return; // Don't do tile hovering logic
      }
    }

    if (this.isMinimapPanning && this.spacePressed) {
      // Handle minimap panning
      const deltaX = x - this.lastMinimapPanX;
      const deltaY = y - this.lastMinimapPanY;
      this.minimapPanX += deltaX;
      this.minimapPanY += deltaY;
      this.lastMinimapPanX = x;
      this.lastMinimapPanY = y;
      this.draw();
      return;
    } else if (this.isPanning && this.spacePressed) {
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
          } else if (this.isDraggingEvent) {
            this.handleEventDrag(tileCoords.x, tileCoords.y);
          } else if (this.tool === 'tiles') {
            this.handleTileClick(tileCoords.x, tileCoords.y, false);
          } else if (this.tool === 'stamp' && this.currentStampMode === 'place' && this.activeStamp) {
            // Allow painting with stamp while dragging (make selection behave like a brush)
            this.placeStamp(tileCoords.x, tileCoords.y);
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
    const wasClick = !this.hasMovedSinceClick;

    if (this.isResizingMinimap) {
      this.isResizingMinimap = false;
      return;
    }

    if (this.isSelecting) {
      this.handleSelectionEnd();
    } else if (this.isDrawingShape) {
      this.handleShapeEnd();
    }
    
    // Stop hero dragging
    if (this.isDraggingHero) {
      this.isDraggingHero = false;
      if (wasClick) {
        this.openHeroEditDialog();
      }
    }

    if (this.isDraggingActor) {
      if (wasClick && this.objectEditCallback && this.draggingActorId !== null) {
        this.objectEditCallback(this.draggingActorId);
      }
      this.isDraggingActor = false;
      this.draggingActorId = null;
    }

    if (this.isDraggingEvent) {
      if (wasClick && this.eventEditCallback && this.draggingEventObjectId !== null) {
        this.eventEditCallback(this.draggingEventObjectId);
      }
      this.isDraggingEvent = false;
      this.draggingEventObjectId = null;
      this.notifyObjectsChanged();
    }

    if (wasClick && !this.isDraggingHero && !this.isDraggingActor && !this.isDraggingEvent) {
      const activeLayer = this.getActiveLayer();
      const interactiveLayers = ['enemy', 'npc', 'object', 'event', 'background'];
      
      if (activeLayer && interactiveLayers.includes(activeLayer.type) && this.hoverX >= 0 && this.hoverY >= 0) {
        const objectsAtPosition = this.getObjectsAtPosition(this.hoverX, this.hoverY);
        // Only trigger generic object edit if it isn't an event (events are handled above because they are implicitly dragged)
        const objectAtMenu = objectsAtPosition.find(obj => obj.x === this.hoverX && obj.y === this.hoverY);
        if (objectAtMenu && this.objectEditCallback && objectAtMenu.type !== 'event') {
          this.objectEditCallback(objectAtMenu.id);
        }
      }
    }

    this.isMouseDown = false;
    this.isPanning = false;
    this.isMinimapPanning = false;
  }

  private handleMouseLeave(): void {
    // Hide tooltip when mouse leaves canvas
    this.hideObjectTooltip();
    // Reset hover coordinates
    this.hoverX = -1;
    this.hoverY = -1;
    this.isDraggingActor = false;
    this.draggingActorId = null;
    this.isDraggingEvent = false;
    this.draggingEventObjectId = null;
    this.isMinimapPanning = false;
    this.isResizingMinimap = false;
    this.draw();
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

    const rect = this.mapCanvas.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    // Check if hovering over minimap
    if (this.showMinimap && this.lastMiniMapBounds) {
      const { x, y, w, h } = this.lastMiniMapBounds;
      if (cursorX >= x && cursorX <= x + w && cursorY >= y && cursorY <= y + h) {
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        // Clamp minimap internal zoom to reasonable values (e.g. 0.25x to 4.0x)
        this.minimapZoom = Math.max(0.25, Math.min(4.0, this.minimapZoom * zoomFactor));
        this.draw();
        return; // Consume wheel event for minimap zoom
      }
    }
    
    // Check if hovering over a cell with multiple events – scroll to cycle
    if (this.hoverX >= 0 && this.hoverY >= 0) {
      const eventsAtHover = this.objects.filter(
        obj => obj.type === 'event' && obj.x >= 0 && obj.y >= 0 &&
          this.hoverX >= obj.x && this.hoverX < obj.x + obj.width &&
          this.hoverY >= obj.y && this.hoverY < obj.y + obj.height
      );
      if (eventsAtHover.length > 1) {
        if (event.deltaY > 0) {
          this.hoveredEventIndex = (this.hoveredEventIndex + 1) % eventsAtHover.length;
        } else {
          this.hoveredEventIndex = (this.hoveredEventIndex - 1 + eventsAtHover.length) % eventsAtHover.length;
        }
        this.showObjectTooltip(eventsAtHover[this.hoveredEventIndex], eventsAtHover.length);
        return;
      }
    }

    // Default: modify main canvas zoom
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.zoom * zoomFactor);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Don't capture keyboard events if user is typing in an input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      this.spacePressed = true;
      this.mapCanvas.style.cursor = 'grab';
    }

    const isEnterShortcut = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
    if (isEnterShortcut) {
      event.preventDefault();
      this.fillSelection();
      return;
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
        case 'KeyS':
          // Ctrl+S = Manual Save
          event.preventDefault();
          if (this.manualSaveCallback) {
            this.manualSaveCallback().catch(_err => {
              // save error handled elsewhere
            });
          }
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
      this.isPanning = false;
      this.isMinimapPanning = false;
      this.mapCanvas.style.cursor = 'crosshair';
    }
  }

  public screenToTile(screenX: number, screenY: number): { x: number, y: number } | null {
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
    // Prevent editing while save is in progress
    if (this.isSaveLocked) {
      return;
    }

    if (this.activeLayerId !== null) {
      const layer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (layer) {
        const effectivePaintMode = this.getEffectivePaintModeForLayer(layer.type);
        const index = y * this.mapWidth + x;
        const currentValue = layer.data[index];
        let newValue: number;

        // Get the active GID for the current layer
        const currentLayerActiveGid = this.getCurrentLayerActiveGid();

        // Determine the action based on right-click or current tool
        if (isRightClick) {
          // Right-click always acts as eraser
          // Phase 4: Paint mode affects what gets erased
          if (effectivePaintMode === 'object') {
            // Object mode: only remove ObjectInstances at this position
            const instancesToRemove = this.getAllObjectInstances()
              .filter(inst => inst.gridX === x && inst.gridY === y && inst.layerId === layer.id.toString());
            for (const inst of instancesToRemove) {
              this.removeObjectInstance(inst.id);
            }
            this.saveState();
            this.markAsChanged();
            return; // Don't write to layer.data in object mode
          } else {
            // Ground mode: erase from layer.data and remove sprite objects
            newValue = 0;
            // Also remove any sprite object at this position
            this.removeSpriteObjectAt(layer.type, x, y);
          }
        } else {
          // Left-click behavior depends on current tool
          switch (this.currentTool) {
            case 'brush':
              // Don't paint if no tile is selected (activeGid is 0)
              if (currentLayerActiveGid === 0 && this.multiSelectedBrushes.size === 0) {
                console.warn(`[PAINT-BLOCKED] GID=0 for layer type="${layer.type}" activeLayerId=${this.activeLayerId} layerActiveGid=${JSON.stringify(Object.fromEntries(this.layerActiveGid))} activeGid=${this.activeGid}`);
                return; // Exit early, don't paint anything
              }

              // Check if brush stroke is within selection
              if (!this.isInSelection(x, y)) {
                return; // Can't paint outside selection
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
              // Check if erase stroke is within selection
              if (!this.isInSelection(x, y)) {
                return; // Can't erase outside selection
              }
              // Phase 4: Paint mode affects eraser behavior
              if (effectivePaintMode === 'object') {
                // Object mode eraser: only remove ObjectInstances
                const instancesToRemove = this.getAllObjectInstances()
                  .filter(inst => inst.gridX === x && inst.gridY === y && inst.layerId === layer.id.toString());
                if (instancesToRemove.length > 0) {
                  this.saveState();
                  for (const inst of instancesToRemove) {
                    this.removeObjectInstance(inst.id);
                  }
                  this.markAsChanged();
                }
                return; // Skip ground layer erasing in object mode
              } else {
                // Ground mode eraser: erase from layer.data and remove sprite objects
                newValue = 0;
                // Also remove any sprite object at this position
                this.removeSpriteObjectAt(layer.type, x, y);
              }
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
          
          // Phase 4: Paint mode branching
          if (effectivePaintMode === 'object' && newValue > 0) {
            // Object mode: create ObjectInstance instead of painting to layer.data
            // Don't destructively clear neighboring cells - user must explicitly request that
            const asset = this.resolveOrCreateAssetRecordForGid(newValue, layer.type);
            if (asset) {
              const instance: ObjectInstance = {
                id: `obj_${this.nextObjectInstanceId++}`,
                assetRecordId: asset.id,
                gridX: x,
                gridY: y,
                layerId: layer.id.toString(),
                properties: {}
              };
              this.addObjectInstance(instance);
            } else {
              console.warn(`[PAINT-MODE] Object mode: asset not found for GID ${newValue}`);
            }
            this.markAsChanged();
          } else if (effectivePaintMode === 'ground' || newValue === 0) {
            // Ground mode: paint to layer.data as normal (or erase)
            // Always try to remove any sprite object at this position when painting a new tile
            // This ensures single tile painting removes multi-tile sprites that cover this cell
            // Note: sprite objects set layer.data to 0, so we can't rely on currentValue > 0
            this.removeSpriteObjectAt(layer.type, x, y);
            
            layer.data[index] = newValue;
            // Record which tileset (tab) this painted cell came from so tabs don't collide
            try {
              const layerType = layer.type;
              let arr = this.layerCellTilesetKey.get(layerType);
              if (!arr) {
                arr = new Array(this.mapWidth * this.mapHeight).fill(null);
                this.layerCellTilesetKey.set(layerType, arr);
              }
              // Determine current active tab tileset fileName if available
              let tilesetFileName: string | null = null;
              const activeTabId = this.layerActiveTabId.get(layerType);
              const tabs = this.layerTabs.get(layerType) || [];
              if (activeTabId) {
                const tab = tabs.find(t => t.id === activeTabId);
                if (tab && tab.tileset && tab.tileset.fileName) tilesetFileName = tab.tileset.fileName;
              }
              // Fallback to layer tileset or global tileset
              if (!tilesetFileName) {
                const lt = this.layerTilesets.get(layerType);
                if (lt && lt.fileName) tilesetFileName = lt.fileName;
              }
              if (!tilesetFileName && this.tilesetFileName) tilesetFileName = this.tilesetFileName;
              arr[index] = tilesetFileName;
            } catch (_e) { void _e; }
            
            this.markAsChanged();
          }
          
          // Legacy map-object creation/removal applies to event/enemy/npc layers only.
          // Object layer now uses ObjectInstances and should not create placeholder map objects.
          if (layer.type === 'event' || layer.type === 'enemy' || layer.type === 'npc') {
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

    // Multi-cell toggles a single cell and keeps existing selection for non-adjacent picks.
    if (this.currentSelectionTool === 'multi-cell') {
      this.toggleSelectionCell(layer, x, y);
      this.draw();
    // For instant selection tools (magic wand, same tile), execute immediately
    } else if (this.currentSelectionTool === 'magic-wand') {
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

  public updateTilePaletteSelection(): void {
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
    
    // Draw NPC drag hover (external drag-drop from NPC list)
    if (this.npcDragHoverX >= 0 && this.npcDragHoverY >= 0) {
      this.drawNpcDragHover();
    }

    // Draw event drag hover (external drag-drop from Event list)
    if (this.eventDragHoverX >= 0 && this.eventDragHoverY >= 0) {
      this.drawEventDragHover();
    }
    
    // Draw selection
    this.drawSelection();
    
    // Draw hero position marker
    this.drawHeroPosition();

    // Draw NPC/enemy placeholders when no tile assigned
    this.drawActorPlaceholders();

    // Draw events when event layer is active
    this.drawEvents();

    // Draw shape preview
    this.drawShapePreview();

    // Draw active event preview if interacting with EventDialog
    this.drawActiveEventPreview();

    // Draw active hotspot preview (pink overlay)
    this.drawActiveHotspotPreview();

    // Draw collision overlay last so collision borders are always on top.
    this.drawCollisionOverlay();
    
    // Restore context state
    this.ctx.restore();
    
    // Update mini map (not affected by zoom/pan)
    this.drawMiniMap();
    
    // Draw stamp preview
    this.drawStampPreview();
    
    // Draw debug info if enabled
    this.drawDebugInfo();
  }

  private drawCollisionOverlay(): void {
    const collisionLayer = this.tileLayers.find(l => l.type === COLLISION_LAYER_TYPE && l.visible);
    if (!collisionLayer) return;

    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;

    this.ctx.save();
    this.ctx.globalAlpha = 1;
    this.ctx.lineWidth = Math.max(1, Math.min(2.5, 1.4 / this.zoom));

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        const gid = collisionLayer.data[index];
        if (gid <= 0) continue;

        const p = this.mapToScreen(x, y);

        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y - halfTileY);
        this.ctx.lineTo(p.x + halfTileX, p.y);
        this.ctx.lineTo(p.x, p.y + halfTileY);
        this.ctx.lineTo(p.x - halfTileX, p.y);
        this.ctx.closePath();

        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;

        switch (gid) {
          case 1:
            // full bold white stroke + 30% white fill overlay
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
            this.ctx.fill();
            break;
          case 2:
            // full bold white dashed stroke + 30% white fill overlay
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
            this.ctx.setLineDash([6, 4]);
            this.ctx.fill();
            break;
          case 3:
            // half opacity bold white stroke
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            break;
          case 4:
            // half opacity bold white dashed stroke
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.setLineDash([6, 4]);
            break;
          default:
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            break;
        }

        this.ctx.stroke();
      }
    }

    this.ctx.restore();
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

  public getTileScreenPosition(mapX: number, mapY: number): { x: number, y: number } {
    return this.mapToScreen(mapX, mapY);
  }

  public screenToMap(screenX: number, screenY: number): { x: number, y: number } {
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

  // NPC drag hover methods for external drag-drop
  public setNpcDragHover(screenX: number, screenY: number): { x: number, y: number } | null {
    // Use the same tile detection as normal hover (screenToTile)
    const mapCoords = this.screenToTile(screenX, screenY);
    
    // Check if coordinates are valid and within map bounds
    if (mapCoords && mapCoords.x >= 0 && mapCoords.x < this.mapWidth && 
        mapCoords.y >= 0 && mapCoords.y < this.mapHeight) {
      // Only redraw if position changed
      if (this.npcDragHoverX !== mapCoords.x || this.npcDragHoverY !== mapCoords.y) {
        this.npcDragHoverX = mapCoords.x;
        this.npcDragHoverY = mapCoords.y;
        this.draw();
      }
      return mapCoords;
    } else {
      // Only redraw if was previously valid
      if (this.npcDragHoverX !== -1 || this.npcDragHoverY !== -1) {
        this.npcDragHoverX = -1;
        this.npcDragHoverY = -1;
        this.draw();
      }
      return null;
    }
  }

  public clearNpcDragHover(): void {
    if (this.npcDragHoverX !== -1 || this.npcDragHoverY !== -1) {
      this.npcDragHoverX = -1;
      this.npcDragHoverY = -1;
      this.draw();
    }
  }

  // Event drag hover methods for external drag-drop
  public setEventDragHover(screenX: number, screenY: number): { x: number, y: number } | null {
    // Use the same tile detection as normal hover (screenToTile)
    const mapCoords = this.screenToTile(screenX, screenY);
    
    // Check if coordinates are valid and within map bounds
    if (mapCoords && mapCoords.x >= 0 && mapCoords.x < this.mapWidth && 
        mapCoords.y >= 0 && mapCoords.y < this.mapHeight) {
      // Only redraw if position changed
      if (this.eventDragHoverX !== mapCoords.x || this.eventDragHoverY !== mapCoords.y) {
        this.eventDragHoverX = mapCoords.x;
        this.eventDragHoverY = mapCoords.y;
        this.draw();
      }
      return mapCoords;
    } else {
      // Only redraw if was previously valid
      if (this.eventDragHoverX !== -1 || this.eventDragHoverY !== -1) {
        this.eventDragHoverX = -1;
        this.eventDragHoverY = -1;
        this.draw();
      }
      return null;
    }
  }

  public clearEventDragHover(): void {
    if (this.eventDragHoverX !== -1 || this.eventDragHoverY !== -1) {
      this.eventDragHoverX = -1;
      this.eventDragHoverY = -1;
      this.draw();
    }
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

  public toggleMinimapMode(): void {
    this.minimapMode = this.minimapMode === 'orthogonal' ? 'isometric' : 'orthogonal';
    this.draw();
  }

  public getMinimapMode(): 'orthogonal' | 'isometric' {
    return this.minimapMode;
  }

  public setMinimapMode(mode: 'orthogonal' | 'isometric'): void {
    if (this.minimapMode !== mode) {
      this.minimapMode = mode;
      this.draw();
    }
  }

  public toggleMinimap(): void {
    this.showMinimap = !this.showMinimap;
    this.draw();
  }

  public getMinimapWindowScale(): number {
    return this.minimapWindowScale;
  }

  public setMinimapWindowScale(scale: number): void {
    const clampedScale = Math.max(0.5, Math.min(3.0, scale));
    if (this.minimapWindowScale !== clampedScale) {
      this.minimapWindowScale = clampedScale;
      this.draw();
    }
  }

  // During sidebar open/close animations we can avoid recomputing minimap
  // coordinates to prevent jitter. When this flag is true the drawMiniMap
  // function will reuse the last computed coordinates until transitions end.
  private sidebarTransitioning: boolean = false;
  private lastMiniMapBounds: { x: number; y: number; w: number; h: number } | null = null;
  private minimapWindowScale: number = 1.0;
  private minimapPanX: number = 0;
  private minimapPanY: number = 0;
  private isMinimapPanning: boolean = false;
  private lastMinimapPanX: number = 0;
  private lastMinimapPanY: number = 0;
  private isResizingMinimap: boolean = false;
  private lastMinimapResizeX: number = 0;
  private lastMinimapResizeY: number = 0;
  private minimapZoom: number = 1.0;
  private minimapHoverCoords: { x: number; y: number } | null = null;

  public getIsResizingMinimap(): boolean {
    return this.isResizingMinimap;
  }

  public setSidebarTransitioning(flag: boolean): void {
    this.sidebarTransitioning = !!flag;
    if (!this.sidebarTransitioning) {
      // Clear cache when transition finishes so next draw computes fresh pos
      this.lastMiniMapBounds = null;
    }
  }

  public getLastMiniMapBounds(): { x: number; y: number; w: number; h: number } | null {
    return this.lastMiniMapBounds;
  }

  public setMinimapHoverCoords(coords: { x: number; y: number } | null): void {
    this.minimapHoverCoords = coords;
  }

  public getMinimapHoverCoords(): { x: number; y: number } | null {
    return this.minimapHoverCoords;
  }

  public getMinimapPan(): { x: number, y: number } {
    return { x: this.minimapPanX, y: this.minimapPanY };
  }

  public getMinimapZoom(): number {
    return this.minimapZoom;
  }

  public panToTile(tileX: number, tileY: number): void {
    // Determine where the tile is right now in raw screen space without any pan
    // Reset pan temporarily to calculate absolute offset
    this.panX = 0;
    this.panY = 0;
    const absScreenPos = this.mapToScreen(tileX, tileY);
    
    // We want this position to map to the center of the canvas
    const targetScreenX = this.mapCanvas.width / 2;
    const targetScreenY = this.mapCanvas.height / 2;
    
    // Calculate new pan required
    this.panX = (targetScreenX - absScreenPos.x) / this.zoom;
    this.panY = (targetScreenY - absScreenPos.y) / this.zoom;
    
    this.draw();
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

  // Object layers that need special rendering (Y-sorted, bottom-center anchor)
  private readonly objectLayerTypes = ['object', 'npc', 'enemy', 'event'];
  
  // Threshold for determining if a sprite is a "tall object" vs a "ground tile"
  // Sprites taller than this will be rendered as objects regardless of layer
  private readonly tallSpriteThreshold = this.tileSizeY * 1.5; // > 48px height for 32px tiles

  /**
   * Check if a sprite should be rendered as an object (tall/oversized) or as a ground tile.
   * Ground tiles are exactly tileSizeX x tileSizeY (64x32).
   * Anything larger is considered a tall object (walls, trees, pillars).
   */
  private isTallSprite(width: number, height: number): boolean {
    // A sprite is "tall" if it exceeds the base tile dimensions
    // We allow small tolerance for sprites that are close to tile size
    return height > this.tallSpriteThreshold || width > this.tileSizeX * 1.5;
  }

  private drawTiles(): void {
    // Render layers in reverse priority order so higher priority layers appear on top
    // Background (priority 6) renders first, collision (priority 4) renders later and appears on top
    const layersReversed = [...this.tileLayers].reverse();
    
    // Collect ALL tall sprites and object layer items for Y-sorted rendering
    // This includes tall sprites from ANY layer (including background)
    const objectsToRender: Array<{
      x: number;
      y: number;
      gid: number;
      layerType: string;
      tileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number };
      tileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>;
      transparency: number;
      sortKey: number; // For Y-sorting (isoX + isoY)
    }> = [];
    
    for (const layer of layersReversed) {
      if (!layer.visible) continue;
      if (layer.type === COLLISION_LAYER_TYPE) continue;
      
      // Check if this is an explicit object layer
      const isObjectLayer = this.objectLayerTypes.includes(layer.type);
      
      // Get the default tileset for this layer type (used as a fallback)
      const layerTilesetFallback = this.getLayerTilesetOrFallback(layer.type) || { image: null, fileName: null, columns: 1, rows: 1, count: 1 };

      // Get the active tab's detected tiles as a base source of tile data
      const tabs = this.layerTabs.get(layer.type) || [];
      const activeTabId = this.layerActiveTabId.get(layer.type);
      let activeTabDetectedTiles: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }> | null = null;
      if (activeTabId) {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.detectedTiles) {
          activeTabDetectedTiles = activeTab.detectedTiles as Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>;
        }
      }

      // Set layer transparency
      this.ctx.globalAlpha = layer.transparency || 1.0;

      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          const gid = layer.data[index];
          if (gid <= 0) continue;

          // Determine per-cell tileset key if any (fileName stored when painting)
          const keyArr = this.layerCellTilesetKey.get(layer.type);
          const cellTilesetKey = keyArr ? keyArr[index] : null;

          // Resolve tileset info for this specific cell
          let tilesetForCell = layerTilesetFallback;
          // Default to layer tile data, then active tab's detected tiles
          let layerTileDataForCell = this.layerTileData.get(layer.type) || activeTabDetectedTiles || new Map();

          if (cellTilesetKey) {
            const tab = tabs.find(t => t.tileset && t.tileset.fileName === cellTilesetKey);
            if (tab && tab.tileset) {
              tilesetForCell = {
                image: tab.tileset.image ?? null,
                fileName: tab.tileset.fileName ?? null,
                columns: (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0)
                  ? tab.tileset.columns
                  : Math.max(1, Math.floor((tab.tileset.image ? tab.tileset.image.width : this.tileSizeX) / this.tileSizeX)),
                rows: (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0)
                  ? tab.tileset.rows
                  : Math.max(1, Math.floor((tab.tileset.image ? tab.tileset.image.height : this.tileSizeY) / this.tileSizeY)),
                count: (typeof tab.tileset.count === 'number' && tab.tileset.count > 0)
                  ? tab.tileset.count
                  : Math.max(1,
                    ((typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0)
                      ? tab.tileset.columns
                      : 1) *
                    ((typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0)
                      ? tab.tileset.rows
                      : 1))
              };
              if (tab.detectedTiles) {
                layerTileDataForCell = tab.detectedTiles as Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>;
              }
            } else {
              // If we can't find tab metadata, fall back to layer fallback or active tab
              layerTileDataForCell = this.layerTileData.get(layer.type) || activeTabDetectedTiles || new Map();
            }
          }

          // Determine sprite dimensions to decide if it's a ground tile or tall object
          const tileData = layerTileDataForCell.get(gid) || this.detectedTileData.get(gid);
          let spriteWidth = this.tileSizeX;
          let spriteHeight = this.tileSizeY;
          
          if (tileData) {
            spriteWidth = tileData.width;
            spriteHeight = tileData.height;
          }
          
          // Determine rendering mode:
          // 1. Explicit object layers -> always render as object
          // 2. Tall sprites (height > threshold) -> render as object even if on background layer
          // 3. Ground-sized sprites on non-object layers -> render as tile
          const shouldRenderAsObject = isObjectLayer || this.isTallSprite(spriteWidth, spriteHeight);

          if (shouldRenderAsObject) {
            // Collect for Y-sorted object rendering
            // Sort key: x + y gives depth order in isometric view (further = rendered first)
            objectsToRender.push({
              x,
              y,
              gid,
              layerType: layer.type,
              tileset: tilesetForCell,
              tileData: layerTileDataForCell,
              transparency: layer.transparency || 1.0,
              sortKey: x + y
            });
          } else {
            // Draw as ground tile (64x32 or smaller, clipped to tile rect)
            this.drawGroundTile(x, y, gid, tilesetForCell, layerTileDataForCell);
          }
        }
      }
      
      // Also render sprite objects for this layer from placedSpriteObjects
      const spriteObjects = this.placedSpriteObjects.get(layer.type);
      if (spriteObjects && spriteObjects.length > 0) {
        const hasInstanceOnLayer = this.getObjectInstancesByLayer(layer.id.toString()).length > 0;
        if (!hasInstanceOnLayer) {
          for (const spriteObj of spriteObjects) {
            // Resolve tileset for this sprite object
            let tilesetForSprite = layerTilesetFallback;
            if (spriteObj.tilesetKey) {
              const tab = tabs.find(t => t.tileset && t.tileset.fileName === spriteObj.tilesetKey);
              if (tab && tab.tileset) {
                tilesetForSprite = {
                  image: tab.tileset.image ?? null,
                  fileName: tab.tileset.fileName ?? null,
                  columns: (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0) ? tab.tileset.columns : 1,
                  rows: (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0) ? tab.tileset.rows : 1,
                  count: (typeof tab.tileset.count === 'number' && tab.tileset.count > 0) ? tab.tileset.count : 1
                };
              }
            }
            
            // Add to objects array for Y-sorted rendering
            objectsToRender.push({
              x: spriteObj.anchorX,
              y: spriteObj.anchorY,
              gid: spriteObj.gid,
              layerType: layer.type,
              tileset: tilesetForSprite,
              tileData: new Map([[spriteObj.gid, {
                sourceX: spriteObj.sourceX,
                sourceY: spriteObj.sourceY,
                width: spriteObj.width,
                height: spriteObj.height
              }]]),
              transparency: layer.transparency || 1.0,
              sortKey: spriteObj.anchorX + spriteObj.anchorY
            });
          }
        }
      }

      // Phase 5: Render ObjectInstances for this layer
      if (this.objectInstances.size > 0) {
        for (const instance of this.objectInstances.values()) {
          // Only render instances on this layer
          if (instance.layerId !== layer.id.toString()) continue;

          const asset = this.assetRecords.get(instance.assetRecordId);
          if (!asset) {
            continue;
          }

          // Try to find the tileset that contains this asset
          let tilesetForInstance = layerTilesetFallback;
          const profile = asset.profileId ? asset.profileId : null;
          if (profile) {
            // Find tab with matching profile
            const tab = tabs.find(t => (t.tileset as unknown as { profileId?: string })?.profileId === profile);
            if (tab && tab.tileset) {
              tilesetForInstance = {
                image: tab.tileset.image ?? null,
                fileName: tab.tileset.fileName ?? null,
                columns: (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0) ? tab.tileset.columns : 1,
                rows: (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0) ? tab.tileset.rows : 1,
                count: (typeof tab.tileset.count === 'number' && tab.tileset.count > 0) ? tab.tileset.count : 1
              };
            }
          }

          // Add instance to render queue with Y-sort key
          objectsToRender.push({
            x: instance.gridX,
            y: instance.gridY,
            gid: 1, // Use GID 1 as placeholder (will use asset source rect directly)
            layerType: layer.type,
            tileset: tilesetForInstance,
            tileData: new Map([[1, {
              sourceX: asset.sourceX,
              sourceY: asset.sourceY,
              width: asset.width,
              height: asset.height,
              originX: asset.originX,
              originY: asset.originY
            }]]),
            transparency: layer.transparency || 1.0,
            sortKey: instance.gridX + instance.gridY
          });
        }
      }
    }
    
    // Sort objects by depth (Y-sort: lower sortKey = further from camera = render first)
    objectsToRender.sort((a, b) => a.sortKey - b.sortKey);
    
    // Render all objects with Y-sorting and bottom-center anchor (no clipping)
    for (const obj of objectsToRender) {
      this.ctx.globalAlpha = obj.transparency;
      this.drawObjectSprite(obj.x, obj.y, obj.gid, obj.tileset, obj.tileData);
    }
    
    // Reset alpha for other drawing operations
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw a ground tile - these are true isometric floor tiles (64x32).
   * Ground tiles are clipped to tile boundaries and drawn in layer order.
   */
  private drawGroundTile(
    x: number,
    y: number,
    gid: number,
    layerTileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number },
    layerTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>
  ): void {
    if (!layerTileset.image || gid <= 0) return;
    
    // Get tile data
    const tileData = layerTileData.get(gid) || this.detectedTileData.get(gid);
    
    let sourceX: number, sourceY: number, tileWidth: number, tileHeight: number;
    
    if (tileData) {
      sourceX = tileData.sourceX;
      sourceY = tileData.sourceY;
      // For ground tiles, use actual dimensions but they should be ~64x32
      tileWidth = tileData.width;
      tileHeight = tileData.height;
    } else {
      // Fallback to fixed grid layout
      const tileIndex = gid - 1;
      sourceX = (tileIndex % layerTileset.columns) * this.tileSizeX;
      sourceY = Math.floor(tileIndex / layerTileset.columns) * this.tileSizeY;
      tileWidth = this.tileSizeX;
      tileHeight = this.tileSizeY;
    }

    // If restored detected-tile metadata is stale/corrupt (out-of-bounds source rect),
    // fall back to grid slicing so painted data still renders on the main canvas.
    const imgW = layerTileset.image.naturalWidth || layerTileset.image.width;
    const imgH = layerTileset.image.naturalHeight || layerTileset.image.height;
    const invalidRect =
      sourceX < 0 ||
      sourceY < 0 ||
      tileWidth <= 0 ||
      tileHeight <= 0 ||
      sourceX + tileWidth > imgW ||
      sourceY + tileHeight > imgH;
    if (invalidRect) {
      const safeColumns = Math.max(1, layerTileset.columns || Math.floor(imgW / this.tileSizeX) || 1);
      const tileIndex = gid - 1;
      sourceX = (tileIndex % safeColumns) * this.tileSizeX;
      sourceY = Math.floor(tileIndex / safeColumns) * this.tileSizeY;
      tileWidth = this.tileSizeX;
      tileHeight = this.tileSizeY;
    }
    
    // Get isometric screen position (center of the tile diamond)
    const screenPos = this.mapToScreen(x, y);
    const scaledTileX = tileWidth * this.zoom;
    const scaledTileY = tileHeight * this.zoom;

    // For ground tiles, position so the tile fills the diamond cell
    // The sprite should be centered horizontally on the tile center
    // and positioned so its bottom aligns with the diamond's bottom
    const halfTileY = (this.tileSizeY / 2) * this.zoom;
    const groundY = screenPos.y + halfTileY;
    
    // Center-bottom anchor for ground tiles
    const destX = screenPos.x - (tileWidth / 2) * this.zoom;
    const destY = groundY - tileHeight * this.zoom;
    
    this.ctx.drawImage(
      layerTileset.image,
      sourceX, sourceY, tileWidth, tileHeight,
      destX, destY, scaledTileX, scaledTileY
    );
  }

  /**
   * Draw an object sprite with bottom-center anchoring (no clipping).
   * Objects can be larger than tiles and should be positioned so their
   * bottom-center aligns with the tile's ground point.
   */
  private drawObjectSprite(
    x: number,
    y: number,
    gid: number,
    layerTileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number },
    layerTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>
  ): void {
    if (!layerTileset.image || gid <= 0) return;
    
    // Get tile/sprite data - check layer data first, then global detectedTileData
    const tileData = layerTileData.get(gid) || this.detectedTileData.get(gid);
    
    let sourceX: number, sourceY: number, spriteWidth: number, spriteHeight: number;
    let originX: number | undefined, originY: number | undefined;
    
    if (tileData) {
      sourceX = tileData.sourceX;
      sourceY = tileData.sourceY;
      spriteWidth = tileData.width;
      spriteHeight = tileData.height;
      originX = tileData.originX;
      originY = tileData.originY;
    } else {
      // Fallback to fixed grid layout
      const tileIndex = gid - 1;
      sourceX = (tileIndex % layerTileset.columns) * this.tileSizeX;
      sourceY = Math.floor(tileIndex / layerTileset.columns) * this.tileSizeY;
      spriteWidth = this.tileSizeX;
      spriteHeight = this.tileSizeY;
    }

    // Same safety guard as ground tiles: if source rect is invalid, recover using grid slicing.
    const imgW = layerTileset.image.naturalWidth || layerTileset.image.width;
    const imgH = layerTileset.image.naturalHeight || layerTileset.image.height;
    const invalidRect =
      sourceX < 0 ||
      sourceY < 0 ||
      spriteWidth <= 0 ||
      spriteHeight <= 0 ||
      sourceX + spriteWidth > imgW ||
      sourceY + spriteHeight > imgH;
    if (invalidRect) {
      const safeColumns = Math.max(1, layerTileset.columns || Math.floor(imgW / this.tileSizeX) || 1);
      const tileIndex = gid - 1;
      sourceX = (tileIndex % safeColumns) * this.tileSizeX;
      sourceY = Math.floor(tileIndex / safeColumns) * this.tileSizeY;
      spriteWidth = this.tileSizeX;
      spriteHeight = this.tileSizeY;
      originX = Math.floor(this.tileSizeX / 2);
      originY = this.tileSizeY;
    }
    
    // Get isometric screen position (center of the tile diamond)
    const screenPos = this.mapToScreen(x, y);
    
    // Calculate the ground point (bottom of the tile diamond)
    const halfTileY = (this.tileSizeY / 2) * this.zoom;
    const groundY = screenPos.y + halfTileY;
    
    // Scale sprite dimensions
    const scaledWidth = spriteWidth * this.zoom;
    const scaledHeight = spriteHeight * this.zoom;
    
    // Use custom origin if provided, otherwise default to bottom-center
    // For objects, bottom-center anchoring means:
    // - Horizontal: sprite center aligns with tile center
    // - Vertical: sprite bottom aligns with tile ground
    const finalOriginX = (typeof originX === 'number') ? originX : Math.floor(spriteWidth / 2);
    const finalOriginY = (typeof originY === 'number') ? originY : spriteHeight;
    
    // Calculate destination position
    // destX: tile center - scaled origin X
    // destY: ground point - scaled origin Y
    const destX = screenPos.x - (finalOriginX * this.zoom);
    const destY = groundY - (finalOriginY * this.zoom);
    
    // Draw without any clipping - objects can extend beyond tile bounds
    this.ctx.drawImage(
      layerTileset.image,
      sourceX, sourceY, spriteWidth, spriteHeight,
      destX, destY, scaledWidth, scaledHeight
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

  // Draw NPC drag hover highlight (same blue effect as regular hover)
  private drawNpcDragHover(): void {
    const screenPos = this.mapToScreen(this.npcDragHoverX, this.npcDragHoverY);
    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;
    
    // Blue hover outline - same as default hover
    this.ctx.strokeStyle = '#007acc';
    this.ctx.lineWidth = Math.max(1, Math.min(3, 2 / this.zoom));
    
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawEventDragHover(): void {
    const screenPos = this.mapToScreen(this.eventDragHoverX, this.eventDragHoverY);
    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;

    this.ctx.save();

    // Orange filled diamond
    this.ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
    this.ctx.closePath();
    this.ctx.fill();

    // Orange border
    this.ctx.strokeStyle = '#ea580c';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
    this.ctx.closePath();
    this.ctx.stroke();

    // White clock icon at center
    const iconSize = Math.max(8, Math.min(16, 12 * this.zoom));
    const cx = screenPos.x;
    const cy = screenPos.y;
    const r = iconSize / 2;

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 1.5 * this.zoom));
    this.ctx.lineCap = 'round';

    // Clock circle
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.stroke();

    // Hour hand (12 o'clock)
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx, cy - r * 0.6);
    this.ctx.stroke();

    // Minute hand (3 o'clock)
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx + r * 0.5, cy);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawEvents(): void {
    // Check if there is an "event" tile layer to get its visibility and opacity.
    // If it doesn't exist, we default to visible and opaque.
    const eventLayer = this.tileLayers.find(l => l.type === 'event');
    if (eventLayer && !eventLayer.visible) return; // Hide/Unhide functional tie-in

    const events = this.objects.filter(obj => obj.type === 'event' && obj.x >= 0 && obj.y >= 0);
    if (events.length === 0) return;

    this.ctx.save();
    
    // Connect to transparency state of the Event layer panel item
    if (eventLayer && eventLayer.transparency != null) {
      this.ctx.globalAlpha = eventLayer.transparency;
    }

// Group events by cell to draw badges for stacked events
      const eventsByCell = new Map<string, MapObject[]>();
      for (const event of events) {
        const key = `${event.x},${event.y}`;
        if (!eventsByCell.has(key)) eventsByCell.set(key, []);
        eventsByCell.get(key)!.push(event);
      }

      for (const event of events) {
        this.drawEventPlaceholder(event);
      }

      // Draw count badges for cells with multiple events
      for (const [, cellEvents] of eventsByCell) {
        if (cellEvents.length > 1) {
          const first = cellEvents[0];
          const screenPos = this.mapToScreen(first.x, first.y);
          const halfTileX = (this.tileSizeX / 2) * this.zoom;
          const halfTileY = (this.tileSizeY / 2) * this.zoom;

          const badgeR = Math.max(6, Math.min(12, 9 * this.zoom));
          const bx = screenPos.x + halfTileX - badgeR * 0.3;
          const by = screenPos.y - halfTileY + badgeR * 0.3;

          this.ctx.save();
          this.ctx.fillStyle = '#ffffff';
          this.ctx.beginPath();
          this.ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = '#000000';
          const fontSize = Math.max(8, Math.min(14, 10 * this.zoom));
          this.ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(String(cellEvents.length), bx, by);
          this.ctx.restore();
        }
      }

    this.ctx.restore();
  }

  private drawEventPlaceholder(event: MapObject): void {
    const screenPos = this.mapToScreen(event.x, event.y);
    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;

    this.ctx.save();

    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Filled orange diamond
    this.ctx.fillStyle = '#f97316';
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
    this.ctx.closePath();
    this.ctx.fill();

    // Orange border
    this.ctx.strokeStyle = '#ea580c';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 2 / this.zoom));
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
    this.ctx.closePath();
    this.ctx.stroke();

    // White clock icon at center
    const iconSize = Math.max(8, Math.min(16, 12 * this.zoom));
    const cx = screenPos.x;
    const cy = screenPos.y;
    const r = iconSize / 2;

    // Clock circle
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = Math.max(1, Math.min(2, 1.5 * this.zoom));
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.stroke();

    // Clock hands (hour hand pointing to 12, minute hand pointing to 3)
    this.ctx.lineCap = 'round';
    // Hour hand (12 o'clock)
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx, cy - r * 0.6);
    this.ctx.stroke();
    // Minute hand (3 o'clock)
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx + r * 0.5, cy);
    this.ctx.stroke();

    this.ctx.restore();
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
      // Draw light blue fill for selected tiles
      this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      this.ctx.strokeStyle = '#007acc';
      this.ctx.lineWidth = Math.max(1, Math.min(2.5, 2.5 / this.zoom));
      
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
        this.ctx.fill();
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

  private drawActiveEventPreview(): void {
    if (!this.activeEventPreview) return;
    const { x, y, width, height } = this.activeEventPreview;

    const w = Math.max(1, width);
    const h = Math.max(1, height);

    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;

    this.ctx.save();
    
    // Draw the full area with lighter transparency
    if (w > 1 || h > 1) {
      const c1 = this.mapToScreen(x, y);
      const c2 = this.mapToScreen(x + w - 1, y);
      const c3 = this.mapToScreen(x + w - 1, y + h - 1);
      const c4 = this.mapToScreen(x, y + h - 1);

      this.ctx.beginPath();
      this.ctx.moveTo(c1.x, c1.y - halfTileY); // Top
      this.ctx.lineTo(c2.x + halfTileX, c2.y); // Right
      this.ctx.lineTo(c3.x, c3.y + halfTileY); // Bottom
      this.ctx.lineTo(c4.x - halfTileX, c4.y); // Left
      this.ctx.closePath();

      this.ctx.fillStyle = 'rgba(255, 165, 0, 0.2)';
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 140, 0, 0.4)';
      this.ctx.lineWidth = Math.max(1, 1 * this.zoom);
      this.ctx.stroke();
    }

    // Draw the single cell (x,y) with stronger overlay
    const origin = this.mapToScreen(x, y);
    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y - halfTileY); // Top
    this.ctx.lineTo(origin.x + halfTileX, origin.y); // Right
    this.ctx.lineTo(origin.x, origin.y + halfTileY); // Bottom
    this.ctx.lineTo(origin.x - halfTileX, origin.y); // Left
    this.ctx.closePath();

    this.ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)';
    this.ctx.lineWidth = Math.max(2, 2 * this.zoom);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawActiveHotspotPreview(): void {
    if (!this.activeHotspotPreview) return;
    const { x, y, width, height } = this.activeHotspotPreview;

    const w = Math.max(1, width);
    const h = Math.max(1, height);

    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;

    this.ctx.save();
    
    // Draw the full area with lighter pink transparency
    if (w > 1 || h > 1) {
      const c1 = this.mapToScreen(x, y);
      const c2 = this.mapToScreen(x + w - 1, y);
      const c3 = this.mapToScreen(x + w - 1, y + h - 1);
      const c4 = this.mapToScreen(x, y + h - 1);

      this.ctx.beginPath();
      this.ctx.moveTo(c1.x, c1.y - halfTileY); // Top
      this.ctx.lineTo(c2.x + halfTileX, c2.y); // Right
      this.ctx.lineTo(c3.x, c3.y + halfTileY); // Bottom
      this.ctx.lineTo(c4.x - halfTileX, c4.y); // Left
      this.ctx.closePath();

      this.ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(219, 39, 119, 0.4)';
      this.ctx.lineWidth = Math.max(1, 1 * this.zoom);
      this.ctx.stroke();
    }

    // Draw the single cell (x,y) with stronger pink overlay
    const origin = this.mapToScreen(x, y);
    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y - halfTileY); // Top
    this.ctx.lineTo(origin.x + halfTileX, origin.y); // Right
    this.ctx.lineTo(origin.x, origin.y + halfTileY); // Bottom
    this.ctx.lineTo(origin.x - halfTileX, origin.y); // Left
    this.ctx.closePath();

    this.ctx.fillStyle = 'rgba(236, 72, 153, 0.6)';
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(219, 39, 119, 0.9)';
    this.ctx.lineWidth = Math.max(2, 2 * this.zoom);
    this.ctx.stroke();

    this.ctx.restore();
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
    // Don't show placeholder for unplaced actors (x < 0 or y < 0)
    if (object.x < 0 || object.y < 0) return false;
    const layer = this.getActorLayerByType(actorLayerType);
    // If no layer exists for this actor type, always show placeholder
    if (!layer) return true;
    const index = object.y * this.mapWidth + object.x;
    if (index < 0 || index >= layer.data.length) return true;
    // Show placeholder if no tile is assigned at this position
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
    if (actorType === 'npc') {
      // Draw lucide circle-user-round icon
      const iconSize = Math.max(5, Math.min(10, 8 * this.zoom));
      const s = iconSize / 12; // scale factor (icon drawn in 24x24, we use half)
      const cx = centerX;
      const cy = centerY;

      this.ctx.save();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = Math.max(1, Math.min(2, 1.5 * this.zoom));
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Outer circle (circle cx=12 cy=12 r=10 scaled)
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2);
      this.ctx.stroke();

      // Head circle (circle cx=12 cy=10 r=4 scaled)
      this.ctx.beginPath();
      this.ctx.arc(cx, cy - 2 * s, 4 * s, 0, Math.PI * 2);
      this.ctx.stroke();

      // Body arc (path d="M18 20a6 6 0 0 0-12 0" scaled)
      // This is an arc from (18,20) to (6,20) with radius 6, sweep clockwise
      // Center of this arc is (12, 20), radius 6
      this.ctx.beginPath();
      this.ctx.arc(cx, cy + 8 * s, 6 * s, Math.PI, 0, false);
      this.ctx.stroke();

      this.ctx.restore();
    } else {
      const fontSize = Math.max(10, Math.min(18, 14 * this.zoom));
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('E', centerX, centerY);
      this.ctx.restore();
    }
  }

  private drawStampPreview(): void {
    if (!this.stampPreview.visible || !this.activeStamp) return;

    this.ctx.strokeStyle = '#007acc';
    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    this.ctx.lineWidth = Math.max(1, Math.min(2.5, 2.5 / this.zoom));

    const halfTileX = (this.tileSizeX / 2) * this.zoom;
    const halfTileY = (this.tileSizeY / 2) * this.zoom;

    // Draw only a single cell highlight at the hover position (anchor point)
    // regardless of how many tiles are selected in the tileset palette
    const screenPos = this.mapToScreen(this.stampPreview.x, this.stampPreview.y);

    // Draw a single diamond outline for the anchor cell
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    this.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    this.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    this.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawMiniMap(): void {
    if (!this.showMinimap) return;

    // Minimap dimensions and position (bottom-right corner)
    const minimapWidth = Math.floor(150 * this.minimapWindowScale);
    const minimapHeight = Math.floor(120 * this.minimapWindowScale);
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
    // Update cached bounds for hit testing
    this.lastMiniMapBounds = { x, y, w: minimapWidth, h: minimapHeight };

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
    let tilePixel: number;
    let mapPixelWidth: number;
    let mapPixelHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (this.minimapMode === 'isometric') {
      const maxTileWidth = Math.floor(minimapWidth * 2 / (this.mapWidth + this.mapHeight)) || 1;
      const maxTileHeight = Math.floor(minimapHeight * 4 / (this.mapWidth + this.mapHeight)) || 1;
      tilePixel = Math.max(1, Math.min(maxTileWidth, maxTileHeight)) * this.minimapZoom;
      
      // We can allow sub-pixel sizes here for smooth zooming or round it
      
      mapPixelWidth = (this.mapWidth + this.mapHeight) * (tilePixel / 2);
      mapPixelHeight = (this.mapWidth + this.mapHeight) * (tilePixel / 4);
      
      offsetX = x + minimapWidth / 2 - (this.mapWidth - this.mapHeight) * (tilePixel / 4) + this.minimapPanX;
      offsetY = y + minimapHeight / 2 - (this.mapWidth + this.mapHeight) * (tilePixel / 8) + this.minimapPanY;
    } else {
      const maxTileWidth = Math.floor(minimapWidth / this.mapWidth) || 1;
      const maxTileHeight = Math.floor(minimapHeight / this.mapHeight) || 1;
      tilePixel = Math.max(1, Math.min(maxTileWidth, maxTileHeight)) * this.minimapZoom;

      mapPixelWidth = this.mapWidth * tilePixel;
      mapPixelHeight = this.mapHeight * tilePixel;
      offsetX = x + Math.floor((minimapWidth - mapPixelWidth) / 2) + this.minimapPanX;
      offsetY = y + Math.floor((minimapHeight - mapPixelHeight) / 2) + this.minimapPanY;
    }

  // Draw minimap contents within clipping region so zoom doesn't leak out
  this.ctx.save();
  roundedRectPath(x, y, minimapWidth, minimapHeight, innerRadius);
  this.ctx.clip();

  // Disable smoothing for pixel-perfect minimap (modern engines)
  this.ctx.imageSmoothingEnabled = false;

    // Priority order for minimap rendering
    // Collision will be drawn last to appear on top of everything
    const layerPriority = (layer: TileLayer) => {
      const type = (layer.type || '').toLowerCase();
      const name = (layer.name || '').toLowerCase();
      if (type === 'collision' || name.includes('collision')) return 5; // Highest, drawn last
      if (type === 'object' || name.includes('object')) return 3;
      if (type === 'background' || name.includes('background')) return 1;
      return 2; // Others in between background and foreground
    };

    // Separate collision layer from other layers
    const allVisibleLayers = [...this.tileLayers].filter(l => l.visible);
    const nonCollisionLayers = allVisibleLayers.filter(l => {
      const type = (l.type || '').toLowerCase();
      const name = (l.name || '').toLowerCase();
      return !(type === 'collision' || name.includes('collision'));
    });
    const collisionLayers = allVisibleLayers.filter(l => {
      const type = (l.type || '').toLowerCase();
      const name = (l.name || '').toLowerCase();
      return (type === 'collision' || name.includes('collision'));
    });

    // Sort non-collision layers for back-to-front rendering
    const renderLayers = nonCollisionLayers.sort((a, b) => layerPriority(a) - layerPriority(b));

    // Draw non-collision tiles in selected view (top-down or isometric)
    for (let tileY = 0; tileY < this.mapHeight; tileY++) {
      for (let tileX = 0; tileX < this.mapWidth; tileX++) {
        const index = tileY * this.mapWidth + tileX;

        // Draw each layer from bottom to top for this cell
        for (let i = 0; i < renderLayers.length; i++) {
          const layer = renderLayers[i];
          const gid = layer.data[index];
          
          if (gid > 0) {
            const lType = (layer.type || '').toLowerCase();
            const lName = (layer.name || '').toLowerCase();

            // Check collision constraint
            if ((lType === 'collision' || lName.includes('collision')) && gid !== 1 && gid !== 2) {
              continue;
            }

            let pixelX: number;
            let pixelY: number;

            if (this.minimapMode === 'isometric') {
              pixelX = offsetX + (tileX - tileY) * (tilePixel / 2);
              pixelY = offsetY + (tileX + tileY) * (tilePixel / 4);
            } else {
              pixelX = offsetX + tileX * tilePixel;
              pixelY = offsetY + tileY * tilePixel;
            }

            let fillColor = '';
            let strokeColor = '';
            let isDashed = false;

            if (lType === 'background' || lName.includes('background')) {
              fillColor = `rgba(34, 139, 34, 0.8)`; // Green
              strokeColor = `rgba(34, 139, 34, 1)`;
            } else if (lType === 'object' || lName.includes('object')) {
              fillColor = `rgba(30, 144, 255, 0.8)`; // Blue
              strokeColor = `rgba(30, 144, 255, 1)`;
            } else if (lType === 'collision' || lName.includes('collision')) {
              if (gid === 1) {
                fillColor = `rgba(255, 255, 255, 0.8)`; // White overlay
                strokeColor = `rgba(255, 255, 255, 1)`;
              } else if (gid === 2) {
                fillColor = `rgba(255, 255, 255, 0.2)`;
                strokeColor = `rgba(255, 255, 255, 0.8)`;
                isDashed = true;
              }
            } else {
              const hue = (gid * 137.5) % 360;
              const layerIndex = this.tileLayers.indexOf(layer);
              fillColor = `hsl(${hue}, 55%, ${layerIndex === 0 ? '45%' : '60%'})`;
              strokeColor = `hsl(${hue}, 55%, ${layerIndex === 0 ? '35%' : '50%'})`;
            }

            this.ctx.fillStyle = fillColor;

            if (isDashed) {
              this.ctx.setLineDash([2, 2]);
            } else {
              this.ctx.setLineDash([]);
            }

            if (this.minimapMode === 'isometric') {
              this.ctx.beginPath();
              this.ctx.moveTo(pixelX, pixelY); // top
              this.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4); // right
              this.ctx.lineTo(pixelX, pixelY + tilePixel / 2); // bottom
              this.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4); // left
              this.ctx.fill();
              
              // Draw subtle stroke for clarity
              this.ctx.strokeStyle = strokeColor;
              this.ctx.lineWidth = 0.5;
              this.ctx.stroke();
            } else {
              this.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
              if (isDashed || layer.type === 'collision') {
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(pixelX, pixelY, tilePixel, tilePixel);
              }
            }

            this.ctx.setLineDash([]);
          }
        }
      }
    }

    // Also render sprite objects for each visible layer on minimap
    for (let layerIndex = 0; layerIndex < this.tileLayers.length; layerIndex++) {
      const layer = this.tileLayers[layerIndex];
      if (!layer.visible) continue;

      const spriteObjects = this.placedSpriteObjects.get(layer.type);
      if (spriteObjects && spriteObjects.length > 0) {
        for (const spriteObj of spriteObjects) {
          let pixelX: number;
          let pixelY: number;

          if (this.minimapMode === 'isometric') {
            pixelX = offsetX + (spriteObj.anchorX - spriteObj.anchorY) * (tilePixel / 2);
            pixelY = offsetY + (spriteObj.anchorX + spriteObj.anchorY) * (tilePixel / 4);
          } else {
            pixelX = offsetX + spriteObj.anchorX * tilePixel;
            pixelY = offsetY + spriteObj.anchorY * tilePixel;
          }
          
          // Use a slightly brighter color for sprite objects based on layer type
          if (layer.type === 'background') {
            this.ctx.fillStyle = `rgba(50, 205, 50, 0.9)`; // Lighter green
          } else if (layer.type === 'object') {
            this.ctx.fillStyle = `rgba(65, 105, 225, 0.9)`; // Royal blue
          } else {
            const hue = (spriteObj.gid * 137.5) % 360;
            this.ctx.fillStyle = `hsl(${hue}, 70%, ${layerIndex === 0 ? '50%' : '65%'})`;
          }
          
          if (this.minimapMode === 'isometric') {
            this.ctx.beginPath();
            this.ctx.moveTo(pixelX, pixelY);
            this.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4);
            this.ctx.lineTo(pixelX, pixelY + tilePixel / 2);
            this.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4);
            this.ctx.fill();
          } else {
            this.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
          }
        }
      }
    }

    // Render ObjectInstances on the minimap
    if (this.objectInstances && this.objectInstances.size > 0) {
      for (const instance of this.objectInstances.values()) {
        // Find the layer this instance belongs to
        const instanceLayer = this.tileLayers.find(l => l.id.toString() === instance.layerId);
        if (!instanceLayer || !instanceLayer.visible) continue;

        let pixelX: number;
        let pixelY: number;

        if (this.minimapMode === 'isometric') {
          pixelX = offsetX + (instance.gridX - instance.gridY) * (tilePixel / 2);
          pixelY = offsetY + (instance.gridX + instance.gridY) * (tilePixel / 4);
        } else {
          pixelX = offsetX + instance.gridX * tilePixel;
          pixelY = offsetY + instance.gridY * tilePixel;
        }

        // Color based on layer type
        const layerName = (instanceLayer.name || '').toLowerCase();
        if (layerName.includes('object')) {
          this.ctx.fillStyle = `rgba(30, 144, 255, 0.8)`; // Blue for objects
        } else if (layerName.includes('background')) {
          this.ctx.fillStyle = `rgba(34, 139, 34, 0.8)`; // Green for background
        } else {
          this.ctx.fillStyle = `rgba(200, 200, 200, 0.8)`; // Gray for other
        }

        if (this.minimapMode === 'isometric') {
          this.ctx.beginPath();
          this.ctx.moveTo(pixelX, pixelY);
          this.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4);
          this.ctx.lineTo(pixelX, pixelY + tilePixel / 2);
          this.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
        }
      }
    }

    // Draw collision layer tiles last so they appear on top of everything
    for (const collisionLayer of collisionLayers) {
      for (let tileY = 0; tileY < this.mapHeight; tileY++) {
        for (let tileX = 0; tileX < this.mapWidth; tileX++) {
          const index = tileY * this.mapWidth + tileX;
          const gid = collisionLayer.data[index];

          if (gid > 0) {
            let pixelX: number;
            let pixelY: number;

            if (this.minimapMode === 'isometric') {
              pixelX = offsetX + (tileX - tileY) * (tilePixel / 2);
              pixelY = offsetY + (tileX + tileY) * (tilePixel / 4);
            } else {
              pixelX = offsetX + tileX * tilePixel;
              pixelY = offsetY + tileY * tilePixel;
            }

            let fillColor = '';
            let strokeColor = '';
            let isDashed = false;

            if (gid === 1) {
              fillColor = `rgba(255, 255, 255, 0.8)`; // White overlay
              strokeColor = `rgba(255, 255, 255, 1)`;
            } else if (gid === 2) {
              fillColor = `rgba(255, 255, 255, 0.2)`;
              strokeColor = `rgba(255, 255, 255, 0.8)`;
              isDashed = true;
            }

            this.ctx.fillStyle = fillColor;

            if (isDashed) {
              this.ctx.setLineDash([2, 2]);
            } else {
              this.ctx.setLineDash([]);
            }

            if (this.minimapMode === 'isometric') {
              this.ctx.beginPath();
              this.ctx.moveTo(pixelX, pixelY);
              this.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4);
              this.ctx.lineTo(pixelX, pixelY + tilePixel / 2);
              this.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4);
              this.ctx.fill();
              
              this.ctx.strokeStyle = strokeColor;
              this.ctx.lineWidth = 0.5;
              this.ctx.stroke();
            } else {
              this.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
              if (isDashed) {
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(pixelX, pixelY, tilePixel, tilePixel);
              }
            }

            this.ctx.setLineDash([]);
          }
        }
      }
    }

    // Optional subtle grid for clarity when tiles are large enough
    if (tilePixel >= 3) {
      this.ctx.strokeStyle = this.isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
      this.ctx.lineWidth = 1;
      for (let ty = 0; ty < this.mapHeight; ty++) {
        for (let tx = 0; tx < this.mapWidth; tx++) {
          if (this.minimapMode === 'isometric') {
            const gx = offsetX + (tx - ty) * (tilePixel / 2);
            const gy = offsetY + (tx + ty) * (tilePixel / 4);
            this.ctx.beginPath();
            this.ctx.moveTo(gx, gy);
            this.ctx.lineTo(gx + tilePixel / 2, gy + tilePixel / 4);
            this.ctx.lineTo(gx, gy + tilePixel / 2);
            this.ctx.lineTo(gx - tilePixel / 2, gy + tilePixel / 4);
            this.ctx.stroke();
          } else {
            const gx = offsetX + tx * tilePixel + 0.25;
            const gy = offsetY + ty * tilePixel + 0.25;
            this.ctx.strokeRect(gx, gy, tilePixel - 0.5, tilePixel - 0.5);
          }
        }
      }
    }

    // Draw red overlay for hovered cell in minimap
    if (this.minimapHoverCoords && tilePixel > 0) {
      const { x: hoverX, y: hoverY } = this.minimapHoverCoords;
      
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
      
      if (this.minimapMode === 'isometric') {
        const gx = offsetX + (hoverX - hoverY) * (tilePixel / 2);
        const gy = offsetY + (hoverX + hoverY) * (tilePixel / 4);
        this.ctx.beginPath();
        this.ctx.moveTo(gx, gy);
        this.ctx.lineTo(gx + tilePixel / 2, gy + tilePixel / 4);
        this.ctx.lineTo(gx, gy + tilePixel / 2);
        this.ctx.lineTo(gx - tilePixel / 2, gy + tilePixel / 4);
        this.ctx.fill();
      } else {
        const pixelX = offsetX + hoverX * tilePixel;
        const pixelY = offsetY + hoverY * tilePixel;
        this.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
      }
    }

    if (this.activeEventPreview && tilePixel > 0) {
      const { x: aX, y: aY, width, height } = this.activeEventPreview;
      const w = Math.max(1, width);
      const h = Math.max(1, height);

      const drawMinimapShape = (sX: number, sY: number, sW: number, sH: number, fill: string, stroke: string) => {
        this.ctx.fillStyle = fill;
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = 1;

        if (this.minimapMode === 'isometric') {
          const getMinimapPoint = (mX: number, mY: number) => ({
            x: offsetX + (mX - mY) * (tilePixel / 2),
            y: offsetY + (mX + mY) * (tilePixel / 4)
          });

          const p1 = getMinimapPoint(sX, sY);
          const p2 = getMinimapPoint(sX + sW - 1, sY);
          const p3 = getMinimapPoint(sX + sW - 1, sY + sH - 1);
          const p4 = getMinimapPoint(sX, sY + sH - 1);

          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x + tilePixel / 2, p2.y + tilePixel / 4);
          this.ctx.lineTo(p3.x, p3.y + tilePixel / 2);
          this.ctx.lineTo(p4.x - tilePixel / 2, p4.y + tilePixel / 4);
          this.ctx.closePath();

          this.ctx.fill();
          this.ctx.stroke();
        } else {
          const pixelX = offsetX + sX * tilePixel;
          const pixelY = offsetY + sY * tilePixel;
          this.ctx.fillRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
          this.ctx.strokeRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
        }
      };

      if (w > 1 || h > 1) {
        drawMinimapShape(aX, aY, w, h, 'rgba(255, 165, 0, 0.2)', 'rgba(255, 140, 0, 0.4)');
      }
      drawMinimapShape(aX, aY, 1, 1, 'rgba(255, 165, 0, 0.6)', 'rgba(255, 140, 0, 0.9)');
    }

    if (this.activeHotspotPreview && tilePixel > 0) {
      const { x: hX, y: hY, width: hWidth, height: hHeight } = this.activeHotspotPreview;
      const hw = Math.max(1, hWidth);
      const hh = Math.max(1, hHeight);

      const drawMinimapShape2 = (sX: number, sY: number, sW: number, sH: number, fill: string, stroke: string) => {
        this.ctx.fillStyle = fill;
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = 1;

        if (this.minimapMode === 'isometric') {
          const getMinimapPoint = (mX: number, mY: number) => ({
            x: offsetX + (mX - mY) * (tilePixel / 2),
            y: offsetY + (mX + mY) * (tilePixel / 4)
          });

          const p1 = getMinimapPoint(sX, sY);
          const p2 = getMinimapPoint(sX + sW - 1, sY);
          const p3 = getMinimapPoint(sX + sW - 1, sY + sH - 1);
          const p4 = getMinimapPoint(sX, sY + sH - 1);

          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x + tilePixel / 2, p2.y + tilePixel / 4);
          this.ctx.lineTo(p3.x, p3.y + tilePixel / 2);
          this.ctx.lineTo(p4.x - tilePixel / 2, p4.y + tilePixel / 4);
          this.ctx.closePath();

          this.ctx.fill();
          this.ctx.stroke();
        } else {
          const pixelX = offsetX + sX * tilePixel;
          const pixelY = offsetY + sY * tilePixel;
          this.ctx.fillRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
          this.ctx.strokeRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
        }
      };

      if (hw > 1 || hh > 1) {
        drawMinimapShape2(hX, hY, hw, hh, 'rgba(236, 72, 153, 0.2)', 'rgba(219, 39, 119, 0.4)');
      }
      drawMinimapShape2(hX, hY, 1, 1, 'rgba(236, 72, 153, 0.6)', 'rgba(219, 39, 119, 0.9)');
    }

    // End clipping mask for minimap contents
    this.ctx.restore();
    
    // Draw minimalistic resize arrow icon at top-left corner
    this.ctx.strokeStyle = this.isDarkMode ? '#bbb' : '#666';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    // Simple diagonal arrow: top-left to bottom-right
    this.ctx.moveTo(x + 5, y + 5);
    this.ctx.lineTo(x + 15, y + 15);
    // Arrowhead on top-left end
    this.ctx.moveTo(x + 8, y + 5);
    this.ctx.lineTo(x + 5, y + 5);
    this.ctx.lineTo(x + 5, y + 8);
    // Arrowhead on bottom-right end
    this.ctx.moveTo(x + 15, y + 12);
    this.ctx.lineTo(x + 15, y + 15);
    this.ctx.lineTo(x + 12, y + 15);
    this.ctx.stroke();

    // Restore context state
    this.ctx.restore();
  }

  // Public methods for React to interact with
  public handleFileUpload(file: File, type: 'tileset' | 'layerTileset', options?: { skipAutoSlice?: boolean }): void {
    const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (activeLayer && activeLayer.type === COLLISION_LAYER_TYPE) return;
    
    if (type === 'tileset') {
      // Treat uploads as layer-specific by default: assign to active layer's tileset
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const columns = Math.max(1, Math.floor(img.width / this.tileSizeX));
          const rows = Math.max(1, Math.floor(img.height / this.tileSizeY));
          const count = columns * rows;
          const tileWidth = columns > 0 ? Math.round(img.width / columns) : this.tileSizeX;
          const tileHeight = rows > 0 ? Math.round(img.height / rows) : this.tileSizeY;

          const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
          if (activeLayer) {
            // If caller requested to skip autoslice, store minimal tileset on the active tab
            if (options && options.skipAutoSlice) {
              // Find active tab and set its tileset without applying to layerTilesets or palette
              const tabs = this.layerTabs.get(activeLayer.type) || [];
              const activeTabId = this.layerActiveTabId.get(activeLayer.type);
              const tab = tabs.find(t => t.id === activeTabId);
              const tilesetEntry: LayerTilesetEntry = {
                image: img,
                fileName: file.name,
                columns,
                rows,
                count,
                tileWidth,
                tileHeight,
                spacing: 0,
                margin: 0,
                sourcePath: this.extractFileSourcePath(file)
              };
              if (tab) {
                tab.tileset = tilesetEntry;
              } else {
                // fallback: store in layerTilesets but do not apply/palette
                this.layerTilesets.set(activeLayer.type, tilesetEntry);
              }
              this.draw();
              return;
            }

            // Store tileset under the active layer so tilesets are per-layer (and thus per-map/tab)
            const newTilesetEntry = {
              image: img,
              fileName: file.name,
              columns,
              rows,
              count,
              tileWidth,
              tileHeight,
              spacing: 0,
              margin: 0,
              sourcePath: this.extractFileSourcePath(file)
            };
            
            // Update both global layerTilesets AND active tab's tileset
            this.layerTilesets.set(activeLayer.type, newTilesetEntry);
            
            // Also update the active tab's tileset for per-map storage
            const tabs = this.layerTabs.get(activeLayer.type) || [];
            const activeTabId = this.layerActiveTabId.get(activeLayer.type);
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab) {
              activeTab.tileset = newTilesetEntry;
            }

            // If there is no saved detected tile mapping for this layer, clear global detected data
            const hasLayerTileData = this.layerTileData.has(activeLayer.type);
            if (hasLayerTileData) {
              // load layer-specific detected tiles into detectedTileData for palette generation
              const layerTiles = this.layerTileData.get(activeLayer.type);
              this.detectedTileData.clear();
              if (layerTiles) {
                for (const [gid, data] of layerTiles.entries()) {
                  this.detectedTileData.set(gid, data);
                }
              }
              }
              // NOTE: If no saved layer data, do NOT clear detectedTileData! This preserves
              // other layers' tile info when importing a new tileset for a different layer.

            // Ensure the editor's current tileset/palette reflects the newly set layer tileset
            // `updateCurrentTileset` will load the layer tileset into the global display state
            // and rebuild the palette accordingly.
            try {
              this.updateCurrentTileset(activeLayer.type);
            } catch (_e) {
              // Fallback: attempt to create the palette directly if update fails
              void _e;
              this.createTilePalette(hasLayerTileData);
            }
            this.draw();
            return;
          }

          // Fallback: if no active layer, behave as legacy tileset upload
          this.tilesetImage = img;
          this.tilesetFileName = file.name;
          this.tilesetColumns = columns;
          this.tilesetRows = rows;
          this.tileCount = count;
          this.tilesetTileWidth = tileWidth;
          this.tilesetTileHeight = tileHeight;
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
      // Layer-specific tileset upload - preserve existing behavior (delegates to helper)
      const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (activeLayer) {
        this.setLayerTileset(activeLayer.type, file);
      }
    }
  }

  private setupPaletteEventDelegation(): void {
    const container = document.getElementById('tilesContainer');
    if (!container) {
      return;
    }

    // Remove old listeners if they exist
    if (this.paletteClickListener) {
      container.removeEventListener('click', this.paletteClickListener);
    }

    // Create a single delegated click listener for all palette tiles
    this.paletteClickListener = (e: Event) => {
      const event = e as MouseEvent;
      const target = event.target as HTMLElement;
      
      // Find the closest wrapper div
      const wrapper = target.closest('.brush-wrapper') as HTMLDivElement | null;
      if (!wrapper) {
        return;
      }

      // Get the tile index from data attribute or nearby canvas
      const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) {
        return;
      }

      const indexStr = canvas.getAttribute('data-tile-index');
      if (!indexStr) {
        return;
      }

      const tileIndex = parseInt(indexStr, 10);

      const brushToolElement = document.getElementById('brushToolState') || document.querySelector('[data-brush-tool]');
      const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';

      if (currentBrushTool === 'merge') {
        console.log('Handling merge tool selection (no auto-merge)');
        this.handleBrushMerge(tileIndex, wrapper);
        return;
      }

      if (currentBrushTool === 'separate') {
        console.log('Handling separate tool');
        this.handleBrushSeparate(tileIndex);
        return;
      }

      if (currentBrushTool === 'remove') {
        console.log('Handling remove tool');
        this.handleBrushRemove(tileIndex);
        return;
      }

      // Normal tile selection - support Ctrl/Cmd multi-select
      const isCtrl = (event.ctrlKey || event.metaKey);
      if (isCtrl) {
        if (this.multiSelectedBrushes.has(tileIndex)) {
          this.multiSelectedBrushes.delete(tileIndex);
          console.log(`[PALETTE] Ctrl+Click: deselected tile ${tileIndex}, multiSelectedBrushes.size now = ${this.multiSelectedBrushes.size}`);
        } else {
          this.multiSelectedBrushes.add(tileIndex);
          console.log(`[PALETTE] Ctrl+Click: selected tile ${tileIndex}, multiSelectedBrushes.size now = ${this.multiSelectedBrushes.size}`);
        }

        if (this.multiSelectedBrushes.size === 1) {
          const only = Array.from(this.multiSelectedBrushes.values())[0];
          this.setCurrentLayerActiveGid(only);
        }
        console.log(`[PALETTE] Current multiSelectedBrushes: [${Array.from(this.multiSelectedBrushes.values()).join(',')}]`);
        this.updateActiveTile();
        return;
      }

      // Single selection: clear multi-selection and select this tile
      console.log(`[PALETTE] Single click on tile ${tileIndex}, clearing multiSelectedBrushes (was size=${this.multiSelectedBrushes.size})`);
      this.multiSelectedBrushes.clear();
      this.setCurrentLayerActiveGid(tileIndex);
      this.updateActiveTile();
    };

    container.addEventListener('click', this.paletteClickListener as EventListener);
  }

  private paletteClickListener: ((e: Event) => void) | null = null;

  private createTilePaletteRetries = 0;
  private maxPaletteRetries = 10;

  private createTilePalette(preserveOrder: boolean = false): void {
    
    // Try to find or create the tilesContainer
    let container = document.getElementById('tilesContainer');
    
    if (!container) {
      // Container doesn't exist - this app uses React palette now
      // Try to find the palette wrapper or create a container
      const appMain = document.querySelector('[class*="flex"]') || document.body;
      
      // Create the container if it doesn't exist
      container = document.createElement('div');
      container.id = 'tilesContainer';
      container.className = 'tiles-grid';
      container.style.display = 'none'; // Hidden - used only for event delegation
      
      if (appMain && appMain !== document.body) {
        appMain.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
    }
    
    if (!this.tilesetImage) {
      return;
    }
    
    container.innerHTML = '';
    
    this.hideCollisionBrushTooltip(true);

    try {
      container.style.position = 'relative';
      container.style.overflow = 'auto';
      const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (activeLayer) {
        const tabs = this.layerTabs.get(activeLayer.type) || [];
        const activeTabId = this.layerActiveTabId.get(activeLayer.type);
        const tab = tabs.find(t => t.id === activeTabId);
        const hasDetectedAssets = Boolean(tab && tab.detectedTiles && tab.detectedTiles.size > 0);
        if (tab && tab.tileset && tab.tileset.image && !hasDetectedAssets) {
          // Append a full-size image so container scrollbars appear for large images
          const fullImg = (tab.tileset.image.cloneNode(true) as HTMLImageElement);
          fullImg.className = 'tileset-full-image';
          fullImg.draggable = false;
          fullImg.style.display = 'block';
          fullImg.style.position = 'absolute';
          fullImg.style.left = '0';
          fullImg.style.top = '0';
          fullImg.style.maxWidth = 'none';
          fullImg.style.maxHeight = 'none';
          fullImg.style.userSelect = 'none';
          fullImg.style.pointerEvents = 'none';
          // Ensure the full-size image sits above the UI overlay but below the SVG grid overlay
          fullImg.style.zIndex = '500';

          // Remove any previous grid overlay remnants
          const prevGrid = container.querySelectorAll('.tileset-grid-overlay, .tileset-full-image');
          prevGrid.forEach(n => n.remove());

          // append image first so scrollbars appear
          container.appendChild(fullImg);

          // Use the original tab.tileset.image to read natural sizes (more reliable)
          const srcImg = tab.tileset.image as HTMLImageElement;
          const imgW = (srcImg.naturalWidth || srcImg.width || (fullImg.naturalWidth || (fullImg as HTMLImageElement).width || 0));
          const imgH = (srcImg.naturalHeight || srcImg.height || (fullImg.naturalHeight || (fullImg as HTMLImageElement).height || 0));
          // If sizes are not yet available, wait for the image to load and re-run overlay setup
          if (imgW <= 0 || imgH <= 0) {
            fullImg.addEventListener('load', () => { try { this.refreshTilePalette(true); } catch (_err) { void _err; } });
            // still return; on next refresh we'll build the grid
            return;
          }

          const NS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(NS, 'svg');
          svg.setAttribute('width', String(imgW));
          svg.setAttribute('height', String(imgH));
          svg.setAttribute('viewBox', `0 0 ${imgW} ${imgH}`);
          svg.classList.add('tileset-grid-overlay');
          svg.style.position = 'absolute';
          svg.style.left = '0';
          svg.style.top = '0';
          svg.style.zIndex = '1000';
          svg.style.pointerEvents = 'auto';

          const cell = this.tileSizeX || 32; // square grid size (fallback 32)
          const cols = Math.ceil(imgW / cell);
          const rows = Math.ceil(imgH / cell);

          // Base grid: lightweight rects with low contrast, pointer-events none so
          // they do not intercept hover; we'll handle hover with a single highlight rect.
          for (let ry = 0; ry < rows; ry++) {
            for (let cx = 0; cx < cols; cx++) {
              const r = document.createElementNS(NS, 'rect');
              const x = cx * cell;
              const y = ry * cell;
              r.setAttribute('x', String(x));
              r.setAttribute('y', String(y));
              r.setAttribute('width', String(Math.min(cell, imgW - x)));
              r.setAttribute('height', String(Math.min(cell, imgH - y)));
// Base grid cell: no fill so underlying image remains visible; show light stroke lines
                r.setAttribute('fill', 'rgba(255,255,255,0)');
                r.setAttribute('stroke', 'rgba(0,0,0,0.06)');
                r.setAttribute('stroke-width', '0.4');
                r.style.pointerEvents = 'none';
                svg.appendChild(r);
              }
            }

            // Single highlight rect that moves on pointermove for hover effect
            const highlight = document.createElementNS(NS, 'rect');
            highlight.setAttribute('fill', 'rgba(255,255,255,0)');
            highlight.setAttribute('stroke', 'rgba(0,0,0,0.14)');
            highlight.setAttribute('stroke-width', '1');
            highlight.style.transition = 'fill 120ms ease, stroke 120ms ease';
            highlight.style.pointerEvents = 'none';
            svg.appendChild(highlight);

            const onPointerMove = (ev: PointerEvent) => {
              const rect = svg.getBoundingClientRect();
              const x = Math.floor((ev.clientX - rect.left) / cell) * cell;
              const y = Math.floor((ev.clientY - rect.top) / cell) * cell;
              if (x < 0 || y < 0 || x >= imgW || y >= imgH) {
                highlight.setAttribute('fill', 'rgba(255,255,255,0)');
                return;
              }
              highlight.setAttribute('x', String(x));
              highlight.setAttribute('y', String(y));
              highlight.setAttribute('width', String(Math.min(cell, imgW - x)));
              highlight.setAttribute('height', String(Math.min(cell, imgH - y)));
              // Slightly brighten the hovered square to indicate selection (50% requested on hover)
              highlight.setAttribute('fill', 'rgba(255,255,255,0.25)');
          };

          const onPointerLeave = () => {
            highlight.setAttribute('fill', 'rgba(255,255,255,0)');
          };

          svg.addEventListener('pointermove', onPointerMove);
          svg.addEventListener('pointerleave', onPointerLeave);

          container.appendChild(svg);

          // Ensure scrollbars reflect full image size by expanding a spacer div
          const spacer = document.createElement('div');
          spacer.style.width = `${imgW}px`;
          spacer.style.height = `${imgH}px`;
          spacer.style.pointerEvents = 'none';
          spacer.className = 'tileset-grid-spacer';
          container.appendChild(spacer);
          // Skip the rest of the palette rendering - we're showing the big image view
          return;
        }
      }
    } catch (_err) { void _err; }

    let tilesToRender: Array<{index: number, sourceX: number, sourceY: number, width: number, height: number}>;
    
    if ((preserveOrder || this.detectedTileData.size > 0) && this.detectedTileData.size > 0) {
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
      
      // Prefer grid slicing when a tileset/columns/rows or explicit tile sizes are available.
      const useGridSlice = !!(this.tilesetColumns > 0 && this.tilesetRows > 0 && this.tilesetTileWidth && this.tilesetTileHeight);
      if (useGridSlice) {
        const tileW = this.tilesetTileWidth || this.tileSizeX;
        const tileH = this.tilesetTileHeight || this.tileSizeY;
        const cols = this.tilesetColumns || Math.max(1, Math.floor(this.tilesetImage.width / tileW));
        const rows = this.tilesetRows || Math.max(1, Math.floor(this.tilesetImage.height / tileH));
        let idx = 1;
        const gridTiles: Array<{ index: number; sourceX: number; sourceY: number; width: number; height: number }> = [];
        for (let ry = 0; ry < rows; ry++) {
          for (let cx = 0; cx < cols; cx++) {
            // Account for optional tileset origin offset when slicing
            const originX = (this as unknown as { tilesetOriginX?: number }).tilesetOriginX ?? 0;
            const originY = (this as unknown as { tilesetOriginY?: number }).tilesetOriginY ?? 0;
            const sx = Math.round(originX + cx * tileW);
            const sy = Math.round(originY + ry * tileH);
            const w = Math.min(tileW, this.tilesetImage.width - sx);
            const h = Math.min(tileH, this.tilesetImage.height - sy);
            gridTiles.push({ index: idx++, sourceX: sx, sourceY: sy, width: w, height: h });
          }
        }
        tilesToRender = gridTiles.map(tile => {
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
      } else {
        // Detect tiles with variable sizes
        const detectedTiles = this.tileDetector.detectVariableSizedTiles(this.tilesetImage);
        
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
      }
      
      // Also store the detected tiles in the current layer's data
      const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      if (activeLayer) {
        const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
        for (const [gid, data] of this.detectedTileData.entries()) {
          layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
        }
        this.layerTileData.set(activeLayer.type, layerTileMap);
        // Persist detected tiles into the active tab if present so switching tabs preserves them
        const tabs = this.layerTabs.get(activeLayer.type) || [];
        const activeTabId = this.layerActiveTabId.get(activeLayer.type);
        if (activeTabId) {
          const tab = tabs.find(t => t.id === activeTabId);
          if (tab) {
            tab.detectedTiles = new Map(layerTileMap);
          }
        }
        console.log(`Stored ${layerTileMap.size} newly detected tiles for layer type: ${activeLayer.type}`);
      }
    }
    
  // Helper to find the brush-tool state element. Prefer a stable id added by React
  // (`brushToolState`) but fall back to the data attribute selector for backward
  // compatibility.
  const getBrushToolEl = () => document.getElementById('brushToolState') || document.querySelector('[data-brush-tool]');
    
    for (const tile of tilesToRender) {
      const canvas = document.createElement('canvas');
      canvas.width = tile.width;
      canvas.height = tile.height;
      canvas.className = 'palette-tile';
      canvas.setAttribute('data-tile-index', tile.index.toString());
      
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
      
      // NOTE: Canvas click handling is now done via delegated event listener on #tilesContainer
      // This ensures that Ctrl+Click for multi-selection and other palette interactions work properly
      
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
      wrapper.addEventListener('mouseenter', (_event) => {
        const brushToolElement = document.querySelector('[data-brush-tool]');
        const currentBrushTool = brushToolElement?.getAttribute('data-brush-tool') || 'none';
        
        if (currentBrushTool === 'remove') {
          removeOverlay.style.display = 'flex';
        }
      });
      
      wrapper.addEventListener('mouseleave', () => {
        removeOverlay.style.display = 'none';
      });
      
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
    }

    // Setup delegated event listener NOW that container is populated
    this.setupPaletteEventDelegation();
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
    } catch (_error) { void _error; }
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
    const oldWidth = this.mapWidth;
    const oldHeight = this.mapHeight;
    this.mapWidth = width;
    this.mapHeight = height;
    
    // Resize layer data — tiles outside the new bounds are dropped (filled with 0)
    for (const layer of this.tileLayers) {
      const newData = new Array(width * height).fill(0);
      for (let y = 0; y < Math.min(height, oldHeight); y++) {
        for (let x = 0; x < Math.min(width, oldWidth); x++) {
          const oldIndex = y * oldWidth + x;
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
      'rules': 0,
      'actions': 1,
      'items': 2,
      'npc': 3,
      'enemy': 4,
      'event': 5,
      'collision': 6,
      'object': 7,
      'background': 8
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
      const tabs = this.layerTabs.get(activeLayer.type) || [];
      if (tabs.length > 0) {
        const resolvedTabId = this.getActiveLayerTabId(activeLayer.type) ?? tabs[0].id;
        this.setActiveLayerTab(activeLayer.type, resolvedTabId);
      } else {
        this.updateCurrentTileset(activeLayer.type);
      }
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

  public setCurrentProjectPath(path: string | null): void {
    this.currentProjectPath = path;
  }

  public getCurrentProjectPath(): string | null {
    return this.currentProjectPath;
  }

  public getMapName(): string {
    return this.mapName;
  }

  public setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    
    // Reinitialize collision data
    this.collisionData = new Array(width * height).fill(0);
    
    // Initialize all layers with fresh empty data for the new dimensions.
    // This method is called during new-map creation (after resetForNewProject),
    // so layer data must always start clean — never carry over from a previous map.
    this.tileLayers.forEach(layer => {
      layer.data = new Array(width * height).fill(0);
    });

    // Re-initialize per-layer cell tileset key arrays for the new dimensions
    for (const l of this.tileLayers) {
      this.layerCellTilesetKey.set(l.type, new Array(width * height).fill(null));
    }
    
    this.draw();
  }

  // Clear all tile data and objects on the map (reset to empty grid)
  public clearMapGrid(): void {
    try {
      // Log counts before clearing for debugging
      try {
        for (const layer of this.tileLayers) {
          const nonZero = layer.data.reduce((acc, v) => acc + (v && v > 0 ? 1 : 0), 0);
          console.log(`clearMapGrid: before clear layer=${layer.name} id=${layer.id} nonZero=${nonZero}`);
        }
      } catch (e) { void e; }

      this.collisionData = new Array(this.mapWidth * this.mapHeight).fill(0);
      for (const layer of this.tileLayers) {
        layer.data = new Array(this.mapWidth * this.mapHeight).fill(0);
      }
      // reset per-layer cell tileset keys
      for (const key of Array.from(this.layerCellTilesetKey.keys())) {
        this.layerCellTilesetKey.set(key, new Array(this.mapWidth * this.mapHeight).fill(null));
      }
      // clear objects, sprite objects and detected tiles
      this.objects = [];
      this.placedSpriteObjects.clear();
      try { this.detectedTileData.clear(); } catch { /* ignore */ }
      this.clearSelection();
      try {
        for (const layer of this.tileLayers) {
          const nonZero = layer.data.reduce((acc, v) => acc + (v && v > 0 ? 1 : 0), 0);
          console.log(`clearMapGrid: after clear layer=${layer.name} id=${layer.id} nonZero=${nonZero}`);
        }
      } catch (e) { void e; }
      this.draw();
    } catch (_e) {
      // eslint-disable-next-line no-console
      void _e;
    }
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

  public getGidAtHover(): number {
    const layer = this.getActiveLayer();
    if (!layer || this.hoverX < 0 || this.hoverY < 0) return 0;
    const index = this.hoverY * this.mapWidth + this.hoverX;
    return layer.data[index] || 0;
  }

  public getGidAt(x: number, y: number): number {
    const layer = this.getActiveLayer();
    if (!layer || x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) return 0;
    const index = y * this.mapWidth + x;
    return layer.data[index] || 0;
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

  // Clear any multi-selected brushes and reset to single brush selection
  public clearMultiSelectedBrushes(): void {
    if (this.multiSelectedBrushes.size > 0) {
      this.multiSelectedBrushes.clear();
      // Trigger a palette refresh to update the UI
      this.updateTilePaletteSelection();
    }
  }

  // Selection tool management methods
  public setCurrentSelectionTool(tool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular'): void {
    this.currentSelectionTool = tool;
    this.tool = 'selection'; // Set main tool mode to selection
  }

  public getCurrentSelectionTool(): 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular' {
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
  private npcRightClickCallback: ((npcId: number, screenX: number, screenY: number) => void) | null = null;
  private cellRightClickCallback: ((cellX: number, cellY: number, screenX: number, screenY: number) => void) | null = null;

  // Stamp tool state
  private stamps: Map<string, import('../types').Stamp> = new Map();
  private activeStamp: import('../types').Stamp | null = null;
  private stampPreview: { x: number; y: number; width: number; height: number; visible: boolean } = { x: 0, y: 0, width: 0, height: 0, visible: false };
  private stampCallback: ((stamps: import('../types').Stamp[]) => void) | null = null;
  private heroEditCallback: ((currentX: number, currentY: number, mapWidth: number, mapHeight: number, onConfirm: (x: number, y: number) => void) => void) | null = null;
  private eventEditCallback: ((eventId: number) => void) | null = null;
  private objectEditCallback: ((objectId: number) => void) | null = null;

  public setEyedropperCallback(callback: (() => void) | null): void {
    this.eyedropperCallback = callback;
  }

  public setObjectsChangedCallback(callback: ((objects: MapObject[]) => void) | null): void {
    this.objectsChangedCallback = callback;
    if (callback) {
      callback(this.getMapObjects());
    }
  }

  public setNpcRightClickCallback(callback: ((npcId: number, screenX: number, screenY: number) => void) | null): void {
    this.npcRightClickCallback = callback;
  }

  public setCellRightClickCallback(callback: ((cellX: number, cellY: number, screenX: number, screenY: number) => void) | null): void {
    this.cellRightClickCallback = callback;
  }

  // Stamp tool management methods
  public setStampTool(): void {
    this.tool = 'stamp';
    this.mapCanvas.style.cursor = 'crosshair';
    this.stampPreview = { x: 0, y: 0, width: 0, height: 0, visible: false };
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

  /**
   * Create a stamp from a tileset palette selection and activate it for placement.
   * Expected selection shape: { x, y, width, height, cols, rows } where sizes are pixels
   * These stamps should always be placed as individual tiles, not sprite objects.
   */
  public setTileSelection(selection: { x: number; y: number; width: number; height: number; cols: number; rows: number; tileWidth?: number; tileHeight?: number }): boolean {
    if (!selection || !this.tilesetImage) return false;

    // Prefer tile size provided by the palette selection (UI), then per-tileset metadata, then editor defaults
    const tileW = selection.tileWidth ?? this.tilesetTileWidth ?? this.tileSizeX;
    const tileH = selection.tileHeight ?? this.tilesetTileHeight ?? this.tileSizeY;
    const cols = this.tilesetColumns || Math.max(1, Math.floor(this.tilesetImage.width / tileW));

    // compute starting cell indices in the tileset
    const startCol = Math.round(selection.x / tileW);
    const startRow = Math.round(selection.y / tileH);
    const stampTiles: import('../types').StampTile[] = [];
    const currentLayerId = this.activeLayerId || 0;

    for (let ry = 0; ry < selection.rows; ry++) {
      for (let cx = 0; cx < selection.cols; cx++) {
        const cellCol = startCol + cx;
        const cellRow = startRow + ry;
        if (cellCol < 0 || cellRow < 0) continue;

        // More robust mapping: match detected tiles by source coordinates
        const expectedX = Math.round(cellCol * tileW);
        const expectedY = Math.round(cellRow * tileH);
        let foundGid: number | null = null;
        for (const [dGid, data] of this.detectedTileData.entries()) {
          if (Math.abs((data.sourceX || 0) - expectedX) <= 2 && Math.abs((data.sourceY || 0) - expectedY) <= 2) {
            foundGid = dGid;
            break;
          }
        }

        if (foundGid !== null) {
          stampTiles.push({ tileId: foundGid, layerId: currentLayerId, x: cx, y: ry });
        } else {
          // Fallback: always use grid-based formula if no detected mapping
          // This ensures multi-cell selections work even if tile detection is incomplete
          const gidFallback = cellRow * cols + cellCol + 1;
          stampTiles.push({ tileId: gidFallback, layerId: currentLayerId, x: cx, y: ry });
        }
      }
    }

    if (stampTiles.length === 0) return false;

    const stamp: import('../types').Stamp = {
      id: `tileset-${Date.now()}`,
      name: 'Tileset Selection',
      width: selection.cols,
      height: selection.rows,
      tiles: stampTiles,
      fromPaletteSelection: true  // Mark this so it places as individual tiles, not sprite objects
    };

    this.stamps.set(stamp.id, stamp);
    // Activate stamp for placement and switch tool to stamp
    this.setActiveStamp(stamp.id);
    this.setStampTool();
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

  public hasMovedDuringClick(): boolean {
    return this.hasMovedSinceClick;
  }

  public setStampCallback(callback: ((stamps: import('../types').Stamp[]) => void) | null): void {
    this.stampCallback = callback;
  }

  public setHeroEditCallback(callback: ((currentX: number, currentY: number, mapWidth: number, mapHeight: number, onConfirm: (x: number, y: number) => void) => void) | null): void {
    this.heroEditCallback = callback;
  }

  public setEventEditCallback(callback: ((eventId: number) => void) | null): void {
    this.eventEditCallback = callback;
  }

  public setObjectEditCallback(callback: ((objectId: number) => void) | null): void {
    this.objectEditCallback = callback;
  }

  private placeStamp(gridX: number, gridY: number): void {
    if (!this.activeStamp) return;

    // Get the target layer
    const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
    if (!activeLayer) return;
    
    // Check if this is an object layer that should use sprite-based rendering
    const isObjectLayer = this.objectLayerTypes.includes(activeLayer.type) || activeLayer.type === 'background';

    // Calculate the bounding box of the stamp in map coordinates to clamp placement
    // so all tiles fit within the map bounds
    if (this.orientation === 'isometric') {
      // For isometric, we need to find the extent of all target positions
      // Isometric mapping: targetX = gridX + cx + ry, targetY = gridY - cx + ry
      let minOffsetX = 0, maxOffsetX = 0, minOffsetY = 0, maxOffsetY = 0;
      
      for (const stampTile of this.activeStamp.tiles) {
        if (stampTile.tileId === 0) continue; // Skip placeholder tiles
        const cx = stampTile.x;
        const ry = stampTile.y;
        const offsetX = cx + ry;
        const offsetY = -cx + ry;
        minOffsetX = Math.min(minOffsetX, offsetX);
        maxOffsetX = Math.max(maxOffsetX, offsetX);
        minOffsetY = Math.min(minOffsetY, offsetY);
        maxOffsetY = Math.max(maxOffsetY, offsetY);
      }
      
      // For isometric, don't clamp at all - let individual tiles skip out of bounds
      // This allows free painting at all edges
      // (The placement loop will skip any tiles that go outside map bounds)
    } else {
      // Orthogonal: simple clamping based on stamp dimensions
      gridX = Math.max(0, Math.min(gridX, this.mapWidth - this.activeStamp.width));
      gridY = Math.max(0, Math.min(gridY, this.mapHeight - this.activeStamp.height));
    }

    const nonZeroTiles = this.activeStamp.tiles.filter(t => t.tileId !== 0);
    // Get the current tileset info
    const layerType = activeLayer.type;
    let tilesetFileName: string | null = null;
    const activeTabId = this.layerActiveTabId.get(layerType);
    const tabs = this.layerTabs.get(layerType) || [];
    if (activeTabId) {
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab && tab.tileset && tab.tileset.fileName) tilesetFileName = tab.tileset.fileName;
    }
    if (!tilesetFileName) {
      const lt = this.layerTilesets.get(layerType);
      if (lt && lt.fileName) tilesetFileName = lt.fileName;
    }
    if (!tilesetFileName && this.tilesetFileName) tilesetFileName = this.tilesetFileName;

    // For object/background layers with multi-cell or tall stamps, create a single sprite object
    // instead of writing individual tiles to each cell
    if (isObjectLayer && nonZeroTiles.length > 0) {
      // Check if any of the tiles are tall sprites
      let hasTallSprites = false;
      let combinedSourceX = Infinity, combinedSourceY = Infinity;
      let combinedMaxX = 0, combinedMaxY = 0;
      const primaryGid = nonZeroTiles[0].tileId;
      
      // Get tile data to determine if sprites are tall
      const layerTileData = this.layerTileData.get(layerType) || new Map();
      let activeTabDetectedTiles: Map<number, { sourceX: number; sourceY: number; width: number; height: number }> | null = null;
      if (activeTabId) {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.detectedTiles) {
          activeTabDetectedTiles = activeTab.detectedTiles as Map<number, { sourceX: number; sourceY: number; width: number; height: number }>;
        }
      }
      
      // Calculate the combined bounding box of all tiles in the stamp
      for (const stampTile of nonZeroTiles) {
        const tileData = layerTileData.get(stampTile.tileId) || 
                         activeTabDetectedTiles?.get(stampTile.tileId) ||
                         this.detectedTileData.get(stampTile.tileId);
        
       
        let sourceX: number, sourceY: number, width: number, height: number;
        
        if (tileData) {
          if (tileData.height > this.tallSpriteThreshold) {
            hasTallSprites = true;
          }
          sourceX = tileData.sourceX;
          sourceY = tileData.sourceY;
          width = tileData.width;
          height = tileData.height;
        } else {
          // Fallback: calculate source position using grid-based formula
          // This allows multi-cell stamps to combine even without explicit tile data
          const gid = stampTile.tileId - 1; // Convert to 0-based
          const cols = this.tilesetColumns || Math.max(1, Math.floor((this.tilesetImage?.width || this.tileSizeX) / this.tileSizeX));
          sourceX = (gid % cols) * this.tileSizeX;
          sourceY = Math.floor(gid / cols) * this.tileSizeY;
          width = this.tileSizeX;
          height = this.tileSizeY;
        }
        
        // Track the combined source region in the tileset
        combinedSourceX = Math.min(combinedSourceX, sourceX);
        combinedSourceY = Math.min(combinedSourceY, sourceY);
        combinedMaxX = Math.max(combinedMaxX, sourceX + width);
        combinedMaxY = Math.max(combinedMaxY, sourceY + height);
      }
   
      // If this is a multi-tile stamp or has tall sprites, create a single sprite object
      // But only if we have valid tile data for the stamps (combinedSourceX !== Infinity)
      if ((nonZeroTiles.length > 1 || hasTallSprites) && combinedSourceX !== Infinity) {
        // After bounds clamping above, gridX and gridY are already at the correct top-left position
        // No need to add offsets again - they're already accounted for in the clamping
        const anchorX = gridX;
        const anchorY = gridY;
        
        // Use the combined source bounds from all tiles
        const spriteWidth = combinedMaxX - combinedSourceX;
        const spriteHeight = combinedMaxY - combinedSourceY;
        const sourceX = combinedSourceX;
        const sourceY = combinedSourceY;
        
        // Create a sprite object entry
        let spriteObjects = this.placedSpriteObjects.get(layerType);
        if (!spriteObjects) {
          spriteObjects = [];
          this.placedSpriteObjects.set(layerType, spriteObjects);
        }
        
        // Remove any existing sprite object at this position
        const existingIndex = spriteObjects.findIndex(obj => obj.anchorX === anchorX && obj.anchorY === anchorY);
        if (existingIndex !== -1) {
          spriteObjects.splice(existingIndex, 1);
        }
        
        // ALSO clear old tiles in layer.data for the stamp region
        // This ensures old painted tiles are removed when placing a sprite object stamp
        for (const stampTile of this.activeStamp.tiles) {
          const targetX = gridX + stampTile.x;
          const targetY = gridY + stampTile.y;
          if (targetX >= 0 && targetX < this.mapWidth && targetY >= 0 && targetY < this.mapHeight) {
            const targetIndex = targetY * this.mapWidth + targetX;
            // Remove old sprite object at each cell
            const oldValue = activeLayer.data[targetIndex];
            if (oldValue && oldValue > 0) {
              this.removeSpriteObjectAt(activeLayer.type, targetX, targetY);
            }
            // Clear the layer data (will be rendered via sprite object instead)
            activeLayer.data[targetIndex] = 0;
          }
        }
        
        spriteObjects.push({
          id: this.nextSpriteObjectId++,
          anchorX,
          anchorY,
          gid: primaryGid,
          tilesetKey: tilesetFileName,
          width: spriteWidth,
          height: spriteHeight,
          sourceX,
          sourceY
        });
        
        this.saveState();
        this.draw();
        return;
      }
    }

    // Standard tile-based placement for ground tiles and non-tall sprites
    for (const stampTile of this.activeStamp.tiles) {
      let targetX: number;
      let targetY: number;
      
      if (this.orientation === 'isometric') {
        const cx = stampTile.x;
        const ry = stampTile.y;
        targetX = gridX + cx + ry;
        targetY = gridY - cx + ry;
      } else {
        targetX = gridX + stampTile.x;
        targetY = gridY + stampTile.y;
      }
      
      if (targetX < 0 || targetX >= this.mapWidth || targetY < 0 || targetY >= this.mapHeight) {
        continue;
      }
      
      const targetIndex = targetY * this.mapWidth + targetX;
      let targetLayer = this.tileLayers.find(l => l.id === stampTile.layerId);
      
      if (!targetLayer && this.activeLayerId !== null) {
        targetLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
      }

      if (targetLayer) {
        if (stampTile.tileId !== 0) {
          const effectivePaintMode = this.getEffectivePaintModeForLayer(targetLayer.type);
          // Phase 4: Paint mode branching
          if (effectivePaintMode === 'object') {
            // Object mode: create ObjectInstance for each stamp tile
            // instead of painting to layer.data
            const asset = this.resolveOrCreateAssetRecordForGid(stampTile.tileId, targetLayer.type);
            if (asset) {
              const instance: ObjectInstance = {
                id: `obj_${this.nextObjectInstanceId++}`,
                assetRecordId: asset.id,
                gridX: targetX,
                gridY: targetY,
                layerId: targetLayer.id.toString(),
                properties: {}
              };
              this.addObjectInstance(instance);
            }
          } else {
            // Ground mode: paint to layer.data as normal
            // Remove any existing sprite object at this position so the new stamp replaces it
            const existingValue = targetLayer.data[targetIndex];
            if (existingValue && existingValue > 0) {
              this.removeSpriteObjectAt(targetLayer.type, targetX, targetY);
            }

            targetLayer.data[targetIndex] = stampTile.tileId;
            try {
              const lType = targetLayer.type;
              let arr = this.layerCellTilesetKey.get(lType);
              if (!arr) {
                arr = new Array(this.mapWidth * this.mapHeight).fill(null);
                this.layerCellTilesetKey.set(lType, arr);
              }
              arr[targetIndex] = tilesetFileName;
            } catch (_e) { void _e; }
          }
        }
      }
    }

    this.saveState();
    this.draw();
  }

  /**
   * Remove a sprite object at a given position from the placedSpriteObjects storage.
   * Used when erasing tiles on object layers.
   */
  private removeSpriteObjectAt(layerType: string, x: number, y: number): void {
    const spriteObjects = this.placedSpriteObjects.get(layerType);
    if (!spriteObjects) return;
    
    // Remove sprite objects that:
    // 1. Have their anchor at this exact position, OR
    // 2. Cover this position (for multi-cell sprites)
    const indicesToRemove: number[] = [];
    
    for (let i = 0; i < spriteObjects.length; i++) {
      const obj = spriteObjects[i];
      
      // Check exact anchor match
      if (obj.anchorX === x && obj.anchorY === y) {
        indicesToRemove.push(i);
        continue;
      }
      
      // Check if this sprite covers the given position
      // Calculate sprite bounds in map cells
      const spriteWidthInCells = Math.ceil((obj.width || this.tileSizeX) / this.tileSizeX);
      const spriteHeightInCells = Math.ceil((obj.height || this.tileSizeY) / this.tileSizeY);
      
      const minX = obj.anchorX;
      const maxX = obj.anchorX + spriteWidthInCells - 1;
      const minY = obj.anchorY;
      const maxY = obj.anchorY + spriteHeightInCells - 1;
      
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        indicesToRemove.push(i);
      }
    }
    
    // Remove in reverse order to maintain correct indices
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      spriteObjects.splice(indicesToRemove[i], 1);
    }
  }

  /**
   * Build a simple stamp layout from the currently multi-selected brushes.
   * This arranges selected tiles into a compact grid (row-major) where each
   * cell corresponds to one map tile (using grid cell units). The tileIds
   * are placed in the order they were selected.
   */
  private buildStampFromMultiSelection(): Stamp | null {
    console.log(`[STAMP] buildStampFromMultiSelection called, multiSelectedBrushes=[${Array.from(this.multiSelectedBrushes.values()).join(',')}]`);
    if (this.multiSelectedBrushes.size === 0) {
      console.log(`[STAMP] No brushes selected, returning null`);
      return null;
    }
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

    console.log(`[STAMP] Built stamp with ${tiles.length} tiles, ${cols}x${rows} layout`);

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

    console.log(`placeMultiSelectionAt: starting at gridX=${gridX} gridY=${gridY} with ${stamp.tiles.length} tiles`);

    // Place each tile relative to gridX/gridY
    for (const t of stamp.tiles) {
      const targetX = gridX + t.x;
      const targetY = gridY + t.y;
      if (targetX < 0 || targetY < 0 || targetX >= this.mapWidth || targetY >= this.mapHeight) {
        console.log(`  [SKIP] tile at (${targetX}, ${targetY}) is out of bounds`);
        continue;
      }
      const index = targetY * this.mapWidth + targetX;
      const layer = this.tileLayers.find(l => l.id === (t.layerId || this.activeLayerId));
      if (layer) {
        const oldValue = layer.data[index];
        console.log(`  [PLACE] layer=${layer.name} (${targetX},${targetY}) index=${index} oldValue=${oldValue} newValue=${t.tileId}`);
        
        // Remove any existing sprite/object at this position so the new stamp replaces it
        try {
          const existing = layer.data[index];
          if (existing && existing > 0) {
            console.log(`    [REMOVE_OBJECT] removing sprite object at (${targetX}, ${targetY})`);
            this.removeSpriteObjectAt(layer.type, targetX, targetY);
          }
        } catch (e) { 
          console.error(`    [ERROR] failed to remove object:`, e);
          void e; 
        }

        layer.data[index] = t.tileId;
        console.log(`    [VERIFY] after set: layer.data[${index}] = ${layer.data[index]}`);

        // Record which tileset (tab) this painted cell came from so tabs don't collide
        try {
          const layerType = layer.type;
          let arr = this.layerCellTilesetKey.get(layerType);
          if (!arr) {
            arr = new Array(this.mapWidth * this.mapHeight).fill(null);
            this.layerCellTilesetKey.set(layerType, arr);
          }
          // Determine current active tab tileset fileName if available
          let tilesetFileName: string | null = null;
          const activeTabId = this.layerActiveTabId.get(layerType);
          const tabs = this.layerTabs.get(layerType) || [];
          if (activeTabId) {
            const tab = tabs.find(t2 => t2.id === activeTabId);
            if (tab && tab.tileset && tab.tileset.fileName) tilesetFileName = tab.tileset.fileName;
          }
          // Fallback to layer tileset or global tileset
          if (!tilesetFileName) {
            const lt = this.layerTilesets.get(layerType);
            if (lt && lt.fileName) tilesetFileName = lt.fileName;
          }
          if (!tilesetFileName && this.tilesetFileName) tilesetFileName = this.tilesetFileName;
          arr[index] = tilesetFileName;
        } catch (_e) { void _e; }

        // Legacy map-object creation applies to event/enemy/npc layers only.
        // Object layer uses ObjectInstances and should not create placeholder map objects.
        try {
          if (layer.type === 'event' || layer.type === 'enemy' || layer.type === 'npc') {
            if (t.tileId > 0) {
              this.createObjectFromTile(targetX, targetY, layer.type, t.tileId);
            } else {
              this.removeObjectAtPosition(targetX, targetY);
            }
          }
        } catch (e) { void e; }
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

  private isInSelection(x: number, y: number): boolean {
    if (!this.selection.active || this.selection.tiles.length === 0) {
      return true; // If no selection, all tiles are "in selection"
    }
    return this.selection.tiles.some(tile => tile.x === x && tile.y === y);
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

      // If a selection is active, only fill cells within the selection
      if (!this.isInSelection(x, y)) {
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
  private toggleSelectionCell(layer: TileLayer, x: number, y: number): void {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return;

    const existingIndex = this.selection.tiles.findIndex((tile) => tile.x === x && tile.y === y);

    if (existingIndex >= 0) {
      this.selection.tiles.splice(existingIndex, 1);
    } else {
      const index = y * this.mapWidth + x;
      const gid = layer.data[index];
      this.selection.tiles.push({ x, y, gid });
    }

    this.selection.active = this.selection.tiles.length > 0;
  }

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

  private normalizeTilesetKey(key: string | null | undefined): string | null {
    if (!key) return null;

    let normalized = this.normalizePath(key).trim();
    if (!normalized) return null;

    // Use basename to avoid path prefix differences.
    if (normalized.includes('/')) {
      normalized = normalized.split('/').pop() || normalized;
    }

    // Strip repeated tab prefixes (legacy/rehydrated keys can accumulate these).
    const uniqueKeyPattern = /^[a-zA-Z]+_tab\d+_/;
    while (uniqueKeyPattern.test(normalized)) {
      normalized = normalized.replace(uniqueKeyPattern, '');
    }

    return normalized || null;
  }

  private registerTilesetOffsetAliases(offsets: Map<string, number>, fileName: string, offset: number): void {
    if (!offsets.has(fileName)) {
      offsets.set(fileName, offset);
    }

    const normalized = this.normalizeTilesetKey(fileName);
    if (normalized && !offsets.has(normalized)) {
      offsets.set(normalized, offset);
    }
  }

  private resolveTilesetOffset(offsets: Map<string, number>, rawKey: string | null | undefined): number | undefined {
    if (!rawKey) return undefined;

    const direct = offsets.get(rawKey);
    if (typeof direct === 'number') return direct;

    const normalized = this.normalizeTilesetKey(rawKey);
    if (!normalized) return undefined;

    return offsets.get(normalized);
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

  // Layer-specific tileset management - now scoped per active tab
  public setLayerTileset(layerType: string, file: File, options?: { skipApply?: boolean }): void {
    if (layerType === COLLISION_LAYER_TYPE) return;
    console.log('setLayerTileset called', { layerType, fileName: file.name, options });
    const gidSnapshotBefore = this.snapshotLayerGids();
    const image = new Image();
    image.onload = () => {
      const columns = Math.max(1, Math.floor(image.width / this.tileSizeX));
      const rows = Math.max(1, Math.floor(image.height / this.tileSizeY));
      const count = Math.max(1, columns * rows);
      const tileWidth = columns > 0 ? Math.round(image.width / columns) : this.tileSizeX;
      const tileHeight = rows > 0 ? Math.round(image.height / rows) : this.tileSizeY;
      const sourcePath = this.extractFileSourcePath(file);

      const tilesetEntry: LayerTilesetEntry = {
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
      };

      // Store tileset in the ACTIVE TAB for this layer (not shared editor state)
      const activeTabId = this.layerActiveTabId.get(layerType);
      const tabs = this.layerTabs.get(layerType) || [];
      const activeTab = tabs.find(t => t.id === activeTabId);
      
      if (activeTab) {
        console.log(`setLayerTileset: storing tileset in tab ${activeTabId} for layer ${layerType}`);
        activeTab.tileset = tilesetEntry;
        if (!options || !options.skipApply) {
          // Also update the shared layerTilesets for immediate display
          this.layerTilesets.set(layerType, tilesetEntry);
        } else {
          console.log('setLayerTileset: skipApply requested - not applying tileset to shared layer state');
        }
      } else {
        // Fallback to shared state if no active tab (shouldn't happen normally)
        
        this.layerTilesets.set(layerType, tilesetEntry);
      }

      // Update current tileset if this is the active layer (only if not skipping apply)
      if ((!options || !options.skipApply)) {
        const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
        if (activeLayer && activeLayer.type === layerType) {
          this.updateCurrentTileset(layerType);
        }
      } else {
        console.log('setLayerTileset: not updating current tileset due to skipApply');
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

  public getLayerTilesetImage(layerType: string): HTMLImageElement | null {
    const tileset = this.getLayerTilesetOrFallback(layerType);
    return tileset?.image ?? null;
  }

  // Tab management API
  public createLayerTab(layerType: string, name?: string): number {
  // Collision layer should never have tabs - only use built-in tileset
  if (layerType === COLLISION_LAYER_TYPE) {
    return -1;
  }
  const tabs = this.layerTabs.get(layerType) || [];
  const id = this.nextLayerTabId++;
  // Initialize new tab with empty tileset/brush/detectedTiles to avoid inheriting previous tab data
  const tab: { id: number; name: string; data?: number[]; tileset?: LayerTilesetEntry; detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>; brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>; } = {
    id,
    name: name || `Tab ${tabs.length + 1}`,
    // Initialize with empty painted tile data array for this tab
    data: new Array(this.mapWidth * this.mapHeight).fill(0),
    // explicit empty structures so setActiveLayerTab clears palette when switching to this tab
    detectedTiles: new Map(),
    brushes: []
  };
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
    // First, save current layer's painting data to the previously active tab
    const currentActiveTabId = this.layerActiveTabId.get(layerType);
    if (currentActiveTabId !== undefined) {
      const tabs = this.layerTabs.get(layerType);
      const currentActiveTab = tabs?.find(t => t.id === currentActiveTabId);
      const layer = this.tileLayers.find(l => l.type === layerType);
      
      if (currentActiveTab && layer) {
        // Save the current layer's painting data to the current active tab
        currentActiveTab.data = [...layer.data];
      }
    }

    // Now switch to the new tab
    this.layerActiveTabId.set(layerType, tabId);
    
    // When switching active tab, update current tileset/palette to reflect tab's tileset if present
    const tabs = this.layerTabs.get(layerType);
    if (tabs) {
      const tab = tabs.find(t => t.id === tabId);
      const layer = this.tileLayers.find(l => l.type === layerType);
      
      if (tab && layer) {
        // Restore the tab's painting data to the layer
        if (tab.data) {
          layer.data = [...tab.data];
        } else {
          layer.data = new Array(this.mapWidth * this.mapHeight).fill(0);
        }
      }
      
      // Check if tab has tileset metadata (may be loading or already loaded)
      if (tab && tab.tileset) {
        if (tab.tileset.image) {
          // Image is ready - apply tileset immediately
          const columns = (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0)
            ? tab.tileset.columns
            : (tab.tileset.image ? Math.max(1, Math.floor(tab.tileset.image.width / this.tileSizeX)) : 1);
          const rows = (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0)
            ? tab.tileset.rows
            : (tab.tileset.image ? Math.max(1, Math.floor(tab.tileset.image.height / this.tileSizeY)) : 1);
          const count = (typeof tab.tileset.count === 'number' && tab.tileset.count > 0)
            ? tab.tileset.count
            : Math.max(1, columns * rows);
          const tileWidth = (typeof tab.tileset.tileWidth === 'number' && tab.tileset.tileWidth > 0)
            ? tab.tileset.tileWidth
            : (tab.tileset.image ? Math.round(tab.tileset.image.width / Math.max(1, columns)) : this.tileSizeX);
          const tileHeight = (typeof tab.tileset.tileHeight === 'number' && tab.tileset.tileHeight > 0)
            ? tab.tileset.tileHeight
            : (tab.tileset.image ? Math.round(tab.tileset.image.height / Math.max(1, rows)) : this.tileSizeY);
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
          // Load detected tiles from tab into per-layer map if present (don't clear global detected map)
          if (tab.detectedTiles) {
            const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
            for (const [gid, data] of tab.detectedTiles.entries()) {
              layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
            }
            this.layerTileData.set(layerType, layerTileMap);
          }
          this.updateCurrentTileset(layerType);
        } else {
          // Tab has tileset metadata but image is still loading
          // Check the cache first before waiting
          const cachedTileset = this.getCachedTilesetImage(layerType, tabId);
          if (cachedTileset) {
            // Use cached image - apply tileset immediately
            tab.tileset.image = cachedTileset.image;
            const columns = (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0)
              ? tab.tileset.columns
              : Math.max(1, Math.floor(cachedTileset.image.width / this.tileSizeX));
            const rows = (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0)
              ? tab.tileset.rows
              : Math.max(1, Math.floor(cachedTileset.image.height / this.tileSizeY));
            const count = (typeof tab.tileset.count === 'number' && tab.tileset.count > 0)
              ? tab.tileset.count
              : Math.max(1, columns * rows);
            const tileWidth = (typeof tab.tileset.tileWidth === 'number' && tab.tileset.tileWidth > 0)
              ? tab.tileset.tileWidth
              : Math.round(cachedTileset.image.width / Math.max(1, columns));
            const tileHeight = (typeof tab.tileset.tileHeight === 'number' && tab.tileset.tileHeight > 0)
              ? tab.tileset.tileHeight
              : Math.round(cachedTileset.image.height / Math.max(1, rows));
            this.layerTilesets.set(layerType, {
              image: cachedTileset.image,
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
            // Load detected tiles from tab into per-layer map if present
            if (tab.detectedTiles) {
              const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
              for (const [gid, data] of tab.detectedTiles.entries()) {
                layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
              }
              this.layerTileData.set(layerType, layerTileMap);
            }
            this.updateCurrentTileset(layerType);
          } else {
            // No cache available - wait for async loading
            // Store the tileset entry in layerTilesets even without image
            // The image will be updated when it finishes loading via the onload callback in loadProjectData
            this.layerTilesets.set(layerType, {
              image: null,
              fileName: tab.tileset.fileName ?? null,
              columns: tab.tileset.columns ?? 0,
              rows: tab.tileset.rows ?? 0,
              count: tab.tileset.count ?? 0,
              tileWidth: tab.tileset.tileWidth,
              tileHeight: tab.tileset.tileHeight,
              spacing: tab.tileset.spacing ?? 0,
              margin: tab.tileset.margin ?? 0,
              sourcePath: tab.tileset.sourcePath ?? null
            });
          
            // Load detected tiles from tab if present
            if (tab.detectedTiles) {
              const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
              for (const [gid, data] of tab.detectedTiles.entries()) {
                layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
              }
              this.layerTileData.set(layerType, layerTileMap);
            }
          }
        }
      } else if (tab) {
        // No tileset for this tab -> explicitly clear current tileset and palette
        // Delete any per-layer tileset so fallback isn't applied
        this.layerTilesets.delete(layerType);

        // Clear current display/state so new tab appears empty
        this.tilesetImage = null;
        this.tilesetFileName = null;
        this.tilesetColumns = 0;
        this.tilesetRows = 0;
        this.tileCount = 0;
        this.tilesetTileWidth = undefined;
        this.tilesetTileHeight = undefined;
        this.tilesetSpacing = undefined;
        this.tilesetMargin = undefined;

        // Load detected tiles from tab if present (may be empty Map)
        if (tab && tab.detectedTiles) {
          this.detectedTileData.clear();
          for (const [gid, data] of tab.detectedTiles.entries()) {
            this.detectedTileData.set(gid, data);
          }
          // Also ensure per-layer map is set
          const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
          for (const [gid, data] of tab.detectedTiles.entries()) {
            layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
          }
          this.layerTileData.set(layerType, layerTileMap);
        } else {
          this.detectedTileData.clear();
          this.layerTileData.delete(layerType);
        }

        // Reset active gid and palette UI
        this.updateActiveGid(0);
        this.clearTilePalette();
        this.draw();
        return;
      }
    }
    
    this.draw();
  }

  public importBrushImageToLayerTab(
    layerType: string,
    tabId: number,
    file: File,
    projectPath?: string,
    overrideSensitivity?: number,
    forceIsometric?: boolean,
    _manualTileWidth?: number,
    _manualTileHeight?: number,
    forceGridSlicing?: boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const tabs = this.layerTabs.get(layerType) || [];
          const tab = tabs.find(t => t.id === tabId);
          if (!tab) {
            return reject(new Error('Tab not found'));
          }
          if (!tab.brushes) tab.brushes = [];
          tab.brushes.push({ image: img as HTMLImageElement, fileName: file.name, width: img.width, height: img.height });
          // Fixed isometric tile dimensions — always 64x32
          const tileWidth = this.tileSizeX;
          const tileHeight = this.tileSizeY;
          const columns = Math.max(1, Math.floor(img.width / tileWidth));
          const rows = Math.max(1, Math.floor(img.height / tileHeight));
          const count = Math.max(1, columns * rows);
          const sourcePath = this.extractFileSourcePath(file);
          
          // Store just the filename (not full path) for tilesetImages key
          // The full path is stored in sourcePath for reference
          const justFileName = file.name;
          
          // If this tab has no tileset, optionally set it as tileset for quick use
          if (!tab.tileset) {
            tab.tileset = {
              image: img as HTMLImageElement,
              fileName: justFileName,
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
            tab.tileset.fileName = justFileName;
            tab.tileset.columns = columns;
            tab.tileset.rows = rows;
            tab.tileset.count = count;
            tab.tileset.tileWidth = tileWidth;
            tab.tileset.tileHeight = tileHeight;
            tab.tileset.spacing = 0;
            tab.tileset.margin = 0;
            tab.tileset.sourcePath = sourcePath;
          }

          // Populate detected tiles on import.
          // Prefer variable-size detection unless fixed-grid slicing is explicitly requested.
          const importedDetectedTiles = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
          let gidCounter = 1;

          if (!forceGridSlicing) {
            try {
              const prevTilesetImage = this.tilesetImage;
              this.tilesetImage = img as HTMLImageElement;
              const variableDetected = this.tileDetector.detectVariableSizedTiles(this.tilesetImage, overrideSensitivity, forceIsometric);
              this.tilesetImage = prevTilesetImage;

              const maxReasonable = Math.max(count * 4, 64);
              if (variableDetected.length > 0 && variableDetected.length <= maxReasonable) {
                for (const tile of variableDetected) {
                  importedDetectedTiles.set(gidCounter, {
                    sourceX: tile.sourceX,
                    sourceY: tile.sourceY,
                    width: tile.width,
                    height: tile.height,
                    originX: Math.floor(tile.width / 2),
                    originY: tile.height
                  });
                  gidCounter++;
                }
              }
            } catch (_e) {
              void _e;
            }
          }

          if (importedDetectedTiles.size === 0) {
            for (let row = 0; row < rows; row++) {
              for (let col = 0; col < columns; col++) {
                const sourceX = col * tileWidth;
                const sourceY = row * tileHeight;
                const width = Math.min(tileWidth, img.width - sourceX);
                const height = Math.min(tileHeight, img.height - sourceY);
                if (width <= 0 || height <= 0) continue;
                importedDetectedTiles.set(gidCounter, {
                  sourceX,
                  sourceY,
                  width,
                  height,
                  originX: Math.floor(width / 2),
                  originY: height
                });
                gidCounter++;
              }
            }
          }

          tab.detectedTiles = importedDetectedTiles;
          this.layerTileData.set(layerType, new Map(importedDetectedTiles));

          // If this is currently the active layer, keep global detected map in sync too.
          const activeLayer = this.tileLayers.find(l => l.id === this.activeLayerId);
          if (activeLayer?.type === layerType) {
            this.detectedTileData.clear();
            for (const [gid, data] of importedDetectedTiles.entries()) {
              this.detectedTileData.set(gid, data);
            }
          }

          // If this tab is active for the layer, update current tileset/palette
          const activeTabId = this.layerActiveTabId.get(layerType);
          if (activeTabId === tabId) {
            this.setActiveLayerTab(layerType, tabId);
          }
          
          // CRITICAL: Save tileset to map JSON file after import
          // This ensures each map's unique tilesets are persisted independently
          // Try provided path first, then fallback to stored currentProjectPath
          const pathToUse = projectPath || this.currentProjectPath;
          if (pathToUse) {
            this.saveTilesetToMapFile(pathToUse).catch((_err: unknown) => {
              // tileset save error handled elsewhere
            });
          }
          
          resolve();
        };
        img.onerror = (_err) => {
          void _err;
          reject(new Error('Failed to load brush image'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = (_err) => {
        void _err;
        reject(new Error('Failed to read image file'));
      };
      reader.readAsDataURL(file);
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
      // Remap any painted cells that referenced the removed tab's tileset
      try {
        const removedTilesetFile = removed[0] && removed[0].tileset ? removed[0].tileset.fileName : null;
        if (removedTilesetFile) {
          const arr = this.layerCellTilesetKey.get(layerType) || new Array(this.mapWidth * this.mapHeight).fill(null);
          for (let i = 0; i < arr.length; i++) {
            if (arr[i] === removedTilesetFile) {
              // Clear cell reference - painting remains but will fallback to layer default or be treated as empty
              arr[i] = null;
            }
          }
          this.layerCellTilesetKey.set(layerType, arr);
        }
      } catch (_e) { void _e; }
      // If removed active tab, set another as active
      const active = this.layerActiveTabId.get(layerType);
      if (active === tabId) {
        if (tabs.length > 0) {
          // Use setActiveLayerTab so the editor updates the current tileset/palette immediately
          try {
            this.setActiveLayerTab(layerType, tabs[0].id);
          } catch (_e) {
            // Fallback to direct set if something unexpected happens
            void _e;
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
    } else { void 0; }
  }

  public getActiveLayerTabId(layerType: string): number | null {
    const activeId = this.layerActiveTabId.get(layerType);
    if (typeof activeId === 'number') return activeId;

    const tabs = this.layerTabs.get(layerType) || [];
    if (tabs.length > 0) {
      const fallbackId = tabs[0].id;
      this.layerActiveTabId.set(layerType, fallbackId);
      return fallbackId;
    }

    return null;
  }

  public updateCurrentTileset(layerType: string): void {
    // For collision layer, ensure tileset is loaded first
    if (layerType === COLLISION_LAYER_TYPE && !this.layerTilesets.has(COLLISION_LAYER_TYPE)) {
      // If collision tileset is not loaded yet, start loading it
      if (!this.collisionTilesetLoading) {
        this.ensureCollisionTileset();
      }
      // If still loading, defer the palette update until the image is loaded
      // The image.onload callback will handle updating the palette
      if (this.collisionTilesetLoading) {
        return;
      }
    }
    
    const tileset = this.getLayerTilesetOrFallback(layerType);
    if (tileset) {
      const normalizedTileWidth = (typeof tileset.tileWidth === 'number' && tileset.tileWidth > 0)
        ? tileset.tileWidth
        : this.tileSizeX;
      const normalizedTileHeight = (typeof tileset.tileHeight === 'number' && tileset.tileHeight > 0)
        ? tileset.tileHeight
        : this.tileSizeY;
      const imgWidth = tileset.image?.width || 0;
      const imgHeight = tileset.image?.height || 0;
      const normalizedColumns = (typeof tileset.columns === 'number' && tileset.columns > 0)
        ? tileset.columns
        : Math.max(1, Math.floor(imgWidth / Math.max(1, normalizedTileWidth)));
      const normalizedRows = (typeof tileset.rows === 'number' && tileset.rows > 0)
        ? tileset.rows
        : Math.max(1, Math.floor(imgHeight / Math.max(1, normalizedTileHeight)));
      const normalizedCount = (typeof tileset.count === 'number' && tileset.count > 0)
        ? tileset.count
        : Math.max(1, normalizedColumns * normalizedRows);

      this.tilesetImage = tileset.image;
      this.tilesetFileName = tileset.fileName;
      this.tilesetColumns = normalizedColumns;
      this.tilesetRows = normalizedRows;
      this.tileCount = normalizedCount;
      this.tilesetTileWidth = normalizedTileWidth;
      this.tilesetTileHeight = normalizedTileHeight;
      this.tilesetSpacing = tileset.spacing ?? 0;
      this.tilesetMargin = tileset.margin ?? 0;
      this.tilesetSourcePath = tileset.sourcePath ?? this.tilesetSourcePath;
      // Apply optional origin offset for palette placement (stored on tab.tileset.originX/Y)
      (this as unknown as { tilesetOriginX?: number }).tilesetOriginX = (tileset as unknown as { originX?: number }).originX ?? 0;
      (this as unknown as { tilesetOriginY?: number }).tilesetOriginY = (tileset as unknown as { originY?: number }).originY ?? 0;
      
      // Update global detectedTileData using layer-level data first, then active-tab data.
      // On project reopen, sliced metadata may exist only on the active tab payload.
      const layerTiles = this.layerTileData.get(layerType);
      const tabs = this.layerTabs.get(layerType) || [];
      const activeTabId = this.layerActiveTabId.get(layerType);
      const activeTab = tabs.find(t => t.id === activeTabId);
      const activeTabTiles = activeTab?.detectedTiles as Map<number, {
        sourceX: number;
        sourceY: number;
        width: number;
        height: number;
        originX?: number;
        originY?: number;
      }> | undefined;
      const detectedTilesSource = (layerTiles && layerTiles.size > 0)
        ? layerTiles
        : activeTabTiles;

      if ((!layerTiles || layerTiles.size === 0) && activeTabTiles && activeTabTiles.size > 0) {
        // Keep layer cache in sync so subsequent refreshes don't regress to legacy grid slicing.
        this.layerTileData.set(layerType, new Map(activeTabTiles));
      }

      this.detectedTileData.clear();
      if (detectedTilesSource) {
        for (const [gid, data] of detectedTilesSource.entries()) {
          this.detectedTileData.set(gid, data);
        }
      }
      
  // Restore the active GID for this layer.
  // If no tile has ever been selected for this layer type, auto-select GID=1
  // so that painting is not silently blocked by getCurrentLayerActiveGid() === 0.
  let layerActiveGid = this.layerActiveGid.get(layerType) || 0;
  if (layerActiveGid === 0 && this.tileCount > 0) {
    layerActiveGid = 1;
    this.layerActiveGid.set(layerType, 1);
  }
  this.updateActiveGid(layerActiveGid);
      
      this.createTilePalette();
    } else {
      console.log('updateCurrentTileset: no tileset for layer', layerType);
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
        this.saveState();
        layer.data.fill(0);
        
        // Also remove all sprite objects for this layer to ensure a clean clear
        const spriteObjects = this.placedSpriteObjects.get(layer.type);
        if (spriteObjects) {
          spriteObjects.length = 0; // Clear the array
        }

        const instanceIds = this.getObjectInstancesByLayer(layer.id.toString()).map(inst => inst.id);
        for (const id of instanceIds) {
          this.removeObjectInstance(id);
        }
        
        this.markAsChanged();
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
      // Clear any per-cell tileset references for this layer
      try {
        this.layerCellTilesetKey.set(layerType, new Array(this.mapWidth * this.mapHeight).fill(null));
      } catch (_e) { void _e; }
      
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
    } catch (_error) {
      void _error;
      return false;
    }
  }

  private assignTilesetOffsets(tilesets: GlobalTilesetInfo[]): void {
    // Calculate cumulative offsets for each tileset.
    // Offset starts at 1 (0 is reserved for empty/no-tile), and each tileset
    // gets offset = cumulative count
    let currentOffset = 1;
    for (const tileset of tilesets) {
      tileset.offset = currentOffset;
      currentOffset += tileset.count;
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

  private getGidFromAssetRecordId(assetRecordId: string): number {
    const match = /^asset_(\d+)$/.exec(assetRecordId || '');
    if (!match) return 0;
    const gid = parseInt(match[1], 10);
    return Number.isFinite(gid) && gid > 0 ? gid : 0;
  }

  private resolveLocalGidFromAssetRecord(asset: AssetRecord | undefined, layerType: string, tilesetKey: string | null): number {
    if (!asset) return 0;

    // Prefer exact detected-tiles mapping from the active tab keyed by source rect.
    const tabs = this.layerTabs.get(layerType) || [];
    const activeTabId = this.layerActiveTabId.get(layerType);
    const activeTab = tabs.find(t => t.id === activeTabId);
    const detected = activeTab?.detectedTiles;
    if (detected && detected.size > 0) {
      for (const [gid, data] of detected.entries()) {
        if (
          data.sourceX === asset.sourceX &&
          data.sourceY === asset.sourceY &&
          data.width === asset.width &&
          data.height === asset.height
        ) {
          return gid;
        }
      }
    }

    // Fallback to grid-based gid computed from source position for this tileset.
    const targetTileset =
      (tilesetKey ? tabs.find(t => t.tileset?.fileName === tilesetKey)?.tileset : undefined)
      || activeTab?.tileset
      || this.layerTilesets.get(layerType)
      || this.getLayerTilesetOrFallback(layerType);

    if (targetTileset) {
      const tileW = (typeof targetTileset.tileWidth === 'number' && targetTileset.tileWidth > 0)
        ? targetTileset.tileWidth
        : this.tileSizeX;
      const tileH = (typeof targetTileset.tileHeight === 'number' && targetTileset.tileHeight > 0)
        ? targetTileset.tileHeight
        : this.tileSizeY;
      const cols = (typeof targetTileset.columns === 'number' && targetTileset.columns > 0)
        ? targetTileset.columns
        : Math.max(1, Math.floor((targetTileset.image?.width || this.tileSizeX) / Math.max(1, tileW)));

      const col = Math.floor(asset.sourceX / Math.max(1, tileW));
      const row = Math.floor(asset.sourceY / Math.max(1, tileH));
      if (col >= 0 && row >= 0) {
        const gid = row * cols + col + 1;
        if (gid > 0) return gid;
      }
    }

    // Last resort: legacy id-based mapping.
    return this.getGidFromAssetRecordId(asset.id);
  }

  private inferTilesetKeyFromAssetProfileId(profileId: string | undefined, layerType: string): string | null {
    if (profileId && profileId.startsWith('profile_')) {
      const key = profileId.slice('profile_'.length).trim();
      if (key) return key;
    }
    if (profileId && profileId.startsWith('legacy_')) {
      const key = profileId.slice('legacy_'.length).trim();
      if (key) return key;
    }
    const fallback = this.getLayerTilesetOrFallback(layerType);
    return fallback?.fileName ?? null;
  }

  private buildObjectLayerExportState(layer: TileLayer): { data: number[]; cellTilesetKeys: Array<string | null> } {
    const data = [...layer.data];
    const size = this.mapWidth * this.mapHeight;
    const existingKeys = this.layerCellTilesetKey.get(layer.type);
    const cellTilesetKeys: Array<string | null> = existingKeys ? [...existingKeys] : new Array(size).fill(null);

    const objectInstances = this.getObjectInstancesByLayer(layer.id.toString());
    for (const instance of objectInstances) {
      if (instance.gridX < 0 || instance.gridY < 0 || instance.gridX >= this.mapWidth || instance.gridY >= this.mapHeight) {
        continue;
      }

      const asset = this.getAssetRecord(instance.assetRecordId);
      const tilesetKey = this.inferTilesetKeyFromAssetProfileId(asset?.profileId, layer.type);
      const localGid = this.resolveLocalGidFromAssetRecord(asset, layer.type, tilesetKey);
      if (localGid <= 0) {
        continue;
      }

      const index = instance.gridY * this.mapWidth + instance.gridX;
      data[index] = localGid;

      if (tilesetKey) {
        cellTilesetKeys[index] = tilesetKey;
      }
    }

    // Backward compatibility for projects that still use legacy sprite objects.
    if (objectInstances.length === 0) {
      const legacyObjects = this.placedSpriteObjects.get(layer.type) || [];
      for (const legacy of legacyObjects) {
        if (legacy.anchorX < 0 || legacy.anchorY < 0 || legacy.anchorX >= this.mapWidth || legacy.anchorY >= this.mapHeight) {
          continue;
        }
        if (legacy.gid <= 0) {
          continue;
        }

        const index = legacy.anchorY * this.mapWidth + legacy.anchorX;
        data[index] = legacy.gid;
        if (legacy.tilesetKey) {
          cellTilesetKeys[index] = legacy.tilesetKey;
        }
      }
    }

    return { data, cellTilesetKeys };
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
    
    // Calculate proper offsets for each tileset
    this.assignTilesetOffsets(mapTilesets);
    
    const tilesetOffsets = new Map<string, number>();
    const tilesetLayerByKey = new Map<string, string>();
    for (const tileset of mapTilesets) {
      if (!tileset.fileName) continue;
      this.registerTilesetOffsetAliases(tilesetOffsets, tileset.fileName, tileset.offset);
      tilesetLayerByKey.set(tileset.fileName, tileset.layerType);
      const normalizedKey = this.normalizeTilesetKey(tileset.fileName);
      if (normalizedKey) {
        tilesetLayerByKey.set(normalizedKey, tileset.layerType);
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
      let exportLayerData = layer.data;
      let exportCellTilesetKeys = this.layerCellTilesetKey.get(layerType);

      if (layerType === 'object') {
        const objectExportState = this.buildObjectLayerExportState(layer);
        exportLayerData = objectExportState.data;
        exportCellTilesetKeys = objectExportState.cellTilesetKeys;
      }

      for (let y = 0; y < this.mapHeight; y++) {
        const row: string[] = [];
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          const localTileId = exportLayerData[index];
          let globalTileId = 0;
          if (localTileId > 0) {
            // Determine which tileset this specific cell belongs to (per-cell key set at paint time)
            const cellTilesetKey = exportCellTilesetKeys ? exportCellTilesetKeys[index] : (layerTileset ? layerTileset.fileName ?? null : null);
            let effectiveTilesetKey = cellTilesetKey;

            // Guard against cross-layer key leakage (e.g. background cells referencing object tileset keys).
            if (!isCollisionLayer && effectiveTilesetKey) {
              const normalizedCellKey = this.normalizeTilesetKey(effectiveTilesetKey);
              const resolvedCellLayerType = tilesetLayerByKey.get(effectiveTilesetKey)
                || (normalizedCellKey ? tilesetLayerByKey.get(normalizedCellKey) : undefined)
                || null;

              if (
                resolvedCellLayerType &&
                resolvedCellLayerType !== layerType &&
                layerTileset?.fileName
              ) {
                effectiveTilesetKey = layerTileset.fileName;
              }
            }

            let tilesetOffset = undefined as number | undefined;
            if (!isCollisionLayer && effectiveTilesetKey) {
              tilesetOffset = this.resolveTilesetOffset(tilesetOffsets, effectiveTilesetKey);
            }

            // Final fallback: use the layer's own tileset when per-cell key is missing/unresolvable.
            if (!isCollisionLayer && (tilesetOffset === undefined) && layerTileset?.fileName) {
              tilesetOffset = this.resolveTilesetOffset(tilesetOffsets, layerTileset.fileName);
            }

            if (tilesetOffset !== undefined && tilesetOffset >= 1) {
              globalTileId = tilesetOffset + (localTileId - 1);
            } else {
              // Fallback: if no tileset offset, write the local id directly
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
      // Write comment line with event name and optional description
      const eName = event.name || '';
      const eDesc = event.description || event.properties?._description || '';
      if (eName) {
        const commentLine = eDesc ? `#${eName} - ${eDesc}` : `#${eName}`;
        lines.push(commentLine);
      }
      lines.push(`[event]`);

      // activate (always first)
      const activate = event.properties.activate || event.activate || 'on_trigger';
      lines.push(`activate=${activate}`);

      // location
      if (event.properties.location) {
        lines.push(`location=${event.properties.location}`);
      } else if (event.x >= 0 && event.y >= 0) {
        lines.push(`location=${event.x},${event.y},${event.width},${event.height}`);
      }

      // hotspot
      if (event.properties.hotspot) {
        lines.push(`hotspot=${event.properties.hotspot}`);
      } else if (event.hotspot) {
        lines.push(`hotspot=${event.hotspot}`);
      }

      // tooltip (use event name if set)
      if (event.properties.tooltip) {
        lines.push(`tooltip=${event.properties.tooltip}`);
      } else if (event.name && event.name !== 'Event' && !event.name.startsWith('event_')) {
        lines.push(`tooltip=${event.name}`);
      } else if (event.tooltip) {
        lines.push(`tooltip=${event.tooltip}`);
      }

      // cooldown / delay
      if (event.properties.cooldown) lines.push(`cooldown=${event.properties.cooldown}`);
      if (event.properties.delay) lines.push(`delay=${event.properties.delay}`);

      // requirements
      const writeRepeatableEventProperty = (key: string) => {
        const value = event.properties[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && String(item).trim()) {
              lines.push(`${key}=${item}`);
            }
          }
        } else if (value) {
          lines.push(`${key}=${value}`);
        }
      };

      writeRepeatableEventProperty('requires_status');
      writeRepeatableEventProperty('requires_not_status');
      if (event.properties.requires_level) lines.push(`requires_level=${event.properties.requires_level}`);
      if (event.properties.requires_item) lines.push(`requires_item=${event.properties.requires_item}`);
      if (event.properties.requires_currency) lines.push(`requires_currency=${event.properties.requires_currency}`);
      if (event.properties.requires_not_currency) lines.push(`requires_not_currency=${event.properties.requires_not_currency}`);
      if (event.properties.requires_class) lines.push(`requires_class=${event.properties.requires_class}`);

      // actions / rewards
      if (event.properties.msg) lines.push(`msg=${event.properties.msg}`);
      if (event.properties.reward_xp) lines.push(`reward_xp=${event.properties.reward_xp}`);
      if (event.properties.reward_currency) lines.push(`reward_currency=${event.properties.reward_currency}`);
      if (event.properties.reward_item) lines.push(`reward_item=${event.properties.reward_item}`);
      if (event.properties.reward_loot) lines.push(`reward_loot=${event.properties.reward_loot}`);
      if (event.properties.reward_loot_count) lines.push(`reward_loot_count=${event.properties.reward_loot_count}`);
      if (event.properties.spawn) lines.push(`spawn=${event.properties.spawn}`);
      if (event.properties.set_status) lines.push(`set_status=${event.properties.set_status}`);
      if (event.properties.unset_status) lines.push(`unset_status=${event.properties.unset_status}`);
      if (event.properties.remove_item) lines.push(`remove_item=${event.properties.remove_item}`);
      if (event.properties.remove_currency) lines.push(`remove_currency=${event.properties.remove_currency}`);

      // teleport / map transitions
      if (event.properties.intermap) {
        lines.push(`intermap=${event.properties.intermap}`);
      } else if (event.intermap) {
        lines.push(`intermap=${event.intermap}`);
      }
      if (event.properties.intermap_random) lines.push(`intermap_random=${event.properties.intermap_random}`);
      if (event.properties.intramap) lines.push(`intramap=${event.properties.intramap}`);

      // sound / music / visual
      if (event.properties.soundfx) {
        lines.push(`soundfx=${event.properties.soundfx}`);
      } else if (event.soundfx) {
        lines.push(`soundfx=${event.soundfx}`);
      }
      if (event.properties.music) lines.push(`music=${event.properties.music}`);
      if (event.properties.shakycam) lines.push(`shakycam=${event.properties.shakycam}`);

      // map modifications
      if (event.properties.mapmod) {
        lines.push(`mapmod=${event.properties.mapmod}`);
      } else if (event.mapmod) {
        lines.push(`mapmod=${event.mapmod}`);
      }

      // npcs / loot
      if (event.properties.npc) lines.push(`npc=${event.properties.npc}`);
      if (event.properties.loot) {
        lines.push(`loot=${event.properties.loot}`);
      } else if (event.loot) {
        lines.push(`loot=${event.loot}`);
      }
      if (event.properties.loot_count) lines.push(`loot_count=${event.properties.loot_count}`);

      // power
      if (event.properties.power) lines.push(`power=${event.properties.power}`);
      if (event.properties.power_damage) lines.push(`power_damage=${event.properties.power_damage}`);
      if (event.properties.power_path) lines.push(`power_path=${event.properties.power_path}`);

      // engine/utility
      if (event.properties.chance_exec) lines.push(`chance_exec=${event.properties.chance_exec}`);
      if (event.properties.save_game) lines.push(`save_game=${event.properties.save_game}`);
      if (event.properties.script) lines.push(`script=${event.properties.script}`);
      if (event.properties.respec) lines.push(`respec=${event.properties.respec}`);
      if (event.properties.stash) lines.push(`stash=${event.properties.stash}`);
      if (event.properties.book) lines.push(`book=${event.properties.book}`);
      if (event.properties.restore) lines.push(`restore=${event.properties.restore}`);
      if (event.properties.cutscene) lines.push(`cutscene=${event.properties.cutscene}`);
      if (event.properties.parallax_layers) lines.push(`parallax_layers=${event.properties.parallax_layers}`);
      if (event.properties.random_status) lines.push(`random_status=${event.properties.random_status}`);
      if (event.properties.show_on_minimap) lines.push(`show_on_minimap=${event.properties.show_on_minimap}`);
      if (event.properties.reachable_from) lines.push(`reachable_from=${event.properties.reachable_from}`);

      // repeat
      if (event.properties.repeat !== undefined) {
        lines.push(`repeat=${event.properties.repeat}`);
      } else if (event.repeat !== undefined) {
        lines.push(`repeat=${event.repeat}`);
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

    const npcs = this.objects.filter(obj => obj.type === 'npc');
    for (const npc of npcs) {
      lines.push(`[npc]`);
      lines.push(`type=npc`);
      lines.push(`location=${npc.x},${npc.y},${npc.width},${npc.height}`);

      const npcFilename = npc.properties?.npcFilename;
      if (npcFilename) {
        lines.push(`filename=${npcFilename}`);
      } else {
        const sanitized = (npc.name || `npc_${npc.id}`)
          .toLowerCase()
          .replace(/[<>:"/\\|?*]/g, '_')
          .trim()
          .replace(/\s+/g, '_')
          .replace(/_{2,}/g, '_') || 'unnamed_npc';
        lines.push(`filename=npcs/${sanitized}.txt`);
      }

      const conditionKeys = [
        'requires_status', 'requires_not_status',
        'requires_level', 'requires_not_level',
        'requires_currency', 'requires_not_currency',
        'requires_item', 'requires_not_item',
        'requires_class', 'requires_not_class',
      ];
      for (const key of conditionKeys) {
        if (npc.properties?.[key]) {
          lines.push(`${key}=${npc.properties[key]}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  public generateFlareTilesetDef(_options: FlareExportOptions = {}): string {
    const lines: string[] = [];

    const globalTilesets = this.collectGlobalTilesets();
    const exportedTilesets = globalTilesets.filter(t => t.fileName && !this.isInternalTilesetFile(t.fileName));
    
    // Calculate proper offsets for each tileset
    this.assignTilesetOffsets(exportedTilesets);
    
    if (exportedTilesets.length === 0) {
      return '# No tilesets found - please load tilesets before exporting\n';
    }

    // Build strict per-tileset local-id lookup so tiles from one image can never
    // resolve rect/origin data from another image.
    const detectedByTileset = new Map<string, Map<number, { sourceX: number; sourceY: number; width: number; height: number }>>();
    for (const tileset of exportedTilesets) {
      if (!tileset.fileName) continue;
      const lookup = new Map<number, { sourceX: number; sourceY: number; width: number; height: number }>();

      // Primary source: layer-specific detected tiles for this exact tileset key.
      const matchingLayerTypes = new Set<string>();
      for (const [layerType, layerTileset] of this.layerTilesets.entries()) {
        const layerFileName = layerTileset?.fileName ?? null;
        if (!layerFileName) continue;
        if (layerFileName === tileset.fileName || this.normalizeTilesetKey(layerFileName) === this.normalizeTilesetKey(tileset.fileName)) {
          matchingLayerTypes.add(layerType);
        }
      }

      for (const layerType of matchingLayerTypes) {
        const layerMap = this.layerTileData.get(layerType);
        if (!layerMap) continue;
        for (const [gid, data] of layerMap.entries()) {
          lookup.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height });
        }
      }

      // Single-tileset legacy fallback only.
      if (lookup.size === 0 && exportedTilesets.length === 1 && this.detectedTileData && this.detectedTileData.size > 0) {
        for (const [gid, data] of this.detectedTileData.entries()) {
          lookup.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height });
        }
      }

      detectedByTileset.set(tileset.fileName, lookup);
    }

    // Emit vanilla-style sections: one [tileset] block per image.
    for (const tileset of exportedTilesets) {
      if (!tileset.fileName) continue;
      lines.push('[tileset]');
      lines.push(`img=images/tilesets/${tileset.fileName}`);

      const columns = Math.max(1, tileset.columns);
      const tileWidth = tileset.tileWidth || this.tileSizeX;
      const tileHeight = tileset.tileHeight || this.tileSizeY;
      const localLookup = detectedByTileset.get(tileset.fileName) || new Map<number, { sourceX: number; sourceY: number; width: number; height: number }>();

      for (let i = 0; i < tileset.count; i++) {
        const globalId = tileset.offset + i;
        const localId = i + 1;
        const detected = localLookup.get(localId);
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

      lines.push('');
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
    const detectedTiles = this.tileDetector.detectVariableSizedTiles(this.tilesetImage);

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
    } catch (_err) {
      void _err;
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
    } catch {
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

    // Notify about undo state change (for persistence)
    if (this.undoStateChangeCallback) {
      this.undoStateChangeCallback();
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

  /**
   * Set callback for undo state changes (used for persistence)
   */
  public setUndoStateChangeCallback(callback: (() => void) | null): void {
    this.undoStateChangeCallback = callback;
  }

  public triggerAutoSave(immediate: boolean = false): void {
    this.markAsChanged(immediate);
  }

  public setDarkMode(isDark: boolean): void {
    this.isDarkMode = isDark;
    this.draw(); // Redraw to apply new grid colors
  }

  private markAsChanged(immediate: boolean = false): void {
    this.hasUnsavedChanges = true;
    this.updateSaveStatus('unsaved');

    if (!this.autoSaveEnabled) return;

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

  public markAsSaved(): void {
    this.hasUnsavedChanges = false;
    this.lastSaveTimestamp = Date.now();
    this.updateSaveStatus('saved');
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
    } catch (_error) {
      void _error;
      this.updateSaveStatus('error');
      
      // Retry after a longer delay
      this.autoSaveTimeout = window.setTimeout(() => {
        this.performAutoSave();
      }, 15000); // 15 seconds retry delay
    }
  }

  private saveToLocalStorage(): void {
    try {
      // Convert layerTabs and layerActiveTabId Maps to serializable objects
      // Note: We store minimal tab info (id and name) since the full tileset/brush data
      // is reconstructed from the tileset when loaded
      const layerTabsObj: Record<string, Array<{ id: number; name?: string }>> = {};
      for (const [key, value] of this.layerTabs.entries()) {
        layerTabsObj[key] = value.map(tab => ({
          id: tab.id,
          name: tab.name
        }));
      }
      
      const layerActiveTabIdObj: Record<string, number> = {};
      for (const [key, value] of this.layerActiveTabId.entries()) {
        layerActiveTabIdObj[key] = value;
      }
      
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
        objectSeparationSensitivity: this.objectSeparationSensitivity,
        // Save tab state for proper restoration
        layerTabs: layerTabsObj,
        layerActiveTabId: layerActiveTabIdObj
      };

      // Crash backup is project-scoped and stored on disk: {projectPath}/backup/crash-backup.json
      const projectPath = this.currentProjectPath;
      if (projectPath && window.electronAPI?.saveCrashBackup) {
        void window.electronAPI.saveCrashBackup(projectPath, backupData);
      }
    } catch (_error) { void _error; }
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
    } catch (_e) {
      void _e;
      return '';
    }
  }

  public loadFromBackupData(backup: unknown): boolean {
    try {
      const data = backup as Record<string, unknown>;
      if (!data) return false;
      
      // Check if backup is recent (within last 24 hours)
      const timestamp = typeof data.timestamp === 'number' ? data.timestamp : 0;
      const age = Date.now() - timestamp;
      if (age > 24 * 60 * 60 * 1000) return false;

      this.mapWidth = typeof data.mapWidth === 'number' ? data.mapWidth : this.mapWidth;
      this.mapHeight = typeof data.mapHeight === 'number' ? data.mapHeight : this.mapHeight;
      this.tileLayers = (Array.isArray(data.layers) ? data.layers : this.tileLayers) as TileLayer[];
      const loadedObjects = this.normalizeLoadedObjects((Array.isArray(data.objects) ? data.objects : []) as MapObject[]);
      this.objects = loadedObjects;
      this.nextObjectId = this.calculateNextObjectId(loadedObjects);
      this.notifyObjectsChanged();
      this.tilesetFileName = (typeof data.tilesetFileName === 'string' ? data.tilesetFileName : null);
      if (typeof data.mapName === 'string') {
        this.setMapName(data.mapName as string);
      } else if (this.tilesetFileName) {
        this.setMapName(this.tilesetFileName.replace(/\.[^/.]+$/, ''));
      } else {
        this.setMapName('Untitled Map');
      }

      // Restore hero position if available
      if (typeof data.heroX === 'number' && typeof data.heroY === 'number') {
        this.heroX = Math.max(0, Math.min(data.heroX, this.mapWidth - 1));
        this.heroY = Math.max(0, Math.min(data.heroY, this.mapHeight - 1));
      } else {
        this.heroX = 0;
        this.heroY = 0;
      }

      // Restore brush-related settings if available
      if (typeof data.tileContentThreshold === 'number') {
        this.tileContentThreshold = data.tileContentThreshold;
      }
      if (typeof data.objectSeparationSensitivity === 'number') {
        this.objectSeparationSensitivity = data.objectSeparationSensitivity;
      }

      // Restore detectedTileData if available
      if (Array.isArray(data.detectedTileData)) {
        this.detectedTileData.clear();
        for (const entry of data.detectedTileData) {
          if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'number') {
            this.detectedTileData.set(entry[0], entry[1] as { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number });
          }
        }
      }

      // Restore layer tabs if available (tab state: id and name)
      if (data.layerTabs && typeof data.layerTabs === 'object') {
        this.layerTabs.clear();
        for (const [layerType, tabs] of Object.entries(data.layerTabs as Record<string, unknown>)) {
          if (Array.isArray(tabs)) {
            this.layerTabs.set(layerType, tabs.map(tab => ({
              id: (tab as { id: number }).id,
              name: typeof (tab as { name?: string }).name === 'string' ? (tab as { name: string }).name : '',
              tileset: undefined,
              detectedTiles: undefined,
              brushes: undefined
            })));
          }
        }
      }

      // Restore active tab id per layer if available
      if (data.layerActiveTabId && typeof data.layerActiveTabId === 'object') {
        this.layerActiveTabId.clear();
        for (const [layerType, tabId] of Object.entries(data.layerActiveTabId as Record<string, unknown>)) {
          if (typeof tabId === 'number') {
            this.layerActiveTabId.set(layerType, tabId);
          }
        }
      }

      // Restore tileset image if available
      if (typeof data.tilesetImage === 'string' && data.tilesetImage.length > 0) {
        const img = new Image();
        img.onload = () => {
          this.tilesetImage = img;
          // Reconstruct tileset metadata
          this.tilesetColumns = Math.floor(img.width / this.tileSizeX);
          this.tilesetRows = Math.floor(img.height / this.tileSizeY);
          this.tileCount = this.tilesetColumns * this.tilesetRows;
          
          // Create tile palette using preserved brush data if available
          if (Array.isArray(data.detectedTileData) && data.detectedTileData.length > 0) {
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
    } catch (_error) {
      void _error;
      return false;
    }
  }

  public clearCrashBackup(): void {
    try {
      if (this.currentProjectPath && window.electronAPI?.clearCrashBackup) {
        void window.electronAPI.clearCrashBackup(this.currentProjectPath);
      }
    } catch (_error) {
      void _error;
    }
  }

  // Save locking methods to prevent edits during save
  public lockSave(): void {
    this.isSaveLocked = true;
    this.saveLockCallback?.(true);
  }

  public unlockSave(): void {
    this.isSaveLocked = false;
    this.saveLockCallback?.(false);
  }

  public isSaveInProgress(): boolean {
    return this.isSaveLocked;
  }

  /** Mark the start/end of a tab switch so auto-save knows to stand down. */
  public setTabSwitching(switching: boolean): void {
    this.isTabSwitching = switching;
  }

  public getTabSwitching(): boolean {
    return this.isTabSwitching;
  }

  public setSaveLockCallback(callback: (locked: boolean) => void): void {
    this.saveLockCallback = callback;
  }

  public setManualSaveCallback(callback: (() => Promise<void>) | null): void {
    this.manualSaveCallback = callback;
  }

  /**
   * Save current map's tileset data to its JSON file
   * Called after importing a tileset - ensures each map's unique tilesets are persisted independently
   * Does NOT save painted tile data (that's autosave's job)
   * Does NOT save other map properties - ONLY tilesets
   */
  public async saveTilesetToMapFile(projectPath?: string): Promise<void> {
    // Use provided path, fall back to currentProjectPath, then mapName
    const targetPath = projectPath || this.currentProjectPath;
    
    if (!targetPath) {
      return;
    }

    // Get current project data (includes all tilesets)
    const projectData = this.getProjectData();
    
    // Ensure name is always a string
    if (!projectData.name) {
      projectData.name = this.mapName || 'Untitled Map';
    }
    
    // Save via Electron API (cast to bypass strict type checking)
    if (window.electronAPI?.saveMapProject) {
      await (window.electronAPI.saveMapProject as (path: string, data: unknown) => Promise<boolean>)(targetPath, projectData);
    }
  }

  // Save complete project data
  public async saveProjectData(projectPath: string): Promise<boolean> {
    try {
      // Log the state of all layer data BEFORE starting the save
      try {
        for (const layer of this.tileLayers) {
          const nonZero = layer.data.filter(v => v > 0).length;
          if (nonZero > 0) {
            const activeTabId = this.layerActiveTabId.get(layer.type);
            console.log(`[SAVE-PRE] layer="${layer.type}" has ${nonZero} painted tiles, activeTab=${activeTabId}`);
          }
        }
      } catch (_e) { void _e; }

      // Use getProjectData() to ensure all data (including layerTabs) is included
      await this.ensureTilesetsLoaded();
      const projectData = this.getProjectData();
      console.log('Project data prepared:', {
        name: projectData.name,
        tilesetCount: Object.keys(projectData.tilesetImages || {}).length,
        layerCount: (projectData.layers || []).length,
        layerTabsCount: Object.keys(projectData.layerTabs || {}).length,
        activeTabsCount: Object.keys(projectData.layerActiveTabId || {}).length
      });

      // Save using Electron API if available
      if (window.electronAPI?.saveMapProject) {
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
        return success;
      } else {
        console.log('Falling back to localStorage save...');
        // Fallback for web - just save to localStorage
        this.saveToLocalStorage();
        return true;
      }
    } catch (_error) {
      void _error;
      return false;
    }
  }

  // Return the current project data without writing to disk. This mirrors the
  // structure used by saveProjectData but is returned directly so the UI can
  // persist an in-memory snapshot (for tabs) without requiring a file save.
  public getProjectData(): EditorProjectData {
    // CRITICAL: Sync current layer's painting data to the active tab before saving
    // This ensures any unpainted tiles are included in the save
    for (const layerType of this.layerTabs.keys()) {
      const activeTabId = this.layerActiveTabId.get(layerType);
      if (activeTabId !== undefined) {
        const tabs = this.layerTabs.get(layerType);
        const activeTab = tabs?.find(t => t.id === activeTabId);
        const layer = this.tileLayers.find(l => l.type === layerType);
        
        if (activeTab && layer) {
          // Save the current layer's painted tiles to the active tab
          activeTab.data = [...layer.data];
          console.log(`[SAVE-SYNC] Synced painting data for tab ${activeTabId} (${activeTab.data.filter(v => v > 0).length} painted tiles)`);
        }
      }
    }

    const tilesetImages: Record<string, string> = {};
    const tilesets: SavedTilesetEntry[] = [];
    
    // Collect layer types that have tabs with tilesets - we'll skip these in the legacy layerTilesets loop
    // because their tilesets will be saved with unique keys from the layerTabs loop below
    const layersWithTabTilesets = new Set<string>();
    for (const [layerType, tabs] of this.layerTabs.entries()) {
      for (const t of tabs) {
        if (t.tileset && t.tileset.fileName) {
          layersWithTabTilesets.add(layerType);
          break;
        }
      }
    }

    for (const [layerType, tileset] of this.layerTilesets.entries()) {
      // Skip this layer if it has tabs with tilesets - they'll be saved with unique keys below
      if (layersWithTabTilesets.has(layerType)) {
        console.log('getProjectData: skipping layerTilesets entry (has tab tilesets)', { layerType });
        continue;
      }
      const fileName = tileset.fileName || null;
      const hasImage = !!tileset.image;
      const preloaded = fileName ? this._preloadedTilesetImages.get(fileName) : undefined;

      // Extract just the filename (not full path) for the key in tilesetImages
      const justFileName = fileName ? fileName.split('/').pop()?.split('\\').pop() || fileName : null;

      console.log('getProjectData: examining tileset entry', { layerType, fileName, justFileName, hasImage, hasPreloaded: !!preloaded, sourcePath: tileset.sourcePath });

      // If no fileName available skip
      if (!justFileName) {
        console.log('getProjectData: skipping tileset (no fileName)', { layerType });
        continue;
      }
      // Skip internal files (collision etc)
      if (this.isInternalTilesetFile(justFileName)) {
        console.log('getProjectData: skipping internal tileset file', { layerType, justFileName });
        continue;
      }

      // Prefer live image, fallback to preloaded image cache
      let imageToUse: HTMLImageElement | undefined;
      if (tileset.image) imageToUse = tileset.image as HTMLImageElement;
      else if (preloaded) imageToUse = preloaded as HTMLImageElement;

      if (!imageToUse) {
        console.log('getProjectData: no image available for tileset, skipping', { layerType, justFileName });
        continue;
      }

      try {
        tilesetImages[justFileName] = this.canvasToDataURL(imageToUse);
      } catch (_err) {
        void _err;
        continue;
      }

      tilesets.push({
        layerType,
        fileName: justFileName,
        name: justFileName.replace(/\.[^/.]+$/, ''),
        columns: tileset.columns,
        rows: tileset.rows,
        count: tileset.count,
        tileWidth: tileset.tileWidth ?? this.tileSizeX,
        tileHeight: tileset.tileHeight ?? this.tileSizeY,
        spacing: tileset.spacing ?? 0,
        margin: tileset.margin ?? 0,
        sourcePath: tileset.sourcePath ?? null,
        detectedTiles: this.getDetectedTilesForLayer(layerType)
      });
    }

    if (this.layerTilesets.size === 0 && this.tilesetFileName) {
      // Legacy/global tileset fallback: prefer live image, else check preloaded cache
      const legacyPreloaded = this._preloadedTilesetImages.get(this.tilesetFileName);
      const legacyImage = this.tilesetImage || legacyPreloaded;
      if (legacyImage) {
        try {
          tilesetImages[this.tilesetFileName] = this.canvasToDataURL(legacyImage);
        } catch (_err) { void _err; }
        tilesets.push({
          fileName: this.tilesetFileName,
          name: this.tilesetFileName.replace(/\.[^/.]+$/, ''),
          columns: this.tilesetColumns || Math.max(1, Math.floor((legacyImage as HTMLImageElement).width / this.tileSizeX)),
          rows: this.tilesetRows || Math.max(1, Math.floor((legacyImage as HTMLImageElement).height / this.tileSizeY)),
          count: this.tileCount || Math.max(1, (this.tilesetColumns || 1) * (this.tilesetRows || 1)),
          tileWidth: this.tilesetTileWidth ?? this.tileSizeX,
          tileHeight: this.tilesetTileHeight ?? this.tileSizeY,
          spacing: this.tilesetSpacing ?? 0,
          margin: this.tilesetMargin ?? 0,
          sourcePath: this.tilesetSourcePath ?? null,
          detectedTiles: Array.from(this.detectedTileData.entries())
        });
      } else {
        console.log('getProjectData: legacy tileset file present but no image available', { file: this.tilesetFileName });
      }
    }

    const projectData: EditorProjectData = {
      name: this.mapName,
      width: this.mapWidth,
      height: this.mapHeight,
      tileSize: this.tileSizeX,
      layers: this.getLayers(),
      objects: this.getMapObjects(),
      tilesets: tilesets.length > 0 ? tilesets : undefined,
      tilesetImages: Object.keys(tilesetImages).length > 0 ? tilesetImages : undefined,
      minimap: this.generateMinimapDataUrl?.() ?? undefined,
      minimapMode: this.minimapMode,
      version: '1.0',
      detectedTileData: this.detectedTileData.size > 0 ? Array.from(this.detectedTileData.entries()) : undefined,
      isStartingMap: this.isStartingMap,
      lastSaved: new Date().toISOString(),
      activeLayerId: this.activeLayerId,
      heroX: this.heroX,
      heroY: this.heroY
    };

    // Serialize per-layer tabs (tab names, per-tab painting data, tab-specific tileset metadata, detected tiles)
    // NOTE: Collision layer is NOT saved - it uses only the built-in collision tileset
    try {
      const tabsObj: Record<string, Array<{ id: number; name?: string; data?: number[]; tileset?: SavedTilesetEntry; detectedTiles?: SerializedDetectedTile[] }>> = {};
      for (const [layerType, tabs] of this.layerTabs.entries()) {
        // Skip collision layer - it should never have tabs
        if (layerType === COLLISION_LAYER_TYPE) continue;
        tabsObj[layerType] = tabs.map(t => {
          const ser: { id: number; name?: string; data?: number[]; tileset?: SavedTilesetEntry; detectedTiles?: SerializedDetectedTile[] } = { id: t.id, name: t.name };
          
          // Save per-tab painting data
          if (t.data && t.data.length > 0) {
            ser.data = [...t.data];
            console.log(`[SAVE] Tab ${t.id} (${t.name}): saving ${t.data.filter(v => v > 0).length} painted tiles`);
          }
          
          if (t.tileset) {
            // Embed the tab's tileset image into tilesetImages if available
            const fileName = t.tileset.fileName;
            // Extract just the filename (not full path) for the key in tilesetImages
            let justFileName = fileName ? fileName.split('/').pop()?.split('\\').pop() || fileName : '';
            
            // Strip any existing unique key prefix (e.g., "background_tab8_tileset.png" -> "tileset.png")
            // This prevents the key from being duplicated on re-save
            const uniqueKeyPattern = /^[a-zA-Z]+_tab\d+_/;
            while (uniqueKeyPattern.test(justFileName)) {
              justFileName = justFileName.replace(uniqueKeyPattern, '');
            }
            
            // Use unique key with layer type and tab ID to prevent collisions
            const uniqueKey = justFileName ? `${layerType}_tab${t.id}_${justFileName}` : '';
            if (uniqueKey && t.tileset.image && !this.isInternalTilesetFile(justFileName)) {
              try {
                // Always save with unique key (overwrite if exists)
                tilesetImages[uniqueKey] = this.canvasToDataURL(t.tileset.image as HTMLImageElement);
                console.log(`[SAVE] Saving tileset image with key: ${uniqueKey}`);
              } catch { void 0; }
            }

            ser.tileset = {
              fileName: uniqueKey || justFileName || '', // Store the unique key as fileName for lookup during load
              name: (justFileName || '').replace(/\.[^/.]+$/, ''),
              columns: t.tileset.columns,
              rows: t.tileset.rows,
              count: t.tileset.count,
              tileWidth: t.tileset.tileWidth,
              tileHeight: t.tileset.tileHeight,
              spacing: t.tileset.spacing,
              margin: t.tileset.margin,
              sourcePath: t.tileset.sourcePath ?? null,
              detectedTiles: t.detectedTiles ? Array.from(t.detectedTiles.entries()) : undefined,
              originX: (t.tileset as unknown as { originX?: number }).originX,
              originY: (t.tileset as unknown as { originY?: number }).originY
            };
          } else if (t.detectedTiles && t.detectedTiles.size > 0) {
            ser.detectedTiles = Array.from(t.detectedTiles.entries());
          }
          return ser;
        });
      }
      if (Object.keys(tabsObj).length > 0) {
        projectData.layerTabs = tabsObj;
      } else { void 0; }

      // Save active tab ids (skip collision layer - it should never have tabs)
      const activeObj: Record<string, number> = {};
      for (const [k, v] of this.layerActiveTabId.entries()) {
        // Skip collision layer - it should never have tabs
        if (k === COLLISION_LAYER_TYPE) continue;
        activeObj[k] = v;
      }
      if (Object.keys(activeObj).length > 0) {
        projectData.layerActiveTabId = activeObj;
      }

      // After the tabs loop has populated tilesetImages, assign it back to projectData.
      // (projectData.tilesetImages was set to undefined at construction time because tilesetImages
      // was empty then; the tabs loop fills it afterward, so we must re-assign here.)
      if (Object.keys(tilesetImages).length > 0) {
        projectData.tilesetImages = tilesetImages;
      }
    } catch { void 0; }

    // Debug summary: don't print full data URLs (they're large). Log counts and filename sizes.
    try {
      const imageKeys = Object.keys(projectData.tilesetImages || {});
      const imgSummary = imageKeys.map(k => ({ file: k, size: (projectData.tilesetImages?.[k]?.length ?? 0) }));
      console.log('getProjectData: summary', { tilesetCount: tilesets.length, tilesetImageCount: imageKeys.length, imgSummary });
    } catch (_err) {
      void _err;
    }

    // Serialize placed sprite objects only during transition when no objectInstances exist.
    // Once instances are present, avoid writing legacy sprite objects back out.
    if (this.placedSpriteObjects.size > 0 && this.objectInstances.size === 0) {
      const spriteObj: NonNullable<EditorProjectData['placedSpriteObjects']> = {};
      for (const [layerType, objs] of this.placedSpriteObjects.entries()) {
        if (objs.length > 0) {
          spriteObj[layerType] = objs.map(o => ({ ...o }));
        }
      }
      if (Object.keys(spriteObj).length > 0) {
        projectData.placedSpriteObjects = spriteObj;
      }
    }

    // Phase 1: Serialize asset records and object instances
    if (this.assetRecords.size > 0) {
      projectData.assetRecords = Array.from(this.assetRecords.values());
      console.log(`[SAVE] Serialized ${projectData.assetRecords.length} asset records`);
    }
    if (this.objectInstances.size > 0) {
      projectData.objectInstances = Array.from(this.objectInstances.values());
      console.log(`[SAVE] Serialized ${projectData.objectInstances.length} object instances`);
    }
    if (this.paintMode) {
      projectData.paintMode = this.paintMode;
    }

    // Phase 7: Bump schema to indicate object-instance migration support.
    projectData.dataSchemaVersion = '1.2';
    projectData.dataSchemaRevision = 2;

    return projectData;
  }

  // ============================================================================
  // Phase 2: Asset Record & Object Instance Accessors
  // ============================================================================

  private getSpatialCellKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private getAssetFootprint(asset: AssetRecord): { width: number; height: number } {
    return {
      width: Math.max(1, asset.footprintWidth ?? 1),
      height: Math.max(1, asset.footprintHeight ?? 1)
    };
  }

  private getCollisionFootprintSize(instance: ObjectInstance, asset: AssetRecord): { width: number; height: number } {
    return {
      width: Math.max(1, instance.collisionFootprintWidth ?? asset.collisionFootprintWidth ?? asset.footprintWidth ?? 1),
      height: Math.max(1, instance.collisionFootprintHeight ?? asset.collisionFootprintHeight ?? asset.footprintHeight ?? 1)
    };
  }

  private deindexObjectInstance(instanceId: string): void {
    const occupied = this.objectInstanceIndexCells.get(instanceId);
    if (!occupied) return;
    for (const cellKey of occupied) {
      const ids = this.objectInstanceCellIndex.get(cellKey);
      if (!ids) continue;
      ids.delete(instanceId);
      if (ids.size === 0) {
        this.objectInstanceCellIndex.delete(cellKey);
      }
    }
    this.objectInstanceIndexCells.delete(instanceId);
  }

  private indexObjectInstance(instance: ObjectInstance): void {
    const asset = this.assetRecords.get(instance.assetRecordId);
    if (!asset) return;

    const footprint = this.getAssetFootprint(asset);
    const occupied: string[] = [];
    for (let dx = 0; dx < footprint.width; dx++) {
      for (let dy = 0; dy < footprint.height; dy++) {
        const cellKey = this.getSpatialCellKey(instance.gridX + dx, instance.gridY + dy);
        let ids = this.objectInstanceCellIndex.get(cellKey);
        if (!ids) {
          ids = new Set<string>();
          this.objectInstanceCellIndex.set(cellKey, ids);
        }
        ids.add(instance.id);
        occupied.push(cellKey);
      }
    }
    this.objectInstanceIndexCells.set(instance.id, occupied);
  }

  private rebuildObjectInstanceSpatialIndex(): void {
    this.objectInstanceCellIndex.clear();
    this.objectInstanceIndexCells.clear();
    for (const instance of this.objectInstances.values()) {
      this.indexObjectInstance(instance);
    }
  }

  private migrateLegacyPlacedSpriteObjectsToInstances(): { migratedAssets: number; migratedInstances: number } {
    const legacyAssetIdBySignature = new Map<string, string>();
    let migratedAssets = 0;
    let migratedInstances = 0;

    for (const [layerType, legacyObjects] of this.placedSpriteObjects.entries()) {
      if (!Array.isArray(legacyObjects) || legacyObjects.length === 0) continue;
      const layer = this.tileLayers.find(l => l.type === layerType);
      if (!layer) continue;

      for (const legacyObj of legacyObjects) {
        const signature = [
          layerType,
          legacyObj.tilesetKey ?? 'legacy',
          legacyObj.sourceX,
          legacyObj.sourceY,
          legacyObj.width,
          legacyObj.height
        ].join('|');

        let assetId = legacyAssetIdBySignature.get(signature);
        if (!assetId) {
          assetId = `asset_${this.nextAssetRecordId++}`;
          const nowIso = new Date().toISOString();
          const asset: AssetRecord = {
            id: assetId,
            profileId: `legacy_${legacyObj.tilesetKey ?? layerType}`,
            name: `Migrated ${layerType} asset`,
            sourceX: legacyObj.sourceX,
            sourceY: legacyObj.sourceY,
            width: legacyObj.width,
            height: legacyObj.height,
            originX: Math.floor(legacyObj.width / 2),
            originY: legacyObj.height,
            anchorX: 1,
            anchorY: 1,
            footprintWidth: Math.max(1, Math.ceil(legacyObj.width / this.tileSizeX)),
            footprintHeight: Math.max(1, Math.ceil(legacyObj.height / this.tileSizeY)),
            category: layerType === 'collision' ? 'collision' : (layerType === 'background' ? 'ground' : 'object'),
            detectionConfidence: 1,
            userVerified: true,
            createdAt: nowIso,
            lastModified: nowIso
          };
          this.assetRecords.set(assetId, asset);
          legacyAssetIdBySignature.set(signature, assetId);
          migratedAssets++;
        }

        const instance: ObjectInstance = {
          id: `obj_${this.nextObjectInstanceId++}`,
          assetRecordId: assetId,
          gridX: legacyObj.anchorX,
          gridY: legacyObj.anchorY,
          layerId: layer.id.toString(),
          properties: {
            migratedFromLegacy: true,
            legacySpriteObjectId: legacyObj.id
          },
          createdAt: new Date().toISOString()
        };
        this.objectInstances.set(instance.id, instance);
        migratedInstances++;
      }
    }

    if (migratedInstances > 0) {
      this.rebuildObjectInstanceSpatialIndex();
    }

    return { migratedAssets, migratedInstances };
  }

  /**
   * Add or update an asset record
   */
  public addAssetRecord(asset: AssetRecord): void {
    if (!asset.id) {
      asset.id = `asset_${this.nextAssetRecordId++}`;
    } else {
      const m = String(asset.id).match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n >= this.nextAssetRecordId) {
          this.nextAssetRecordId = n + 1;
        }
      }
    }
    this.assetRecords.set(asset.id, asset);
    // Asset footprint/category edits can affect indexed bounds; rebuild to avoid stale occupancy.
    this.rebuildObjectInstanceSpatialIndex();
    console.log(`[ASSET] Added asset record: ${asset.id} (${asset.name || 'unnamed'})`);
  }

  /**
   * Get a single asset record by ID
   */
  public getAssetRecord(id: string): AssetRecord | undefined {
    return this.assetRecords.get(id);
  }

  /**
   * Get all asset records
   */
  public getAllAssetRecords(): AssetRecord[] {
    return Array.from(this.assetRecords.values());
  }

  /**
   * Add or update an object instance
   */
  public addObjectInstance(instance: ObjectInstance): void {
    if (instance.id) {
      this.deindexObjectInstance(instance.id);
    }
    if (!instance.id) {
      instance.id = `obj_${this.nextObjectInstanceId++}`;
    } else {
      const m = String(instance.id).match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n >= this.nextObjectInstanceId) {
          this.nextObjectInstanceId = n + 1;
        }
      }
    }
    this.objectInstances.set(instance.id, instance);
    this.indexObjectInstance(instance);
  }

  /**
   * Get a single object instance by ID
   */
  public getObjectInstance(id: string): ObjectInstance | undefined {
    return this.objectInstances.get(id);
  }

  /**
   * Get all object instances
   */
  public getAllObjectInstances(): ObjectInstance[] {
    return Array.from(this.objectInstances.values());
  }

  /**
   * Get all object instances on a specific layer
   */
  public getObjectInstancesByLayer(layerId: string): ObjectInstance[] {
    const matches: ObjectInstance[] = [];
    for (const inst of this.objectInstances.values()) {
      if (inst.layerId === layerId) matches.push(inst);
    }
    return matches;
  }

  /**
   * Remove an object instance by ID
   */
  public removeObjectInstance(id: string): boolean {
    this.deindexObjectInstance(id);
    const success = this.objectInstances.delete(id);
    return success;
  }

  /**
   * Set the current paint mode
   */
  public setPaintMode(mode: PaintMode): void {
    if (this.paintMode !== mode) {
      this.paintMode = mode;
      console.log(`[PAINT] Paint mode changed to: ${mode}`);
    }
  }

  /**
   * Get the current paint mode
   */
  public getPaintMode(): PaintMode {
    return this.paintMode;
  }

  private resolveOrCreateAssetRecordForGid(gid: number, layerType: string): AssetRecord | undefined {
    const id = `asset_${gid}`;
    const existing = this.getAssetRecord(id);
    if (existing) return existing;

    const tabs = this.layerTabs.get(layerType) || [];
    const activeTabId = this.layerActiveTabId.get(layerType);
    const activeTab = tabs.find(t => t.id === activeTabId);
    const tileData = activeTab?.detectedTiles?.get(gid) || this.detectedTileData.get(gid);
    if (!tileData) return undefined;

    const profileId = activeTab?.tileset?.fileName
      ? `profile_${activeTab.tileset.fileName}`
      : `profile_${layerType}`;

    const asset: AssetRecord = {
      id,
      profileId,
      name: `Asset ${gid}`,
      sourceX: tileData.sourceX,
      sourceY: tileData.sourceY,
      width: tileData.width,
      height: tileData.height,
      originX: tileData.originX ?? Math.floor(tileData.width / 2),
      originY: tileData.originY ?? tileData.height,
      anchorX: 1,
      anchorY: 1,
      footprintWidth: 1,
      footprintHeight: 1,
      category: layerType === 'object' ? 'object' : 'ground',
      detectionConfidence: 0.95,
      userVerified: false,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    this.addAssetRecord(asset);
    return asset;
  }

  private getEffectivePaintModeForLayer(layerType: string): PaintMode {
    return layerType === 'object' ? 'object' : 'ground';
  }

  /**
   * Get all object instances at or overlapping a specific grid coordinate
   * Phase 6: Used for collision/selection/eraser targeting with footprint-based bounds
   */
  public getObjectInstancesAtGridCoord(gridX: number, gridY: number): ObjectInstance[] {
    const ids = this.objectInstanceCellIndex.get(this.getSpatialCellKey(gridX, gridY));
    if (!ids || ids.size === 0) return [];
    const instances: ObjectInstance[] = [];
    for (const id of ids) {
      const inst = this.objectInstances.get(id);
      if (inst) instances.push(inst);
    }
    return instances;
  }

  /**
   * Get collision footprint for a grid cell
   * Phase 6: Returns the footprint cells occupied by collision assets at this location
   */
  public getCollisionFootprint(gridX: number, gridY: number): Array<{ x: number; y: number }> {
    const footprint: Array<{ x: number; y: number }> = [];
    
    // Check for ObjectInstances with collision footprints
    const instances = this.getObjectInstancesAtGridCoord(gridX, gridY);
    for (const instance of instances) {
      const asset = this.assetRecords.get(instance.assetRecordId);
      if (!asset) continue;

      const collisionSize = this.getCollisionFootprintSize(instance, asset);
      const footprintWidth = collisionSize.width;
      const footprintHeight = collisionSize.height;

      for (let fx = 0; fx < footprintWidth; fx++) {
        for (let fy = 0; fy < footprintHeight; fy++) {
          footprint.push({ x: instance.gridX + fx, y: instance.gridY + fy });
        }
      }
    }

    return footprint;
  }

  // Ensure any tileset images currently loading are finished before
  // producing a snapshot. This helps avoid race conditions where
  // `getProjectData()` is called while images are still in-flight.
  public async ensureTilesetsLoaded(timeoutMs = 2000): Promise<void> {
    const waiters: Promise<void>[] = [];

    const pushIfLoading = (img?: HTMLImageElement) => {
      if (!img) return;
      if (img.complete) return;
      waiters.push(new Promise<void>((resolve) => {
        const onFinish = () => {
          img.removeEventListener('load', onFinish);
          img.removeEventListener('error', onFinish);
          resolve();
        };
        img.addEventListener('load', onFinish);
        img.addEventListener('error', onFinish);
      }));
    };

    // Check per-layer tilesets
    try {
      for (const [, ts] of this.layerTilesets.entries()) {
        pushIfLoading(ts.image as HTMLImageElement | undefined);
      }
    } catch {
      // ignore
    }

    // Check single/global tileset image as fallback
    try {
      pushIfLoading(this.tilesetImage as HTMLImageElement | undefined);
    } catch {
      // ignore
    }

    if (waiters.length === 0) return;

    // Promise that resolves when all images finish or when timeout elapses
    await Promise.race([
      Promise.all(waiters).then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  }

  // Allow external code to provide a mapping of filename -> dataURL so the
  // editor can pre-load images that might not be present on disk yet (e.g.
  // in-memory tab snapshots). This will create Image objects and keep them
  // in a small cache so subsequent operations can use them.
  private _preloadedTilesetImages: Map<string, HTMLImageElement> = new Map();

  public setTilesetImages(images: Record<string, string>): void {
    try {
      for (const [file, dataUrl] of Object.entries(images)) {
        try {
          if (!dataUrl) continue;
          const existing = this._preloadedTilesetImages.get(file);
          if (existing && existing.src === dataUrl && existing.complete) continue;
          const img = new Image();
          img.onload = () => {
            console.log('Preloaded tileset image:', file, img.width + 'x' + img.height);
            this._preloadedTilesetImages.set(file, img);
          };
          img.onerror = () => {
            
          };
          img.src = dataUrl;
        } catch (_e) { void _e; }
      }
    } catch (_e) { void _e; }
  }

  // Helper to return the active layer's type (null if none)
  public getActiveLayerType(): string | null {
    try {
      const active = this.tileLayers.find(l => l.id === this.activeLayerId);
      return active ? active.type : null;
    } catch {
      return null;
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

  public addMapObject(type: 'event' | 'enemy' | 'npc', x: number, y: number, width: number = 1, height: number = 1): MapObject {
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
    } else if (type === 'npc') {
      object.category = 'npc';
      object.wander_radius = 0;
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

  public reorderMapObjects(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.objects.length || toIndex < 0 || toIndex >= this.objects.length || fromIndex === toIndex) return;
    const [item] = this.objects.splice(fromIndex, 1);
    this.objects.splice(toIndex, 0, item);
    this.saveState();
    this.notifyObjectsChanged();
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

    // Check if we're hovering over an event object
      const eventsAtHover = this.objects.filter(
        obj => obj.type === 'event' && obj.x >= 0 && obj.y >= 0 &&
          this.hoverX >= obj.x && this.hoverX < obj.x + obj.width &&
          this.hoverY >= obj.y && this.hoverY < obj.y + obj.height
      );
      if (eventsAtHover.length > 0) {
        // Clamp hoveredEventIndex
        if (this.hoveredEventIndex >= eventsAtHover.length) this.hoveredEventIndex = 0;
        const eventAtHover = eventsAtHover[this.hoveredEventIndex];
        this.mapCanvas.style.cursor = 'move';
        this.showObjectTooltip(eventAtHover, eventsAtHover.length);
        return;
      }
      this.hoveredEventIndex = 0;
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

  private showObjectTooltip(object: MapObject, eventCount: number = 1): void {
    // Create or update tooltip
    let tooltip = document.getElementById('object-tooltip') as HTMLElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'object-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.background = '#000000'; // Black background
      tooltip.style.padding = '6px 8px'; // Slightly adjusted padding
      tooltip.style.borderRadius = '6px'; // Shadcn style border radius
      tooltip.style.fontSize = '12px'; // Standard smaller text
      tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; 
      tooltip.style.lineHeight = '1.4'; // Normal line height
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '1000';
      tooltip.style.border = '1px solid rgba(156, 163, 175, 0.5)'; // Light gray stroke
      tooltip.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'; // Tailwind shadow-md
      document.body.appendChild(tooltip);
    }

// Lucide MousePointerClick SVG
      const mouseIcon = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
          <path d="M14 4.1 12 6" />
          <path d="m5.1 8-2.9-.8" />
          <path d="m6 12-1.9 2" />
          <path d="M7.2 2.2 8 5.1" />
          <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
        </svg>
      `;

      // Update tooltip content - larger bold name at top, smaller action text below
      const typeDisplay = object.type === 'enemy' ? object.category || 'enemy' : object.type;
      const title = typeDisplay === 'event' ? `${object.name || 'Unnamed'} (Event)` : (object.name || (typeDisplay.charAt(0).toUpperCase() + typeDisplay.slice(1)));
      
      // Lucide Mouse SVG (for scroll hint)
      const scrollIcon = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
          <rect x="6" y="3" width="12" height="18" rx="6" />
          <path d="M12 7v4" />
        </svg>
      `;

      const scrollLine = eventCount > 1 ? `
        <div style="font-size: 11px; display: flex; align-items: center; color: rgba(209, 213, 219, 0.8); margin-top: 2px;">
          ${scrollIcon}Scroll to switch
        </div>
      ` : '';

      tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: #ffffff; font-size: 13px;">${title}</div>
        <div style="font-size: 11px; display: flex; align-items: center; color: rgba(209, 213, 219, 0.8);">
          ${mouseIcon}Click to edit
        </div>
        ${scrollLine}
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
      tooltip.style.background = '#000000'; // Black background
      tooltip.style.padding = '6px 8px'; // Slightly adjusted padding
      tooltip.style.borderRadius = '6px'; // Shadcn style border radius
      tooltip.style.fontSize = '12px'; // Standard smaller text
      tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; 
      tooltip.style.lineHeight = '1.4'; // Normal line height
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '1000';
      tooltip.style.border = '1px solid rgba(156, 163, 175, 0.5)'; // Light gray stroke
      tooltip.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'; // Tailwind shadow-md
      document.body.appendChild(tooltip);
    }

// Lucide MousePointerClick SVG
      const mouseIcon = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
          <path d="M14 4.1 12 6" />
          <path d="m5.1 8-2.9-.8" />
          <path d="m6 12-1.9 2" />
          <path d="M7.2 2.2 8 5.1" />
          <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
        </svg>
      `;
  
      const label = actorType === 'npc' ? 'NPC' : 'Enemy';
      const name = object.name || label;
      const title = actorType === 'npc' ? `${name}  (NPC)` : name;
  
      tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: #ffffff; font-size: 13px;">${title}</div>
        <div style="font-size: 11px; display: flex; align-items: center; color: rgba(209, 213, 219, 0.8);">
          ${mouseIcon}Click to edit
        </div>
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
      tooltip.style.background = '#000000'; // Black background
      tooltip.style.padding = '6px 8px'; // Slightly adjusted padding
      tooltip.style.borderRadius = '6px'; // Shadcn style border radius
      tooltip.style.fontSize = '12px'; // Standard smaller text
      tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; 
      tooltip.style.lineHeight = '1.4'; // Normal line height
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '1000';
      tooltip.style.border = '1px solid rgba(156, 163, 175, 0.5)'; // Light gray stroke
      tooltip.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'; // Tailwind shadow-md
      document.body.appendChild(tooltip);
    }

// Lucide MousePointerClick SVG
      const mouseIcon = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
          <path d="M14 4.1 12 6" />
          <path d="m5.1 8-2.9-.8" />
          <path d="m6 12-1.9 2" />
          <path d="M7.2 2.2 8 5.1" />
          <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
        </svg>
      `;
  
      // Update tooltip content with hero-specific information
      tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: #ffffff; font-size: 13px;">Hero Position</div>
        <div style="font-size: 11px; color: rgba(209, 213, 219, 0.8); margin-bottom: 4px;">Position: (${this.heroX}, ${this.heroY})</div>
        <div style="font-size: 11px; display: flex; align-items: center; color: rgba(209, 213, 219, 0.8);">
          ${mouseIcon}Click to edit or drag to move
        </div>
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
    let objectType: 'event' | 'enemy' | 'npc';
    if (layerType === 'event') {
      objectType = 'event';
    } else if (layerType === 'npc') {
      objectType = 'npc';
    } else if (layerType === 'enemy' || layerType === 'object') {
      objectType = 'enemy';
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

  /**
   * Save current layer tilesets to project-level storage.
   * This preserves imported tilesets across different maps in the same project.
   * Excludes collision layer tilesets (which are internal and regenerated per-map).
   */
  private saveCurrentTilesetsToProjectLevel(): void {
    for (const [layerType, tilesetEntry] of this.layerTilesets.entries()) {
      // Skip collision layer - it's regenerated per-map as needed
      if (layerType === COLLISION_LAYER_TYPE) continue;
      
      // Store the tileset entry in project-level storage
      // The image reference is preserved (not cloned) for performance
      this.projectTilesets.set(layerType, tilesetEntry);
      console.log(`[PROJECT] Saved tileset for layer "${layerType}" to project storage`);
    }
  }

  /**
   * Restore project-level tilesets back to layer tilesets.
   * Called after creating default layers to make imported tilesets available.
   */
  private restoreProjectTilesetsToLayers(): void {
    for (const [layerType, tilesetEntry] of this.projectTilesets.entries()) {
      // Check if this layer type exists in the current map
      const layer = this.tileLayers.find(l => l.type === layerType);
      if (layer) {
        this.layerTilesets.set(layerType, tilesetEntry);
        console.log(`[PROJECT] Restored tileset for layer "${layerType}" from project storage`);
      }
    }
  }

  // Reset editor for a new project - clears all data and crash backup file
  public resetForNewProject(): void {
    // Clear project crash backup to prevent loading old data
    this.clearCrashBackup();
    
    // NOTE: Do NOT save tilesets to project-level here
    // Each map's tilesets should be stored in its own layerTabs
    // When switching between maps, setActiveLayerTab() will restore from layerTabs
    
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
    
    // Reset layer-specific tilesets (per-map data)
    this.layerTilesets.clear();

    // Clear placed sprite objects so they don't bleed into the new map visually
    this.placedSpriteObjects.clear();

    // Clear per-layer tile data (gid→sprite-rect mapping) to prevent stale
    // tile lookups from the previous map rendering on the new map
    this.layerTileData.clear();

    // Clear per-cell tileset key overrides from the previous map
    this.layerCellTilesetKey.clear();
    
    // Reset per-layer active GID so the new map starts with no tile pre-selected.
    // Without this, GIDs from the previous map bleed into the new map and may paint
    // with a GID that belongs to a different tileset.
    this.layerActiveGid.clear();
    
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
    this.stampPreview = { x: 0, y: 0, width: 0, height: 0, visible: false };
    
    // Reset auto-save state
    this.hasUnsavedChanges = false;
    this.lastSaveTimestamp = 0;
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    // Create default layers for new project
    this.createDefaultLayers();
    
    // NOTE: Do NOT restore project-level tilesets for new maps
    // New maps should start with an empty tileset palette
    // Project-level tilesets are only restored when loading existing maps via loadProjectData()
    
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
      
      // Clear existing state before loading new data (essential for tab switching)
      // This ensures old data doesn't persist when switching between tabs
      this.tileLayers = [];
      this.activeLayerId = null;
      this.layerTilesets.clear();
      this.objects = [];
      // Clear placed sprite objects so they don't bleed across map tabs
      this.placedSpriteObjects.clear();
      this.selectedObjectId = null;
      // Phase 1: Clear asset records and object instances from previous loading
      this.assetRecords.clear();
      this.objectInstances.clear();
      this.objectInstanceCellIndex.clear();
      this.objectInstanceIndexCells.clear();
      this.paintMode = 'ground'; // Reset to default paint mode

      if (projectData.minimapMode) {
        this.minimapMode = projectData.minimapMode;
      }
      
      this.selection = {
        active: false,
        startX: -1,
        startY: -1,
        endX: -1,
        endY: -1,
        tiles: []
      };
      this.stamps.clear();
      this.activeStamp = null;
      // Clear per-layer tile data (gid→sprite-rect mapping) so stale lookups
      // from the previous map don't affect rendering of the newly loaded map
      this.layerTileData.clear();
      // Clear per-cell tileset key overrides left over from the previous map
      this.layerCellTilesetKey.clear();
      // Clear per-layer active GID so loading a new map starts fresh (the auto-select
      // in updateCurrentTileset will pick GID=1 again when the tileset loads).
      this.layerActiveGid.clear();
      
      // Clear preloaded tileset cache to prevent contamination from previous maps
      this._preloadedTilesetImages.clear();
      
      // Log incoming tileset summary for debugging (keys and approximate sizes)
      try {
        const imgKeys = projectData.tilesetImages ? Object.keys(projectData.tilesetImages) : [];
        const imgInfo = imgKeys.map(k => ({ file: k, size: projectData.tilesetImages?.[k]?.length ?? 0 }));
        console.log('loadProjectData: incoming tileset summary', { tilesetsProvided: Array.isArray(projectData.tilesets) ? projectData.tilesets.length : 0, tilesetImageCount: imgKeys.length, imgInfo });
      } catch (_e) { void _e; }

      // Phase 0: Check schema version for backward-compatibility
      const schemaVersion = projectData.dataSchemaVersion || '1.0'; // Default to legacy if missing
      console.log(`[MIGRATION] Loading project with schema version: ${schemaVersion} (revision: ${projectData.dataSchemaRevision ?? 'undefined'})`);
      if (!projectData.dataSchemaVersion) {
        console.warn('[MIGRATION] Legacy map detected (no schema version). Will load using legacy tileset/detectedTiles data.');
      }
      
      // Restore brush-related settings and mapping if available
      if (projectData.tileContentThreshold !== undefined) {
        this.tileContentThreshold = projectData.tileContentThreshold;
      }
      if (projectData.objectSeparationSensitivity !== undefined) {
        this.objectSeparationSensitivity = projectData.objectSeparationSensitivity;
      }

      // Clear existing layer tilesets
      this.layerTilesets.clear();

      // Clear legacy/global tileset state to prevent stale tileset from previous map
      this.tilesetImage = null;
      this.tilesetFileName = null;
      this.tilesetColumns = 0;
      this.tilesetRows = 0;
      this.tileCount = 0;
      this.tilesetTileWidth = this.tileSizeX;
      this.tilesetTileHeight = this.tileSizeY;
      this.tilesetSpacing = 0;
      this.tilesetMargin = 0;
      this.tilesetSourcePath = null;

      // Restore per-layer tabs (if project saved them). This makes layer tab state
      // (tab names, per-tab tileset metadata and detected tiles) scoped to the
      // project being loaded instead of remaining in the shared editor instance.
      // CRITICAL: Always clear existing tabs to prevent data from previous map leaking
      this.layerTabs.clear();
      this.layerActiveTabId.clear();
      this._preloadedTilesetImages.clear();
      try {
        if (projectData.layerTabs && typeof projectData.layerTabs === 'object') {
          let maxTabId = this.nextLayerTabId || 1;
          for (const [layerType, tabs] of Object.entries(projectData.layerTabs)) {
            type RestoredTab = {
              id: number;
              name: string;
              data?: number[]; // Restored per-tab painting data
              tileset?: LayerTilesetEntry;
              detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>;
              brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>;
            };

            const arr: Array<RestoredTab> = [];
            for (const t of tabs || []) {
              const tabId = typeof t.id === 'number' ? t.id : (maxTabId++);
              const tabName = t.name || `Tab ${tabId}`;
              const tabObj: RestoredTab = { id: tabId, name: tabName };
              
              // Restore per-tab painting data if available
              if (t.data && Array.isArray(t.data)) {
                tabObj.data = [...t.data];
              } else {
                // Initialize with empty data if not present
                const mapWidth = projectData.width || 20;
                const mapHeight = projectData.height || 15;
                tabObj.data = new Array(mapWidth * mapHeight).fill(0);
              }
              
              // Rehydrate tileset metadata (do not embed large data URLs here)
              if (t.tileset && t.tileset.fileName) {
                const ts: LayerTilesetEntry = {
                  image: null,
                  fileName: t.tileset.fileName ?? null,
                  columns: t.tileset.columns ?? 0,
                  rows: t.tileset.rows ?? 0,
                  count: t.tileset.count ?? 0,
                  tileWidth: t.tileset.tileWidth,
                  tileHeight: t.tileset.tileHeight,
                  spacing: t.tileset.spacing ?? 0,
                  margin: t.tileset.margin ?? 0,
                  sourcePath: t.tileset.sourcePath ?? null
                };
                // restore optional origin if present
                try { (ts as unknown as { originX?: number }).originX = (t.tileset as unknown as { originX?: number }).originX ?? 0; } catch (_err) { void _err; }
                try { (ts as unknown as { originY?: number }).originY = (t.tileset as unknown as { originY?: number }).originY ?? 0; } catch (_err) { void _err; }
                // If we have a tileset image embedded in projectData.tilesetImages,
                // create an Image and attach to the tab so switching to the tab
                // restores the palette without relying on global editor state.
                try {
                  let fn = ts.fileName ?? '';
                  
                  // Strip any duplicated unique key prefixes that may have accumulated from previous buggy saves
                  // e.g., "background_tab8_background_tab8_tileset.png" -> "tileset.png"
                  const uniqueKeyPattern = /^[a-zA-Z]+_tab\d+_/;
                  while (uniqueKeyPattern.test(fn)) {
                    fn = fn.replace(uniqueKeyPattern, '');
                  }
                  
                  // Now construct the correct unique key
                  const lookupKey = `${layerType}_tab${t.id}_${fn}`;
                  
                  // Extract plain filename for backward compatibility lookups
                  let plainFileName = fn;
                  if (plainFileName.includes('/') || plainFileName.includes('\\')) {
                    plainFileName = plainFileName.split('/').pop()?.split('\\').pop() || plainFileName;
                  }
                  
                  // FIRST: Check if we have this tileset cached in memory (fastest)
                  const cachedTileset = this.getCachedTilesetImage(layerType, tabId);
                  if (cachedTileset) {
                    ts.image = cachedTileset.image;
                    tabObj.tileset = ts;
                    
                    // If this is the active tab, apply immediately
                    const activeTabIdCheck = this.layerActiveTabId.get(layerType);
                    if (activeTabIdCheck === tabId) {
                      this.layerTilesets.set(layerType, ts);
                      // We'll update the tileset display after all tabs are processed
                    }
                    
                    // Skip the async image loading since we have it cached
                    const serializedDetectedTiles =
                      (Array.isArray(t.detectedTiles)
                        ? t.detectedTiles
                        : (Array.isArray(t.tileset?.detectedTiles) ? t.tileset.detectedTiles : undefined)) as SerializedDetectedTile[] | undefined;

                    if (serializedDetectedTiles) {
                      const m = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
                      for (const pair of serializedDetectedTiles) {
                        const [gid, data] = pair as SerializedDetectedTile;
                        m.set(gid, {
                          sourceX: data.sourceX,
                          sourceY: data.sourceY,
                          width: data.width,
                          height: data.height,
                          originX: data.originX,
                          originY: data.originY
                        });
                      }
                      tabObj.detectedTiles = m;
                    }
                    arr.push(tabObj);
                    if (tabObj.id && tabObj.id > maxTabId) maxTabId = tabObj.id;
                    continue; // Skip to next tab
                  }
                  
                  // Try to find the tileset image - check unique key first, then fall back to plain filename
                  let imageDataUrl: string | null = null;
                  if (projectData.tilesetImages && projectData.tilesetImages[lookupKey]) {
                    imageDataUrl = projectData.tilesetImages[lookupKey];
                  } else if (projectData.tilesetImages && projectData.tilesetImages[plainFileName]) {
                    imageDataUrl = projectData.tilesetImages[plainFileName];
                  } else {
                    // Also try the original stored fileName in case it has a different unique key
                    const originalFn = ts.fileName ?? '';
                    if (projectData.tilesetImages && projectData.tilesetImages[originalFn]) {
                      imageDataUrl = projectData.tilesetImages[originalFn];
                    }
                  }
                  
                  if (imageDataUrl) {
                    const img = new Image();
                    // Set image immediately (it will load asynchronously from data URL)
                    ts.image = img;
                    // Capture variables for closure
                    const capturedLayerType = layerType;
                    const capturedTabId = tabId;
                    const capturedDataUrl = imageDataUrl;
                    img.onload = () => {
                      // Cache the loaded image for future tab switches
                      this.cacheTilesetImage(capturedLayerType, capturedTabId, img, capturedDataUrl);
                      // If this tab is active for the layer, apply its tileset immediately
                      try {
                        const activeTabId = this.layerActiveTabId.get(capturedLayerType);
                        if (activeTabId === capturedTabId) {
                          this.layerTilesets.set(capturedLayerType, ts);
                          this.updateCurrentTileset(capturedLayerType);
                        }
                      } catch (_e) { void _e; }
                    };
                    img.onerror = () => {
                    };
                    img.src = imageDataUrl;
                  } else {
                    // Fallback: load from sourcePath if available
                    const sourcePath = t.tileset.sourcePath;
                    if (sourcePath && window.electronAPI?.readFileAsDataURL) {
                      window.electronAPI.readFileAsDataURL(sourcePath)
                        .then((dataUrl) => {
                          if (!dataUrl) return;
                          const img = new Image();
                          ts.image = img;
                          // Capture variables for closure
                          const capturedLayerType = layerType;
                          const capturedTabId = tabId;
                          img.onload = () => {
                            // Cache the loaded image for future tab switches
                            this.cacheTilesetImage(capturedLayerType, capturedTabId, img, dataUrl);
                            try {
                              const activeTabId = this.layerActiveTabId.get(capturedLayerType);
                              if (activeTabId === capturedTabId) {
                                this.layerTilesets.set(capturedLayerType, ts);
                                this.updateCurrentTileset(capturedLayerType);
                              }
                            } catch (_e) { void _e; }
                          };
                          img.onerror = () => {
                          };
                          img.src = dataUrl;
                        })
                        .catch((_err: unknown) => {
                        });
                    }
                  }
                } catch { void 0; }
                tabObj.tileset = ts;
              }

              // Detected tiles serialized as arrays -> convert to Map for runtime use
              const serializedDetectedTiles =
                (Array.isArray(t.detectedTiles)
                  ? t.detectedTiles
                  : (Array.isArray(t.tileset?.detectedTiles) ? t.tileset.detectedTiles : undefined)) as SerializedDetectedTile[] | undefined;

              if (serializedDetectedTiles) {
                const m = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
                for (const pair of serializedDetectedTiles) {
                  const [gid, data] = pair as SerializedDetectedTile;
                  m.set(gid, {
                    sourceX: data.sourceX,
                    sourceY: data.sourceY,
                    width: data.width,
                    height: data.height,
                    originX: data.originX,
                    originY: data.originY
                  });
                }
                tabObj.detectedTiles = m;
              }
              arr.push(tabObj);
              if (tabObj.id && tabObj.id > maxTabId) maxTabId = tabObj.id;
            }
            this.layerTabs.set(layerType, arr);
          }
          // restore active tab mapping (skip collision layer - it should never have tabs)
          if (projectData.layerActiveTabId && typeof projectData.layerActiveTabId === 'object') {
            for (const [lt, id] of Object.entries(projectData.layerActiveTabId)) {
              // Skip collision layer - it should never have tabs
              if (lt === COLLISION_LAYER_TYPE) continue;
              if (typeof id === 'number') this.layerActiveTabId.set(lt, id);
            }
          }
          // Ensure each layer has an active tab id (fallback to first tab)
          for (const [lt, tabs] of this.layerTabs.entries()) {
            if (!this.layerActiveTabId.has(lt) && tabs.length > 0) {
              this.layerActiveTabId.set(lt, tabs[0].id);
            }
          }
          this.nextLayerTabId = (maxTabId || 1) + 1;
        }
      } catch (_e) { void _e; }

      // Load tilesets first (both legacy and per-layer)
      if (projectData.tilesets && Array.isArray(projectData.tilesets)) {
        let loadedCount = 0;
        const totalTilesets = projectData.tilesets.length;
        
        for (const tilesetData of projectData.tilesets) {
          if (tilesetData.fileName && projectData.tilesetImages && projectData.tilesetImages[tilesetData.fileName]) {
            const dataURL = projectData.tilesetImages[tilesetData.fileName];
            
            // Load the tileset image
            const img = new Image();
            img.onload = () => {
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
              } else {
                // Legacy tileset: keep for debugging but do not auto-apply
              }

              // Restore per-layer detected tile data if available
              if (tilesetData.detectedTiles && Array.isArray(tilesetData.detectedTiles)) {

                if (tilesetData.layerType) {
                  // Store tiles specifically for this layer type
                  const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
                  for (const [gid, data] of tilesetData.detectedTiles) {
                    const d = data as { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number };
                    layerTileMap.set(gid, { sourceX: d.sourceX, sourceY: d.sourceY, width: d.width, height: d.height, originX: d.originX, originY: d.originY });
                  }
                  this.layerTileData.set(tilesetData.layerType, layerTileMap);
                } else {
                  // Legacy detected tiles: do not inject into global display state
                }
              }

              // Check if all tilesets are loaded
              loadedCount++;
              if (loadedCount === totalTilesets) {
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
      
      // CRITICAL: Restore active tab's tilesets into layerTilesets for immediate display
      // This ensures each map/tab's unique tileset is properly loaded after deserialization
      for (const [layerType, tabs] of this.layerTabs.entries()) {
        const activeTabId = this.layerActiveTabId.get(layerType);
        if (activeTabId !== undefined) {
          const activeTab = tabs.find(t => t.id === activeTabId);
          if (activeTab?.tileset?.image) {
            const tileset = activeTab.tileset;
            const img = tileset.image!;
            // Only restore if image has loaded (width > 0)
            if (img.width > 0 || img.height > 0) {
              this.layerTilesets.set(layerType, tileset);
            }
          }
        }
      }
      
      // Load layer data if available
      if (projectData.layers && projectData.layers.length > 0) {
        this.tileLayers = [...projectData.layers]; // Create new array

        // Restore activeLayerId from saved project data if available
        if (projectData.activeLayerId !== undefined && projectData.activeLayerId !== null) {
          // Verify the saved activeLayerId exists in the loaded layers
          const savedActiveLayer = this.tileLayers.find(l => l.id === projectData.activeLayerId);
          if (savedActiveLayer) {
            this.activeLayerId = projectData.activeLayerId;
          } else {
            // Fallback to first layer if saved ID doesn't exist
            this.activeLayerId = this.tileLayers[0].id;
          }
        } else if (this.tileLayers.length > 0) {
          // No saved activeLayerId, use first layer
          this.activeLayerId = this.tileLayers[0].id;
        }

        // NOTE: Do NOT call updateCurrentTileset here.
        // Tileset images are loading asynchronously, and the img.onload callbacks
        // (set up during layerTabs restoration) will call updateCurrentTileset
        // when the images are ready. Calling it here with unloaded images would
        // result in an empty palette that doesn't get refreshed properly.

        // Backward compatibility: always keep a fixed "Rules" layer available in the UI.
        // This layer is currently UI-focused and does not participate in Flare layer export.
        if (!this.tileLayers.some(l => l.type === 'rules')) {
          const maxId = this.tileLayers.reduce((max, l) => Math.max(max, l.id), 0);
          const rulesLayer: TileLayer = {
            id: maxId + 1,
            name: 'Rules',
            type: 'rules',
            data: new Array(this.mapWidth * this.mapHeight).fill(0),
            visible: true,
            transparency: 1.0
          };

          const itemsIndex = this.tileLayers.findIndex(l => l.type === 'items');
          if (itemsIndex >= 0) {
            this.tileLayers.splice(itemsIndex, 0, rulesLayer);
          } else {
            this.tileLayers.unshift(rulesLayer);
          }

          this.nextLayerId = Math.max(this.nextLayerId, rulesLayer.id + 1);
        }
      } else {
        this.createDefaultLayers();
      }

      // Ensure per-layer cell tileset key arrays exist after loading layers
      for (const l of this.tileLayers) {
        if (!this.layerCellTilesetKey.has(l.type)) {
          this.layerCellTilesetKey.set(l.type, new Array(this.mapWidth * this.mapHeight).fill(null));
        }
      }

      // Ensure layer tabs exist for background and object layers (for backward compatibility
      // with projects saved before tabs were added to the project data format)
      try {
        const hasObject = this.tileLayers.some(l => l.type === 'object');
        const hasBackground = this.tileLayers.some(l => l.type === 'background');
        
        if (hasObject && (!this.layerTabs.has('object') || this.layerTabs.get('object')!.length === 0)) {
          const id = this.createLayerTab('object');
          this.setActiveLayerTab('object', id);
        }
        
        if (hasBackground && (!this.layerTabs.has('background') || this.layerTabs.get('background')!.length === 0)) {
          const id = this.createLayerTab('background');
          this.setActiveLayerTab('background', id);
        }
      } catch (_e) { void _e; }
      
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
      
      // CRITICAL: Load active tab's data into layer data for display AFTER all setup/clearing
      // This must happen after clearMapGrid() and all UI initialization
      for (const layerType of this.layerTabs.keys()) {
        const activeTabId = this.layerActiveTabId.get(layerType);
        if (activeTabId !== undefined) {
          const tabs = this.layerTabs.get(layerType);
          const activeTab = tabs?.find(t => t.id === activeTabId);
          const layer = this.tileLayers.find(l => l.type === layerType);
          
          if (activeTab && layer && activeTab.data) {
            layer.data = [...activeTab.data];
          }

          // If tab-level detected metadata is missing but layer-level metadata exists,
          // hydrate the active tab so React palette consistently uses asset mode.
          if (activeTab && (!activeTab.detectedTiles || activeTab.detectedTiles.size === 0)) {
            const layerDetected = this.layerTileData.get(layerType);
            if (layerDetected && layerDetected.size > 0) {
              activeTab.detectedTiles = new Map(layerDetected);
            }
          }
          
          // Always restore active tab's tileset - this ensures each map's unique tileset is loaded
          if (activeTab?.tileset?.image) {
            const tileset = activeTab.tileset;
            const img = tileset.image!;
            // Ensure the image is loaded before applying (width should be > 0)
            if (img.width > 0 || img.height > 0) {
              this.layerTilesets.set(layerType, tileset);
              // Refresh palette display
              this.updateCurrentTileset(layerType);
            } else {
              // Image still loading, schedule restoration for when image loads
              const onImageLoad = () => {
                this.layerTilesets.set(layerType, tileset);
                img.removeEventListener('load', onImageLoad);
                // Refresh palette display after image loads
                this.updateCurrentTileset(layerType);
              };
              img.addEventListener('load', onImageLoad);
            }
          }
        }
      }
      
      // NOTE: Do NOT automatically restore project-level tilesets
      // Each map should be self-contained with its own tileset data in layerTabs
      // If a map has explicit tileset data, it will be restored above
      
      // Restore placed sprite objects (multi-cell palette paintings on object/background layers)
      if (projectData.placedSpriteObjects && typeof projectData.placedSpriteObjects === 'object') {
        for (const [layerType, objs] of Object.entries(projectData.placedSpriteObjects)) {
          if (Array.isArray(objs) && objs.length > 0) {
            this.placedSpriteObjects.set(layerType, objs.map(o => ({ ...o })));
            // Keep nextSpriteObjectId above any restored ids
            for (const o of objs) {
              if (o.id >= this.nextSpriteObjectId) this.nextSpriteObjectId = o.id + 1;
            }
          }
        }
      }

      // Phase 1: Restore asset records and object instances
      if (projectData.assetRecords && Array.isArray(projectData.assetRecords)) {
        for (const asset of projectData.assetRecords) {
          this.assetRecords.set(asset.id, asset);
          const m = String(asset.id).match(/(\d+)$/);
          if (m) {
            const numId = parseInt(m[1], 10);
            if (!isNaN(numId) && numId >= this.nextAssetRecordId) {
              this.nextAssetRecordId = numId + 1;
            }
          }
        }
      }
      if (projectData.objectInstances && Array.isArray(projectData.objectInstances)) {
        for (const instance of projectData.objectInstances) {
          this.objectInstances.set(instance.id, instance);
          // Keep nextObjectInstanceId above any restored ids
          const numId = parseInt(instance.id, 10);
          if (!isNaN(numId) && numId >= this.nextObjectInstanceId) {
            this.nextObjectInstanceId = numId + 1;
          }
        }
      }
      if (projectData.paintMode) {
        this.paintMode = projectData.paintMode;
      }

      console.log('Project data loaded successfully');
      this.draw();
    } catch (_error) { void _error; }
  }

  // Load tileset from data URL
  public async loadTilesetFromDataURL(dataURL: string, fileName: string, sourcePath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Loading tileset from dataURL:', fileName, 'SourcePath:', sourcePath);
      const img = new Image();
      img.onload = () => {
        console.log('Tileset image loaded successfully:', img.width, 'x', img.height);
        
        // Store the tileset image and properties
        this.tilesetImage = img;
        this.tilesetFileName = fileName;
        this.tilesetSourcePath = sourcePath || null;
        
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
          
          const newTilesetInfo = {
            image: img,
            fileName: fileName,
            columns: this.tilesetColumns,
            rows: this.tilesetRows,
            count: this.tileCount,
            sourcePath: sourcePath || null
          };
          
          // Store the tileset for the current layer type
          this.layerTilesets.set(activeLayer.type, newTilesetInfo);
          
          // IMPORTANT: Also save to project-level storage to persist across maps
          this.projectTilesets.set(activeLayer.type, newTilesetInfo);
          console.log(`[PROJECT] Imported and saved tileset "${fileName}" for layer "${activeLayer.type}" to project storage`);
          
          // Also update the active tab's tileset
          const tabs = this.layerTabs.get(activeLayer.type) || [];
          const activeTabId = this.layerActiveTabId.get(activeLayer.type);
          const activeTab = tabs.find(t => t.id === activeTabId);
          if (activeTab) {
            activeTab.tileset = newTilesetInfo;
            // IMPORTANT: Cache the tileset image for persistence across tab switches
            this.cacheTilesetImage(activeLayer.type, activeTab.id, img, dataURL);
          }
          
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
        try {
          // Also store the loaded image into the preloaded cache so snapshots
          // and saves that rely on `_preloadedTilesetImages` will include this
          // tileset even if the live `layerTilesets` reference is mutated later.
          if (fileName) {
            this._preloadedTilesetImages.set(fileName, img);
            console.log('Cached loaded tileset into preloaded cache:', fileName);
          }
        } catch (_e) { void _e; }
        resolve();
      };
      img.onerror = (_e) => {
        
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
  }

  /**
   * Get current undo/redo history state for persistence
   */
  public getUndoStackState(): { history: Array<{ layers: TileLayer[]; objects: MapObject[] }>; historyIndex: number } {
    return {
      history: this.history,
      historyIndex: this.historyIndex
    };
  }

  /**
   * Restore undo/redo history state from persistence
   */
  public setUndoStackState(state: { history: Array<{ layers: TileLayer[]; objects: MapObject[] }>; historyIndex: number }): void {
    if (!Array.isArray(state.history)) {
      console.warn('Invalid history state provided to setUndoStackState');
      return;
    }

    if (typeof state.historyIndex !== 'number' || state.historyIndex < -1) {
      console.warn('Invalid history index provided to setUndoStackState');
      return;
    }

    this.history = state.history;
    this.historyIndex = state.historyIndex;
  }
}
