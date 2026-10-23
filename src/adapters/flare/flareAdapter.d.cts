export const id: string;
export const SCHEMA_VERSION: number;

export function toIntFlare(value: unknown): number;
export function slugFileName(input: string): string;
export function legacyMapFileName(input: string): string;
export function tilePixelOffset(
  originX: number,
  originY: number,
  tileSizeY: number
): { offsetX: number; offsetY: number };
export function formatCurrency(value: unknown): string;
export function exportMapText(map: Record<string, unknown>): { text: string; errors: string[] };
export function exportTilesetText(def: Record<string, unknown>): string;
export function exportTilesetConfig(tile?: { width?: number; height?: number; orientation?: string }): string;
export function exportItemFile(
  items: Array<Record<string, unknown>>,
  options?: { append?: boolean; includes?: string[] }
): { text: string; powers: Array<Record<string, unknown>> };
export function exportPowerFile(powers: Array<Record<string, unknown>>): string;
export function exportEnemyFile(enemy: Record<string, unknown>): { text: string; warnings: string[] };
export function normalizeEnemyText(content: string): { text: string; warnings: string[] };
export function exportNpcFile(npc: Record<string, unknown>): string;
export function importNpcText(content: string): Record<string, unknown>;
export function importMapText(content: string): Record<string, unknown>;
export function withAppend(content: string): string;
export function validateText(
  category: string,
  content: string,
  filePath?: string
): Array<{ level: "error" | "warning"; message: string; path?: string }>;
export function exportProject(project: Record<string, unknown>): {
  files: Array<{ path: string; content: string }>;
  errors: Array<{ level: string; message: string; path?: string }>;
  warnings: Array<{ level: string; message: string; path?: string }>;
};
export function importProject(files: Record<string, string>): Record<string, unknown>;
export function validate(project: Record<string, unknown>): Array<{ level: string; message: string }>;
export function launchPlan(
  project: Record<string, unknown>,
  options?: { loadSlot?: string }
): { args: string[]; mods: string[]; loadSlot?: string };
export function migrateFiles(
  files: Record<string, string>,
  projectName?: string
): {
  project: Record<string, unknown>;
  backup: string[];
  files: Array<{ path: string; content: string }>;
  errors: Array<{ level: string; message: string }>;
  warnings: Array<{ level: string; message: string }>;
};
export function emptyProject(name?: string): Record<string, unknown>;
export function editorSession(extra?: { layerVisibility?: Record<string, boolean>; notes?: string }): Record<string, unknown>;
