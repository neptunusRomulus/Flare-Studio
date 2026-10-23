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
export function exportLootFile(data: object): string;
export function importLootText(content: string): Record<string, unknown>;
export function exportQuestFile(quest: object): string;
export function importQuestText(content: string): Record<string, unknown>;
export function exportEffectFile(effects: Array<Record<string, unknown>>): string;
export function importEffectText(content: string): Array<Record<string, unknown>>;
export function mergeEffectText(existingText: string, effects: object[]): string;
export function importPowerText(content: string): Array<Record<string, unknown>>;
export function mergePowerText(existingText: string, powers: object[]): string;
export function listPowerIds(content: string): string[];
export function importEngineText(content: string): Array<Record<string, unknown>>;
export function exportEngineText(doc: Array<Record<string, unknown>>): string;
export function sectionsFromEngineText(content: string): Array<{ type: string; fields: Array<{ key: string; value: string; comment?: string }> }>;
export function engineTextFromSections(sections: Array<{ type: string; fields: Array<{ key: string; value: string; comment?: string }> }>): string;
export function tileFromTilesetConfig(content: string): { width: number; height: number; orientation: string };
export function applyTileToProjectIndex(indexText: string, tile: { width?: number; height?: number; orientation?: string }): string;
export function exportItemTypesFile(doc: Record<string, unknown>): string;
export function exportItemQualitiesFile(doc: Record<string, unknown>): string;
export function exportItemSetsFile(sets: Array<Record<string, unknown>>): string;
export function exportCutsceneFile(cutscene: Record<string, unknown>): string;
export function exportLanguagePot(entries: string[]): string;
export function exportParallaxFile(layers: Array<Record<string, unknown>>): string;
export function exportFogMask(mask: Record<string, unknown>): string;
export function exportProcgenRules(rules: Record<string, unknown>): string;
export function canonicalJson(kind: string, data: object): string;
export function contentSlug(value: unknown, fallback?: string): string;
