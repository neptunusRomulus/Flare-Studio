import type { CanonicalProject } from '../schema/types';

export interface ExportFile {
  path: string;
  content: string;
}

export interface AdapterIssue {
  level: 'error' | 'warning';
  message: string;
  path?: string;
}

export interface ExportResult {
  files: ExportFile[];
  errors: AdapterIssue[];
  warnings: AdapterIssue[];
}

export interface LaunchPlan {
  args: string[];
  mods: string[];
  loadSlot?: string;
}

/**
 * A game engine behind the editor. FlareAdapter is the first implementation.
 * The editor stores CanonicalProject; only an adapter writes engine files.
 */
export interface EngineAdapter {
  readonly id: string;
  exportProject(project: CanonicalProject): ExportResult;
  importProject(files: Record<string, string>): CanonicalProject;
  validate(project: CanonicalProject): AdapterIssue[];
  launchPlan(project: CanonicalProject, options?: { loadSlot?: string }): LaunchPlan;
}
