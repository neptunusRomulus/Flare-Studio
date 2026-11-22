import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EntityDock from '@/components/EntityDock';
import { groupOfType, ENTITY_GROUP, CONTENT_GROUP } from '@/components/targetGroups';
import ContentDock from '@/components/ContentDock';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAppContext } from '../context/AppContext';
import WelcomeScreen from '../components/WelcomeScreen';
import WindowControlBar from '@/components/WindowControlBar';
import DockFooter from '@/components/DockFooter';
import AppControls from '@/components/AppControls';
import SidebarGameSettingsArea from '@/components/SidebarGameSettingsArea';
import SidebarWorldSettingsArea from '@/components/SidebarWorldSettingsArea';
import SidebarStringsArea from '@/components/SidebarStringsArea';
import SidebarTitlesArea from '@/components/SidebarTitlesArea';
import SidebarStatsArea from '@/components/SidebarStatsArea';
import SidebarPowerTreeArea from '@/components/SidebarPowerTreeArea';
import PaletteDock from '@/components/PaletteDock';
import { shouldShowPanels, shouldShowRightSidebar } from '@/hooks/preMapEditor';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import EngineStudioWindows from '@/components/engine/EngineStudioWindows';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import EventDialog from '@/components/EventDialog';
import { AnchoredConfirm } from '@/components/ui/inline-confirm';
import HelpDialog from '@/components/HelpDialog';
import ConflictDialog from '@/components/ConflictDialog';
import EditorArea from '@/components/EditorArea';
import QuestMapContainer from '@/components/QuestMapContainer';
import BookEditorView from '@/components/BookEditorView';
import MenuEditorView from '@/components/MenuEditorView';
import { Toaster } from '@/components/ui/toaster';
import DialogsContainer from '@/components/DialogsContainer';
import StatusEditDialog from '@/components/StatusEditDialog';
import EventScriptDatalist from '@/components/events/EventScriptDatalist';
import XpScalingDatalist from '@/components/engine/XpScalingDatalist';
import StepSoundDatalist from '@/components/engine/StepSoundDatalist';
import ItemRandomizerDatalist from '@/components/engine/ItemRandomizerDatalist';
import ProcgenRulesDatalist from '@/components/engine/ProcgenRulesDatalist';
import StoryFlagDatalist from '@/components/powers/StoryFlagDatalist';
import SessionRecoveryDialog from '@/components/SessionRecoveryDialog';
import useCrashRecovery from '@/hooks/useCrashRecovery';
import useCloseGuard from '@/hooks/useCloseGuard';
import { useProjectBackup } from '@/hooks/useProjectBackup';
import { npcObjectsFromSession, writeNpcDefinitionsForObjects } from '@/flare/manualSaveExport';
import useManualSaveSetup from '@/hooks/useManualSaveSetup';
import { useSaveHealth } from '@/context/SaveHealthContext';
import { anythingDirty, isMapDirty } from '@/editor/saveHealth';
import { normalizeProjectBackup } from '@/editor/projectSession';
import useFlareEngine from '@/hooks/useFlareEngine';
import usePreMapSetup from '@/hooks/usePreMapSetup';
import useHelpNavigation from '@/hooks/useHelpNavigation';
import { toast } from '@/hooks/use-toast';
import type { HelpTarget } from '@/help/helpTopics';

export default function AppMain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = useAppContext() as any;
  
  const {
    showWelcome,
    handleCreateNewMap,
    handleOpenMap,
    openMapForRecovery,
    isDarkMode,
    titleBarProps,
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
    debugMode,
    setDebugMode,
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
    editingScriptPath,
    eventScriptPaths,
    onEventScriptSaved,
    onEditEventScript,
    confirmDialogProps,
    showHelp,
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
  const { editorDirty, saveDirtySources, collectEditorDrafts, hydrateEditorDrafts, mapDrafts, setMapDraft, clearMapDraft } = useSaveHealth();
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const openMapForRecoveryRef = useRef(openMapForRecovery);
  openMapForRecoveryRef.current = openMapForRecovery;
  const restoreProjectBackupRef = useRef<(backup: unknown) => Promise<boolean>>(async () => false);
  const projectPathRef = useRef<string | null>(controls?.currentProjectPath ?? null);
  projectPathRef.current = controls?.currentProjectPath ?? null;
  const {
    hasCrashBackup,
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
      return restoreProjectBackupRef.current(backup);
    }
  });

  const { saveInactiveMapDrafts, restoreProjectBackup, rememberCurrentMap } = useProjectBackup({
    editor,
    projectPath: controls?.currentProjectPath ?? null,
    paused: hasCrashBackup,
    editorDirty,
    mapDrafts,
    collectEditorDrafts,
    setMapDraft,
    clearMapDraft,
    openMapForRecovery: async (name: string) => {
      if (typeof openMapForRecoveryRef.current === 'function') await openMapForRecoveryRef.current(name);
    },
  });
  restoreProjectBackupRef.current = async (backup: unknown) => {
    const parsed = normalizeProjectBackup(backup);
    if (parsed?.editors) hydrateEditorDrafts(parsed.editors);
    const ok = await restoreProjectBackup(backup);
    const current = editorRef.current;
    if (current) {
      const restoredName = typeof current.getMapName === 'function' ? current.getMapName() : '';
      if (restoredName) setMapName(restoredName);
      const snap = parsed?.maps.find((entry) => entry.mapName.toLowerCase() === String(restoredName || parsed.mapName || '').toLowerCase())?.snapshot
        || parsed?.maps[0]?.snapshot;
      if (typeof snap?.mapWidth === 'number') setMapWidth(snap.mapWidth);
      if (typeof snap?.mapHeight === 'number') setMapHeight(snap.mapHeight);
    }
    return ok;
  };

  useEffect(() => {
    editor?.setCrashBackupPaused?.(hasCrashBackup);
    return () => { editor?.setCrashBackupPaused?.(false); };
  }, [editor, hasCrashBackup]);

  const handleRecover = async () => {
    const success = await recoverSession();
    if (success) setShowRecoveryDialog(false);
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

  const mapStatus = titleBarProps?.saveStatus ?? 'saved';
  const sessionDirty = editorDirty || mapDrafts.length > 0;
  const dirty = anythingDirty(mapStatus, sessionDirty ? { session: true } : {});
  const saveAll = useCallback(async () => {
    rememberCurrentMap();
    const projectPath = controls?.currentProjectPath;
    const npcObjects = npcObjectsFromSession(editor, mapDrafts);
    await saveInactiveMapDrafts();
    if (isMapDirty(mapStatus)) await handleManualSave();
    if (projectPath) await writeNpcDefinitionsForObjects(npcObjects, projectPath);
    await saveDirtySources(projectPath);
    const currentName = typeof editor?.getMapName === 'function' ? editor.getMapName() : '';
    if (currentName) clearMapDraft(currentName);
  }, [mapStatus, handleManualSave, saveDirtySources, saveInactiveMapDrafts, rememberCurrentMap, controls?.currentProjectPath, editor, mapDrafts, clearMapDraft]);

  useCloseGuard({
    isDirty: () => anythingDirty(titleBarProps?.saveStatus ?? 'saved', (editorDirty || mapDrafts.length > 0) ? { session: true } : {}),
    saveAll,
    onDiscard: () => { dismissRecovery(); },
  });

  const enhancedControls = useMemo(() => ({
    ...(controls ?? {}),
    handleManualSave: saveAll,
    isManuallySaving,
    hasUnsavedChanges: dirty,
    onSaveAndQuit: async () => {
      await saveAll();
      if (typeof controls?.onSaveAndQuit === 'function') {
        // onSaveAndQuit also saves the map and shows welcome; map already saved above.
        await controls.onQuit?.();
      }
    },
  }), [controls, saveAll, isManuallySaving, dirty]);

  const hasMap = canvasCtx.mapInitialized;

  // Quest Map replaces the map view while the Quests sub-target is active (choice remembered).
  const [questMapOpen, setQuestMapOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('flare-studio.questMapOpen') !== 'false'; } catch { return true; }
  });
  const toggleQuestMap = useCallback(() => {
    setQuestMapOpen((open) => {
      const next = !open;
      try { localStorage.setItem('flare-studio.questMapOpen', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const showQuestMap = questMapOpen && tileset.activeLayer?.type === 'rules' && !!controls?.currentProjectPath;
  const showBookEditor = tileset.activeLayer?.type === 'books';
  const showMenuEditor = tileset.activeLayer?.type === 'gameSettings';

  // Per-layer visibility (rail layer icons) / opacity (wheel) on the Map and Entities rail icons
  const layerVisibility = useMemo(() => layersObj ? {
    onToggleVisibility: layersObj.handleToggleLayerVisibility,
    onTransparencyChange: layersObj.handleLayerTransparencyChange,
  } : undefined, [layersObj]);

  // Flare engine launcher
  const flareEngineSave = useCallback(async () => { await saveAll(); }, [saveAll]);
  const flareEngine = useFlareEngine({
    currentProjectPath: controls?.currentProjectPath ?? null,
    mapName: mapName ?? null,
    onBeforeLaunch: flareEngineSave,
  });

  // Left-side panels are available as soon as a project's editor exists, even before the first map.
  const templateProjectPath: string | null = controls?.currentProjectPath ?? null;
  const showPanels = shouldShowPanels({ hasMap, hasEditor: !!editor, projectPath: templateProjectPath });

  usePreMapSetup({ editor, hasMap, projectPath: templateProjectPath, layersObj, tileset });

  // Help "Go there": switch to a layer tab, or open Engine Settings on a tab.
  const { settingsTab, closeSettings, canGoHelp, goHelp } = useHelpNavigation({
    controls,
    layersObj,
    hasSettings: typeof controls?.setShowSettings === 'function',
    onHelpClose: handleHelpClose,
    onCloseSettings: handleCloseSettings,
    setQuestMapOpen,
    persistQuestMapOpen: useCallback((open: boolean) => {
      try { localStorage.setItem('flare-studio.questMapOpen', String(open)); } catch { /* ignore */ }
    }, []),
  });

  const playProps = useMemo(() => ({
    isRunning: flareEngine.isRunning,
    lastError: flareEngine.lastError,
    hasProject: !!controls?.currentProjectPath,
    hasMap,
    onLaunch: flareEngine.launch,
  }), [flareEngine.isRunning, flareEngine.lastError, flareEngine.launch, controls?.currentProjectPath, hasMap]);

  // The old title bar is gone: the logo menu floats next to the map-tab strip (top-left when there is none).
  const appMenu = useMemo(
    () => showPanels && controls
      ? <AppControls
          {...enhancedControls}
          saveStatus={titleBarProps?.saveStatus}
          editorDirty={sessionDirty}
        />
      : undefined,
    [showPanels, controls, enhancedControls, titleBarProps, sessionDirty],
  );

  const enhancedTopBarProps = useMemo(() => ({
    ...topBarProps,
    play: playProps,
  }), [topBarProps, playProps]);

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
    <div className="relative h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <WindowControlBar
        onMinimize={titleBarProps?.onMinimize ?? (() => {})}
        onMaximize={titleBarProps?.onMaximize ?? (() => {})}
        onClose={titleBarProps?.onClose ?? (() => {})}
      />

      <main className="flex flex-1 min-h-0">
        <PaletteDock
          {...tileset}
          mapLayers={layersObj?.layers}
          onSelectLayer={layersObj?.handleSetActiveLayer}
          open={shouldShowRightSidebar({ hasMap })}
          layerVisibility={layerVisibility}
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
              projectPath={controls?.currentProjectPath}
              mapName={mapName}
            />
          ) : groupOfType(tileset.activeLayer?.type) === CONTENT_GROUP ? (
            <ContentDock
              layers={layersObj?.layers ?? []}
              activeLayer={tileset.activeLayer}
              onSelectLayer={layersObj?.handleSetActiveLayer ?? (() => {})}
              items={items}
              statuses={{ handleOpenStatusDialog: statuses?.handleOpenStatusDialog ?? (() => {}), projectPath: controls?.currentProjectPath ?? null }}
              rules={{ rulesList: rules.rulesList, handleAddRule: rules.handleAddRule, handleEditRule: rules.handleEditRule, questMapOpen, onToggleQuestMap: toggleQuestMap }}
              projectPath={controls?.currentProjectPath}
            />
          ) : tileset.activeLayer?.type === 'gameSettings' ? (
            <SidebarGameSettingsArea />
          ) : tileset.activeLayer?.type === 'worldSettings' ? (
            <SidebarWorldSettingsArea />
          ) : tileset.activeLayer?.type === 'strings' ? (
            <SidebarStringsArea />
          ) : tileset.activeLayer?.type === 'titles' ? (
            <SidebarTitlesArea />
          ) : tileset.activeLayer?.type === 'stats' ? (
            <SidebarStatsArea />
          ) : tileset.activeLayer?.type === 'powerTree' ? (
            <SidebarPowerTreeArea />
          ) : !tileset.activeLayer ? null : undefined}
        >
          {(overlay) => (
            <div className="relative flex flex-1 min-w-0 min-h-0">
              <EditorArea topBarProps={enhancedTopBarProps} canvasCtx={canvasCtx} bottomToolbarProps={bottomToolbarProps} isDarkMode={isDarkMode} overlay={overlay} appMenu={appMenu} />
              {showQuestMap && (
                <QuestMapContainer
                  editor={editor}
                  quests={rules.rulesList ?? []}
                  projectPath={controls?.currentProjectPath}
                  mapName={mapName}
                  onOpenQuest={(id) => rules.handleEditRule?.(id)}
                  onOpenNpc={(id) => actors?.handleEditObject?.(id)}
                  onClose={toggleQuestMap}
                />
              )}
              {showBookEditor && <BookEditorView projectPath={controls?.currentProjectPath} />}
              {showMenuEditor && <MenuEditorView projectPath={controls?.currentProjectPath} />}
            </div>
          )}
        </PaletteDock>

        <EngineStudioWindows />

        <EngineSettingsDialog
          open={showSettings}
          onClose={closeSettings}
          initialTab={settingsTab}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          editor={editor}
          showActiveGid={showActiveGid}
          setShowActiveGid={setShowActiveGid}
          debugMode={debugMode}
          setDebugMode={setDebugMode}
          flarePath={flareEngine.flarePath}
          isFlareRunning={flareEngine.isRunning}
          onConfigureFlarePath={flareEngine.configureFlarePath}
          onLaunchFlareMainMenu={() => { void flareEngine.launch('main-menu'); }}
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
          projectPath={controls?.currentProjectPath}
          currentMapFileId={(canvasCtx?.mapTabs?.tabs ?? []).find((t: { id?: string }) => t.id === canvasCtx?.mapTabs?.activeTabId)?.name || mapName}
        />

        <EventDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} eventLocation={eventDialogLocation} editingEventId={editingEventId} scriptPath={editingScriptPath} scripts={eventScriptPaths} onScriptSaved={() => { void onEventScriptSaved(); }} onEditScript={onEditEventScript} />

        <AnchoredConfirm open={!!showClearLayerDialog} onCancel={handleClearLayerClose} onConfirm={handleClearLayerConfirm} />

        <AnchoredConfirm open={!!confirmDialogProps.action} onCancel={confirmDialogProps.onCancel} onConfirm={confirmDialogProps.onConfirm} />

        <HelpDialog open={showHelp} onClose={handleHelpClose} onGo={goHelp} canGo={canGoHelp} />

        <ConflictDialog />
      </main>
      <LoadingOverlay />

      <Toaster />

      <DialogsContainer ctx={c} />

      <StatusEditDialog open={showStatusDialog} onClose={handleCloseStatusDialog} />
      <StoryFlagDatalist projectPath={controls?.currentProjectPath ?? null} />
      <EventScriptDatalist projectPath={controls?.currentProjectPath ?? null} />
      <XpScalingDatalist projectPath={controls?.currentProjectPath ?? null} />
      <StepSoundDatalist projectPath={controls?.currentProjectPath ?? null} />
      <ItemRandomizerDatalist projectPath={controls?.currentProjectPath ?? null} />
      <ProcgenRulesDatalist projectPath={controls?.currentProjectPath ?? null} />

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
