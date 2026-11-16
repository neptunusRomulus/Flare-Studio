import type { AssetRecord, MapObject, ObjectInstance, PaintMode, TileLayer, Tool } from '@/types';
import type { LayerTilesetEntry } from '@/editor/TileMapEditor';

export interface ToolInputHost {
  activeGid: number;
  activeLayerId: number | null;
  activeStamp: import('@/types').Stamp | null;
  addObjectInstance(instance: ObjectInstance): void;
  bucketFill(layer: TileLayer, startX: number, startY: number, newValue: number): void;
  clearSelection(): void;
  createObjectFromTile(x: number, y: number, layerType: string, _gid: number): void;
  currentSelectionTool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular';
  currentShapeTool: 'rectangle' | 'circle' | 'line';
  currentStampMode: 'select' | 'create' | 'place';
  currentTool: 'brush' | 'eraser' | 'bucket';
  draw(): void;
  markAsChanged(immediate?: boolean): void;
  drawCircleShape(centerX: number, centerY: number, endX: number, endY: number): Array<{x: number, y: number}>;
  drawLineShape(startX: number, startY: number, endX: number, endY: number): Array<{x: number, y: number}>;
  drawRectangleShape(startX: number, startY: number, endX: number, endY: number): Array<{x: number, y: number}>;
  eyedropperCallback: (() => void) | null;
  getAllObjectInstances(): ObjectInstance[];
  getCurrentLayerActiveGid(): number;
  getEffectivePaintModeForLayer(layerType: string): PaintMode;
  handleSelectionStart(x: number, y: number, isRightClick: boolean): void;
  isDrawingShape: boolean;
  isInSelection(x: number, y: number): boolean;
  isSaveLocked: boolean;
  isSelecting: boolean;
  layerActiveGid: Map<string, number>;
  layerActiveTabId: Map<string, number>;
  layerCellTilesetKey: Map<string, Array<string | null>>;
  layerTabs: Map<string, Array<{ id: number; name: string; data?: number[]; tileset?: LayerTilesetEntry; detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>; brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>; }>>;
  layerTilesets: Map<string, LayerTilesetEntry>;
  mapCanvas: HTMLCanvasElement;
  mapHeight: number;
  mapWidth: number;
  multiSelectedBrushes: Set<number>;
  nextObjectInstanceId: number;
  placeMultiSelectionAt(gridX: number, gridY: number): void;
  placeStamp(gridX: number, gridY: number): void;
  raycastToTile(worldX: number, worldY: number): { x: number; y: number } | null;
  removeObjectAtPosition(x: number, y: number): void;
  removeObjectInstance(id: string): boolean;
  removeSpriteObjectAt(layerType: string, x: number, y: number): void;
  resolveOrCreateAssetRecordForGid(gid: number, layerType: string): AssetRecord | undefined;
  saveState(): void;
  screenToWorld(screenX: number, screenY: number): { x: number; y: number };
  selectCircular(layer: TileLayer, centerX: number, centerY: number, endX: number, endY: number): void;
  selectMagicWand(layer: TileLayer, startX: number, startY: number): void;
  selectRectangular(layer: TileLayer, startX: number, startY: number, endX: number, endY: number): void;
  selectSameTile(layer: TileLayer, startX: number, startY: number): void;
  selection: { active: boolean; startX: number; startY: number; endX: number; endY: number; tiles: Array<{x: number, y: number, gid: number}>; };
  setCurrentLayerActiveGid(gid: number): void;
  shapeDrawing: { active: boolean; startX: number; startY: number; endX: number; endY: number; preview: Array<{x: number, y: number}>; };
  stampPreview: { x: number; y: number; width: number; height: number; visible: boolean };
  tileLayers: TileLayer[];
  tilesetFileName: string | null;
  toggleSelectionCell(layer: TileLayer, x: number, y: number): void;
  tool: Tool;
  updateTilePaletteSelection(): void;
}

export function handleTileClick(host: ToolInputHost, x: number, y: number, isRightClick: boolean): void {
  // Prevent editing while save is in progress
  if (host.isSaveLocked) {
    return;
  }

  if (host.activeLayerId !== null) {
    const layer = host.tileLayers.find(l => l.id === host.activeLayerId);
    if (layer) {
      const effectivePaintMode = host.getEffectivePaintModeForLayer(layer.type);
      const index = y * host.mapWidth + x;
      const currentValue = layer.data[index];
      let newValue: number;

      // Get the active GID for the current layer
      const currentLayerActiveGid = host.getCurrentLayerActiveGid();

      // Determine the action based on right-click or current tool
      if (isRightClick) {
        // Right-click always acts as eraser
        // Phase 4: Paint mode affects what gets erased
        if (effectivePaintMode === 'object') {
          // Object mode: only remove ObjectInstances at this position
          const instancesToRemove = host.getAllObjectInstances()
            .filter(inst => inst.gridX === x && inst.gridY === y && inst.layerId === layer.id.toString());
          for (const inst of instancesToRemove) {
            host.removeObjectInstance(inst.id);
          }
          host.saveState();
          host.markAsChanged();
          return; // Don't write to layer.data in object mode
        } else {
          // Ground mode: erase from layer.data and remove sprite objects
          newValue = 0;
          // Also remove any sprite object at this position
          host.removeSpriteObjectAt(layer.type, x, y);
        }
      } else {
        // Left-click behavior depends on current tool
        switch (host.currentTool) {
          case 'brush':
            // Don't paint if no tile is selected (activeGid is 0)
            if (currentLayerActiveGid === 0 && host.multiSelectedBrushes.size === 0) {
              console.warn(`[PAINT-BLOCKED] GID=0 for layer type="${layer.type}" activeLayerId=${host.activeLayerId} layerActiveGid=${JSON.stringify(Object.fromEntries(host.layerActiveGid))} activeGid=${host.activeGid}`);
              return; // Exit early, don't paint anything
            }

            // Check if brush stroke is within selection
            if (!host.isInSelection(x, y)) {
              return; // Can't paint outside selection
            }

            // If multiple brushes are selected, stamp them as a block
            if (host.multiSelectedBrushes.size > 1) {
              host.saveState();
              host.placeMultiSelectionAt(x, y);
              host.markAsChanged();
              return;
            }

            newValue = currentLayerActiveGid;
            break;
          case 'eraser':
            // Check if erase stroke is within selection
            if (!host.isInSelection(x, y)) {
              return; // Can't erase outside selection
            }
            // Phase 4: Paint mode affects eraser behavior
            if (effectivePaintMode === 'object') {
              // Object mode eraser: only remove ObjectInstances
              const instancesToRemove = host.getAllObjectInstances()
                .filter(inst => inst.gridX === x && inst.gridY === y && inst.layerId === layer.id.toString());
              if (instancesToRemove.length > 0) {
                host.saveState();
                for (const inst of instancesToRemove) {
                  host.removeObjectInstance(inst.id);
                }
                host.markAsChanged();
              }
              return; // Skip ground layer erasing in object mode
            } else {
              // Ground mode eraser: erase from layer.data and remove sprite objects
              newValue = 0;
              // Also remove any sprite object at this position
              host.removeSpriteObjectAt(layer.type, x, y);
            }
            break;
          case 'bucket':
            // Don't bucket fill if no tile is selected (activeGid is 0)
            if (currentLayerActiveGid === 0) {
              return; // Exit early, don't paint anything
            }
            // Bucket fill uses a different approach
            if (currentValue !== currentLayerActiveGid) {
              host.saveState();
              host.bucketFill(layer, x, y, currentLayerActiveGid);
              host.markAsChanged();
              host.draw(); // Immediately reflect changes
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
        host.saveState();
        
        // Phase 4: Paint mode branching
        if (effectivePaintMode === 'object' && newValue > 0) {
          // Object mode: create ObjectInstance instead of painting to layer.data
          // Don't destructively clear neighboring cells - user must explicitly request that
          const asset = host.resolveOrCreateAssetRecordForGid(newValue, layer.type);
          if (asset) {
            const instance: ObjectInstance = {
              id: `obj_${host.nextObjectInstanceId++}`,
              assetRecordId: asset.id,
              gridX: x,
              gridY: y,
              layerId: layer.id.toString(),
              properties: {}
            };
            host.addObjectInstance(instance);
          } else {
            console.warn(`[PAINT-MODE] Object mode: asset not found for GID ${newValue}`);
          }
          host.markAsChanged();
        } else if (effectivePaintMode === 'ground' || newValue === 0) {
          // Ground mode: paint to layer.data as normal (or erase)
          // Always try to remove any sprite object at this position when painting a new tile
          // This ensures single tile painting removes multi-tile sprites that cover this cell
          // Note: sprite objects set layer.data to 0, so we can't rely on currentValue > 0
          host.removeSpriteObjectAt(layer.type, x, y);
          
          layer.data[index] = newValue;
          // Record which tileset (tab) this painted cell came from so tabs don't collide
          try {
            const layerType = layer.type;
            let arr = host.layerCellTilesetKey.get(layerType);
            if (!arr) {
              arr = new Array(host.mapWidth * host.mapHeight).fill(null);
              host.layerCellTilesetKey.set(layerType, arr);
            }
            // Determine current active tab tileset fileName if available
            let tilesetFileName: string | null = null;
            const activeTabId = host.layerActiveTabId.get(layerType);
            const tabs = host.layerTabs.get(layerType) || [];
            if (activeTabId) {
              const tab = tabs.find(t => t.id === activeTabId);
              if (tab && tab.tileset && tab.tileset.fileName) tilesetFileName = tab.tileset.fileName;
            }
            // Fallback to layer tileset or global tileset
            if (!tilesetFileName) {
              const lt = host.layerTilesets.get(layerType);
              if (lt && lt.fileName) tilesetFileName = lt.fileName;
            }
            if (!tilesetFileName && host.tilesetFileName) tilesetFileName = host.tilesetFileName;
            arr[index] = tilesetFileName;
          } catch (_e) { void _e; }
          
          host.markAsChanged();
        }
        
        // Legacy map-object creation/removal applies to event/enemy/npc layers only.
        // Object layer now uses ObjectInstances and should not create placeholder map objects.
        if (layer.type === 'event' || layer.type === 'enemy' || layer.type === 'npc') {
          if (newValue > 0) {
            // Create object when placing tile
            host.createObjectFromTile(x, y, layer.type, newValue);
          } else {
            // Remove object when erasing tile
            host.removeObjectAtPosition(x, y);
          }
        }
        
        host.markAsChanged();
        host.draw(); // Immediately reflect changes
      }
    }
  }
}

export function handleStampClick(host: ToolInputHost, x: number, y: number, isRightClick: boolean): void {
  if (isRightClick) {
    // Right-click clears stamp preview
    host.stampPreview.visible = false;
    host.draw();
    return;
  }

  if (host.currentStampMode === 'create') {
    // Start selection for creating a stamp
    host.handleSelectionStart(x, y, isRightClick);
  } else if (host.currentStampMode === 'place' && host.activeStamp) {
    // Place the active stamp
    host.placeStamp(x, y);
  }
}

export function handleSelectionStart(host: ToolInputHost, x: number, y: number, isRightClick: boolean): void {
  if (isRightClick) {
    // Right-click clears selection
    host.clearSelection();
    return;
  }

  const layer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (!layer) return;

  host.selection.startX = x;
  host.selection.startY = y;
  host.selection.endX = x;
  host.selection.endY = y;

  // Multi-cell toggles a single cell and keeps existing selection for non-adjacent picks.
  if (host.currentSelectionTool === 'multi-cell') {
    host.toggleSelectionCell(layer, x, y);
    host.draw();
  // For instant selection tools (magic wand, same tile), execute immediately
  } else if (host.currentSelectionTool === 'magic-wand') {
    host.selectMagicWand(layer, x, y);
    host.draw();
  } else if (host.currentSelectionTool === 'same-tile') {
    host.selectSameTile(layer, x, y);
    host.draw();
  } else {
    // For drag-based tools (rectangular, circular), start selection
    host.isSelecting = true;
  }
}

export function handleSelectionDrag(host: ToolInputHost, x: number, y: number): void {
  if (!host.isSelecting) return;

  host.selection.endX = x;
  host.selection.endY = y;
  host.draw(); // Update preview
}

export function handleSelectionEnd(host: ToolInputHost): void {
  if (!host.isSelecting) return;

  const layer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (!layer) return;

  // Execute the selection based on tool type
  if (host.currentSelectionTool === 'rectangular') {
    host.selectRectangular(layer, host.selection.startX, host.selection.startY, host.selection.endX, host.selection.endY);
  } else if (host.currentSelectionTool === 'circular') {
    host.selectCircular(layer, host.selection.startX, host.selection.startY, host.selection.endX, host.selection.endY);
  }

  host.isSelecting = false;
  host.draw();
}

export function handleShapeStart(host: ToolInputHost, x: number, y: number, isRightClick: boolean): void {
  if (isRightClick) {
    // Right-click cancels shape drawing
    host.shapeDrawing.active = false;
    host.isDrawingShape = false;
    host.draw();
    return;
  }

  host.shapeDrawing.active = true;
  host.shapeDrawing.startX = x;
  host.shapeDrawing.startY = y;
  host.shapeDrawing.endX = x;
  host.shapeDrawing.endY = y;
  host.shapeDrawing.preview = [];
  host.isDrawingShape = true;
}

export function handleShapeDrag(host: ToolInputHost, x: number, y: number): void {
  if (!host.isDrawingShape) return;

  host.shapeDrawing.endX = x;
  host.shapeDrawing.endY = y;

  // Update preview based on shape type
  switch (host.currentShapeTool) {
    case 'rectangle':
      host.shapeDrawing.preview = host.drawRectangleShape(
        host.shapeDrawing.startX, host.shapeDrawing.startY,
        host.shapeDrawing.endX, host.shapeDrawing.endY
      );
      break;
    case 'circle':
      host.shapeDrawing.preview = host.drawCircleShape(
        host.shapeDrawing.startX, host.shapeDrawing.startY,
        host.shapeDrawing.endX, host.shapeDrawing.endY
      );
      break;
    case 'line':
      host.shapeDrawing.preview = host.drawLineShape(
        host.shapeDrawing.startX, host.shapeDrawing.startY,
        host.shapeDrawing.endX, host.shapeDrawing.endY
      );
      break;
  }

  host.draw(); // Update preview
}

export function handleShapeEnd(host: ToolInputHost): void {
  if (!host.isDrawingShape) return;

  const layer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (!layer) return;

  // Get the active GID for the current layer
  const currentLayerActiveGid = host.getCurrentLayerActiveGid();

  // Apply the shape to the layer
  if (host.shapeDrawing.preview.length > 0 && currentLayerActiveGid > 0) {
    host.saveState();
    
    host.shapeDrawing.preview.forEach(point => {
      const index = point.y * host.mapWidth + point.x;
      layer.data[index] = currentLayerActiveGid;
    });

    host.markAsChanged();
  }

  host.shapeDrawing.active = false;
  host.isDrawingShape = false;
  host.shapeDrawing.preview = [];
  host.draw();
}

export function handleEyedropper(host: ToolInputHost, x: number, y: number): number | null {
  const layer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (!layer) return null;

  if (x >= 0 && x < host.mapWidth && y >= 0 && y < host.mapHeight) {
    const index = y * host.mapWidth + x;
    const gid = layer.data[index];
    
    if (gid > 0) {
      // Set the active GID for the current layer
      host.setCurrentLayerActiveGid(gid);
      host.updateTilePaletteSelection();
      
      // Switch back to brush tool automatically
      host.tool = 'tiles';
      host.currentTool = 'brush';
      host.mapCanvas.style.cursor = 'crosshair';
      
      // Notify the UI that we switched back to brush
      if (host.eyedropperCallback) {
        host.eyedropperCallback();
      }
      
      return gid;
    }
  }
  
  return null;
}

export function screenToTile(host: ToolInputHost, screenX: number, screenY: number): { x: number, y: number } | null {
  // Convert screen coordinates to world coordinates first
  const worldCoords = host.screenToWorld(screenX, screenY);
  
  // Cast a ray from the mouse position to find which tile diamond it hits
  return host.raycastToTile(worldCoords.x, worldCoords.y);
}
