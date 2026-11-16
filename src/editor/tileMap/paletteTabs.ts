import type { TileLayer, Tool } from '@/types';
import type { LayerTilesetEntry } from '@/editor/TileMapEditor';

export interface PaletteTabsHost {
  activeGid: number;
  activeGidCallback: ((gid: number) => void) | null;
  activeLayerId: number | null;
  activeStamp: import('@/types').Stamp | null;
  clearSelection(): void;
  createTilePalette(preserveOrder: boolean): void;
  currentStampMode: 'select' | 'create' | 'place';
  detectedTileData: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number; }>;
  draw(): void;
  hideCollisionBrushTooltip(immediate: boolean): void;
  layerActiveGid: Map<string, number>;
  layerActiveTabId: Map<string, number>;
  layerTabs: Map<string, Array<{ id: number; name: string; data?: number[]; tileset?: LayerTilesetEntry; detectedTiles?: Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number }>; brushes?: Array<{ image: HTMLImageElement; fileName: string; width: number; height: number }>; }>>;
  layerTileData: Map<string, Map<number, { sourceX: number; sourceY: number; width: number; height: number; originX?: number; originY?: number; }>>;
  multiSelectedBrushes: Set<number>;
  setCurrentLayerActiveGid(gid: number): void;
  stampPreview: { x: number; y: number; width: number; height: number; visible: boolean };
  tileLayers: TileLayer[];
  tilesetImage: HTMLImageElement | null;
  tool: Tool;
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
