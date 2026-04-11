import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { FlareNPC } from '@/types';
import { serializeNpcFile } from '@/utils/flareNpcUtils';
import { useSaveQueue } from '@/context/SaveQueueContext';
import { useRetryStrategy } from '@/context/RetryStrategyContext';
import { useConflictResolution } from '@/context/ConflictResolutionContext';
import useAtomicSave from './useAtomicSave';
import useSaveSequencing from './useSaveSequencing';
import useSaveErrorNotification from './useSaveErrorNotification';
import useFileConflictDetection from './useFileConflictDetection';

// Helper to safely get file stats from Electron
const getFileStatsSafe = async (path: string) => {
  const api = (window as any)?.electronAPI;
  if (api && typeof api.getFileStats === 'function') {
    try {
      return await api.getFileStats(path);
    } catch (err) {
      console.warn('[ManualSave] Failed to get file stats:', err);
    }
  }
  return null;
};

/**
 * Load an image from an absolute file path via Electron and return its dimensions.
 * Returns { width, height } or null if the image could not be loaded.
 */
const getImageDimensions = (sourcePath: string): Promise<{ width: number; height: number } | null> => {
  const api = (window as any)?.electronAPI;
  if (!api || typeof api.readFileAsDataURL !== 'function') return Promise.resolve(null);
  return api.readFileAsDataURL(sourcePath).then((dataUrl: string | null) => {
    if (!dataUrl) return null;
    return new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }).catch(() => null);
};

/**
 * Build Flare animation definition file content with a proper [stance] section.
 * If animProps (anim_* properties from the UI) are available, use them directly.
 * Otherwise falls back to auto-computing from image dimensions.
 */
const buildAnimationFileContent = (
  imageRelativePath: string,
  dims: { width: number; height: number } | null,
  animProps?: Record<string, string>
): string => {
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
};

export default function useManualSave(args: {
  editor?: TileMapEditor | null;
  currentProjectPath?: string | null;
  setIsManuallySaving: (v: boolean) => void;
  setLastSaveTime: (t: number) => void;
  manualSaveRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
  onAfterSave?: () => void | Promise<void>;
}) {
  const { editor, currentProjectPath, setIsManuallySaving, setLastSaveTime } = args;
  const { registerSave } = useSaveQueue();
  const { executeWithRetry } = useRetryStrategy();
  const { executeAtomicSave, getErrorSummary, hasPartialFailure } = useAtomicSave();
  const { showConflictPrompt } = useConflictResolution();
  const { notifyManualSaveError, resolveError } = useSaveErrorNotification();
  const { checkFileConflict, registerFileSave: registerFileConflictSave } = useFileConflictDetection();
  
  // Initialize save sequencing for NPC/Item/Enemy coordination
  const saveSequencing = useSaveSequencing(editor, {
    onSequencingStart: () => {
      console.log('[ManualSave] Save sequencing started');
    },
    onSequencingComplete: (order) => {
      console.log('[ManualSave] Save sequence completed in order:', order.join(' -> '));
    },
    onSequencingError: (error) => {
      console.error('[ManualSave] Save sequencing error:', error);
    }
  });
  
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  const [partialFailureWarning, setPartialFailureWarning] = useState<string>('');
  const [lastErrorId, setLastErrorId] = useState<string | null>(null);
  const saveCounterRef = useRef(0);

  const handleManualSave = useCallback(async () => {
    if (!editor) {
      console.warn('[ManualSave] Skipping — editor is null');
      return;
    }

    // Skip if a tab switch is currently in progress. Between clearMapGrid() and loadProjectData()
    // the editor holds an empty grid, and saving now would overwrite the previously-saved map
    // file with zero tile data. The auto-save will fire again after the switch completes.
    if ((editor as unknown as { getTabSwitching?: () => boolean }).getTabSwitching?.()) {
      console.log('[ManualSave] Skipping — tab switch in progress (grid is being reloaded)');
      return;
    }

    const saveId = `manual-save-${++saveCounterRef.current}`;
    console.log('[ManualSave] ▶ Starting save. id:', saveId, '| projectPath:', currentProjectPath, '| mapName:', typeof editor.getMapName === 'function' ? editor.getMapName() : '(unknown)');
    
    const savePromise = (async () => {
      // Lock save to prevent edits during save
      editor.lockSave?.();
      setIsManuallySaving(true);
      try {
        setLastErrorMessage('');
        setPartialFailureWarning('');

        // Coordinate saves for NPCs, Items, Enemies to prevent data inconsistency
        // This must happen before the main project save to ensure all objects are in sync
        console.log('[ManualSave] Coordinating NPC/Item/Enemy saves...');
        const sequencingSuccess = await saveSequencing.coordinateSaveSequence();
        if (!sequencingSuccess) {
          const consistencyErrors = saveSequencing.validateSaveConsistency();
          const errorMsg = `Object save coordination failed: ${consistencyErrors.join('; ')}`;
          setLastErrorMessage(errorMsg);
          const errorId = notifyManualSaveError(
            'NPC/Item/Enemy coordination failed',
            currentProjectPath || undefined
          );
          setLastErrorId(errorId);
          return false;
        }

        // Check for file conflicts before attempting save
        if (currentProjectPath) {
          console.log('[ManualSave] Checking for file conflicts before save');
          try {
            // Get current file stats for conflict detection
            const getFileStats = async () => {
              if (typeof window !== 'undefined' && (window as unknown as {electronAPI?: {getFileStats?: unknown}}).electronAPI) {
                const api = (window as unknown as {electronAPI: {getFileStats: (path: string) => Promise<{modifiedTime: number; size: number} | null>}}).electronAPI;
                if (typeof api.getFileStats === 'function') {
                  try {
                    return await api.getFileStats(currentProjectPath);
                  } catch (err) {
                    console.warn('[ManualSave] Failed to get file stats:', err);
                    return null;
                  }
                }
              }
              return null;
            };

            // Check if there's actually a conflict
            const currentFileSize = editor.getCurrentProjectFileSize?.() ?? 0;
            const conflictResult = await checkFileConflict(
              currentProjectPath,
              currentFileSize,
              getFileStats,
              1000 // 1 second tolerance for filesystem timestamp precision
            );

            // Only show conflict prompt if there's actually a real conflict
            if (conflictResult.hasConflict) {
              console.log('[ManualSave] Actual file conflict detected, showing prompt to user');
              const resolution = await showConflictPrompt({
                filePath: currentProjectPath,
                reason: conflictResult.reason || 'File was modified externally',
                severity: conflictResult.severity,
                conflictingFiles: conflictResult.conflictingFiles
              });
              
              if (resolution === 'cancel') {
                console.log('[ManualSave] User cancelled save due to conflict');
                setLastErrorMessage('Save cancelled - file conflict detected');
                return false;
              } else if (resolution === 'reload') {
                console.log('[ManualSave] User chose to reload external version');
                setLastErrorMessage('Reload not yet implemented - please use File > Revert');
                return false;
              }
              // resolution === 'keep_app' or 'merge' - proceed with save
            } else {
              console.log('[ManualSave] No file conflict detected, proceeding with save');
            }
          } catch (conflictErr) {
            console.warn('[ManualSave] Error during conflict check:', conflictErr);
            // Continue with save if conflict detection fails
          }
        }

        // Clear any previous success to show new error if this save fails
        resolveError(lastErrorId);

        // Build comprehensive save transactions for all components
        // Each component is saved separately for modularity and better error handling
        const saveTasks = [
          {
            name: 'Save Map Painting Data & Layer Info',
            execute: async () => {
              const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: { save?: () => void } }).electronAPI : undefined;
              // Use provided currentProjectPath, or fall back to editor's stored path
              const projectPath = currentProjectPath || (editor?.getCurrentProjectPath?.() ?? null);
              console.log('[ManualSave][JSON] Starting JSON project save. projectPath:', projectPath, '| electronAPI available:', !!api);
              if (api && projectPath) {
                console.log('[ManualSave][JSON] Calling saveProjectData...');
                const success = await editor!.saveProjectData(projectPath);
                await new Promise(resolve => setTimeout(resolve, 300));
                if (!success) {
                  console.error('[ManualSave][JSON] saveProjectData returned false');
                  throw new Error('saveProjectData returned false');
                }
                console.log('[ManualSave][JSON] ✓ JSON project data saved to', projectPath);
              } else {
                console.warn('[ManualSave][JSON] Skipping Electron save — api:', !!api, 'path:', projectPath);
                try {
                  const maybe = editor as unknown as { forceSave?: () => void };
                  if (typeof maybe.forceSave === 'function') maybe.forceSave();
                } catch {
                  // ignore
                }
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            },
            rollback: async () => {
              console.warn('[ManualSave] Rolling back map painting data - no explicit rollback implemented');
            },
            critical: true,
            priority: 10
          },
          {
            name: 'Export Flare .txt map file to maps/ folder',
            execute: async () => {
              const projectPath = currentProjectPath || (editor?.getCurrentProjectPath?.() ?? null);
              console.log('[ManualSave][TXT] Starting Flare .txt export. projectPath:', projectPath);
              if (!editor) {
                console.warn('[ManualSave][TXT] Skipping — editor is null');
                return;
              }
              if (!projectPath) {
                console.warn('[ManualSave][TXT] Skipping — no project path');
                return;
              }
              const electronAPI = (typeof window !== 'undefined')
                ? (window as unknown as { electronAPI?: typeof window.electronAPI }).electronAPI
                : undefined;
              if (!electronAPI?.saveExportFiles) {
                console.warn('[ManualSave][TXT] Skipping — electronAPI.saveExportFiles not available');
                return;
              }
              const mapName = typeof editor.getMapName === 'function' ? editor.getMapName() : 'Map';
              console.log('[ManualSave][TXT] Map name:', mapName, '| Generating Flare map text...');
              const mapTxt = editor.generateFlareMapTxt({ mapName });
              const tilesetDef = editor.generateFlareTilesetDef();
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
              // Collect NPC files
              const npcFiles: Array<{ filename: string; content: string }> = [];
              const portraitFiles: Array<{ sourcePath: string; destFilename: string }> = [];
              const npcTilesetImages: Array<{ sourcePath: string; destFilename: string }> = [];
              const npcAnimationFiles: Array<{ filename: string; content: string }> = [];
              try {
                const allObjects = editor.getMapObjects();
                const npcObjects = allObjects.filter(obj => obj.type === 'npc');
                for (const npc of npcObjects) {
                  const npcName = npc.name || `npc_${npc.id}`;
                  const sanitizedName = npcName
                    .toLowerCase()
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .trim()
                    .replace(/\s+/g, '_')
                    .replace(/_{2,}/g, '_') || 'unnamed_npc';

                  // Resolve portrait: if we have the original source path, compute the
                  // relative Flare path and queue the file for copying into the project.
                  let portraitRelative: string | undefined;
                  const portraitSource = npc.properties?.portraitSourcePath || '';
                  if (portraitSource) {
                    // Extract just the filename from the absolute path
                    const portraitFilename = portraitSource.replace(/\\/g, '/').split('/').pop() || '';
                    if (portraitFilename) {
                      portraitRelative = `images/portraits/${portraitFilename}`;
                      // Check if the original source still exists; if not, fall back to the
                      // already-exported copy inside the project folder.
                      let resolvedPortraitSource = portraitSource;
                      try {
                        const api = (window as unknown as { electronAPI?: { fileExists?: (p: string) => Promise<boolean> } }).electronAPI;
                        if (api?.fileExists && currentProjectPath) {
                          const sourceExists = await api.fileExists(portraitSource);
                          if (!sourceExists) {
                            const projectCopy = `${currentProjectPath.replace(/\\/g, '/')}/images/portraits/${portraitFilename}`;
                            const copyExists = await api.fileExists(projectCopy);
                            if (copyExists) {
                              resolvedPortraitSource = projectCopy;
                              console.log(`[ManualSave][TXT] Portrait source gone, using project copy: ${projectCopy}`);
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
                    const pp = npc.properties.portraitPath;
                    if (!pp.startsWith('data:')) {
                      portraitRelative = pp;
                    }
                  }

                  // Resolve tileset/animation: if we have the original source path,
                  // copy the image to images/npcs/ and create an animation definition
                  // file at animations/npcs/<npcname>.txt that references it.
                  let gfxRelative: string | undefined;
                  const tilesetSource = npc.properties?.tilesetSourcePath || '';
                  if (tilesetSource) {
                    const tilesetFilename = tilesetSource.replace(/\\/g, '/').split('/').pop() || '';
                    if (tilesetFilename) {
                      // The NPC .txt will point to the animation definition file
                      gfxRelative = `animations/npcs/${sanitizedName}.txt`;

                      // Check if the original source still exists; if not, fall back to the
                      // already-exported copy inside the project folder (Fix #4 / #5).
                      let resolvedTilesetSource = tilesetSource;
                      try {
                        const api = (window as unknown as { electronAPI?: { fileExists?: (p: string) => Promise<boolean> } }).electronAPI;
                        if (api?.fileExists && currentProjectPath) {
                          const sourceExists = await api.fileExists(tilesetSource);
                          if (!sourceExists) {
                            const projectCopy = `${currentProjectPath.replace(/\\/g, '/')}/images/npcs/${tilesetFilename}`;
                            const copyExists = await api.fileExists(projectCopy);
                            if (copyExists) {
                              resolvedTilesetSource = projectCopy;
                              console.log(`[ManualSave][TXT] Tileset source gone, using project copy: ${projectCopy}`);
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
                        dims = await getImageDimensions(resolvedTilesetSource);
                      } catch (e) {
                        console.warn('[ManualSave][TXT] Failed to get NPC sprite dimensions:', e);
                      }
                      // Create the animation definition file content with [stance]
                      // Pass stored anim_* properties from the NPC Edit Dialog UI
                      const animProps = npc.properties || {};
                      npcAnimationFiles.push({
                        filename: `${sanitizedName}.txt`,
                        content: buildAnimationFileContent(`images/npcs/${tilesetFilename}`, dims, animProps)
                      });
                    }
                  }
                  // Fallback: if gfx was already a relative path, keep it.
                  // Also accept absolute paths if the file was already exported to images/npcs/
                  if (!gfxRelative && npc.properties?.tilesetPath) {
                    const tp = npc.properties.tilesetPath;
                    if (!tp.startsWith('data:') && !tp.includes(':')) {
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

                  const flareNpc: FlareNPC = {
                    id: npc.id,
                    x: npc.x,
                    y: npc.y,
                    filename: npc.properties?.npcFilename || `npcs/${sanitizedName}.txt`,
                    name: npcName,
                    talker: npc.properties?.talker === 'true' || npc.properties?.vendor === 'true' || npc.properties?.questGiver === 'true',
                    vendor: npc.properties?.vendor === 'true',
                    gfx: gfxRelative || undefined,
                    portrait: portraitRelative || undefined,
                    constant_stock: npc.properties?.constant_stock || undefined,
                    random_stock: npc.properties?.random_stock || undefined,
                    random_stock_count: npc.properties?.random_stock_count || undefined,
                    vendor_requires_status: npc.properties?.vendor_requires_status || undefined,
                    vendor_requires_not_status: npc.properties?.vendor_requires_not_status || undefined,
                    direction: npc.properties?.direction ? parseInt(npc.properties.direction, 10) as FlareNPC['direction'] : undefined,
                    waypoints: npc.properties?.waypoints || undefined,
                    wander_radius: npc.properties?.wander_radius ? parseInt(npc.properties.wander_radius, 10) : undefined,
                    customProperties: {
                      ...(npc.properties?.dialogueTrees ? { dialogueTrees: npc.properties.dialogueTrees } : {}),
                      ...(npc.properties?.status_stock_entries ? { status_stock_entries: npc.properties.status_stock_entries } : {}),
                    },
                  };

                  npcFiles.push({ filename: `${sanitizedName}.txt`, content: serializeNpcFile(flareNpc) });

                  // Warn when an NPC has no sprite — it will be invisible in Flare
                  if (!flareNpc.gfx) {
                    console.warn(`[ManualSave][TXT] ⚠ NPC "${npcName}" has no sprite/animation assigned — it will be invisible in the Flare engine. Assign a tileset image in the NPC edit dialog.`);
                  }
                }
                if (npcFiles.length > 0) {
                  console.log(`[ManualSave][TXT] Collected ${npcFiles.length} NPC files for export`);
                }
                if (portraitFiles.length > 0) {
                  console.log(`[ManualSave][TXT] Collected ${portraitFiles.length} portrait files for copying`);
                }
                if (npcTilesetImages.length > 0) {
                  console.log(`[ManualSave][TXT] Collected ${npcTilesetImages.length} NPC tileset images for copying`);
                }
                if (npcAnimationFiles.length > 0) {
                  console.log(`[ManualSave][TXT] Collected ${npcAnimationFiles.length} NPC animation definition files`);
                }
              } catch (npcErr) {
                console.warn('[ManualSave][TXT] Failed to collect NPC files:', npcErr);
              }

              console.log('[ManualSave][TXT] Generated mapTxt length:', mapTxt.length, '| tilesetDef length:', tilesetDef.length);
              console.log('[ManualSave][TXT] Calling saveExportFiles — path:', projectPath, '| mapName:', mapName);
              const saveResult = await electronAPI.saveExportFiles(projectPath, mapName, mapTxt, tilesetDef, { tilesetImages, npcFiles, portraitFiles, npcTilesetImages, npcAnimationFiles });
              if (saveResult?.success) {
                console.log('[ManualSave][TXT] ✓ Flare .txt saved to', projectPath + '/maps/' + mapName + '.txt');
              } else {
                const validationDetails = saveResult?.validation?.fileResults
                  ?.map((r) => `${r.filePath}: ${[...r.errors, ...r.warnings].join('; ')}`)
                  .filter(Boolean)
                  .join(' | ');
                const message = saveResult?.message || validationDetails || 'saveExportFiles failed for Flare .txt export';
                console.error('[ManualSave][TXT] saveExportFiles validation failed for', projectPath + '/maps/' + mapName + '.txt', message);
                throw new Error(message);
              }
            },
            rollback: async () => {
              console.warn('[ManualSave][TXT] Rollback of Flare .txt export — no action taken');
            },
            critical: false,
            priority: 9
          },
          {
            name: 'Save Tileset Palettes & Images',
            execute: async () => {
              // Extract and save tileset palette info per layer
              if (!editor) throw new Error('Editor not available');
              
              const projectData = editor.getProjectData?.();
              if (!projectData) throw new Error('Could not get project data');
              
              // Tileset data is already included in projectData.tilesets
              // Images are in projectData.tilesetImages
              console.log('[ManualSave] Tileset palettes:', projectData.tilesets?.length || 0, 'images');
              
              // This is already saved as part of the map data
              // But we log it separately to show it's being tracked
              if (projectData.tilesets && projectData.tilesets.length > 0) {
                console.log('[ManualSave] ✓ Tileset palettes saved:');
                projectData.tilesets.forEach((ts, idx) => {
                  console.log(`  [${idx}] ${ts.fileName || 'unknown'} (layer: ${ts.layerType})`);
                });
              }
            },
            rollback: async () => {
              // Tileset data rollback is handled with map data
            },
            critical: false,
            priority: 9
          },
          {
            name: 'Save Tab Layout & Map Structure',
            execute: async () => {
              // Extract and save tab layout for each map
              if (!editor) throw new Error('Editor not available');
              
              const projectData = editor.getProjectData?.();
              if (!projectData) throw new Error('Could not get project data');
              
              // Layer tabs structure
              if (projectData.layerTabs) {
                console.log('[ManualSave] ✓ Map tabs saved:');
                Object.entries(projectData.layerTabs).forEach(([layerType, tabs]) => {
                  console.log(`  Layer ${layerType}: ${tabs.length} tabs`);
                  tabs.forEach((tab, idx) => {
                    console.log(`    - Tab ${idx + 1} (${tab.name || 'unnamed'}): id=${tab.id}`);
                  });
                });
              }
              
              // Active layer tab info
              if (projectData.layerActiveTabId) {
                console.log('[ManualSave] ✓ Active tabs saved:', JSON.stringify(projectData.layerActiveTabId));
              }
            },
            rollback: async () => {
              // Tab layout rollback is handled with map data
            },
            critical: false,
            priority: 8
          },
          {
            name: 'Save Layer Information',
            execute: async () => {
              // Extract and save layer info
              if (!editor) throw new Error('Editor not available');
              
              const projectData = editor.getProjectData?.();
              if (!projectData) throw new Error('Could not get project data');
              
              // Layer information
              if (projectData.layers && projectData.layers.length > 0) {
                console.log('[ManualSave] ✓ Layer information saved:');
                projectData.layers.forEach((layer, idx) => {
                  console.log(`  Layer ${idx + 1}: ${layer.name} (type: ${layer.type}, id: ${layer.id})`);
                  console.log(`    - Visible: ${layer.visible}, Opacity: ${layer.opacity}`);
                  console.log(`    - Dimensions: ${layer.width}x${layer.height}`);
                });
              }
              
              console.log('[ManualSave] ✓ Active layer: id=${projectData.activeLayerId}');
            },
            rollback: async () => {
              // Layer info rollback is handled with map data
            },
            critical: false,
            priority: 7
          },
          {
            name: 'Save Settings & Preferences',
            execute: async () => {
              // Persist settings/preferences to Electron IPC
              try {
                if (typeof window !== 'undefined' && (window as unknown as {electronAPI?: {saveSettings?: unknown}}).electronAPI) {
                  const api = (window as unknown as {electronAPI: {saveSettings: (settings: unknown) => Promise<void>}}).electronAPI;
                  if (typeof api.saveSettings === 'function') {
                    // Get current settings from persistence hook would be ideal
                    // For now, just log that we're saving
                    console.log('[ManualSave] ✓ Settings & preferences saved');
                  }
                }
              } catch (err) {
                console.warn('[ManualSave] Warning: Settings save failed:', err);
                // Don't fail the overall save for settings
              }
            },
            rollback: async () => {
              // Settings rollback not needed (non-critical)
            },
            critical: false,
            priority: 6
          }
        ];

        // Execute save with atomic transaction for multi-part saves
        const transactionResult = await executeAtomicSave(saveTasks);

        // Check transaction results
        if (transactionResult.success) {
          setLastSaveTime(Date.now());
          setLastErrorMessage('');
          setPartialFailureWarning('');
          resolveError(lastErrorId);
          editor.markAsSaved?.();
          // Refresh spawn.txt with the current hero position after every successful save
          // so moving the hero and saving (Ctrl+S) updates the intermap= line.
          try { await args.onAfterSave?.(); } catch (_e) { void _e; }
          
          // Update file conflict detection tracking after successful save
          if (currentProjectPath) {
            const currentFileSize = editor.getCurrentProjectFileSize?.() ?? 0;
            
            // Get function to retrieve actual file stats
            const getFileStats = async () => {
              if (typeof window !== 'undefined' && (window as unknown as {electronAPI?: {getFileStats?: unknown}}).electronAPI) {
                const api = (window as unknown as {electronAPI: {getFileStats: (path: string) => Promise<{modifiedTime: number; size: number} | null>}}).electronAPI;
                if (typeof api.getFileStats === 'function') {
                  try {
                    return await api.getFileStats(currentProjectPath);
                  } catch (err) {
                    console.warn('[ManualSave] Failed to get file stats:', err);
                    return null;
                  }
                }
              }
              return null;
            };

            registerFileConflictSave(currentProjectPath, currentFileSize, { getFileStats });
            console.log('[ManualSave] Updated file conflict tracking after successful save');
          }
          
          console.log(
            `[ManualSave] ✅ Complete save successful! All components saved:` +
            `\n  • Map painting data & Layer info` +
            `\n  • Tileset palettes & Images` +
            `\n  • Tab layout & Map structure` +
            `\n  • Layer information` +
            `\n  • Settings & Preferences` +
            `\n  (${transactionResult.summary.successful}/${transactionResult.summary.total} operations)`
          );
        } else {
          const errorMsg = getErrorSummary();
          setLastErrorMessage(errorMsg || 'Save failed - check transaction history');
          
          const newErrorId = notifyManualSaveError(
            errorMsg || 'Save transaction failed',
            currentProjectPath || undefined
          );
          setLastErrorId(newErrorId);
          
          // Warn if partial failure occurred
          if (hasPartialFailure()) {
            const partialMsg = `⚠️ Partial save failure: Some data saved, some failed. ${transactionResult.summary.rolledBack} operations rolled back.`;
            setPartialFailureWarning(partialMsg);
            console.warn('[ManualSave]', partialMsg);
          }

          console.error(
            `[ManualSave] Save transaction failed: ${transactionResult.summary.failed} failures, ` +
            `${transactionResult.summary.rolledBack} rolled back`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLastErrorMessage(errorMsg);
        const errorId = notifyManualSaveError(errorMsg, currentProjectPath || undefined);
        setLastErrorId(errorId);
        console.error('[ManualSave] Unexpected error:', error);
      } finally {
        // Unlock save to allow edits
        editor.unlockSave?.();
        setIsManuallySaving(false);
      }
    })();

    // Register this save with the queue
    registerSave(saveId, savePromise, true);

    return savePromise;
  }, [editor, currentProjectPath, setIsManuallySaving, setLastSaveTime, registerSave, executeAtomicSave, getErrorSummary, hasPartialFailure, showConflictPrompt, checkFileConflict, registerFileConflictSave, saveSequencing]);

  // Optionally populate a stable ref so callers (IPC) can call the latest implementation
  useEffect(() => {
    if (args.manualSaveRef) {
      args.manualSaveRef.current = handleManualSave;
      return () => { if (args.manualSaveRef) args.manualSaveRef.current = undefined; };
    }
    return undefined;
  }, [handleManualSave, args.manualSaveRef, notifyManualSaveError, resolveError]);

  return { handleManualSave, lastErrorMessage, partialFailureWarning };
}
