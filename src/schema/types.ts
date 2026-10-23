/**
 * Canonical project model (schemaVersion 1).
 * Editor-only data (camera, layer visibility, undo) does not belong here.
 * See src/schema/project.schema.json.
 */

export const CANONICAL_SCHEMA_VERSION = 1 as const;

export interface CanonicalMeta {
  name: string;
  description?: string;
  version?: string;
  game?: string;
  requires?: string[];
  engineVersionMin?: string;
}

export interface CanonicalTileConfig {
  width: number;
  height: number;
  orientation: 'isometric' | 'orthogonal';
}

export interface CanonicalLayer {
  type: string;
  rows: number[][];
  /** Editor-only. The Flare export ignores this. */
  visible?: boolean;
}

export interface CanonicalMap {
  id: string;
  title?: string;
  width: number;
  height: number;
  music?: string;
  heroX: number;
  heroY: number;
  tileset?: string;
  layers: CanonicalLayer[];
  events: Array<Record<string, string | string[]>>;
  enemies: Array<Record<string, string>>;
  npcs: Array<Record<string, string>>;
}

export interface CanonicalProject {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  meta: CanonicalMeta;
  tile?: CanonicalTileConfig;
  maps?: CanonicalMap[];
  items?: Array<Record<string, unknown>>;
  enemies?: Array<Record<string, unknown>>;
  npcs?: Array<Record<string, unknown>>;
  powers?: Array<Record<string, unknown>>;
}

export interface EditorSession {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  /** Layer visibility, camera and notes. The engine never reads this file. */
  layerVisibility?: Record<string, boolean>;
  notes?: string;
}
