/**
 * Serialization side of a manual save.
 *
 * Pure-ish helpers that turn the editor state into the files a Flare project
 * expects: tileset images, NPC definition files, NPC portraits, NPC animation
 * files, enemy definitions and the map / tileset definition text. The hook
 * (`useManualSave`) keeps sequencing, conflict handling and UI progress; this
 * module only produces content and calls the filesystem bridge it is given.
 */
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { FlareNPC, MapObject } from '@/types';
import { npcFileUpdate, npcFileContent, npcFileBase, isStudioNpcAnimation } from '@/utils/npcFileUpdate';
import { propertyRecord, propertyText } from '@/editor/propertyText';
import { writeEnemyDefinition } from '@/utils/enemyFileWrite';
import { debugLog } from '@/lib/debugLog';

/** The filesystem bridge the export needs (subset of `window.electronAPI`). */
export type ManualSaveFileApi = {
  fileExists?: (path: string) => Promise<boolean>;
  readFile?: (path: string) => Promise<string | null>;
  readFileAsDataURL?: (path: string) => Promise<string | null>;
  getFileStats?: (path: string) => Promise<FileStats | null>;
  saveExportFiles?: (
    projectPath: string,
    mapName: string,
    mapTxt: string,
    tilesetDef: string,
    files: ExportFileSet
  ) => Promise<SaveExportFilesResult | null | undefined>;
};

export type FileStats = { modifiedTime: number; size: number };

export type NpcExportFiles = {
  npcFiles: Array<{ filename: string; content: string }>;
  portraitFiles: Array<{ sourcePath: string; destFilename: string }>;
  npcTilesetImages: Array<{ sourcePath: string; destFilename: string }>;
  npcAnimationFiles: Array<{ filename: string; content: string }>;
};

export type ExportFileSet = NpcExportFiles & { tilesetImages: Record<string, string> };

export type SaveExportFilesResult = {
  success?: boolean;
  message?: string;
  validation?: {
    fileResults?: Array<{ filePath: string; errors: string[]; warnings: string[] }>;
  };
};

/** The renderer's preload bridge, when running inside Electron. */
export function manualSaveFileApi(): ManualSaveFileApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electronAPI?: ManualSaveFileApi }).electronAPI;
}

/**
 * Load an image from an absolute file path via Electron and return its dimensions.
 * Returns { width, height } or null if the image could not be loaded.
 */
export async function getImageDimensions(
  sourcePath: string,
  api: ManualSaveFileApi | undefined = manualSaveFileApi()
): Promise<{ width: number; height: number } | null> {
  if (!api || typeof api.readFileAsDataURL !== 'function') return null;
  if (typeof Image === 'undefined') return null;
  try {
    const dataUrl = await api.readFileAsDataURL(sourcePath);
    if (!dataUrl) return null;
    return await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch {
    return null;
  }
}

/**
 * Build Flare animation definition file content with a proper [stance] section.
 * If animProps (anim_* properties from the UI) are available, use them directly.
 * Otherwise falls back to auto-computing from image dimensions.
 */
export function buildAnimationFileContent(
  imageRelativePath: string,
  dims: { width: number; height: number } | null,
  animProps?: Record<string, string>
): string {
  const lines: string[] = [`image=${imageRelativePath}`];
  lines.push('');

  // Try to use stored animation properties from the UI first
  const rw = animProps?.anim_render_width;
  const rh = animProps?.anim_render_height;
  if (rw && rh) {
    const frameW = parseInt(rw, 10);
    const frameH = parseInt(rh, 10);
    const offsetX = parseInt(animProps?.anim_render_offset_x || String(Math.floor(frameW / 2)), 10);
    const offsetY = parseInt(animProps?.anim_render_offset_y || String(frameH - 2), 10);
    const frameCount = parseInt(animProps?.anim_frames || '1', 10);
    const duration = animProps?.anim_duration || (frameCount > 1 ? '1200ms' : '1s');
    const animType = animProps?.anim_type || 'looped';
    const blendMode = animProps?.anim_blend_mode || 'normal';
    const alphaMod = animProps?.anim_alpha_mod || '255';
    const colorMod = animProps?.anim_color_mod || '255,255,255';

    lines.push(`render_size=${frameW},${frameH}`);
    lines.push(`render_offset=${offsetX},${offsetY}`);
    if (blendMode !== 'normal') lines.push(`blend_mode=${blendMode}`);
    if (alphaMod !== '255') lines.push(`alpha_mod=${alphaMod}`);
    if (colorMod !== '255,255,255') lines.push(`color_mod=${colorMod}`);
    lines.push('');
    lines.push('[stance]');
    lines.push(`frames=${frameCount}`);
    lines.push('position=0');
    lines.push(`duration=${duration}`);
    lines.push(`type=${animType}`);
    if (frameCount === 1) {
      lines.push(`frame=0,0,0,0,${frameW},${frameH},${offsetX},${offsetY}`);
    }
  } else if (dims && dims.width > 0 && dims.height > 0) {
    const w = dims.width;
    const h = dims.height;
    // Heuristic: if the width is a multiple of the height, treat it as a horizontal sprite strip
    const frameW = h > 0 && w > h && w % h === 0 ? h : w;
    const frameH = h;
    const frameCount = Math.max(1, Math.floor(w / frameW));
    const offsetX = Math.floor(frameW / 2);
    const offsetY = frameH - 2; // anchor near the feet

    lines.push(`render_size=${frameW},${frameH}`);
    lines.push(`render_offset=${offsetX},${offsetY}`);
    lines.push('');
    lines.push('[stance]');
    lines.push(`frames=${frameCount}`);
    lines.push('position=0');
    lines.push(`duration=${frameCount > 1 ? '1200ms' : '1s'}`);
    lines.push('type=looped');

    if (frameCount === 1) {
      lines.push(`frame=0,0,0,0,${frameW},${frameH},${offsetX},${offsetY}`);
    }
  } else {
    // Fallback: minimal [stance] so the NPC is not invisible
    lines.push('[stance]');
    lines.push('frames=1');
    lines.push('duration=1s');
    lines.push('type=looped');
  }

  lines.push('');
  return lines.join('\n');
}

/** File stem used for an NPC's `.txt` / animation / sprite names. */
export function sanitizeNpcFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_') || 'unnamed_npc';
}

/** Data URLs for every tileset image that should be written with the map. */
export function collectTilesetImages(editor: TileMapEditor): Record<string, string> {
  const tilesetImages: Record<string, string> = {};
  type MaybeTilesetEntry = { fileName?: string; image?: HTMLImageElement | null };
  try {
    const exportInfo = editor.getTilesetExportInfo();
    for (const info of exportInfo) {
      let matchedEntry: MaybeTilesetEntry | undefined;
      if (editor['layerTilesets'] && typeof editor['layerTilesets'].forEach === 'function') {
        editor['layerTilesets'].forEach((val: unknown) => {
          const candidate = val as MaybeTilesetEntry | undefined;
          if (candidate?.fileName === info.fileName) {
            matchedEntry = candidate;
          }
        });
      }

      let imgEl: HTMLImageElement | null = null;
      const entryImage = matchedEntry?.image ?? null;
      if (entryImage) {
        imgEl = entryImage;
      }
      if (!imgEl && editor['tilesetFileName'] === info.fileName) {
        const editorImage = editor['tilesetImage'] as HTMLImageElement | null | undefined;
        if (editorImage) {
          imgEl = editorImage;
        }
      }

      if (imgEl) {
        try {
          const dataUrl = editor['canvasToDataURL'](imgEl);
          tilesetImages[info.fileName] = dataUrl;
        } catch (imgErr) {
          console.warn('[ManualSave][TXT] Failed to serialize tileset image', info.fileName, imgErr);
        }
      }
    }
  } catch (err) {
    console.warn('[ManualSave][TXT] Failed to collect tileset images:', err);
  }
  return tilesetImages;
}

/** Turn one map object into the NPC record the `.txt` export writes. */
export function buildFlareNpc(npc: MapObject, gfxRelative?: string, portraitRelative?: string): FlareNPC {
  const npcName = npc.name || `npc_${npc.id}`;
  const sanitizedName = sanitizeNpcFileName(npcName);
  return {
    id: npc.id,
    x: npc.x,
    y: npc.y,
    filename: propertyText(npc.properties?.npcFilename, `npcs/${sanitizedName}.txt`),
    name: npcName,
    talker: npc.properties?.talker === 'true' || npc.properties?.vendor === 'true' || npc.properties?.questGiver === 'true',
    vendor: npc.properties?.vendor === 'true',
    gfx: gfxRelative || undefined,
    portrait: portraitRelative || undefined,
    constant_stock: propertyText(npc.properties?.constant_stock) || undefined,
    random_stock: propertyText(npc.properties?.random_stock) || undefined,
    random_stock_count: propertyText(npc.properties?.random_stock_count) || undefined,
    vendor_requires_status: propertyText(npc.properties?.vendor_requires_status) || undefined,
    vendor_requires_not_status: propertyText(npc.properties?.vendor_requires_not_status) || undefined,
    direction: propertyText(npc.properties?.direction) ? parseInt(propertyText(npc.properties?.direction), 10) as FlareNPC['direction'] : undefined,
    waypoints: propertyText(npc.properties?.waypoints) || undefined,
    wander_radius: propertyText(npc.properties?.wander_radius) ? parseInt(propertyText(npc.properties?.wander_radius), 10) : undefined,
    customProperties: {
      ...(propertyText(npc.properties?.dialogueTrees) ? { dialogueTrees: propertyText(npc.properties?.dialogueTrees) } : {}),
      ...(propertyText(npc.properties?.status_stock_entries) ? { status_stock_entries: propertyText(npc.properties?.status_stock_entries) } : {}),
    },
  };
}

/**
 * Collect every NPC file the export writes: the merged `.txt` definitions plus
 * the portrait, tileset image and animation files they reference.
 */
export async function collectNpcExportFiles(
  editor: TileMapEditor,
  currentProjectPath: string | null | undefined,
  api: ManualSaveFileApi | undefined = manualSaveFileApi()
): Promise<NpcExportFiles> {
  const npcFiles: Array<{ filename: string; content: string }> = [];
  const portraitFiles: Array<{ sourcePath: string; destFilename: string }> = [];
  const npcTilesetImages: Array<{ sourcePath: string; destFilename: string }> = [];
  const npcAnimationFiles: Array<{ filename: string; content: string }> = [];
  try {
    const allObjects = editor.getMapObjects();
    const npcObjects = allObjects.filter(obj => obj.type === 'npc');
    for (const npc of npcObjects) {
      const npcName = npc.name || `npc_${npc.id}`;
      const sanitizedName = sanitizeNpcFileName(npcName);

      // Resolve portrait: if we have the original source path, compute the
      // relative Flare path and queue the file for copying into the project.
      let portraitRelative: string | undefined;
      const portraitSource = propertyText(npc.properties?.portraitSourcePath);
      if (portraitSource) {
        // Extract just the filename from the absolute path
        const portraitFilename = portraitSource.replace(/\\/g, '/').split('/').pop() || '';
        if (portraitFilename) {
          portraitRelative = `images/portraits/${portraitFilename}`;
          // Check if the original source still exists; if not, fall back to the
          // already-exported copy inside the project folder.
          let resolvedPortraitSource = portraitSource;
          try {
            if (api?.fileExists && currentProjectPath) {
              const sourceExists = await api.fileExists(portraitSource);
              if (!sourceExists) {
                const projectCopy = `${currentProjectPath.replace(/\\/g, '/')}/images/portraits/${portraitFilename}`;
                const copyExists = await api.fileExists(projectCopy);
                if (copyExists) {
                  resolvedPortraitSource = projectCopy;
                  debugLog(`[ManualSave][TXT] Portrait source gone, using project copy: ${projectCopy}`);
                } else {
                  console.warn(`[ManualSave][TXT] Portrait source not found: ${portraitSource} (project copy also missing)`);
                }
              }
            }
          } catch { /* ignore */ }
          portraitFiles.push({ sourcePath: resolvedPortraitSource, destFilename: portraitFilename });
        }
      }
      // Fallback: if portrait was already a relative path (not a data URL), keep it
      if (!portraitRelative && npc.properties?.portraitPath) {
        const pp = propertyText(npc.properties.portraitPath);
        if (pp && !pp.startsWith('data:')) {
          portraitRelative = pp;
        }
      }

      // Resolve tileset/animation: if we have the original source path,
      // copy the image to images/npcs/ and create an animation definition
      // file at animations/npcs/<npcname>.txt that references it.
      let gfxRelative: string | undefined;
      const tilesetSource = propertyText(npc.properties?.tilesetSourcePath);
      if (tilesetSource) {
        const tilesetFilename = tilesetSource.replace(/\\/g, '/').split('/').pop() || '';
        if (tilesetFilename) {
          // The NPC .txt will point to the animation definition file.
          // Never overwrite a hand-made (multi-animation) file at that path: use our own name instead.
          let animBase = sanitizedName;
          try {
            if (api?.readFile && currentProjectPath) {
              const existingAnim = await api.readFile(`${currentProjectPath.replace(/\\/g, '/')}/animations/npcs/${sanitizedName}.txt`);
              if (existingAnim && !isStudioNpcAnimation(existingAnim, tilesetFilename)) animBase = `${sanitizedName}_studio`;
            }
          } catch { /* no existing file */ }
          gfxRelative = `animations/npcs/${animBase}.txt`;

          // Check if the original source still exists; if not, fall back to the
          // already-exported copy inside the project folder (Fix #4 / #5).
          let resolvedTilesetSource = tilesetSource;
          try {
            if (api?.fileExists && currentProjectPath) {
              const sourceExists = await api.fileExists(tilesetSource);
              if (!sourceExists) {
                const projectCopy = `${currentProjectPath.replace(/\\/g, '/')}/images/npcs/${tilesetFilename}`;
                const copyExists = await api.fileExists(projectCopy);
                if (copyExists) {
                  resolvedTilesetSource = projectCopy;
                  debugLog(`[ManualSave][TXT] Tileset source gone, using project copy: ${projectCopy}`);
                } else {
                  console.warn(`[ManualSave][TXT] ⚠ NPC "${npcName}" sprite source not found: ${tilesetSource} (project copy also missing). NPC may be invisible in-game.`);
                }
              }
            }
          } catch { /* ignore */ }

          // Queue the image to be copied into images/npcs/
          npcTilesetImages.push({ sourcePath: resolvedTilesetSource, destFilename: tilesetFilename });
          // Get image dimensions to build a proper [stance] animation file
          let dims: { width: number; height: number } | null = null;
          try {
            dims = await getImageDimensions(resolvedTilesetSource, api);
          } catch (e) {
            console.warn('[ManualSave][TXT] Failed to get NPC sprite dimensions:', e);
          }
          // Create the animation definition file content with [stance]
          // Pass stored anim_* properties from the NPC Edit Dialog UI
          const animProps = propertyRecord(npc.properties);
          npcAnimationFiles.push({
            filename: `${animBase}.txt`,
            content: buildAnimationFileContent(`images/npcs/${tilesetFilename}`, dims, animProps)
          });
        }
      }
      // Fallback: if gfx was already a relative path, keep it.
      // Also accept absolute paths if the file was already exported to images/npcs/
      if (!gfxRelative && npc.properties?.tilesetPath) {
        const tp = propertyText(npc.properties.tilesetPath);
        if (tp && !tp.startsWith('data:') && !tp.includes(':')) {
          gfxRelative = tp;
        } else if (tp.includes(':') && !tp.startsWith('data:') && currentProjectPath) {
          // Absolute path left from a previous session — extract filename and
          // build the Flare-relative animation path if a project copy exists.
          const fn = tp.replace(/\\/g, '/').split('/').pop() || '';
          if (fn) {
            gfxRelative = `animations/npcs/${sanitizedName}.txt`;
            console.warn(`[ManualSave][TXT] ⚠ NPC "${npcName}" tileset was an absolute path (${tp}). Using relative fallback: ${gfxRelative}`);
          }
        }
      }

      const flareNpc = buildFlareNpc(npc, gfxRelative, portraitRelative);

      // Merge into the existing NPC file so keys/sections/dialog order Studio doesn't model survive
      const npcBase = npcFileBase(flareNpc.filename);
      let existingNpcText: string | null = null;
      try {
        if (api?.readFile && currentProjectPath) existingNpcText = await api.readFile(`${currentProjectPath.replace(/\\/g, '/')}/npcs/${npcBase}`);
      } catch { /* new file */ }
      const npcUpdate = npcFileUpdate(npcName, npc.properties as Record<string, unknown> | undefined, { animations: gfxRelative, portrait: portraitRelative });
      npcFiles.push({ filename: npcBase, content: npcFileContent(existingNpcText, npcUpdate) });

      // Warn when an NPC has no sprite — it will be invisible in Flare
      if (!flareNpc.gfx) {
        console.warn(`[ManualSave][TXT] ⚠ NPC "${npcName}" has no sprite/animation assigned — it will be invisible in the Flare engine. Assign a tileset image in the NPC edit dialog.`);
      }
    }
    if (npcFiles.length > 0) {
      debugLog(`[ManualSave][TXT] Collected ${npcFiles.length} NPC files for export`);
    }
    if (portraitFiles.length > 0) {
      debugLog(`[ManualSave][TXT] Collected ${portraitFiles.length} portrait files for copying`);
    }
    if (npcTilesetImages.length > 0) {
      debugLog(`[ManualSave][TXT] Collected ${npcTilesetImages.length} NPC tileset images for copying`);
    }
    if (npcAnimationFiles.length > 0) {
      debugLog(`[ManualSave][TXT] Collected ${npcAnimationFiles.length} NPC animation definition files`);
    }
  } catch (npcErr) {
    console.warn('[ManualSave][TXT] Failed to collect NPC files:', npcErr);
  }

  return { npcFiles, portraitFiles, npcTilesetImages, npcAnimationFiles };
}

/** Write one `npcs/…` definition file per enemy on the map. Returns the count. */
export async function writeEnemyDefinitions(editor: TileMapEditor, projectPath: string | null | undefined): Promise<number> {
  let written = 0;
  try {
    if (projectPath) {
      const enemyObjects = editor.getMapObjects().filter((obj) => obj.type === 'enemy');
      for (const enemy of enemyObjects) {
        const wrote = await writeEnemyDefinition(projectPath, enemy);
        if (!wrote) console.warn('[ManualSave][TXT] Failed to write enemy file for', enemy.name || enemy.id);
      }
      if (enemyObjects.length > 0) {
        debugLog(`[ManualSave][TXT] Wrote ${enemyObjects.length} enemy definition file(s)`);
      }
      written = enemyObjects.length;
    }
  } catch (enemyErr) {
    console.warn('[ManualSave][TXT] Failed to write enemy files:', enemyErr);
  }
  return written;
}

/**
 * Write the Flare `.txt` map export (map, tileset definition, tileset images,
 * NPC / portrait / animation files and enemy definitions). Throws when the IPC
 * write reports a validation failure.
 */
export async function exportFlareTextFiles(
  editor: TileMapEditor | null | undefined,
  projectPath: string | null | undefined,
  api: ManualSaveFileApi | undefined = manualSaveFileApi()
): Promise<boolean> {
  if (!editor) {
    console.warn('[ManualSave][TXT] Skipping — editor is null');
    return false;
  }
  if (!projectPath) {
    console.warn('[ManualSave][TXT] Skipping — no project path');
    return false;
  }
  if (!api?.saveExportFiles) {
    console.warn('[ManualSave][TXT] Skipping — electronAPI.saveExportFiles not available');
    return false;
  }
  const mapName = typeof editor.getMapName === 'function' ? editor.getMapName() : 'Map';
  debugLog('[ManualSave][TXT] Map name:', mapName, '| Generating Flare map text...');
  const mapTxt = editor.generateFlareMapTxt({ mapName });
  const tilesetDef = editor.generateFlareTilesetDef();
  const tilesetImages = collectTilesetImages(editor);
  const { npcFiles, portraitFiles, npcTilesetImages, npcAnimationFiles } = await collectNpcExportFiles(editor, projectPath, api);
  await writeEnemyDefinitions(editor, projectPath);

  debugLog('[ManualSave][TXT] Generated mapTxt length:', mapTxt.length, '| tilesetDef length:', tilesetDef.length);
  debugLog('[ManualSave][TXT] Calling saveExportFiles — path:', projectPath, '| mapName:', mapName);
  const saveResult = await api.saveExportFiles(projectPath, mapName, mapTxt, tilesetDef, { tilesetImages, npcFiles, portraitFiles, npcTilesetImages, npcAnimationFiles });
  if (saveResult?.success) {
    debugLog('[ManualSave][TXT] ✓ Flare .txt saved to', projectPath + '/maps/' + mapName + '.txt');
    return true;
  }
  const validationDetails = saveResult?.validation?.fileResults
    ?.map((r) => `${r.filePath}: ${[...r.errors, ...r.warnings].join('; ')}`)
    .filter(Boolean)
    .join(' | ');
  const message = saveResult?.message || validationDetails || 'saveExportFiles failed for Flare .txt export';
  console.error('[ManualSave][TXT] saveExportFiles validation failed for', projectPath + '/maps/' + mapName + '.txt', message);
  throw new Error(message);
}
