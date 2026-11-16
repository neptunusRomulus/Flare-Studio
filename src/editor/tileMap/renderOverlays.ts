import type { TileLayer, Tool, MapObject } from '@/types';
import { COLLISION_LAYER_TYPE } from './constants';
import { MAP_TARGET_CURSOR } from '@/components/mapTargets';

export interface RenderOverlaysHost {
  activeEventPreview: { x: number; y: number; width: number; height: number } | null;
  activeHotspotPreview: { x: number; y: number; width: number; height: number } | null;
  ctx: CanvasRenderingContext2D;
  currentSelectionTool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular';
  debugMode: boolean;
  drawActiveEventPreview(): void;
  drawActiveHotspotPreview(): void;
  drawActorPlaceholders(): void;
  drawCircularSelectionPreview(): void;
  drawCollisionOverlay(): void;
  drawDebugInfo(): void;
  drawEventDragHover(): void;
  drawEvents(): void;
  drawGrid(): void;
  drawHeroPosition(): void;
  drawHover(): void;
  drawMiniMap(): void;
  drawNpcDragHover(): void;
  drawRectangularSelectionPreview(): void;
  drawSelection(): void;
  drawShapePreview(): void;
  drawStampPreview(): void;
  drawTiles(): void;
  eventDragHoverX: number;
  eventDragHoverY: number;
  getActiveLayer(): TileLayer | null;
  getObjectsAtPosition(x: number, y: number): MapObject[];
  hoverX: number;
  hoverY: number;
  isDarkMode: boolean;
  isDrawingShape: boolean;
  isSelecting: boolean;
  mapCanvas: HTMLCanvasElement;
  mapHeight: number;
  mapToScreen(mapX: number, mapY: number): { x: number; y: number };
  mapWidth: number;
  npcDragHoverX: number;
  npcDragHoverY: number;
  selection: { active: boolean; startX: number; startY: number; endX: number; endY: number; tiles: Array<{x: number, y: number, gid: number}>; };
  shapeDrawing: { active: boolean; startX: number; startY: number; endX: number; endY: number; preview: Array<{x: number, y: number}>; };
  tileLayers: TileLayer[];
  tileSizeX: number;
  tileSizeY: number;
  zoom: number;
}

export function draw(host: RenderOverlaysHost): void {
  // Clear canvas
  host.ctx.clearRect(0, 0, host.mapCanvas.width, host.mapCanvas.height);
  
  // Save context state
  host.ctx.save();
  
  // Apply zoom and pan transformations to the drawing context
  // Note: We don't apply transformations here since they're already applied in mapToScreen()
  
  // Draw grid
  host.drawGrid();
  
  // Draw tiles
  host.drawTiles();

  // Draw hover
  if (host.hoverX >= 0 && host.hoverY >= 0) {
    host.drawHover();
  }
  
  // Draw NPC drag hover (external drag-drop from NPC list)
  if (host.npcDragHoverX >= 0 && host.npcDragHoverY >= 0) {
    host.drawNpcDragHover();
  }

  // Draw event drag hover (external drag-drop from Event list)
  if (host.eventDragHoverX >= 0 && host.eventDragHoverY >= 0) {
    host.drawEventDragHover();
  }
  
  // Draw selection
  host.drawSelection();
  
  // Draw hero position marker
  host.drawHeroPosition();

  // Draw NPC/enemy placeholders when no tile assigned
  host.drawActorPlaceholders();

  // Draw events when event layer is active
  host.drawEvents();

  // Draw shape preview
  host.drawShapePreview();

  // Draw active event preview if interacting with EventDialog
  host.drawActiveEventPreview();

  // Draw active hotspot preview (pink overlay)
  host.drawActiveHotspotPreview();

  // Draw collision overlay last so collision borders are always on top.
  host.drawCollisionOverlay();
  
  // Restore context state
  host.ctx.restore();
  
  // Update mini map (not affected by zoom/pan)
  host.drawMiniMap();
  
  // Draw stamp preview
  host.drawStampPreview();
  
  // Draw debug info if enabled
  host.drawDebugInfo();
}

export function drawCollisionOverlay(host: RenderOverlaysHost): void {
  const collisionLayer = host.tileLayers.find(l => l.type === COLLISION_LAYER_TYPE && l.visible);
  if (!collisionLayer) return;

  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;

  host.ctx.save();
  host.ctx.globalAlpha = 1;
  host.ctx.lineWidth = Math.max(1, Math.min(2.5, 1.4 / host.zoom));

  for (let y = 0; y < host.mapHeight; y++) {
    for (let x = 0; x < host.mapWidth; x++) {
      const index = y * host.mapWidth + x;
      const gid = collisionLayer.data[index];
      if (gid <= 0) continue;

      const p = host.mapToScreen(x, y);

      host.ctx.beginPath();
      host.ctx.moveTo(p.x, p.y - halfTileY);
      host.ctx.lineTo(p.x + halfTileX, p.y);
      host.ctx.lineTo(p.x, p.y + halfTileY);
      host.ctx.lineTo(p.x - halfTileX, p.y);
      host.ctx.closePath();

      host.ctx.lineWidth = 2;
      host.ctx.setLineDash([]);
      host.ctx.globalAlpha = 1;

      switch (gid) {
        case 1:
          // full bold white stroke + 30% white fill overlay
          host.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          host.ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
          host.ctx.fill();
          break;
        case 2:
          // full bold white dashed stroke + 30% white fill overlay
          host.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          host.ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
          host.ctx.setLineDash([6, 4]);
          host.ctx.fill();
          break;
        case 3:
          // half opacity bold white stroke
          host.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          break;
        case 4:
          // half opacity bold white dashed stroke
          host.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          host.ctx.setLineDash([6, 4]);
          break;
        default:
          host.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          break;
      }

      host.ctx.stroke();
    }
  }

  host.ctx.restore();
}

export function drawDebugInfo(host: RenderOverlaysHost): void {
  if (!host.debugMode) return;
  
  // Draw diamond boundaries for all tiles using EXACTLY the same logic as drawHover
  host.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  host.ctx.lineWidth = 1;
  
  for (let tileY = 0; tileY < host.mapHeight; tileY++) {
    for (let tileX = 0; tileX < host.mapWidth; tileX++) {
      // Use the exact same positioning logic as drawHover
      const screenPos = host.mapToScreen(tileX, tileY);
      const halfTileX = (host.tileSizeX / 2) * host.zoom;
      const halfTileY = (host.tileSizeY / 2) * host.zoom;
      
      // Draw diamond shape using the same exact pattern as hover
      host.ctx.beginPath();
      host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
      host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
      host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
      host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
      host.ctx.closePath();
      host.ctx.stroke();
      
      // ALSO draw where the tile image would actually be positioned
      host.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      host.ctx.lineWidth = 1;
      
// Calculate where the tile image is actually drawn (matching drawTile logic)
const scaledTileX = host.tileSizeX * host.zoom;
const scaledTileY = host.tileSizeY * host.zoom;
const groundY = screenPos.y + halfTileY;
const destX = screenPos.x - (scaledTileX / 2);
const destY = groundY - scaledTileY;
      
      // Draw rectangle showing where the tile image is actually placed
      host.ctx.strokeRect(destX, destY, scaledTileX, scaledTileY);
      
      // Reset color for coordinates
      host.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      
      // Draw tile coordinates
      host.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      host.ctx.font = '10px Arial';
      host.ctx.textAlign = 'center';
      host.ctx.fillText(`${tileX},${tileY}`, screenPos.x, screenPos.y);
    }
  }
}

export function drawGrid(host: RenderOverlaysHost): void {
  // Use different grid colors based on dark mode
  host.ctx.strokeStyle = host.isDarkMode ? '#666' : '#999';
  host.ctx.lineWidth = Math.max(1, Math.min(3, 2 / host.zoom)); // Make lines more visible
  host.ctx.globalAlpha = 0.8; // Slightly transparent
  
  // Draw diamond-shaped grid cells for isometric view
  for (let mapY = 0; mapY < host.mapHeight; mapY++) {
    for (let mapX = 0; mapX < host.mapWidth; mapX++) {
      const screenPos = host.mapToScreen(mapX, mapY);
      const halfTileX = (host.tileSizeX / 2) * host.zoom;
      const halfTileY = (host.tileSizeY / 2) * host.zoom;
      
      // Draw diamond outline for each cell
      host.ctx.beginPath();
      host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
      host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
      host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
      host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
      host.ctx.closePath();
      host.ctx.stroke();
    }
  }
  
  host.ctx.globalAlpha = 1; // Reset alpha
}

export function drawHover(host: RenderOverlaysHost): void {
  const screenPos = host.mapToScreen(host.hoverX, host.hoverY);
  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;
  
  // Check if we're hovering over an object on an interactive layer
  const activeLayer = host.getActiveLayer();
  const interactiveLayers = ['enemy', 'npc', 'object', 'event', 'background'];
  const hasObjectAtPosition = activeLayer && 
                             interactiveLayers.includes(activeLayer.type) && 
                             host.getObjectsAtPosition(host.hoverX, host.hoverY).length > 0;
  
  if (hasObjectAtPosition) {
    // Draw orange glow effect for objects
    host.ctx.save();
    
    // Create orange glow with multiple layers
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
    
    // Draw bright orange border
    host.ctx.shadowColor = 'transparent';
    host.ctx.shadowBlur = 0;
    host.ctx.strokeStyle = '#ff6b00';
    host.ctx.lineWidth = Math.max(1, Math.min(3, 3 / host.zoom));
    
    host.ctx.beginPath();
    host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    host.ctx.closePath();
    host.ctx.stroke();
    
    host.ctx.restore();
  } else {
    // Hover outline: per drawing target colour (Map layer), blue elsewhere
    const t = activeLayer?.type;
    host.ctx.strokeStyle = t && t in MAP_TARGET_CURSOR ? MAP_TARGET_CURSOR[t as keyof typeof MAP_TARGET_CURSOR] : '#007acc';
    host.ctx.lineWidth = Math.max(1, Math.min(3, 2 / host.zoom)); // Scale line width inversely with zoom, but constrain to 1-3px
    
    host.ctx.beginPath();
    host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    host.ctx.closePath();
    host.ctx.stroke();
  }
}

export function drawNpcDragHover(host: RenderOverlaysHost): void {
  const screenPos = host.mapToScreen(host.npcDragHoverX, host.npcDragHoverY);
  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;
  
  // Blue hover outline - same as default hover
  host.ctx.strokeStyle = '#007acc';
  host.ctx.lineWidth = Math.max(1, Math.min(3, 2 / host.zoom));
  
  host.ctx.beginPath();
  host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
  host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
  host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
  host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
  host.ctx.closePath();
  host.ctx.stroke();
}

export function drawEventDragHover(host: RenderOverlaysHost): void {
  const screenPos = host.mapToScreen(host.eventDragHoverX, host.eventDragHoverY);
  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;

  host.ctx.save();

  // Orange filled diamond
  host.ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
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

  host.ctx.strokeStyle = '#ffffff';
  host.ctx.lineWidth = Math.max(1, Math.min(2, 1.5 * host.zoom));
  host.ctx.lineCap = 'round';

  // Clock circle
  host.ctx.beginPath();
  host.ctx.arc(cx, cy, r, 0, Math.PI * 2);
  host.ctx.stroke();

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

export function drawSelection(host: RenderOverlaysHost): void {
  // Draw selection preview for drag-based tools
  if (host.isSelecting && (host.currentSelectionTool === 'rectangular' || host.currentSelectionTool === 'circular')) {
    host.ctx.strokeStyle = '#ff6b00';
    host.ctx.lineWidth = Math.max(1, Math.min(2, 2 / host.zoom));
    host.ctx.setLineDash([5, 5]);

    if (host.currentSelectionTool === 'rectangular') {
      host.drawRectangularSelectionPreview();
    } else if (host.currentSelectionTool === 'circular') {
      host.drawCircularSelectionPreview();
    }

    host.ctx.setLineDash([]); // Reset line dash
  }

  // Draw active selection
  if (host.selection.active && host.selection.tiles.length > 0) {
    // Draw light blue fill for selected tiles
    host.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    host.ctx.strokeStyle = '#007acc';
    host.ctx.lineWidth = Math.max(1, Math.min(2.5, 2.5 / host.zoom));
    
    // Draw outline around each selected tile
    host.selection.tiles.forEach(tile => {
      const screenPos = host.mapToScreen(tile.x, tile.y);
      const halfTileX = (host.tileSizeX / 2) * host.zoom;
      const halfTileY = (host.tileSizeY / 2) * host.zoom;
      
      host.ctx.beginPath();
      host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
      host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
      host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
      host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
      host.ctx.closePath();
      host.ctx.fill();
      host.ctx.stroke();
    });
  }
}

export function drawRectangularSelectionPreview(host: RenderOverlaysHost): void {
  const minX = Math.min(host.selection.startX, host.selection.endX);
  const maxX = Math.max(host.selection.startX, host.selection.endX);
  const minY = Math.min(host.selection.startY, host.selection.endY);
  const maxY = Math.max(host.selection.startY, host.selection.endY);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x >= 0 && x < host.mapWidth && y >= 0 && y < host.mapHeight) {
        const screenPos = host.mapToScreen(x, y);
        const halfTileX = (host.tileSizeX / 2) * host.zoom;
        const halfTileY = (host.tileSizeY / 2) * host.zoom;
        
        host.ctx.beginPath();
        host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        host.ctx.closePath();
        host.ctx.stroke();
      }
    }
  }
}

export function drawCircularSelectionPreview(host: RenderOverlaysHost): void {
  const radius = Math.sqrt(Math.pow(host.selection.endX - host.selection.startX, 2) + Math.pow(host.selection.endY - host.selection.startY, 2));

  for (let y = 0; y < host.mapHeight; y++) {
    for (let x = 0; x < host.mapWidth; x++) {
      const distance = Math.sqrt(Math.pow(x - host.selection.startX, 2) + Math.pow(y - host.selection.startY, 2));
      if (distance <= radius) {
        const screenPos = host.mapToScreen(x, y);
        const halfTileX = (host.tileSizeX / 2) * host.zoom;
        const halfTileY = (host.tileSizeY / 2) * host.zoom;
        
        host.ctx.beginPath();
        host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
        host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
        host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
        host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
        host.ctx.closePath();
        host.ctx.stroke();
      }
    }
  }
}

export function drawActiveEventPreview(host: RenderOverlaysHost): void {
  if (!host.activeEventPreview) return;
  const { x, y, width, height } = host.activeEventPreview;

  const w = Math.max(1, width);
  const h = Math.max(1, height);

  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;

  host.ctx.save();
  
  // Draw the full area with lighter transparency
  if (w > 1 || h > 1) {
    const c1 = host.mapToScreen(x, y);
    const c2 = host.mapToScreen(x + w - 1, y);
    const c3 = host.mapToScreen(x + w - 1, y + h - 1);
    const c4 = host.mapToScreen(x, y + h - 1);

    host.ctx.beginPath();
    host.ctx.moveTo(c1.x, c1.y - halfTileY); // Top
    host.ctx.lineTo(c2.x + halfTileX, c2.y); // Right
    host.ctx.lineTo(c3.x, c3.y + halfTileY); // Bottom
    host.ctx.lineTo(c4.x - halfTileX, c4.y); // Left
    host.ctx.closePath();

    host.ctx.fillStyle = 'rgba(255, 165, 0, 0.2)';
    host.ctx.fill();

    host.ctx.strokeStyle = 'rgba(255, 140, 0, 0.4)';
    host.ctx.lineWidth = Math.max(1, 1 * host.zoom);
    host.ctx.stroke();
  }

  // Draw the single cell (x,y) with stronger overlay
  const origin = host.mapToScreen(x, y);
  host.ctx.beginPath();
  host.ctx.moveTo(origin.x, origin.y - halfTileY); // Top
  host.ctx.lineTo(origin.x + halfTileX, origin.y); // Right
  host.ctx.lineTo(origin.x, origin.y + halfTileY); // Bottom
  host.ctx.lineTo(origin.x - halfTileX, origin.y); // Left
  host.ctx.closePath();

  host.ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
  host.ctx.fill();

  host.ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)';
  host.ctx.lineWidth = Math.max(2, 2 * host.zoom);
  host.ctx.stroke();

  host.ctx.restore();
}

export function drawActiveHotspotPreview(host: RenderOverlaysHost): void {
  if (!host.activeHotspotPreview) return;
  const { x, y, width, height } = host.activeHotspotPreview;

  const w = Math.max(1, width);
  const h = Math.max(1, height);

  const halfTileX = (host.tileSizeX / 2) * host.zoom;
  const halfTileY = (host.tileSizeY / 2) * host.zoom;

  host.ctx.save();
  
  // Draw the full area with lighter pink transparency
  if (w > 1 || h > 1) {
    const c1 = host.mapToScreen(x, y);
    const c2 = host.mapToScreen(x + w - 1, y);
    const c3 = host.mapToScreen(x + w - 1, y + h - 1);
    const c4 = host.mapToScreen(x, y + h - 1);

    host.ctx.beginPath();
    host.ctx.moveTo(c1.x, c1.y - halfTileY); // Top
    host.ctx.lineTo(c2.x + halfTileX, c2.y); // Right
    host.ctx.lineTo(c3.x, c3.y + halfTileY); // Bottom
    host.ctx.lineTo(c4.x - halfTileX, c4.y); // Left
    host.ctx.closePath();

    host.ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
    host.ctx.fill();

    host.ctx.strokeStyle = 'rgba(219, 39, 119, 0.4)';
    host.ctx.lineWidth = Math.max(1, 1 * host.zoom);
    host.ctx.stroke();
  }

  // Draw the single cell (x,y) with stronger pink overlay
  const origin = host.mapToScreen(x, y);
  host.ctx.beginPath();
  host.ctx.moveTo(origin.x, origin.y - halfTileY); // Top
  host.ctx.lineTo(origin.x + halfTileX, origin.y); // Right
  host.ctx.lineTo(origin.x, origin.y + halfTileY); // Bottom
  host.ctx.lineTo(origin.x - halfTileX, origin.y); // Left
  host.ctx.closePath();

  host.ctx.fillStyle = 'rgba(236, 72, 153, 0.6)';
  host.ctx.fill();

  host.ctx.strokeStyle = 'rgba(219, 39, 119, 0.9)';
  host.ctx.lineWidth = Math.max(2, 2 * host.zoom);
  host.ctx.stroke();

  host.ctx.restore();
}

export function drawShapePreview(host: RenderOverlaysHost): void {
  if (!host.isDrawingShape || host.shapeDrawing.preview.length === 0) return;

  host.ctx.strokeStyle = '#0099ff';
  host.ctx.lineWidth = Math.max(1, Math.min(2, 2 / host.zoom));
  host.ctx.setLineDash([3, 3]);

  // Draw preview outline around each tile in the shape
  host.shapeDrawing.preview.forEach(point => {
    const screenPos = host.mapToScreen(point.x, point.y);
    const halfTileX = (host.tileSizeX / 2) * host.zoom;
    const halfTileY = (host.tileSizeY / 2) * host.zoom;
    
    host.ctx.beginPath();
    host.ctx.moveTo(screenPos.x, screenPos.y - halfTileY); // Top
    host.ctx.lineTo(screenPos.x + halfTileX, screenPos.y); // Right
    host.ctx.lineTo(screenPos.x, screenPos.y + halfTileY); // Bottom
    host.ctx.lineTo(screenPos.x - halfTileX, screenPos.y); // Left
    host.ctx.closePath();
    host.ctx.stroke();
  });

  host.ctx.setLineDash([]); // Reset line dash
}
