import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EntityDock from '@/components/EntityDock';
import { groupOfType, ENTITY_GROUP, CONTENT_GROUP } from '@/components/targetGroups';
import ContentDock from '@/components/ContentDock';
import LoadingOverlay from '@/components/LoadingOverlay';
import { loadingOverlay } from '@/components/loadingOverlayStore';
import { useAppContext } from '../context/AppContext';
import WelcomeScreen from '../components/WelcomeScreen';
import AppShell from '@/components/AppShell';
import MainLayerSwitch from '@/components/MainLayerSwitch';
import DockFooter from '@/components/DockFooter';
import AppControls from '@/components/AppControls';
import SidebarGameSettingsArea from '@/components/SidebarGameSettingsArea';
import PaletteDock from '@/components/PaletteDock';
import { shouldShowPanels } from '@/hooks/preMapEditor';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import EventDialog from '@/components/EventDialog';
import { AnchoredConfirm } from '@/components/ui/inline-confirm';
import HelpDialog from '@/components/HelpDialog';
import ConflictDialog from '@/components/ConflictDialog';
import EditorArea from '@/components/EditorArea';
import { Toaster } from '@/components/ui/toaster';
import DialogsContainer from '@/components/DialogsContainer';
import StatusEditDialog from '@/components/StatusEditDialog';
import SessionRecoveryDialog from '@/components/SessionRecoveryDialog';
import useCrashRecovery from '@/hooks/useCrashRecovery';
import useManualSaveSetup from '@/hooks/useManualSaveSetup';
import useFlareEngine from '@/hooks/useFlareEngine';
import { takeTemplateImport, markPreMapSlots } from '@/flare/projectTemplate';
import { importTemplateTilesets, type TilesetImportEditor } from '@/editor/importTileset';
import { importTemplateActors, type ActorImportResult } from '@/flare/templateActors';
import { toast } from '@/hooks/use-toast';

export default function AppMain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = useAppContext() as any;
  
  const {
    showWelcome,
    handleCreateNewMap,
    handleOpenMap,
    isDarkMode,
    titleBarProps,
    showSidebarToggle,
    leftCollapsed,
    handleSidebarToggle,
    actors,
    statuses = { isStatusesLayer: false, handleOpenStatusDialog: () => {} },
    rules,
    items,
    events,
    gameSettings,
    tileset,
    layersObj,
    exportStatus,
    controls,
    showSettings,
    handleCloseSettings,
    setIsDarkMode,
    editor,
    showActiveGid,
    setShowActiveGid,
    setShowSidebarToggle,
    showMapSettingsOnly,
    handleCloseMapSettings,
    handleDeleteMap,
    mapName,
    setMapName,
    mapWidth,
    setMapWidth,
    mapHeight,
    setMapHeight,
    isStartingMap,
    updateStartingMap,
    handleMapResize,
    showClearLayerDialog,
    handleClearLayerClose,
    handleClearLayerConfirm,
    eventDialogOpen,
    setEventDialogOpen,
    eventDialogLocation,
    editingEventId,
    confirmDialogProps,
    showHelp,
    activeHelpTab,
    setActiveHelpTab,
    handleHelpClose,
    topBarProps,
    canvasCtx,
    bottomToolbarProps,
    dialogsCtx,
    showStatusDialog,
    handleCloseStatusDialog,
    tooltip
  } = c;

  // Crash recovery state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const {
    hasCrashBackup,
    backupTimestamp,
    mapName: crashedMapName,
    isRecovering,
    recoveryError,
    recoverSession,
    dismissRecovery,
    getCrashTimeFormatted,
    getTimeSinceCrash
  } = useCrashRecovery({
    projectPath: controls?.currentProjectPath ?? null,
    onRecoveryFound: () => setShowRecoveryDialog(true),
    onRecoveryDismissed: () => setShowRecoveryDialog(false),
    onRecoverBackup: async (backup: unknown) => {
      if (!editor || typeof editor.loadFromBackupData !== 'function') {
        return false;
      }

      const loaded = editor.loadFromBackupData(backup);
      if (!loaded) {
        return false;
      }

      const restored = backup as {
        mapName?: unknown;
        mapWidth?: unknown;
        mapHeight?: unknown;
      };

      if (typeof restored.mapName === 'string') {
        setMapName(restored.mapName);
      }
      if (typeof restored.mapWidth === 'number') {
        setMapWidth(restored.mapWidth);
      }
      if (typeof restored.mapHeight === 'number') {
        setMapHeight(restored.mapHeight);
      }

      try {
        editor.redraw?.();
      } catch (err) {
        void err;
      }

      return true;
    }
  });

  const handleRecover = async () => {
    const success = await recoverSession();
    if (success) {
      // Close dialog and allow editor to use recovered state
      setShowRecoveryDialog(false);
    }
  };

  const handleDismiss = () => {
    dismissRecovery();
    setShowRecoveryDialog(false);
  };

  // Set up manual save (Ctrl+S) support - must be called within SaveQueueProvider
  // After every successful save, refresh spawn.txt if this map is the starting map
  // so hero-position changes are persisted without needing to re-toggle the checkbox.
  const onAfterSave = useCallback(() => {
    if (isStartingMap) updateStartingMap(true);
  }, [isStartingMap, updateStartingMap]);
  const { handleManualSave, isManuallySaving } = useManualSaveSetup(editor, controls?.currentProjectPath, undefined, onAfterSave);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  useEffect(() => {
    if (!editor) return;
    editor.setSaveStatusCallback((status: string) => {
      setHasUnsavedChanges(status === 'unsaved' || status === 'error');
    });
  }, [editor]);

  const enhancedControls = useMemo(() => ({
    ...(controls ?? {}),
    handleManualSave,
    isManuallySaving,
    hasUnsavedChanges
  }), [controls, handleManualSave, isManuallySaving, hasUnsavedChanges]);

  const hasMap = canvasCtx.mapInitialized;

  // Per-layer visibility (corner eye) / opacity (wheel) on the Map and Entities sub-switch buttons
  const layerVisibility = useMemo(() => layersObj ? {
    onToggleVisibility: layersObj.handleToggleLayerVisibility,
    onTransparencyChange: layersObj.handleLayerTransparencyChange,
  } : undefined, [layersObj]);

  // Flare engine launcher
  const flareEngineSave = useCallback(async () => { await handleManualSave(); }, [handleManualSave]);
  const flareEngine = useFlareEngine({
    currentProjectPath: controls?.currentProjectPath ?? null,
    mapName: mapName ?? null,
    onBeforeLaunch: flareEngineSave,
  });

  // Sidebars + palette dock are available as soon as a project's editor exists, even before the first map.
  const templateProjectPath: string | null = controls?.currentProjectPath ?? null;
  const showPanels = shouldShowPanels({ hasMap, hasEditor: !!editor, projectPath: templateProjectPath });

  // Before the first map: select Background so the palette dock shows (scratch and template alike).
  const preMapInitEditorRef = useRef<unknown>(null);
  useEffect(() => {
    if (!editor || hasMap || !templateProjectPath || preMapInitEditorRef.current === editor) return;
    preMapInitEditorRef.current = editor;
    const layers = typeof editor.getLayers === 'function' ? editor.getLayers() : [];
    const background = layers.find((l: { type: string }) => l.type === 'background');
    if (background) { try { void layersObj?.handleSetActiveLayer?.(background.id); } catch { /* ignore */ } }
  }, [editor, hasMap, templateProjectPath, layersObj]);

  // "Start with template": import fantasycore tilesets as soon as the new project's editor is ready (no map needed).
  useEffect(() => {
    if (!editor || !templateProjectPath) return;
    const layers = typeof editor.getLayers === 'function' ? editor.getLayers() : [];
    const background = layers.find((l: { type: string }) => l.type === 'background');
    if (!background) return;
    const flarePath = takeTemplateImport(templateProjectPath);
    if (!flarePath) return;
    if (!hasMap) markPreMapSlots(editor);
    void (async () => {
      let result: Awaited<ReturnType<typeof importTemplateTilesets>>;
      try {
        loadingOverlay.begin('template');
        result = await importTemplateTilesets(editor as TilesetImportEditor, flarePath, templateProjectPath, 'background',
          (done, total) => loadingOverlay.progress('template', done, total, 'Loading tilesets…'));
      } catch (err) {
        console.warn('[Template] import failed', err);
        result = { imported: [], skipped: [], failed: [], misfit: [] };
      }
      let actors: ActorImportResult | null = null;
      try {
        loadingOverlay.progress('template', 0, 0, 'Loading NPCs and enemies…');
        actors = await importTemplateActors(editor, flarePath, templateProjectPath,
          (done, total) => loadingOverlay.progress('template', done, total, 'Loading NPCs and enemies…'));
        if (actors.missing.length) console.warn('[Template] Missing referenced files:', actors.missing);
        if (actors.rawOnly.length) console.warn('[Template] NPC definition files not converted (kept in the mod):', actors.rawOnly);
      } catch (err) {
        console.warn('[Template] NPC/enemy import failed', err);
      } finally {
        loadingOverlay.end('template');
      }
      try { await layersObj?.handleSetActiveLayer?.(background.id); } catch { /* ignore */ }
      try { tileset?.setTabTick?.((t: number) => (t || 0) + 1); } catch { /* ignore */ }
      if (result.imported.length > 0) {
        const notes = [
          result.skipped.length > 0 ? `${result.skipped.length} skipped (slot limit)` : '',
          result.failed.length > 0 ? `${result.failed.length} failed` : '',
          result.misfit.length > 0 ? `${result.misfit.length} don't fit the tile size` : '',
          actors && (actors.npcs || actors.enemies) ? `${actors.npcs} NPCs, ${actors.enemies} enemies added` : '',
        ].filter(Boolean).join(', ');
        toast({ title: 'Template tilesets imported', description: notes || undefined });
      } else {
        toast({ title: 'Template import failed', variant: 'destructive' });
      }
    })();
  }, [editor, hasMap, templateProjectPath, layersObj, tileset]);

  // Merge flare engine state into titleBarProps
  const enhancedTitleBarProps = useMemo(() => ({
    ...titleBarProps,
    appMenu: showPanels && controls ? <AppControls {...enhancedControls} iconUrl={titleBarProps?.flareIconUrl} /> : undefined,
    flareEngine: {
      isRunning: flareEngine.isRunning,
      lastError: flareEngine.lastError,
      hasProject: !!controls?.currentProjectPath,
      hasMap,
      flarePath: flareEngine.flarePath,
      onLaunch: flareEngine.launch,
      onConfigurePath: flareEngine.configureFlarePath,
    },
  }), [titleBarProps, flareEngine.isRunning, flareEngine.lastError, flareEngine.launch, flareEngine.flarePath, flareEngine.configureFlarePath, controls?.currentProjectPath, hasMap, showPanels, controls, enhancedControls]);

  if (showWelcome) {
    return (
      <WelcomeScreen
        onCreateNewMap={handleCreateNewMap}
        onOpenMap={handleOpenMap}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <AppShell
        titleBarProps={enhancedTitleBarProps}
        sidebarToggleProps={{ show: showSidebarToggle && showPanels, leftCollapsed, onToggle: handleSidebarToggle }}
      />

      <main className="flex flex-1 min-h-0">
        <EditorArea topBarProps={topBarProps} canvasCtx={canvasCtx} bottomToolbarProps={bottomToolbarProps} isDarkMode={isDarkMode} />

        <PaletteDock
          {...tileset}
          mapLayers={layersObj?.layers}
          onSelectLayer={layersObj?.handleSetActiveLayer}
          open={showPanels}
          layerVisibility={layerVisibility}
          header={<MainLayerSwitch layers={layersObj?.layers ?? []} activeLayer={tileset.activeLayer} onSelectLayer={layersObj?.handleSetActiveLayer ?? (() => {})} />}
          footer={<DockFooter exportStatus={exportStatus} />}
          currentProjectPath={controls?.currentProjectPath}
          content={groupOfType(tileset.activeLayer?.type) === ENTITY_GROUP ? (
            <EntityDock
              layers={layersObj?.layers ?? []}
              activeLayer={tileset.activeLayer}
              onSelectLayer={layersObj?.handleSetActiveLayer ?? (() => {})}
              actors={{ ...actors, isNpcLayer: false, isEnemyLayer: false }}
              events={{ ...events, isEventLayer: true }}
              visibility={layerVisibility}
            />
          ) : groupOfType(tileset.activeLayer?.type) === CONTENT_GROUP ? (
            <ContentDock
              layers={layersObj?.layers ?? []}
              activeLayer={tileset.activeLayer}
              onSelectLayer={layersObj?.handleSetActiveLayer ?? (() => {})}
              items={items}
              statuses={{ handleOpenStatusDialog: statuses?.handleOpenStatusDialog ?? (() => {}) }}
              rules={{ rulesList: rules.rulesList, handleAddRule: rules.handleAddRule, handleEditRule: rules.handleEditRule }}
            />
          ) : tileset.activeLayer?.type === 'gameSettings' ? (
            <SidebarGameSettingsArea />
          ) : !tileset.activeLayer ? null : undefined}
        />

        <EngineSettingsDialog
          open={showSettings}
          onClose={handleCloseSettings}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          editor={editor}
          showActiveGid={showActiveGid}
          setShowActiveGid={setShowActiveGid}
          showSidebarToggle={showSidebarToggle}
          setShowSidebarToggle={setShowSidebarToggle}
        />

        <MapSettingsDialog
          open={showMapSettingsOnly}
          onClose={handleCloseMapSettings}
          mapName={mapName}
          setMapName={setMapName}
          mapWidth={mapWidth}
          setMapWidth={setMapWidth}
          mapHeight={mapHeight}
          setMapHeight={setMapHeight}
          isStartingMap={isStartingMap}
          updateStartingMap={updateStartingMap}
          handleMapResize={handleMapResize}
          handleDeleteMap={handleDeleteMap}
          editor={editor}
        />

        <EventDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} eventLocation={eventDialogLocation} editingEventId={editingEventId} />

        <AnchoredConfirm open={!!showClearLayerDialog} onCancel={handleClearLayerClose} onConfirm={handleClearLayerConfirm} />

        <AnchoredConfirm open={!!confirmDialogProps.action} onCancel={confirmDialogProps.onCancel} onConfirm={confirmDialogProps.onConfirm} />

        <HelpDialog open={showHelp} activeTab={activeHelpTab} setActiveTab={setActiveHelpTab} onClose={handleHelpClose} />

        <ConflictDialog />
      </main>
      <LoadingOverlay />

      <Toaster />

      <DialogsContainer ctx={c} />

      <StatusEditDialog open={showStatusDialog} onClose={handleCloseStatusDialog} />

      <SessionRecoveryDialog
        isOpen={showRecoveryDialog && hasCrashBackup}
        mapName={crashedMapName}
        crashTime={getCrashTimeFormatted()}
        timeSinceCrash={getTimeSinceCrash()}
        isRecovering={isRecovering}
        error={recoveryError}
        onRecover={handleRecover}
        onDismiss={handleDismiss}
      />

      {tooltip && (
        <div
          className={`custom-tooltip ${tooltip.visible ? 'visible' : ''} ${tooltip.fadeOut ? 'fade-out' : ''}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
