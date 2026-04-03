import { useCallback, useState, useRef, useEffect } from 'react';
import type { MapObject, FlareNPC } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { buildSpawnContent, computeIntermapTarget, STARTING_MAP_INVALID_NAMES } from '@/editor/mapSpawnUtils';
import { serializeNpcFile } from '@/utils/flareNpcUtils';

type ProjectIOOptions = {
  editor: TileMapEditor | null;
  currentProjectPath: string | null;
  mapName: string;
  startingMapIntermap: string | null;
  mapObjects: MapObject[];
  buildConstantStockString: (items: Record<number, number>) => string;
  toast: (opts: { title: string; description: string; variant?: 'destructive' }) => void;
  // Callbacks from App for map handling
  handleManualSave?: () => Promise<void>;
  updateLayersList?: () => void;
  syncMapObjects?: () => void;
  setMapInitialized?: (v: boolean) => void;
  setMapName?: (n: string) => void;
};

const useProjectIO = ({
  editor,
  currentProjectPath,
  mapName,
  startingMapIntermap,
  mapObjects,
  buildConstantStockString,
  toast,
  handleManualSave,
  updateLayersList,
  syncMapObjects,
  setMapInitialized,
  setMapName
}: ProjectIOOptions) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [pendingExport, setPendingExport] = useState<null | (() => Promise<boolean>)>(null);

  const checkExportFilesExist = useCallback(async (targetMapName: string) => {
    if (!window.electronAPI?.resolvePathRelative || !currentProjectPath) return false;
    const sanitizedMapName = targetMapName.replace(/[<>:"/\\|?*]/g, '_').trim().replace(/\s+/g, '_').replace(/_{2,}/g, '_') || 'Map_Name';
    const mapFilePath = `${currentProjectPath}/maps/${sanitizedMapName}.txt`;
    const tilesetFilePath = `${currentProjectPath}/tilesetdefs/tileset_${sanitizedMapName}.txt`;
    try {
      const mapExists = await window.electronAPI.fileExists?.(mapFilePath);
      const tilesetExists = await window.electronAPI.fileExists?.(tilesetFilePath);
      return !!mapExists || !!tilesetExists;
    } catch {
      return false;
    }
  }, [currentProjectPath]);

  const performExport = useCallback(async ({ silent = false, forceOverwrite = false }: { silent?: boolean, forceOverwrite?: boolean } = {}) => {
    if (!editor || !currentProjectPath) {
      toast({
        title: 'Export Failed',
        description: 'No project loaded or editor not initialized.',
        variant: 'destructive',
      });
      return false;
    }
    const trimmedName = mapName.trim();
    if (!trimmedName || STARTING_MAP_INVALID_NAMES.has(trimmedName.toLowerCase())) {
      if (!silent) {
        toast({
          title: 'Export Skipped',
          description: 'Please create and name your map before exporting.',
          variant: 'destructive',
        });
      }
      return false;
    }

    if (!startingMapIntermap) {
      if (!silent) {
        toast({
          title: 'Export Failed',
          description: 'No starting map selected.',
          variant: 'destructive',
        });
      }
      return false;
    }

    if (!silent) {
      setIsExporting(true);
      setExportProgress(0);
    }

    // Build spawn.txt content with hero coordinates.
    // If the currently loaded map IS the starting map, use its live hero position.
    // Otherwise, read the existing spawn.txt (which was written with correct coords
    // by writeSpawnFile) to preserve the hero position.
    let spawnContent: string;
    const currentIntermapTarget = computeIntermapTarget(true, mapName);
    const isCurrentMapStarting = Boolean(
      currentIntermapTarget && startingMapIntermap && currentIntermapTarget === startingMapIntermap
    );
    if (isCurrentMapStarting && editor) {
      const heroPos = (editor as unknown as { getHeroPosition?: () => { x: number; y: number } }).getHeroPosition?.();
      spawnContent = buildSpawnContent(startingMapIntermap, heroPos);
    } else if (currentProjectPath && window.electronAPI?.readSpawnFile) {
      const existingSpawn = await window.electronAPI.readSpawnFile(currentProjectPath);
      spawnContent = existingSpawn ?? buildSpawnContent(startingMapIntermap);
    } else {
      spawnContent = buildSpawnContent(startingMapIntermap);
    }

    const tilesetExportInfo = editor.getTilesetExportInfo();
    let pathOverrides: Record<string, string> | undefined;
    if (tilesetExportInfo.length > 0) {
      const overrides: Record<string, string> = {};
      for (const info of tilesetExportInfo) {
        const keys = [info.id];
        if (info.sourcePath) keys.push(info.sourcePath);
        if (info.fileName) keys.push(info.fileName);
        let candidate = info.sourcePath ?? null;
        if (currentProjectPath && info.sourcePath && window.electronAPI?.resolvePathRelative) {
          try {
            const relative = await window.electronAPI.resolvePathRelative(currentProjectPath, info.sourcePath);
            if (relative && relative.trim()) {
              candidate = relative;
            }
          } catch (error) {
            console.warn('Failed to resolve tileset path relative to project:', error);
          }
        }
        if (!candidate && info.fileName) {
          candidate = info.fileName;
        }
        if (candidate) {
          const normalized = candidate.replace(/\\/g, '/');
          for (const key of keys) {
            if (key) {
              overrides[key] = normalized;
            }
          }
        }
      }
      if (Object.keys(overrides).length > 0) {
        pathOverrides = overrides;
      }
    }

    try {
      if (!forceOverwrite && !silent) {
        const exists = await checkExportFilesExist(mapName);
        if (exists) {
          setPendingExport(() => () => performExport({ silent, forceOverwrite: true }));
          setShowOverwriteDialog(true);
          return false;
        }
      }
      if (!silent) {
        setExportProgress(25);
      }

      const mapTxt = editor.generateFlareMapTxt({ pathOverrides, mapName });

      if (!silent) {
        setExportProgress(50);
      }

      const tilesetDef = editor.generateFlareTilesetDef({ pathOverrides });

      if (!silent) {
        setExportProgress(75);
      }

      if (window.electronAPI?.saveExportFiles) {
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
                console.warn('Failed to serialize tileset image', info.fileName, imgErr);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to collect tileset images for export:', err);
        }

        const npcFiles: Array<{ filename: string; content: string }> = [];
        try {
          const npcObjects = mapObjects.filter(obj => obj.type === 'npc');
          for (const npc of npcObjects) {
            const npcName = npc.name || `npc_${npc.id}`;
            const sanitizedName = npcName
              .toLowerCase()
              .replace(/[<>:"/\\|?*]/g, '_')
              .trim()
              .replace(/\s+/g, '_')
              .replace(/_{2,}/g, '_') || 'unnamed_npc';

            const filename = `${sanitizedName}.txt`;

            const flareNpc: FlareNPC = {
              id: npc.id,
              x: npc.x,
              y: npc.y,
              filename: npc.properties?.npcFilename || `npcs/${sanitizedName}.txt`,
              name: npcName,
              talker: npc.properties?.talker === 'true' || npc.properties?.vendor === 'true' || npc.properties?.questGiver === 'true',
              vendor: npc.properties?.vendor === 'true',
              gfx: npc.properties?.tilesetPath || undefined,
              portrait: npc.properties?.portraitPath || undefined,
              constant_stock: npc.properties?.constant_stock || undefined,
              random_stock: npc.properties?.random_stock || undefined,
              random_stock_count: npc.properties?.random_stock_count ? parseInt(npc.properties.random_stock_count, 10) : undefined,
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

            const content = serializeNpcFile(flareNpc);
            npcFiles.push({ filename, content });
          }
        } catch (npcErr) {
          console.warn('Failed to collect NPC files for export:', npcErr);
        }

        const success = await window.electronAPI.saveExportFiles(
          currentProjectPath,
          mapName,
          mapTxt,
          tilesetDef,
          {
            spawn: {
              enabled: true,
              content: spawnContent,
              filename: 'spawn.txt'
            },
            tilesetImages,
            npcFiles
          }
        );

        if (!success) {
          throw new Error('Failed to save export files');
        }

        if (!silent) {
          setExportProgress(100);
          setTimeout(() => {
            setShowExportSuccess(true);
          }, 1500);
        }
      } else {
        editor.exportFlareMap();
        console.warn('Spawn file creation skipped: Electron API unavailable.');
        if (!silent) {
          setExportProgress(100);
        }
      }

      return true;
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'An error occurred while exporting the map.',
        variant: 'destructive',
      });
      return false;
    } finally {
      if (!silent) {
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(0);
        }, 1000);
      }
    }
  }, [editor, currentProjectPath, mapName, startingMapIntermap, toast, checkExportFilesExist, buildConstantStockString, mapObjects]);

  const handleExportMap = useCallback(async () => {
    await performExport();
  }, [performExport]);

  // Project maps state and helpers
  const [projectMaps, setProjectMaps] = useState<string[]>([]);

  const refreshProjectMaps = useCallback(async () => {
    if (!currentProjectPath || !window.electronAPI?.listMaps) {
      setProjectMaps([]);
      return;
    }
    try {
      const maps: string[] = await window.electronAPI.listMaps(currentProjectPath);
      setProjectMaps([...maps]);
    } catch (e) {
      console.warn('Failed to list maps:', e);
      setProjectMaps([]);
    }
  }, [currentProjectPath]);

  // Keep refs to external callbacks so we don't force consumers to create
  // new functions and cause unnecessary callback re-creations.
  const handleManualSaveRef = useRef<typeof handleManualSave | undefined>(undefined);
  const updateLayersListRef = useRef<typeof updateLayersList | undefined>(undefined);
  const syncMapObjectsRef = useRef<typeof syncMapObjects | undefined>(undefined);
  const setMapInitializedRef = useRef<typeof setMapInitialized | undefined>(undefined);
  const setMapNameRef = useRef<typeof setMapName | undefined>(undefined);

  // update refs when inputs change
  useEffect(() => { handleManualSaveRef.current = handleManualSave; }, [handleManualSave]);
  useEffect(() => { updateLayersListRef.current = updateLayersList; }, [updateLayersList]);
  useEffect(() => { syncMapObjectsRef.current = syncMapObjects; }, [syncMapObjects]);
  useEffect(() => { setMapInitializedRef.current = setMapInitialized; }, [setMapInitialized]);
  useEffect(() => { setMapNameRef.current = setMapName; }, [setMapName]);

  const handleOpenMapFromMapsFolder = useCallback(async (filename: string) => {
    if (!currentProjectPath) return;
    try {
      const exported = await performExport({ silent: true });
      if (!exported) {
        toast({ title: 'Export failed', description: 'Failed to export current map before opening a new one.', variant: 'destructive' });
        return;
      }

      if (typeof handleManualSaveRef.current === 'function') await handleManualSaveRef.current();

      const content = await window.electronAPI.readMapFile(currentProjectPath, filename);
      if (!content) {
        toast({ title: 'Open failed', description: `Failed to read map file ${filename}`, variant: 'destructive' });
        return;
      }

      if (editor && typeof editor.loadFlareMapTxt === 'function') {
        editor.loadFlareMapTxt!(content);
        if (typeof editor.setMapName === 'function') editor.setMapName(filename.replace(/\.txt$/i, ''));
        updateLayersListRef.current?.();
        syncMapObjectsRef.current?.();
        setMapInitializedRef.current?.(true);
        setMapNameRef.current?.(filename.replace(/\.txt$/i, ''));
        toast({ title: 'Map opened', description: `Opened ${filename}` });
      } else {
        toast({ title: 'Map loaded (raw)', description: 'Map content loaded but no parser available in the editor. Implement loadFlareMapTxt to parse it.' });
      }
    } catch (e) {
      console.error('Open map error:', e);
      toast({ title: 'Open failed', description: 'An unexpected error occurred while opening the map.', variant: 'destructive' });
    }
  }, [currentProjectPath, editor, performExport, toast]);

  

  const handleOverwriteConfirm = useCallback(() => {
    setShowOverwriteDialog(false);
    if (pendingExport) {
      pendingExport();
      setPendingExport(null);
    }
  }, [pendingExport]);

  const handleOverwriteCancel = useCallback(() => {
    setShowOverwriteDialog(false);
    setPendingExport(null);
  }, []);

  return {
    isExporting,
    exportProgress,
    showExportSuccess,
    setShowExportSuccess,
    showOverwriteDialog,
    handleOverwriteConfirm,
    handleOverwriteCancel,
    performExport,
    handleExportMap
    ,
    projectMaps,
    refreshProjectMaps,
    handleOpenMapFromMapsFolder
  };
};

export default useProjectIO;
