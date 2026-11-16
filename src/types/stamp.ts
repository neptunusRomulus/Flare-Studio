/**
 * Stamp model: a reusable multi-tile selection the user can place on the map.
 */
// Stamp-related types
export interface StampTile {
  tileId: number;
  layerId: number;
  x: number;
  y: number;
}

export interface Stamp {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: StampTile[];
  thumbnail?: string; // Base64 encoded image for preview
  fromPaletteSelection?: boolean; // True if created from tileset palette - should place as individual tiles, not sprite objects
  // Phase 0: Store exact palette cell dimensions to decouple from detected sprite size
  tilePixelWidth?: number;  // Exact pixel width of palette cell
  tilePixelHeight?: number; // Exact pixel height of palette cell
}

export type StampMode = 'select' | 'create' | 'place';
