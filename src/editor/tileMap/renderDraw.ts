import type { AssetRecord, MapObject, ObjectInstance, Stamp, TileLayer } from '@/types';
import type { LayerTilesetEntry } from '../TileMapEditor';
import { COLLISION_LAYER_TYPE } from './constants';
import { tileDrawTopLeft } from '../tilesetDef';

export interface RenderDrawHost {
  activeEventPreview: { x: number; y: number; width: number; height: number } | null;
  activeHotspotPreview: { x: number; y: number; width: number; height: number } | null;
  activeStamp: import('@/types').Stamp | null;
  actorUsesPlaceholder(object: MapObject): boolean;
  assetRecords: Map<string, AssetRecord>;
  ctx: CanvasRenderingContext2D;
  detectedTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number; }>;
  draggingActorId: number | null;
  drawActorIcon(centerX: number, centerY: number, actorType: 'npc' | 'enemy'): void;
  drawActorPlaceholder(object: MapObject, actorType: 'npc' | 'enemy'): void;
  drawEventPlaceholder(event: MapObject): void;
  drawGroundTile(x: number, y: number, gid: number, layerTileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number }, layerTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>): void;
  drawHeroIcon(centerX: number, centerY: number): void;
  drawObjectSprite(x: number, y: number, gid: number, layerTileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number }, layerTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>): void;
  findTabForCellKey<T extends { tileset?: { fileName?: string | null } | null }>(tabs: T[], key: string | null): T | undefined;
  getActorLayerType(object: MapObject): 'npc' | 'enemy' | null;
  getLayerTilesetOrFallback(layerType: string): LayerTilesetEntry | null;
  getObjectInstancesByLayer(layerId: string): ObjectInstance[];
  heroX: number;
  heroY: number;
  hoverX: number;
  hoverY: number;
  isDarkMode: boolean;
  isDraggingActor: boolean;
  isTallSprite(width: number, height: number): boolean;
  lastMiniMapBounds: { x: number; y: number; w: number; h: number } | null;
  layerActiveTabId: Map<string, number>;
  layerCellTilesetKey: Map<string, Array<string | null>>;
  layerTabs: Map<string, Array<{ id: number; name: string; data?: number[]; tileset?: LayerTilesetEntry; detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>; brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>; }>>;
  layerTileData: Map<string, Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number; }>>;
  mapCanvas: HTMLCanvasElement;
  mapHeight: number;
  mapToScreen(mapX: number, mapY: number): { x: number; y: number };
  mapWidth: number;
  minimapHoverCoords: { x: number; y: number } | null;
  minimapMode: 'orthogonal' | 'isometric';
  minimapPanX: number;
  minimapPanY: number;
  minimapWindowScale: number;
  minimapZoom: number;
  objectInstances: Map<string, ObjectInstance>;
  objectLayerTypes: unknown[];
  objects: MapObject[];
  placedSpriteObjects: Map<string, Array<{ id: number; anchorX: number; anchorY: number; gid: number; tilesetKey: string | null; width: number; height: number; sourceX: number; sourceY: number; }>>;
  showMinimap: boolean;
  stampPreview: { x: number; y: number; width: number; height: number; visible: boolean };
  tileLayers: TileLayer[];
  tileSizeX: number;
  tileSizeY: number;
  tilesetColumns: number;
  tilesetImage: HTMLImageElement | null;
  zoom: number;
}

export function drawTiles(host: RenderDrawHost): void {
  // Render layers in reverse priority order so higher priority layers appear on top
  // Background (priority 6) renders first, collision (priority 4) renders later and appears on top
  const layersReversed = [...host.tileLayers].reverse();
  
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
    const isObjectLayer = host.objectLayerTypes.includes(layer.type);
    
    // Get the default tileset for this layer type (used as a fallback)
    const layerTilesetFallback = host.getLayerTilesetOrFallback(layer.type) || { image: null, fileName: null, columns: 1, rows: 1, count: 1 };

    // Get the active tab's detected tiles as a base source of tile data
    const tabs = host.layerTabs.get(layer.type) || [];
    const activeTabId = host.layerActiveTabId.get(layer.type);
    let activeTabDetectedTiles: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }> | null = null;
    if (activeTabId) {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.detectedTiles) {
        activeTabDetectedTiles = activeTab.detectedTiles as Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>;
      }
    }

    // Set layer transparency
    host.ctx.globalAlpha = layer.transparency || 1.0;

    for (let y = 0; y < host.mapHeight; y++) {
      for (let x = 0; x < host.mapWidth; x++) {
        const index = y * host.mapWidth + x;
        const gid = layer.data[index];
        if (gid <= 0) continue;

        // Determine per-cell tileset key if any (fileName stored when painting)
        const keyArr = host.layerCellTilesetKey.get(layer.type);
        const cellTilesetKey = keyArr ? keyArr[index] : null;

        // Resolve tileset info for this specific cell
        let tilesetForCell = layerTilesetFallback;
        // Default to layer tile data, then active tab's detected tiles
        let layerTileDataForCell = host.layerTileData.get(layer.type) || activeTabDetectedTiles || new Map();

        if (cellTilesetKey) {
          const tab = host.findTabForCellKey(tabs, cellTilesetKey);
          if (tab && tab.tileset) {
            tilesetForCell = {
              image: tab.tileset.image ?? null,
              fileName: tab.tileset.fileName ?? null,
              columns: (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0)
                ? tab.tileset.columns
                : Math.max(1, Math.floor((tab.tileset.image ? tab.tileset.image.width : host.tileSizeX) / host.tileSizeX)),
              rows: (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0)
                ? tab.tileset.rows
                : Math.max(1, Math.floor((tab.tileset.image ? tab.tileset.image.height : host.tileSizeY) / host.tileSizeY)),
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
            layerTileDataForCell = host.layerTileData.get(layer.type) || activeTabDetectedTiles || new Map();
          }
        }

        // Determine sprite dimensions to decide if it's a ground tile or tall object
        const tileData = layerTileDataForCell.get(gid) || host.detectedTileData.get(gid);
        let spriteWidth = host.tileSizeX;
        let spriteHeight = host.tileSizeY;
        
        if (tileData) {
          spriteWidth = tileData.width;
          spriteHeight = tileData.height;
        }
        
        // Determine rendering mode:
        // 1. Explicit object layers -> always render as object
        // 2. Tall sprites (height > threshold) -> render as object even if on background layer
        // 3. Ground-sized sprites on non-object layers -> render as tile
        const shouldRenderAsObject = isObjectLayer || host.isTallSprite(spriteWidth, spriteHeight);

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
          host.drawGroundTile(x, y, gid, tilesetForCell, layerTileDataForCell);
        }
      }
    }
    
    // Also render sprite objects for this layer from placedSpriteObjects
    const spriteObjects = host.placedSpriteObjects.get(layer.type);
    if (spriteObjects && spriteObjects.length > 0) {
      const hasInstanceOnLayer = host.getObjectInstancesByLayer(layer.id.toString()).length > 0;
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
    if (host.objectInstances.size > 0) {
      for (const instance of host.objectInstances.values()) {
        // Only render instances on this layer
        if (instance.layerId !== layer.id.toString()) continue;

        const asset = host.assetRecords.get(instance.assetRecordId);
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
    host.ctx.globalAlpha = obj.transparency;
    host.drawObjectSprite(obj.x, obj.y, obj.gid, obj.tileset, obj.tileData);
  }
  
  // Reset alpha for other drawing operations
  host.ctx.globalAlpha = 1.0;
}

export function drawGroundTile(host: RenderDrawHost, x: number,
    y: number,
    gid: number,
    layerTileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number },
    layerTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>): void {
  if (!layerTileset.image || gid <= 0) return;
  
  // Get tile data
  const tileData = layerTileData.get(gid) || host.detectedTileData.get(gid);
  
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
    sourceX = (tileIndex % layerTileset.columns) * host.tileSizeX;
    sourceY = Math.floor(tileIndex / layerTileset.columns) * host.tileSizeY;
    tileWidth = host.tileSizeX;
    tileHeight = host.tileSizeY;
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
    const safeColumns = Math.max(1, layerTileset.columns || Math.floor(imgW / host.tileSizeX) || 1);
    const tileIndex = gid - 1;
    sourceX = (tileIndex % safeColumns) * host.tileSizeX;
    sourceY = Math.floor(tileIndex / safeColumns) * host.tileSizeY;
    tileWidth = host.tileSizeX;
    tileHeight = host.tileSizeY;
  }
  
  // Get isometric screen position (center of the tile diamond)
  const screenPos = host.mapToScreen(x, y);
  const scaledTileX = tileWidth * host.zoom;
  const scaledTileY = tileHeight * host.zoom;

  // Anchor: the tile's origin (Flare def offset, or bottom-center for grid tiles)
  // sits on the diamond's bottom point. Fallback rects above have no origin.
  const useOrigin = !invalidRect && !!tileData && typeof tileData.originX === 'number' && typeof tileData.originY === 'number';
  const { x: destX, y: destY } = tileDrawTopLeft(screenPos.x, screenPos.y, host.tileSizeY, host.zoom, {
    width: tileWidth,
    height: tileHeight,
    originX: useOrigin ? tileData!.originX : undefined,
    originY: useOrigin ? tileData!.originY : undefined,
  });
  
  host.ctx.drawImage(
    layerTileset.image,
    sourceX, sourceY, tileWidth, tileHeight,
    destX, destY, scaledTileX, scaledTileY
  );
}

export function drawObjectSprite(host: RenderDrawHost, x: number,
    y: number,
    gid: number,
    layerTileset: { image: HTMLImageElement | null; fileName: string | null; columns: number; rows: number; count: number },
    layerTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>): void {
  if (!layerTileset.image || gid <= 0) return;
  
  // Get tile/sprite data - check layer data first, then global detectedTileData
  const tileData = layerTileData.get(gid) || host.detectedTileData.get(gid);
  
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
    sourceX = (tileIndex % layerTileset.columns) * host.tileSizeX;
    sourceY = Math.floor(tileIndex / layerTileset.columns) * host.tileSizeY;
    spriteWidth = host.tileSizeX;
    spriteHeight = host.tileSizeY;
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
    const safeColumns = Math.max(1, layerTileset.columns || Math.floor(imgW / host.tileSizeX) || 1);
    const tileIndex = gid - 1;
    sourceX = (tileIndex % safeColumns) * host.tileSizeX;
    sourceY = Math.floor(tileIndex / safeColumns) * host.tileSizeY;
    spriteWidth = host.tileSizeX;
    spriteHeight = host.tileSizeY;
    originX = Math.floor(host.tileSizeX / 2);
    originY = host.tileSizeY;
  }
  
  // Get isometric screen position (center of the tile diamond)
  const screenPos = host.mapToScreen(x, y);
  
  // Calculate the ground point (bottom of the tile diamond)
  const halfTileY = (host.tileSizeY / 2) * host.zoom;
  const groundY = screenPos.y + halfTileY;
  
  // Scale sprite dimensions
  const scaledWidth = spriteWidth * host.zoom;
  const scaledHeight = spriteHeight * host.zoom;
  
  // Use custom origin if provided, otherwise default to bottom-center
  // For objects, bottom-center anchoring means:
  // - Horizontal: sprite center aligns with tile center
  // - Vertical: sprite bottom aligns with tile ground
  const finalOriginX = (typeof originX === 'number') ? originX : Math.floor(spriteWidth / 2);
  const finalOriginY = (typeof originY === 'number') ? originY : spriteHeight;
  
  // Calculate destination position
  // destX: tile center - scaled origin X
  // destY: ground point - scaled origin Y
  const destX = screenPos.x - (finalOriginX * host.zoom);
  const destY = groundY - (finalOriginY * host.zoom);
  
  // Draw without any clipping - objects can extend beyond tile bounds
  host.ctx.drawImage(
    layerTileset.image,
    sourceX, sourceY, spriteWidth, spriteHeight,
    destX, destY, scaledWidth, scaledHeight
  );
}

export function drawTile(host: RenderDrawHost, x: number, y: number, gid: number): void {
  if (!host.tilesetImage || gid <= 0) return;
  
  // Check if we have variable-sized tile data for this gid
  const tileData = host.detectedTileData.get(gid);
  
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
    sourceX = (tileIndex % host.tilesetColumns) * host.tileSizeX;
    sourceY = Math.floor(tileIndex / host.tilesetColumns) * host.tileSizeY;
    tileWidth = host.tileSizeX;
    tileHeight = host.tileSizeY;
  }
  
// Use isometric screen coordinates with zoom applied
const screenPos = host.mapToScreen(x, y);
const scaledTileX = tileWidth * host.zoom;
const scaledTileY = tileHeight * host.zoom;

// Compute ground (base) position for the tile diamond. We want the
// bottom-center of the sprite to sit on the tile base (so sprites don't
// appear to "float" above the grid lines). screenPos is the diamond
// center, so bottom of the diamond is screenPos.y + halfTileY.
const halfTileY = (host.tileSizeY / 2) * host.zoom;
const groundY = screenPos.y + halfTileY;

// Determine origin (fallback to center-bottom behavior if not present)
const finalOriginX = (typeof originX === 'number') ? originX : Math.floor(tileWidth / 2);
const finalOriginY = (typeof originY === 'number') ? originY : tileHeight; // default to bottom

// Draw image so its origin point aligns to the tile ground anchor
const destX = screenPos.x - (finalOriginX * host.zoom);
const destY = groundY - (finalOriginY * host.zoom);
  
  host.ctx.drawImage(
    host.tilesetImage,
    sourceX, sourceY, tileWidth, tileHeight,
    destX, destY, scaledTileX, scaledTileY
  );
}

export function drawEvents(host: RenderDrawHost): void {
  // Check if there is an "event" tile layer to get its visibility and opacity.
  // If it doesn't exist, we default to visible and opaque.
  const eventLayer = host.tileLayers.find(l => l.type === 'event');
  if (eventLayer && !eventLayer.visible) return; // Hide/Unhide functional tie-in

  const events = host.objects.filter(obj => obj.type === 'event' && obj.x >= 0 && obj.y >= 0);
  if (events.length === 0) return;

  host.ctx.save();
  
  // Connect to transparency state of the Event layer panel item
  if (eventLayer && eventLayer.transparency != null) {
    host.ctx.globalAlpha = eventLayer.transparency;
  }

// Group events by cell to draw badges for stacked events
    const eventsByCell = new Map<string, MapObject[]>();
    for (const event of events) {
      const key = `${event.x},${event.y}`;
      if (!eventsByCell.has(key)) eventsByCell.set(key, []);
      eventsByCell.get(key)!.push(event);
    }

    for (const event of events) {
      host.drawEventPlaceholder(event);
    }

    // Draw count badges for cells with multiple events
    for (const [, cellEvents] of eventsByCell) {
      if (cellEvents.length > 1) {
        const first = cellEvents[0];
        const screenPos = host.mapToScreen(first.x, first.y);
        const halfTileX = (host.tileSizeX / 2) * host.zoom;
        const halfTileY = (host.tileSizeY / 2) * host.zoom;

        const badgeR = Math.max(6, Math.min(12, 9 * host.zoom));
        const bx = screenPos.x + halfTileX - badgeR * 0.3;
        const by = screenPos.y - halfTileY + badgeR * 0.3;

        host.ctx.save();
        host.ctx.fillStyle = '#ffffff';
        host.ctx.beginPath();
        host.ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
        host.ctx.fill();

        host.ctx.fillStyle = '#000000';
        const fontSize = Math.max(8, Math.min(14, 10 * host.zoom));
        host.ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
        host.ctx.textAlign = 'center';
        host.ctx.textBaseline = 'middle';
        host.ctx.fillText(String(cellEvents.length), bx, by);
        host.ctx.restore();
      }
    }

  host.ctx.restore();
}

export function drawEventPlaceholder(host: RenderDrawHost, event: MapObject): void {
  const screenPos = host.mapToScreen(event.x, event.y);
  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;

  host.ctx.save();

  host.ctx.shadowColor = 'transparent';
  host.ctx.shadowBlur = 0;

  // Filled orange diamond
  host.ctx.fillStyle = '#f97316';
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
  host.ctx.closePath();
  host.ctx.fill();

  // Orange border
  host.ctx.strokeStyle = '#ea580c';
  host.ctx.lineWidth = Math.max(1, Math.min(2, 2 / host.zoom));
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
  host.ctx.closePath();
  host.ctx.stroke();

  // White clock icon at center
  const iconSize = Math.max(8, Math.min(16, 12 * host.zoom));
  const cx = screenPos.x;
  const cy = screenPos.y;
  const r = iconSize / 2;

  // Clock circle
  host.ctx.strokeStyle = '#ffffff';
  host.ctx.lineWidth = Math.max(1, Math.min(2, 1.5 * host.zoom));
  host.ctx.beginPath();
  host.ctx.arc(cx, cy, r, 0, Math.PI * 2);
  host.ctx.stroke();

  // Clock hands (hour hand pointing to 12, minute hand pointing to 3)
  host.ctx.lineCap = 'round';
  // Hour hand (12 o'clock)
  host.ctx.beginPath();
  host.ctx.moveTo(cx, cy);
  host.ctx.lineTo(cx, cy - r * 0.6);
  host.ctx.stroke();
  // Minute hand (3 o'clock)
  host.ctx.beginPath();
  host.ctx.moveTo(cx, cy);
  host.ctx.lineTo(cx + r * 0.5, cy);
  host.ctx.stroke();

  host.ctx.restore();
}

export function drawHeroPosition(host: RenderDrawHost): void {
  // Draw the hero position marker as a fully orange filled cell
  const screenPos = host.mapToScreen(host.heroX, host.heroY);
  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;
  
  host.ctx.save();
  
  // Check if mouse is hovering over hero position
  const isHovering = host.hoverX === host.heroX && host.hoverY === host.heroY;
  
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
      host.ctx.strokeStyle = layer.color;
      host.ctx.lineWidth = Math.max(1, Math.min(layer.width, layer.width / host.zoom));
      host.ctx.shadowColor = '#ff6b00';
      host.ctx.shadowBlur = Math.max(2, Math.min(10, layer.width / host.zoom));
      
      host.ctx.beginPath();
      host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
      host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
      host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
      host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
      host.ctx.closePath();
      host.ctx.stroke();
    });
  }
  
  // Reset shadow settings
  host.ctx.shadowColor = 'transparent';
  host.ctx.shadowBlur = 0;
  
  // Draw filled orange diamond
  host.ctx.fillStyle = '#ff6b00';
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
  host.ctx.closePath();
  host.ctx.fill();
  
  // Draw bright orange border
  host.ctx.strokeStyle = '#ff8c00';
  host.ctx.lineWidth = Math.max(1, Math.min(2, 2 / host.zoom));
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
  host.ctx.closePath();
  host.ctx.stroke();
  
  // Draw hero icon in the center
  host.drawHeroIcon(screenPos.x, screenPos.y);
  
  host.ctx.restore();
}

export function drawHeroIcon(host: RenderDrawHost, centerX: number, centerY: number): void {
  const iconSize = Math.max(12, Math.min(20, 16 * host.zoom));
  const halfSize = iconSize / 2;

  host.ctx.save();
  host.ctx.fillStyle = '#ffffff';
  host.ctx.strokeStyle = '#ffffff';
  host.ctx.lineWidth = 1.5;

  // Draw user/hero icon (simplified person silhouette)
  // Head (circle)
  host.ctx.beginPath();
  host.ctx.arc(centerX, centerY - halfSize * 0.6, halfSize * 0.25, 0, Math.PI * 2);
  host.ctx.fill();

  // Body (rounded rectangle)
  host.ctx.beginPath();
  host.ctx.roundRect(
    centerX - halfSize * 0.3, 
    centerY - halfSize * 0.2, 
    halfSize * 0.6, 
    halfSize * 0.8, 
    halfSize * 0.15
  );
  host.ctx.fill();

  host.ctx.restore();
}

export function drawActorPlaceholders(host: RenderDrawHost): void {
  for (const object of host.objects) {
    if (!host.actorUsesPlaceholder(object)) {
      continue;
    }
    const actorLayerType = host.getActorLayerType(object);
    if (actorLayerType) {
      host.drawActorPlaceholder(object, actorLayerType);
    }
  }
}

export function drawActorPlaceholder(host: RenderDrawHost, object: MapObject, actorType: 'npc' | 'enemy'): void {
  const screenPos = host.mapToScreen(object.x, object.y);
  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;

  host.ctx.save();

  const isHovering = host.hoverX === object.x && host.hoverY === object.y;
  const isDragging = host.isDraggingActor && host.draggingActorId === object.id;
  if (isHovering || isDragging) {
    const glowLayers = [
      { color: 'rgba(255, 107, 0, 0.1)', width: 8 },
      { color: 'rgba(255, 107, 0, 0.2)', width: 6 },
      { color: 'rgba(255, 107, 0, 0.3)', width: 4 },
      { color: 'rgba(255, 107, 0, 0.5)', width: 2 }
    ];

    glowLayers.forEach(layer => {
      host.ctx.strokeStyle = layer.color;
      host.ctx.lineWidth = Math.max(1, Math.min(layer.width, layer.width / host.zoom));
      host.ctx.shadowColor = '#ff6b00';
      host.ctx.shadowBlur = Math.max(2, Math.min(10, layer.width / host.zoom));

      host.ctx.beginPath();
      host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
      host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
      host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
      host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
      host.ctx.closePath();
      host.ctx.stroke();
    });
  }

  host.ctx.shadowColor = 'transparent';
  host.ctx.shadowBlur = 0;

  host.ctx.fillStyle = '#ffb3b3';
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
  host.ctx.closePath();
  host.ctx.fill();

  host.ctx.strokeStyle = '#fb7185';
  host.ctx.lineWidth = Math.max(1, Math.min(2, 2 / host.zoom));
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY);
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y);
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY);
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y);
  host.ctx.closePath();
  host.ctx.stroke();

  host.drawActorIcon(screenPos.x, screenPos.y, actorType);

  host.ctx.restore();
}

export function drawActorIcon(host: RenderDrawHost, centerX: number, centerY: number, actorType: 'npc' | 'enemy'): void {
  if (actorType === 'npc') {
    // Draw lucide circle-user-round icon
    const iconSize = Math.max(5, Math.min(10, 8 * host.zoom));
    const s = iconSize / 12; // scale factor (icon drawn in 24x24, we use half)
    const cx = centerX;
    const cy = centerY;

    host.ctx.save();
    host.ctx.strokeStyle = '#ffffff';
    host.ctx.lineWidth = Math.max(1, Math.min(2, 1.5 * host.zoom));
    host.ctx.lineCap = 'round';
    host.ctx.lineJoin = 'round';

    // Outer circle (circle cx=12 cy=12 r=10 scaled)
    host.ctx.beginPath();
    host.ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2);
    host.ctx.stroke();

    // Head circle (circle cx=12 cy=10 r=4 scaled)
    host.ctx.beginPath();
    host.ctx.arc(cx, cy - 2 * s, 4 * s, 0, Math.PI * 2);
    host.ctx.stroke();

    // Body arc (path d="M18 20a6 6 0 0 0-12 0" scaled)
    // This is an arc from (18,20) to (6,20) with radius 6, sweep clockwise
    // Center of this arc is (12, 20), radius 6
    host.ctx.beginPath();
    host.ctx.arc(cx, cy + 8 * s, 6 * s, Math.PI, 0, false);
    host.ctx.stroke();

    host.ctx.restore();
  } else {
    const iconSize = Math.max(10, Math.min(18, 14 * host.zoom));
    const skullRadius = iconSize * 0.42;
    const eyeRadius = Math.max(1.5, iconSize * 0.12);
    const eyeOffsetX = iconSize * 0.18;
    const eyeOffsetY = iconSize * -0.08;
    const jawHeight = iconSize * 0.16;
    const jawWidth = iconSize * 0.26;
    const jawSpacing = iconSize * 0.12;
    const foreheadWidth = skullRadius * 0.95;

    host.ctx.save();
    host.ctx.fillStyle = '#ffffff';
    host.ctx.strokeStyle = '#ffffff';
    host.ctx.lineWidth = Math.max(1, Math.min(2, 1.5 * host.zoom));
    host.ctx.lineJoin = 'round';
    host.ctx.lineCap = 'round';

    // Skull head
    host.ctx.beginPath();
    host.ctx.arc(centerX, centerY - iconSize * 0.06, skullRadius, Math.PI * 0.95, Math.PI * 0.05, false);
    host.ctx.lineTo(centerX + skullRadius * 0.7, centerY + skullRadius * 0.3);
    host.ctx.quadraticCurveTo(centerX, centerY + skullRadius * 0.6, centerX - skullRadius * 0.7, centerY + skullRadius * 0.3);
    host.ctx.closePath();
    host.ctx.fill();
    host.ctx.stroke();

    // Forehead ridge
    host.ctx.beginPath();
    host.ctx.moveTo(centerX - foreheadWidth * 0.5, centerY - iconSize * 0.08);
    host.ctx.quadraticCurveTo(centerX, centerY - iconSize * 0.25, centerX + foreheadWidth * 0.5, centerY - iconSize * 0.08);
    host.ctx.stroke();

    // Eye sockets
    host.ctx.fillStyle = '#000000';
    host.ctx.beginPath();
    host.ctx.arc(centerX - eyeOffsetX, centerY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    host.ctx.fill();
    host.ctx.beginPath();
    host.ctx.arc(centerX + eyeOffsetX, centerY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    host.ctx.fill();

    // Nose cavity
    host.ctx.beginPath();
    host.ctx.moveTo(centerX, centerY + iconSize * 0.02);
    host.ctx.lineTo(centerX - iconSize * 0.05, centerY + iconSize * 0.12);
    host.ctx.lineTo(centerX + iconSize * 0.05, centerY + iconSize * 0.12);
    host.ctx.closePath();
    host.ctx.fill();

    // Teeth blocks
    const baseY = centerY + skullRadius * 0.25;
    const toothCount = 3;
    for (let i = 0; i < toothCount; i += 1) {
      const x = centerX + (i - 1) * (jawWidth + jawSpacing);
      host.ctx.fillRect(x - jawWidth / 2, baseY, jawWidth, jawHeight);
    }

    host.ctx.restore();
  }
}

export function drawStampPreview(host: RenderDrawHost): void {
  if (!host.stampPreview.visible || !host.activeStamp) return;

  host.ctx.strokeStyle = '#007acc';
  host.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
  host.ctx.lineWidth = Math.max(1, Math.min(2.5, 2.5 / host.zoom));

  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;

  // Draw only a single cell highlight at the hover position (anchor point)
  // regardless of how many tiles are selected in the tileset palette
  const screenPos = host.mapToScreen(host.stampPreview.x, host.stampPreview.y);

  // Draw a single diamond outline for the anchor cell
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
  host.ctx.closePath();
  host.ctx.fill();
  host.ctx.stroke();
}

export function drawMiniMap(host: RenderDrawHost): void {
  if (!host.showMinimap) return;

  // Minimap dimensions and position (bottom-right corner of the canvas)
  const minimapWidth = Math.floor(150 * host.minimapWindowScale);
  const minimapHeight = Math.floor(120 * host.minimapWindowScale);
  const padding = 10;
  let x = host.mapCanvas.width - minimapWidth - padding;
  let y = host.mapCanvas.height - minimapHeight - padding;
  // Clamp inside canvas to avoid drawing outside if the canvas is smaller
  x = Math.max(0, Math.min(host.mapCanvas.width - minimapWidth, x));
  y = Math.max(0, Math.min(host.mapCanvas.height - minimapHeight, y));
  // Update cached bounds for hit testing
  host.lastMiniMapBounds = { x, y, w: minimapWidth, h: minimapHeight };

  // Save current context state
  host.ctx.save();

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
    host.ctx.beginPath();
    host.ctx.moveTo(rx + r, ry);
    host.ctx.lineTo(rx + rw - r, ry);
    host.ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
    host.ctx.lineTo(rx + rw, ry + rh - r);
    host.ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
    host.ctx.lineTo(rx + r, ry + rh);
    host.ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
    host.ctx.lineTo(rx, ry + r);
    host.ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    host.ctx.closePath();
  };

  // Outer background (slightly transparent)
  host.ctx.fillStyle = host.isDarkMode ? 'rgba(42, 42, 42, 0.9)' : 'rgba(0, 0, 0, 0.7)';
  roundedRectPath(outerX, outerY, outerW, outerH, outerRadius);
  host.ctx.fill();

  // Inner minimap background
  host.ctx.fillStyle = host.isDarkMode ? '#2a2a2a' : '#f0f0f0';
  roundedRectPath(x, y, minimapWidth, minimapHeight, innerRadius);
  host.ctx.fill();

  // Draw border with rounded corners
  host.ctx.strokeStyle = host.isDarkMode ? '#999' : '#333';
  host.ctx.lineWidth = 1;
  roundedRectPath(x, y, minimapWidth, minimapHeight, innerRadius);
  host.ctx.stroke();

  // Calculate crisp integer tile pixel size to ensure squares (disable fractional scaling)
  // We choose the largest integer tile size that fits both directions.
  let tilePixel: number;
  let mapPixelWidth: number;
  let mapPixelHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (host.minimapMode === 'isometric') {
    const maxTileWidth = Math.floor(minimapWidth * 2 / (host.mapWidth + host.mapHeight)) || 1;
    const maxTileHeight = Math.floor(minimapHeight * 4 / (host.mapWidth + host.mapHeight)) || 1;
    tilePixel = Math.max(1, Math.min(maxTileWidth, maxTileHeight)) * host.minimapZoom;
    
    // We can allow sub-pixel sizes here for smooth zooming or round it
    
    mapPixelWidth = (host.mapWidth + host.mapHeight) * (tilePixel / 2);
    mapPixelHeight = (host.mapWidth + host.mapHeight) * (tilePixel / 4);
    
    offsetX = x + minimapWidth / 2 - (host.mapWidth - host.mapHeight) * (tilePixel / 4) + host.minimapPanX;
    offsetY = y + minimapHeight / 2 - (host.mapWidth + host.mapHeight) * (tilePixel / 8) + host.minimapPanY;
  } else {
    const maxTileWidth = Math.floor(minimapWidth / host.mapWidth) || 1;
    const maxTileHeight = Math.floor(minimapHeight / host.mapHeight) || 1;
    tilePixel = Math.max(1, Math.min(maxTileWidth, maxTileHeight)) * host.minimapZoom;

    mapPixelWidth = host.mapWidth * tilePixel;
    mapPixelHeight = host.mapHeight * tilePixel;
    offsetX = x + Math.floor((minimapWidth - mapPixelWidth) / 2) + host.minimapPanX;
    offsetY = y + Math.floor((minimapHeight - mapPixelHeight) / 2) + host.minimapPanY;
  }

// Draw minimap contents within clipping region so zoom doesn't leak out
host.ctx.save();
roundedRectPath(x, y, minimapWidth, minimapHeight, innerRadius);
host.ctx.clip();

// Disable smoothing for pixel-perfect minimap (modern engines)
host.ctx.imageSmoothingEnabled = false;

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
  const allVisibleLayers = [...host.tileLayers].filter(l => l.visible);
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
  for (let tileY = 0; tileY < host.mapHeight; tileY++) {
    for (let tileX = 0; tileX < host.mapWidth; tileX++) {
      const index = tileY * host.mapWidth + tileX;

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

          if (host.minimapMode === 'isometric') {
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
            const layerIndex = host.tileLayers.indexOf(layer);
            fillColor = `hsl(${hue}, 55%, ${layerIndex === 0 ? '45%' : '60%'})`;
            strokeColor = `hsl(${hue}, 55%, ${layerIndex === 0 ? '35%' : '50%'})`;
          }

          host.ctx.fillStyle = fillColor;

          if (isDashed) {
            host.ctx.setLineDash([2, 2]);
          } else {
            host.ctx.setLineDash([]);
          }

          if (host.minimapMode === 'isometric') {
            host.ctx.beginPath();
            host.ctx.moveTo(pixelX, pixelY); // top
            host.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4); // right
            host.ctx.lineTo(pixelX, pixelY + tilePixel / 2); // bottom
            host.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4); // left
            host.ctx.fill();
            
            // Draw subtle stroke for clarity
            host.ctx.strokeStyle = strokeColor;
            host.ctx.lineWidth = 0.5;
            host.ctx.stroke();
          } else {
            host.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
            if (isDashed || layer.type === 'collision') {
              host.ctx.strokeStyle = strokeColor;
              host.ctx.lineWidth = 0.5;
              host.ctx.strokeRect(pixelX, pixelY, tilePixel, tilePixel);
            }
          }

          host.ctx.setLineDash([]);
        }
      }
    }
  }

  // Also render sprite objects for each visible layer on minimap
  for (let layerIndex = 0; layerIndex < host.tileLayers.length; layerIndex++) {
    const layer = host.tileLayers[layerIndex];
    if (!layer.visible) continue;

    const spriteObjects = host.placedSpriteObjects.get(layer.type);
    if (spriteObjects && spriteObjects.length > 0) {
      for (const spriteObj of spriteObjects) {
        let pixelX: number;
        let pixelY: number;

        if (host.minimapMode === 'isometric') {
          pixelX = offsetX + (spriteObj.anchorX - spriteObj.anchorY) * (tilePixel / 2);
          pixelY = offsetY + (spriteObj.anchorX + spriteObj.anchorY) * (tilePixel / 4);
        } else {
          pixelX = offsetX + spriteObj.anchorX * tilePixel;
          pixelY = offsetY + spriteObj.anchorY * tilePixel;
        }
        
        // Use a slightly brighter color for sprite objects based on layer type
        if (layer.type === 'background') {
          host.ctx.fillStyle = `rgba(50, 205, 50, 0.9)`; // Lighter green
        } else if (layer.type === 'object') {
          host.ctx.fillStyle = `rgba(65, 105, 225, 0.9)`; // Royal blue
        } else {
          const hue = (spriteObj.gid * 137.5) % 360;
          host.ctx.fillStyle = `hsl(${hue}, 70%, ${layerIndex === 0 ? '50%' : '65%'})`;
        }
        
        if (host.minimapMode === 'isometric') {
          host.ctx.beginPath();
          host.ctx.moveTo(pixelX, pixelY);
          host.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4);
          host.ctx.lineTo(pixelX, pixelY + tilePixel / 2);
          host.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4);
          host.ctx.fill();
        } else {
          host.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
        }
      }
    }
  }

  // Render ObjectInstances on the minimap
  if (host.objectInstances && host.objectInstances.size > 0) {
    for (const instance of host.objectInstances.values()) {
      // Find the layer this instance belongs to
      const instanceLayer = host.tileLayers.find(l => l.id.toString() === instance.layerId);
      if (!instanceLayer || !instanceLayer.visible) continue;

      let pixelX: number;
      let pixelY: number;

      if (host.minimapMode === 'isometric') {
        pixelX = offsetX + (instance.gridX - instance.gridY) * (tilePixel / 2);
        pixelY = offsetY + (instance.gridX + instance.gridY) * (tilePixel / 4);
      } else {
        pixelX = offsetX + instance.gridX * tilePixel;
        pixelY = offsetY + instance.gridY * tilePixel;
      }

      // Color based on layer type
      const layerName = (instanceLayer.name || '').toLowerCase();
      if (layerName.includes('object')) {
        host.ctx.fillStyle = `rgba(30, 144, 255, 0.8)`; // Blue for objects
      } else if (layerName.includes('background')) {
        host.ctx.fillStyle = `rgba(34, 139, 34, 0.8)`; // Green for background
      } else {
        host.ctx.fillStyle = `rgba(200, 200, 200, 0.8)`; // Gray for other
      }

      if (host.minimapMode === 'isometric') {
        host.ctx.beginPath();
        host.ctx.moveTo(pixelX, pixelY);
        host.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4);
        host.ctx.lineTo(pixelX, pixelY + tilePixel / 2);
        host.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4);
        host.ctx.fill();
      } else {
        host.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
      }
    }
  }

  // Draw collision layer tiles last so they appear on top of everything
  for (const collisionLayer of collisionLayers) {
    for (let tileY = 0; tileY < host.mapHeight; tileY++) {
      for (let tileX = 0; tileX < host.mapWidth; tileX++) {
        const index = tileY * host.mapWidth + tileX;
        const gid = collisionLayer.data[index];

        if (gid > 0) {
          let pixelX: number;
          let pixelY: number;

          if (host.minimapMode === 'isometric') {
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

          host.ctx.fillStyle = fillColor;

          if (isDashed) {
            host.ctx.setLineDash([2, 2]);
          } else {
            host.ctx.setLineDash([]);
          }

          if (host.minimapMode === 'isometric') {
            host.ctx.beginPath();
            host.ctx.moveTo(pixelX, pixelY);
            host.ctx.lineTo(pixelX + tilePixel / 2, pixelY + tilePixel / 4);
            host.ctx.lineTo(pixelX, pixelY + tilePixel / 2);
            host.ctx.lineTo(pixelX - tilePixel / 2, pixelY + tilePixel / 4);
            host.ctx.fill();
            
            host.ctx.strokeStyle = strokeColor;
            host.ctx.lineWidth = 0.5;
            host.ctx.stroke();
          } else {
            host.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
            if (isDashed) {
              host.ctx.strokeStyle = strokeColor;
              host.ctx.lineWidth = 0.5;
              host.ctx.strokeRect(pixelX, pixelY, tilePixel, tilePixel);
            }
          }

          host.ctx.setLineDash([]);
        }
      }
    }
  }

  // Optional subtle grid for clarity when tiles are large enough
  if (tilePixel >= 3) {
    host.ctx.strokeStyle = host.isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
    host.ctx.lineWidth = 1;
    for (let ty = 0; ty < host.mapHeight; ty++) {
      for (let tx = 0; tx < host.mapWidth; tx++) {
        if (host.minimapMode === 'isometric') {
          const gx = offsetX + (tx - ty) * (tilePixel / 2);
          const gy = offsetY + (tx + ty) * (tilePixel / 4);
          host.ctx.beginPath();
          host.ctx.moveTo(gx, gy);
          host.ctx.lineTo(gx + tilePixel / 2, gy + tilePixel / 4);
          host.ctx.lineTo(gx, gy + tilePixel / 2);
          host.ctx.lineTo(gx - tilePixel / 2, gy + tilePixel / 4);
          host.ctx.stroke();
        } else {
          const gx = offsetX + tx * tilePixel + 0.25;
          const gy = offsetY + ty * tilePixel + 0.25;
          host.ctx.strokeRect(gx, gy, tilePixel - 0.5, tilePixel - 0.5);
        }
      }
    }
  }

  // Draw red overlay for hovered cell in minimap
  if (host.minimapHoverCoords && tilePixel > 0) {
    const { x: hoverX, y: hoverY } = host.minimapHoverCoords;
    
    host.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    
    if (host.minimapMode === 'isometric') {
      const gx = offsetX + (hoverX - hoverY) * (tilePixel / 2);
      const gy = offsetY + (hoverX + hoverY) * (tilePixel / 4);
      host.ctx.beginPath();
      host.ctx.moveTo(gx, gy);
      host.ctx.lineTo(gx + tilePixel / 2, gy + tilePixel / 4);
      host.ctx.lineTo(gx, gy + tilePixel / 2);
      host.ctx.lineTo(gx - tilePixel / 2, gy + tilePixel / 4);
      host.ctx.fill();
    } else {
      const pixelX = offsetX + hoverX * tilePixel;
      const pixelY = offsetY + hoverY * tilePixel;
      host.ctx.fillRect(pixelX, pixelY, tilePixel, tilePixel);
    }
  }

  if (host.activeEventPreview && tilePixel > 0) {
    const { x: aX, y: aY, width, height } = host.activeEventPreview;
    const w = Math.max(1, width);
    const h = Math.max(1, height);

    const drawMinimapShape = (sX: number, sY: number, sW: number, sH: number, fill: string, stroke: string) => {
      host.ctx.fillStyle = fill;
      host.ctx.strokeStyle = stroke;
      host.ctx.lineWidth = 1;

      if (host.minimapMode === 'isometric') {
        const getMinimapPoint = (mX: number, mY: number) => ({
          x: offsetX + (mX - mY) * (tilePixel / 2),
          y: offsetY + (mX + mY) * (tilePixel / 4)
        });

        const p1 = getMinimapPoint(sX, sY);
        const p2 = getMinimapPoint(sX + sW - 1, sY);
        const p3 = getMinimapPoint(sX + sW - 1, sY + sH - 1);
        const p4 = getMinimapPoint(sX, sY + sH - 1);

        host.ctx.beginPath();
        host.ctx.moveTo(p1.x, p1.y);
        host.ctx.lineTo(p2.x + tilePixel / 2, p2.y + tilePixel / 4);
        host.ctx.lineTo(p3.x, p3.y + tilePixel / 2);
        host.ctx.lineTo(p4.x - tilePixel / 2, p4.y + tilePixel / 4);
        host.ctx.closePath();

        host.ctx.fill();
        host.ctx.stroke();
      } else {
        const pixelX = offsetX + sX * tilePixel;
        const pixelY = offsetY + sY * tilePixel;
        host.ctx.fillRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
        host.ctx.strokeRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
      }
    };

    if (w > 1 || h > 1) {
      drawMinimapShape(aX, aY, w, h, 'rgba(255, 165, 0, 0.2)', 'rgba(255, 140, 0, 0.4)');
    }
    drawMinimapShape(aX, aY, 1, 1, 'rgba(255, 165, 0, 0.6)', 'rgba(255, 140, 0, 0.9)');
  }

  if (host.activeHotspotPreview && tilePixel > 0) {
    const { x: hX, y: hY, width: hWidth, height: hHeight } = host.activeHotspotPreview;
    const hw = Math.max(1, hWidth);
    const hh = Math.max(1, hHeight);

    const drawMinimapShape2 = (sX: number, sY: number, sW: number, sH: number, fill: string, stroke: string) => {
      host.ctx.fillStyle = fill;
      host.ctx.strokeStyle = stroke;
      host.ctx.lineWidth = 1;

      if (host.minimapMode === 'isometric') {
        const getMinimapPoint = (mX: number, mY: number) => ({
          x: offsetX + (mX - mY) * (tilePixel / 2),
          y: offsetY + (mX + mY) * (tilePixel / 4)
        });

        const p1 = getMinimapPoint(sX, sY);
        const p2 = getMinimapPoint(sX + sW - 1, sY);
        const p3 = getMinimapPoint(sX + sW - 1, sY + sH - 1);
        const p4 = getMinimapPoint(sX, sY + sH - 1);

        host.ctx.beginPath();
        host.ctx.moveTo(p1.x, p1.y);
        host.ctx.lineTo(p2.x + tilePixel / 2, p2.y + tilePixel / 4);
        host.ctx.lineTo(p3.x, p3.y + tilePixel / 2);
        host.ctx.lineTo(p4.x - tilePixel / 2, p4.y + tilePixel / 4);
        host.ctx.closePath();

        host.ctx.fill();
        host.ctx.stroke();
      } else {
        const pixelX = offsetX + sX * tilePixel;
        const pixelY = offsetY + sY * tilePixel;
        host.ctx.fillRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
        host.ctx.strokeRect(pixelX, pixelY, sW * tilePixel, sH * tilePixel);
      }
    };

    if (hw > 1 || hh > 1) {
      drawMinimapShape2(hX, hY, hw, hh, 'rgba(236, 72, 153, 0.2)', 'rgba(219, 39, 119, 0.4)');
    }
    drawMinimapShape2(hX, hY, 1, 1, 'rgba(236, 72, 153, 0.6)', 'rgba(219, 39, 119, 0.9)');
  }

  // End clipping mask for minimap contents
  host.ctx.restore();
  
  // Draw minimalistic resize arrow icon at top-left corner
  host.ctx.strokeStyle = host.isDarkMode ? '#bbb' : '#666';
  host.ctx.lineWidth = 1.5;
  host.ctx.beginPath();
  // Simple diagonal arrow: top-left to bottom-right
  host.ctx.moveTo(x + 5, y + 5);
  host.ctx.lineTo(x + 15, y + 15);
  // Arrowhead on top-left end
  host.ctx.moveTo(x + 8, y + 5);
  host.ctx.lineTo(x + 5, y + 5);
  host.ctx.lineTo(x + 5, y + 8);
  // Arrowhead on bottom-right end
  host.ctx.moveTo(x + 15, y + 12);
  host.ctx.lineTo(x + 15, y + 15);
  host.ctx.lineTo(x + 12, y + 15);
  host.ctx.stroke();

  // Restore context state
  host.ctx.restore();
}
