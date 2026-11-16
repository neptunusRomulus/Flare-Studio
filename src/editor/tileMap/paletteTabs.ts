import type { LayerTilesetEntry } from '@/editor/TileMapEditor';
import { TileDetector } from '@/editor/tileDetection';
import { COLLISION_LAYER_TYPE, GAME_SETTINGS_LAYER_TYPE, INTERNAL_TILESET_FILENAMES } from './constants';
import { debugLog } from '@/lib/debugLog';
import { clearSlotCells, type SlotLike } from '@/editor/slotCells';
import { slotGroup } from '@/editor/sharedSlots';
import type { TileLayer, Tool } from '@/types';

export interface PaletteTabsHost {
  activeGid: number;
  activeGidCallback: ((gid: number) => void) | null;
  activeLayerId: number | null;
  activeStamp: import('@/types').Stamp | null;
  clearSelection(): void;
  clearTilePalette(): void;
  collisionTilesetLoading: boolean;
  createTilePalette(preserveOrder?: boolean): void;
  currentProjectPath: string | null;
  currentStampMode: 'select' | 'create' | 'place';
  detectedTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number; }>;
  dispatchBrushEvent(action: string, data: number | { from: number; to: number }): void;
  draw(): void;
  ensureCollisionTileset(): void;
  extractFileSourcePath(file: File): string | null;
  getCachedTilesetImage(layerType: string, tabId: number): { image: HTMLImageElement; dataUrl: string } | null;
  getLayerTilesetOrFallback(layerType: string): LayerTilesetEntry | null;
  handleBrushMerge(tileIndex: number, wrapper: HTMLElement): void;
  handleBrushRemove(tileIndex: number): void;
  handleBrushSeparate(tileIndex: number): void;
  hideCollisionBrushTooltip(immediate?: boolean): void;
  layerActiveGid: Map<string, number>;
  layerActiveTabId: Map<string, number>;
  layerCellTilesetKey: Map<string, Array<string | null>>;
  layerTabs: Map<string, Array<{ id: number; name: string; data?: number[]; tileset?: LayerTilesetEntry; detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>; brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>; }>>;
  layerTileData: Map<string, Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number; }>>;
  layerTilesets: Map<string, LayerTilesetEntry>;
  logLayerGidChanges(before: Map<string, { unique: number[]; nonZeroCount: number }>, after: Map<string, { unique: number[]; nonZeroCount: number }>, sourceLayerType: string): void;
  mapHeight: number;
  mapWidth: number;
  multiSelectedBrushes: Set<number>;
  nextLayerTabId: number;
  normalizeTilesetKey(key: string | null | undefined): string | null;
  paletteClickListener: ((e: Event) => void) | null;
  refreshTilePalette(preserveOrder?: boolean): void;
  saveTilesetToMapFile(projectPath?: string): Promise<void>;
  setActiveLayerTab(layerType: string, tabId: number): void;
  setCurrentLayerActiveGid(gid: number): void;
  setLayerTileset(layerType: string, file: File, options?: { skipApply?: boolean }): void;
  setupPaletteEventDelegation(): void;
  snapshotLayerGids(): Map<string, { unique: number[]; nonZeroCount: number }>;
  stampPreview: { x: number; y: number; width: number; height: number; visible: boolean };
  tileCount: number;
  tileDetector: TileDetector;
  tileLayers: TileLayer[];
  tileSizeX: number;
  tileSizeY: number;
  tilesetColumns: number;
  tilesetFileName: string | null;
  tilesetImage: HTMLImageElement | null;
  tilesetMargin?: number;
  tilesetRows: number;
  tilesetSourcePath: string | null;
  tilesetSpacing?: number;
  tilesetTileHeight?: number;
  tilesetTileWidth?: number;
  tool: Tool;
  updateActiveGid(gid: number): void;
  updateActiveTile(): void;
  updateCurrentTileset(layerType: string): void;
}


export function refreshTilePalette(host: PaletteTabsHost, preserveOrder: boolean = false): void {
  if (host.tilesetImage) {
    host.createTilePalette(preserveOrder);

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

export function getDetectedTileInfo(host: PaletteTabsHost): Array<{gid: number, width: number, height: number, sourceX: number, sourceY: number}> {
  const tileInfo: Array<{gid: number, width: number, height: number, sourceX: number, sourceY: number}> = [];
  host.detectedTileData.forEach((data, gid) => {
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

export function getDetectedTilesForLayer(host: PaletteTabsHost, layerType: string): Array<[number, { sourceX: number; sourceY: number; width: number; height: number }]> {
  const layerTiles = host.layerTileData.get(layerType);
  if (layerTiles) {
    return Array.from(layerTiles.entries());
  }
  return [];
}

export function getCurrentLayerActiveGid(host: PaletteTabsHost): number {
  const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (activeLayer) {
    return host.layerActiveGid.get(activeLayer.type) || 0;
  }
  return 0;
}

export function setCurrentLayerActiveGid(host: PaletteTabsHost, gid: number): void {
  const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (activeLayer) {
    host.layerActiveGid.set(activeLayer.type, gid);
    // Update global activeGid for UI consistency
    host.activeGid = gid;
    if (host.activeGidCallback) {
      try {
        host.activeGidCallback(host.activeGid);
      } catch (_e) { void _e; }
    }
    // Clear any multi-tile selection when a single tile is selected
    host.clearSelection();
    // Force redraw to ensure selection highlight is cleared
    host.draw();
  }
}

export function updateActiveGid(host: PaletteTabsHost, gid: number): void {
  host.activeGid = gid;
  if (host.activeGidCallback) {
    try {
      host.activeGidCallback(host.activeGid);
    } catch (_e) { void _e; }
  }
}

export function setActiveGidCallback(host: PaletteTabsHost, cb: ((gid: number) => void) | null): void {
  host.activeGidCallback = cb;
  // Immediately notify with current value if callback provided
  if (cb) {
    try {
      cb(host.activeGid);
    } catch (_e) { void _e; }
  }
}

export function setActiveGid(host: PaletteTabsHost, gid: number): void {
  // Hide stamp preview when selecting a single tile
  host.stampPreview.visible = false;
  // Clear multi-selected brushes so single tile painting works correctly
  host.multiSelectedBrushes.clear();
  // Clear active stamp so we use single tile painting, not stamp placement
  host.activeStamp = null;
  host.currentStampMode = 'select';
  // Set tool to tiles mode for brush painting
  host.tool = 'tiles';
  host.setCurrentLayerActiveGid(gid);
}

export function getLayerTabs(host: PaletteTabsHost, layerType: string) {
  return host.layerTabs.get(layerType) || [];
}

export function getActiveLayerTabId(host: PaletteTabsHost, layerType: string): number | null {
  const activeId = host.layerActiveTabId.get(layerType);
  if (typeof activeId === 'number') return activeId;

  const tabs = host.layerTabs.get(layerType) || [];
  if (tabs.length > 0) {
    const fallbackId = tabs[0].id;
    host.layerActiveTabId.set(layerType, fallbackId);
    return fallbackId;
  }

  return null;
}

export function clearTilePalette(host: PaletteTabsHost): void {
  const container = document.getElementById('tilesContainer');
  if (container) {
    container.innerHTML = '';
  }
  host.hideCollisionBrushTooltip(true);
}

export function updateTilePaletteSelection(host: PaletteTabsHost): void {
  // Update the active GID display
  const activeGidSpan = document.getElementById('activeGid');
  if (activeGidSpan) {
    activeGidSpan.textContent = host.activeGid.toString();
  }

  // Update tile palette visual selection
  const tiles = document.querySelectorAll('.tile-palette .tile');
  tiles.forEach((tile, index) => {
    const tileElement = tile as HTMLElement;
    if (index === host.activeGid - 1) {
      tileElement.classList.add('selected');
      tileElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      tileElement.classList.remove('selected');
    }
  });
}

export function createTilePalette(host: PaletteTabsHost, preserveOrder: boolean = false): void {
  
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
  
  if (!host.tilesetImage) {
    return;
  }
  
  container.innerHTML = '';
  
  host.hideCollisionBrushTooltip(true);

  try {
    container.style.position = 'relative';
    container.style.overflow = 'auto';
    const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
    if (activeLayer) {
      const tabs = host.layerTabs.get(activeLayer.type) || [];
      const activeTabId = host.layerActiveTabId.get(activeLayer.type);
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
          fullImg.addEventListener('load', () => { try { host.refreshTilePalette(true); } catch (_err) { void _err; } });
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

        const cell = host.tileSizeX || 32; // square grid size (fallback 32)
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
  
  if ((preserveOrder || host.detectedTileData.size > 0) && host.detectedTileData.size > 0) {
    // Use existing ordered data
    tilesToRender = Array.from(host.detectedTileData.entries()).map(([index, data]) => ({
      index, // This is now the current Map key (sequential)
      sourceX: data.sourceX,
      sourceY: data.sourceY,
      width: data.width,
      height: data.height
    }));
  } else {
    // Clear previous tile data and detect new tiles
    host.detectedTileData.clear();
    
    // Prefer grid slicing when a tileset/columns/rows or explicit tile sizes are available.
    const useGridSlice = !!(host.tilesetColumns > 0 && host.tilesetRows > 0 && host.tilesetTileWidth && host.tilesetTileHeight);
    if (useGridSlice) {
      const tileW = host.tilesetTileWidth || host.tileSizeX;
      const tileH = host.tilesetTileHeight || host.tileSizeY;
      const cols = host.tilesetColumns || Math.max(1, Math.floor(host.tilesetImage.width / tileW));
      const rows = host.tilesetRows || Math.max(1, Math.floor(host.tilesetImage.height / tileH));
      let idx = 1;
      const gridTiles: Array<{ index: number; sourceX: number; sourceY: number; width: number; height: number }> = [];
      for (let ry = 0; ry < rows; ry++) {
        for (let cx = 0; cx < cols; cx++) {
          // Account for optional tileset origin offset when slicing
          const originX = (host as unknown as { tilesetOriginX?: number }).tilesetOriginX ?? 0;
          const originY = (host as unknown as { tilesetOriginY?: number }).tilesetOriginY ?? 0;
          const sx = Math.round(originX + cx * tileW);
          const sy = Math.round(originY + ry * tileH);
          const w = Math.min(tileW, host.tilesetImage.width - sx);
          const h = Math.min(tileH, host.tilesetImage.height - sy);
          gridTiles.push({ index: idx++, sourceX: sx, sourceY: sy, width: w, height: h });
        }
      }
      tilesToRender = gridTiles.map(tile => {
        host.detectedTileData.set(tile.index, {
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
      const detectedTiles = host.tileDetector.detectVariableSizedTiles(host.tilesetImage);
      
      tilesToRender = detectedTiles.map(tile => {
        // Store tile data for later use in drawing
        host.detectedTileData.set(tile.index, {
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
    const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
    if (activeLayer) {
      const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
      for (const [gid, data] of host.detectedTileData.entries()) {
        layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
      }
      host.layerTileData.set(activeLayer.type, layerTileMap);
      // Persist detected tiles into the active tab if present so switching tabs preserves them
      const tabs = host.layerTabs.get(activeLayer.type) || [];
      const activeTabId = host.layerActiveTabId.get(activeLayer.type);
      if (activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) {
          tab.detectedTiles = new Map(layerTileMap);
        }
      }
      debugLog(`Stored ${layerTileMap.size} newly detected tiles for layer type: ${activeLayer.type}`);
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
        host.tilesetImage,
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
      debugLog(`Remove overlay clicked for tile index: ${tile.index}`);
      host.handleBrushRemove(tile.index);
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
        host.dispatchBrushEvent('dragstart', tile.index);
      } else {
        e.preventDefault();
      }
    });
    
    wrapper.addEventListener('dragend', (_e) => {
      wrapper.style.opacity = '1';
      host.dispatchBrushEvent('dragend', tile.index);
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
          host.dispatchBrushEvent('drop', { from: draggedTileIndex, to: targetTileIndex });
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
  host.setupPaletteEventDelegation();
}

export function setupPaletteEventDelegation(host: PaletteTabsHost): void {
  const container = document.getElementById('tilesContainer');
  if (!container) {
    return;
  }

  // Remove old listeners if they exist
  if (host.paletteClickListener) {
    container.removeEventListener('click', host.paletteClickListener);
  }

  // Create a single delegated click listener for all palette tiles
  host.paletteClickListener = (e: Event) => {
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
      debugLog('Handling merge tool selection (no auto-merge)');
      host.handleBrushMerge(tileIndex, wrapper);
      return;
    }

    if (currentBrushTool === 'separate') {
      debugLog('Handling separate tool');
      host.handleBrushSeparate(tileIndex);
      return;
    }

    if (currentBrushTool === 'remove') {
      debugLog('Handling remove tool');
      host.handleBrushRemove(tileIndex);
      return;
    }

    // Normal tile selection - support Ctrl/Cmd multi-select
    const isCtrl = (event.ctrlKey || event.metaKey);
    if (isCtrl) {
      if (host.multiSelectedBrushes.has(tileIndex)) {
        host.multiSelectedBrushes.delete(tileIndex);
        debugLog(`[PALETTE] Ctrl+Click: deselected tile ${tileIndex}, multiSelectedBrushes.size now = ${host.multiSelectedBrushes.size}`);
      } else {
        host.multiSelectedBrushes.add(tileIndex);
        debugLog(`[PALETTE] Ctrl+Click: selected tile ${tileIndex}, multiSelectedBrushes.size now = ${host.multiSelectedBrushes.size}`);
      }

      if (host.multiSelectedBrushes.size === 1) {
        const only = Array.from(host.multiSelectedBrushes.values())[0];
        host.setCurrentLayerActiveGid(only);
      }
      debugLog(`[PALETTE] Current multiSelectedBrushes: [${Array.from(host.multiSelectedBrushes.values()).join(',')}]`);
      host.updateActiveTile();
      return;
    }

    // Single selection: clear multi-selection and select this tile
    debugLog(`[PALETTE] Single click on tile ${tileIndex}, clearing multiSelectedBrushes (was size=${host.multiSelectedBrushes.size})`);
    host.multiSelectedBrushes.clear();
    host.setCurrentLayerActiveGid(tileIndex);
    host.updateActiveTile();
  };

  container.addEventListener('click', host.paletteClickListener as EventListener);
}

export function setActiveLayerTab(host: PaletteTabsHost, layerType: string, tabId: number): void {
  // First, save current layer's painting data to the previously active tab
  const currentActiveTabId = host.layerActiveTabId.get(layerType);
  if (currentActiveTabId !== undefined) {
    const tabs = host.layerTabs.get(layerType);
    const currentActiveTab = tabs?.find(t => t.id === currentActiveTabId);
    const layer = host.tileLayers.find(l => l.type === layerType);
    
    // Slots share one layer grid; each cell remembers its slot via layerCellTilesetKey.
    void currentActiveTab; void layer;
  }

  // Now switch to the new tab
  host.layerActiveTabId.set(layerType, tabId);
  
  // When switching active tab, update current tileset/palette to reflect tab's tileset if present
  const tabs = host.layerTabs.get(layerType);
  if (tabs) {
    const tab = tabs.find(t => t.id === tabId);
    const layer = host.tileLayers.find(l => l.type === layerType);
    
    void layer;
    
    // Check if tab has tileset metadata (may be loading or already loaded)
    if (tab && tab.tileset) {
      if (tab.tileset.image) {
        // Image is ready - apply tileset immediately
        const columns = (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0)
          ? tab.tileset.columns
          : (tab.tileset.image ? Math.max(1, Math.floor(tab.tileset.image.width / host.tileSizeX)) : 1);
        const rows = (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0)
          ? tab.tileset.rows
          : (tab.tileset.image ? Math.max(1, Math.floor(tab.tileset.image.height / host.tileSizeY)) : 1);
        const count = (typeof tab.tileset.count === 'number' && tab.tileset.count > 0)
          ? tab.tileset.count
          : Math.max(1, columns * rows);
        const tileWidth = (typeof tab.tileset.tileWidth === 'number' && tab.tileset.tileWidth > 0)
          ? tab.tileset.tileWidth
          : (tab.tileset.image ? Math.round(tab.tileset.image.width / Math.max(1, columns)) : host.tileSizeX);
        const tileHeight = (typeof tab.tileset.tileHeight === 'number' && tab.tileset.tileHeight > 0)
          ? tab.tileset.tileHeight
          : (tab.tileset.image ? Math.round(tab.tileset.image.height / Math.max(1, rows)) : host.tileSizeY);
        host.layerTilesets.set(layerType, {
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
          host.layerTileData.set(layerType, layerTileMap);
        }
        host.updateCurrentTileset(layerType);
      } else {
        // Tab has tileset metadata but image is still loading
        // Check the cache first before waiting
        const cachedTileset = host.getCachedTilesetImage(layerType, tabId);
        if (cachedTileset) {
          // Use cached image - apply tileset immediately
          tab.tileset.image = cachedTileset.image;
          const columns = (typeof tab.tileset.columns === 'number' && tab.tileset.columns > 0)
            ? tab.tileset.columns
            : Math.max(1, Math.floor(cachedTileset.image.width / host.tileSizeX));
          const rows = (typeof tab.tileset.rows === 'number' && tab.tileset.rows > 0)
            ? tab.tileset.rows
            : Math.max(1, Math.floor(cachedTileset.image.height / host.tileSizeY));
          const count = (typeof tab.tileset.count === 'number' && tab.tileset.count > 0)
            ? tab.tileset.count
            : Math.max(1, columns * rows);
          const tileWidth = (typeof tab.tileset.tileWidth === 'number' && tab.tileset.tileWidth > 0)
            ? tab.tileset.tileWidth
            : Math.round(cachedTileset.image.width / Math.max(1, columns));
          const tileHeight = (typeof tab.tileset.tileHeight === 'number' && tab.tileset.tileHeight > 0)
            ? tab.tileset.tileHeight
            : Math.round(cachedTileset.image.height / Math.max(1, rows));
          host.layerTilesets.set(layerType, {
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
            host.layerTileData.set(layerType, layerTileMap);
          }
          host.updateCurrentTileset(layerType);
        } else {
          // No cache available - wait for async loading
          // Store the tileset entry in layerTilesets even without image
          // The image will be updated when it finishes loading via the onload callback in loadProjectData
          host.layerTilesets.set(layerType, {
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
            host.layerTileData.set(layerType, layerTileMap);
          }
        }
      }
    } else if (tab) {
      // No tileset for this tab -> explicitly clear current tileset and palette
      // Delete any per-layer tileset so fallback isn't applied
      host.layerTilesets.delete(layerType);

      // Clear current display/state so new tab appears empty
      host.tilesetImage = null;
      host.tilesetFileName = null;
      host.tilesetColumns = 0;
      host.tilesetRows = 0;
      host.tileCount = 0;
      host.tilesetTileWidth = undefined;
      host.tilesetTileHeight = undefined;
      host.tilesetSpacing = undefined;
      host.tilesetMargin = undefined;

      // Load detected tiles from tab if present (may be empty Map)
      if (tab && tab.detectedTiles) {
        host.detectedTileData.clear();
        for (const [gid, data] of tab.detectedTiles.entries()) {
          host.detectedTileData.set(gid, data);
        }
        // Also ensure per-layer map is set
        const layerTileMap = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
        for (const [gid, data] of tab.detectedTiles.entries()) {
          layerTileMap.set(gid, { sourceX: data.sourceX, sourceY: data.sourceY, width: data.width, height: data.height, originX: data.originX, originY: data.originY });
        }
        host.layerTileData.set(layerType, layerTileMap);
      } else {
        host.detectedTileData.clear();
        host.layerTileData.delete(layerType);
      }

      // Reset active gid and palette UI
      host.updateActiveGid(0);
      host.clearTilePalette();
      host.draw();
      return;
    }
  }
  
  host.draw();
}

export function updateCurrentTileset(host: PaletteTabsHost, layerType: string): void {
  // For collision layer, ensure tileset is loaded first
  if (layerType === COLLISION_LAYER_TYPE && !host.layerTilesets.has(COLLISION_LAYER_TYPE)) {
    // If collision tileset is not loaded yet, start loading it
    if (!host.collisionTilesetLoading) {
      host.ensureCollisionTileset();
    }
    // If still loading, defer the palette update until the image is loaded
    // The image.onload callback will handle updating the palette
    if (host.collisionTilesetLoading) {
      return;
    }
  }
  
  const tileset = host.getLayerTilesetOrFallback(layerType);
  if (tileset) {
    const normalizedTileWidth = (typeof tileset.tileWidth === 'number' && tileset.tileWidth > 0)
      ? tileset.tileWidth
      : host.tileSizeX;
    const normalizedTileHeight = (typeof tileset.tileHeight === 'number' && tileset.tileHeight > 0)
      ? tileset.tileHeight
      : host.tileSizeY;
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

    host.tilesetImage = tileset.image;
    host.tilesetFileName = tileset.fileName;
    host.tilesetColumns = normalizedColumns;
    host.tilesetRows = normalizedRows;
    host.tileCount = normalizedCount;
    host.tilesetTileWidth = normalizedTileWidth;
    host.tilesetTileHeight = normalizedTileHeight;
    host.tilesetSpacing = tileset.spacing ?? 0;
    host.tilesetMargin = tileset.margin ?? 0;
    host.tilesetSourcePath = tileset.sourcePath ?? host.tilesetSourcePath;
    // Apply optional origin offset for palette placement (stored on tab.tileset.originX/Y)
    (host as unknown as { tilesetOriginX?: number }).tilesetOriginX = (tileset as unknown as { originX?: number }).originX ?? 0;
    (host as unknown as { tilesetOriginY?: number }).tilesetOriginY = (tileset as unknown as { originY?: number }).originY ?? 0;
    
    // Update global detectedTileData using layer-level data first, then active-tab data.
    // On project reopen, sliced metadata may exist only on the active tab payload.
    const layerTiles = host.layerTileData.get(layerType);
    const tabs = host.layerTabs.get(layerType) || [];
    const activeTabId = host.layerActiveTabId.get(layerType);
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
      host.layerTileData.set(layerType, new Map(activeTabTiles));
    }

    host.detectedTileData.clear();
    if (detectedTilesSource) {
      for (const [gid, data] of detectedTilesSource.entries()) {
        host.detectedTileData.set(gid, data);
      }
    }
    
// Restore the active GID for this layer.
// If no tile has ever been selected for this layer type, auto-select GID=1
// so that painting is not silently blocked by getCurrentLayerActiveGid() === 0.
let layerActiveGid = host.layerActiveGid.get(layerType) || 0;
if (layerActiveGid === 0 && host.tileCount > 0) {
  layerActiveGid = 1;
  host.layerActiveGid.set(layerType, 1);
}
host.updateActiveGid(layerActiveGid);
    
    host.createTilePalette();
  } else {
    debugLog('updateCurrentTileset: no tileset for layer', layerType);
    // Clear current tileset if no tileset for this layer type
    host.tilesetImage = null;
    host.tilesetFileName = null;
    host.tilesetColumns = 0;
    host.tilesetRows = 0;
    host.tileCount = 0;
    host.detectedTileData.clear();
host.updateActiveGid(0);
    host.clearTilePalette();
  }
}

export function handleFileUpload(host: PaletteTabsHost, file: File, type: 'tileset' | 'layerTileset', options?: { skipAutoSlice?: boolean }): void {
  const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (activeLayer && activeLayer.type === COLLISION_LAYER_TYPE) return;
  
  if (type === 'tileset') {
    // Treat uploads as layer-specific by default: assign to active layer's tileset
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const columns = Math.max(1, Math.floor(img.width / host.tileSizeX));
        const rows = Math.max(1, Math.floor(img.height / host.tileSizeY));
        const count = columns * rows;
        const tileWidth = columns > 0 ? Math.round(img.width / columns) : host.tileSizeX;
        const tileHeight = rows > 0 ? Math.round(img.height / rows) : host.tileSizeY;

        const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
        if (activeLayer) {
          // If caller requested to skip autoslice, store minimal tileset on the active tab
          if (options && options.skipAutoSlice) {
            // Find active tab and set its tileset without applying to layerTilesets or palette
            const tabs = host.layerTabs.get(activeLayer.type) || [];
            const activeTabId = host.layerActiveTabId.get(activeLayer.type);
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
              sourcePath: host.extractFileSourcePath(file)
            };
            if (tab) {
              tab.tileset = tilesetEntry;
            } else {
              // fallback: store in layerTilesets but do not apply/palette
              host.layerTilesets.set(activeLayer.type, tilesetEntry);
            }
            host.draw();
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
            sourcePath: host.extractFileSourcePath(file)
          };
          
          // Update both global layerTilesets AND active tab's tileset
          host.layerTilesets.set(activeLayer.type, newTilesetEntry);
          
          // Also update the active tab's tileset for per-map storage
          const tabs = host.layerTabs.get(activeLayer.type) || [];
          const activeTabId = host.layerActiveTabId.get(activeLayer.type);
          const activeTab = tabs.find(t => t.id === activeTabId);
          if (activeTab) {
            activeTab.tileset = newTilesetEntry;
          }

          // If there is no saved detected tile mapping for this layer, clear global detected data
          const hasLayerTileData = host.layerTileData.has(activeLayer.type);
          if (hasLayerTileData) {
            // load layer-specific detected tiles into detectedTileData for palette generation
            const layerTiles = host.layerTileData.get(activeLayer.type);
            host.detectedTileData.clear();
            if (layerTiles) {
              for (const [gid, data] of layerTiles.entries()) {
                host.detectedTileData.set(gid, data);
              }
            }
            }
            // NOTE: If no saved layer data, do NOT clear detectedTileData! This preserves
            // other layers' tile info when importing a new tileset for a different layer.

          // Ensure the editor's current tileset/palette reflects the newly set layer tileset
          // `updateCurrentTileset` will load the layer tileset into the global display state
          // and rebuild the palette accordingly.
          try {
            host.updateCurrentTileset(activeLayer.type);
          } catch (_e) {
            // Fallback: attempt to create the palette directly if update fails
            void _e;
            host.createTilePalette(hasLayerTileData);
          }
          host.draw();
          return;
        }

        // Fallback: if no active layer, behave as legacy tileset upload
        host.tilesetImage = img;
        host.tilesetFileName = file.name;
        host.tilesetColumns = columns;
        host.tilesetRows = rows;
        host.tileCount = count;
        host.tilesetTileWidth = tileWidth;
        host.tilesetTileHeight = tileHeight;
        host.tilesetSpacing = 0;
        host.tilesetMargin = 0;
        host.tilesetSourcePath = host.extractFileSourcePath(file);
        host.createTilePalette();
        host.draw();
      };
      img.src = e.target?.result as string;
    };
        reader.readAsDataURL(file);
  } else if (type === 'layerTileset') {
    // Layer-specific tileset upload - preserve existing behavior (delegates to helper)
    const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
    if (activeLayer) {
      host.setLayerTileset(activeLayer.type, file);
    }
  }
}

export function setLayerTileset(host: PaletteTabsHost, layerType: string, file: File, options?: { skipApply?: boolean }): void {
  if (layerType === COLLISION_LAYER_TYPE) return;
  debugLog('setLayerTileset called', { layerType, fileName: file.name, options });
  const gidSnapshotBefore = host.snapshotLayerGids();
  const image = new Image();
  image.onload = () => {
    const columns = Math.max(1, Math.floor(image.width / host.tileSizeX));
    const rows = Math.max(1, Math.floor(image.height / host.tileSizeY));
    const count = Math.max(1, columns * rows);
    const tileWidth = columns > 0 ? Math.round(image.width / columns) : host.tileSizeX;
    const tileHeight = rows > 0 ? Math.round(image.height / rows) : host.tileSizeY;
    const sourcePath = host.extractFileSourcePath(file);

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
    const activeTabId = host.layerActiveTabId.get(layerType);
    const tabs = host.layerTabs.get(layerType) || [];
    const activeTab = tabs.find(t => t.id === activeTabId);
    
    if (activeTab) {
      debugLog(`setLayerTileset: storing tileset in tab ${activeTabId} for layer ${layerType}`);
      activeTab.tileset = tilesetEntry;
      if (!options || !options.skipApply) {
        // Also update the shared layerTilesets for immediate display
        host.layerTilesets.set(layerType, tilesetEntry);
      } else {
        debugLog('setLayerTileset: skipApply requested - not applying tileset to shared layer state');
      }
    } else {
      // Fallback to shared state if no active tab (shouldn't happen normally)
      
      host.layerTilesets.set(layerType, tilesetEntry);
    }

    // Update current tileset if this is the active layer (only if not skipping apply)
    if ((!options || !options.skipApply)) {
      const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
      if (activeLayer && activeLayer.type === layerType) {
        host.updateCurrentTileset(layerType);
      }
    } else {
      debugLog('setLayerTileset: not updating current tileset due to skipApply');
    }

    const gidSnapshotAfter = host.snapshotLayerGids();
    host.logLayerGidChanges(gidSnapshotBefore, gidSnapshotAfter, layerType);
  };
  image.src = URL.createObjectURL(file);
}

export function importBrushImageToLayerTab(host: PaletteTabsHost, layerType: string,
    tabId: number,
    file: File,
    projectPath?: string,
    overrideSensitivity?: number,
    forceIsometric?: boolean,
    _manualTileWidth?: number,
    _manualTileHeight?: number,
    forceGridSlicing?: boolean,
    defTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const tabs = host.layerTabs.get(layerType) || [];
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) {
          return reject(new Error('Tab not found'));
        }
        if (!tab.brushes) tab.brushes = [];
        tab.brushes.push({ image: img as HTMLImageElement, fileName: file.name, width: img.width, height: img.height });
        // Fixed isometric tile dimensions — always 64x32
        const tileWidth = host.tileSizeX;
        const tileHeight = host.tileSizeY;
        const columns = Math.max(1, Math.floor(img.width / tileWidth));
        const rows = Math.max(1, Math.floor(img.height / tileHeight));
        const fromDef = !!defTiles && defTiles.size > 0;
        // Def-sliced: local ids are the Flare tile ids, so count spans up to the highest id.
        const count = fromDef ? Math.max(...defTiles!.keys()) : Math.max(1, columns * rows);
        const sourcePath = host.extractFileSourcePath(file);
        
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
            sourcePath,
            tileSource: fromDef ? 'def' : 'grid'
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
          tab.tileset.tileSource = fromDef ? 'def' : 'grid';
        }

        // Always slice into single project-size tiles; multi-tile objects are made with merge.
        void overrideSensitivity; void forceIsometric; void forceGridSlicing;
        const importedDetectedTiles = new Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>();
        let gidCounter = 1;

        if (fromDef) {
          for (const [id, t] of defTiles!.entries()) {
            importedDetectedTiles.set(id, { sourceX: t.sourceX, sourceY: t.sourceY, width: t.width, height: t.height, originX: t.originX, originY: t.originY });
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
        host.layerTileData.set(layerType, new Map(importedDetectedTiles));

        // If this is currently the active layer, keep global detected map in sync too.
        const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
        if (activeLayer?.type === layerType) {
          host.detectedTileData.clear();
          for (const [gid, data] of importedDetectedTiles.entries()) {
            host.detectedTileData.set(gid, data);
          }
        }

        // If this tab is active for the layer, update current tileset/palette
        const activeTabId = host.layerActiveTabId.get(layerType);
        if (activeTabId === tabId) {
          host.setActiveLayerTab(layerType, tabId);
        }
        
        // CRITICAL: Save tileset to map JSON file after import
        // This ensures each map's unique tilesets are persisted independently
        // Try provided path first, then fallback to stored currentProjectPath
        const pathToUse = projectPath || host.currentProjectPath;
        if (pathToUse) {
          host.saveTilesetToMapFile(pathToUse).catch((_err: unknown) => {
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

export function removeLayerTab(host: PaletteTabsHost, layerType: string, tabId: number): void {
  const tabs = host.layerTabs.get(layerType) || [];
  const idx = tabs.findIndex(t => t.id === tabId);
  debugLog(`removeLayerTab called for layer=${layerType} tabId=${tabId} (found idx=${idx})`);
  if (idx !== -1) {
    const removed = tabs.splice(idx, 1);
    debugLog('removeLayerTab removed:', removed);
    host.layerTabs.set(layerType, tabs);
    // Remap any painted cells that referenced the removed tab's tileset
    try {
      const removedTilesetFile = removed[0] && removed[0].tileset ? removed[0].tileset.fileName : null;
      const layerForRemoval = host.tileLayers.find(l => l.type === layerType);
      if (removedTilesetFile) {
        const arr = host.layerCellTilesetKey.get(layerType) || new Array(host.mapWidth * host.mapHeight).fill(null);
        // Cells painted with the deleted slot are erased on every layer sharing the slot list
        if (layerForRemoval) clearSlotCells(layerForRemoval.data, arr, removed as unknown as SlotLike[], k => host.normalizeTilesetKey(k));
        for (const other of host.tileLayers) {
          if (other.type === layerType || slotGroup(other.type) !== slotGroup(layerType)) continue;
          const okeys = host.layerCellTilesetKey.get(other.type);
          if (okeys) clearSlotCells(other.data, okeys, removed as unknown as SlotLike[], k => host.normalizeTilesetKey(k));
        }
        host.layerCellTilesetKey.set(layerType, arr);
      }
    } catch (_e) { void _e; }
    // If removed active tab, set another as active
    const active = host.layerActiveTabId.get(layerType);
    if (active === tabId) {
      if (tabs.length > 0) {
        // Use setActiveLayerTab so the editor updates the current tileset/palette immediately
        try {
          host.setActiveLayerTab(layerType, tabs[0].id);
        } catch (_e) {
          // Fallback to direct set if something unexpected happens
          void _e;
          host.layerActiveTabId.set(layerType, tabs[0].id);
          host.updateCurrentTileset(layerType);
        }
      } else {
        host.layerActiveTabId.delete(layerType);
        // No tabs left -> clear tileset for this layer
        host.layerTilesets.delete(layerType);
        host.updateCurrentTileset(layerType);
      }
    }
  } else { void 0; }
}

export function createLayerTab(host: PaletteTabsHost, layerType: string, name?: string): number {
// Collision layer should never have tabs - only use built-in tileset
if (layerType === COLLISION_LAYER_TYPE) {
  return -1;
}
const tabs = host.layerTabs.get(layerType) || [];
const id = host.nextLayerTabId++;
// Initialize new tab with empty tileset/brush/detectedTiles to avoid inheriting previous tab data
const tab: { id: number; name: string; data?: number[]; tileset?: LayerTilesetEntry; detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>; brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>; } = {
  id,
  name: name || `Tab ${tabs.length + 1}`,
  // Initialize with empty painted tile data array for this tab
  data: new Array(host.mapWidth * host.mapHeight).fill(0),
  // explicit empty structures so setActiveLayerTab clears palette when switching to this tab
  detectedTiles: new Map(),
  brushes: []
};
tabs.push(tab);
host.layerTabs.set(layerType, tabs);
  // If no active tab set for this layer, set this one
  if (!host.layerActiveTabId.has(layerType)) {
    host.layerActiveTabId.set(layerType, id);
  }
  return id;
}

export function getLayerTilesetImage(host: PaletteTabsHost, layerType: string): HTMLImageElement | null {
  const tileset = host.getLayerTilesetOrFallback(layerType);
  return tileset?.image ?? null;
}

export function hasLayerTileset(host: PaletteTabsHost, layerType: string): boolean {
  return host.layerTilesets.has(layerType);
}

export function removeLayerTileset(host: PaletteTabsHost): void {
  const activeLayer = host.tileLayers.find(l => l.id === host.activeLayerId);
  if (activeLayer) {
    const layerType = activeLayer.type;
    
    // Remove from layer tilesets
    host.layerTilesets.delete(layerType);
    
    // Remove layer tile data
    host.layerTileData.delete(layerType);
    // Clear any per-cell tileset references for this layer
    try {
      host.layerCellTilesetKey.set(layerType, new Array(host.mapWidth * host.mapHeight).fill(null));
    } catch (_e) { void _e; }
    
    // Clear current tileset display if this was the active layer
    host.tilesetImage = null;
    host.tilesetFileName = null;
    host.tilesetColumns = 0;
    host.tilesetRows = 0;
    host.tileCount = 0;
    host.detectedTileData.clear();
    host.activeGid = 0;
    host.clearTilePalette();
    
    host.draw();
  }
}
