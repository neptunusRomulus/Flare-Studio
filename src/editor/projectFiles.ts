import {
  applyTileToProjectIndex,
  canonicalJson,
  exportEngineText,
  importEngineText,
  tileFromTilesetConfig,
  withAppend,
} from '../adapters/flare/flareAdapter.cjs';

const APPEND_RELATIVE = /^(items\/(types|qualities|sets)\.txt|powers\/(powers|effects)\.txt)$/;

export function projectRoot(projectPath: string) {
  return projectPath.replace(/\\/g, '/').replace(/\/$/, '');
}

export async function writeProjectFiles(
  projectPath: string,
  files: Array<{ path: string; content: string }>
): Promise<boolean> {
  const api = window.electronAPI;
  if (!api?.writeFile || !api.createFolderIfNotExists) return false;
  const root = projectRoot(projectPath);
  for (const file of files) {
    const full = `${root}/${file.path.replace(/^\/+/, '')}`;
    const folder = full.slice(0, full.lastIndexOf('/'));
    const created = await api.createFolderIfNotExists(folder);
    if (!created) return false;
    const saved = await api.writeFile(full, file.content);
    if (!saved) return false;
  }
  return true;
}

export function authoredConfigText(relativePath: string, content: string) {
  const normalized = exportEngineText(importEngineText(content));
  if (APPEND_RELATIVE.test(relativePath) && !normalized.startsWith('APPEND')) return withAppend(normalized);
  return normalized;
}

export async function loadConfigDocument(projectPath: string | null, relativePath: string): Promise<string> {
  if (!projectPath || !window.electronAPI?.readFile) return '';
  const text = await window.electronAPI.readFile(`${projectRoot(projectPath)}/${relativePath}`);
  return text || '';
}

export async function saveConfigDocument(
  projectPath: string | null,
  relativePath: string,
  content: string
): Promise<boolean> {
  if (!projectPath) return false;
  const text = authoredConfigText(relativePath, content);
  const saved = await writeProjectFiles(projectPath, [
    { path: relativePath, content: text },
    { path: `content/documents/${relativePath}.json`, content: canonicalJson('document', { path: relativePath, text }) },
  ]);
  if (!saved || relativePath !== 'engine/tileset_config.txt' || !window.electronAPI?.readFile) return saved;
  const indexPath = `${projectRoot(projectPath)}/project.json`;
  const indexText = await window.electronAPI.readFile(indexPath);
  if (!indexText) return saved;
  const next = applyTileToProjectIndex(indexText, tileFromTilesetConfig(text));
  await window.electronAPI.writeFile(indexPath, next);
  return saved;
}
