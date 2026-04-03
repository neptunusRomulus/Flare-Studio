import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import WelcomeScreen from '../components/WelcomeScreen';
import AppShell from '@/components/AppShell';
import AppSidebar from '@/components/AppSidebar';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import EventDialog from '@/components/EventDialog';
import ClearLayerDialog from '@/components/ClearLayerDialog';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import HelpDialog from '@/components/HelpDialog';
import ConflictDialog from '@/components/ConflictDialog';
import EditorArea from '@/components/EditorArea';
import { Toaster } from '@/components/ui/toaster';
import DialogsContainer from '@/components/DialogsContainer';
import SessionRecoveryDialog from '@/components/SessionRecoveryDialog';
import useCrashRecovery from '@/hooks/useCrashRecovery';
import useManualSaveSetup from '@/hooks/useManualSaveSetup';
import useFlareEngine from '@/hooks/useFlareEngine';

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
    rules,
    items,
    events,
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
    enemyPanelProps,
    dialogsCtx,
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
    editor.setSaveStatusCallback((status) => {
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

  // Flare engine launcher
  const flareEngineSave = useCallback(async () => { await handleManualSave(); }, [handleManualSave]);
  const flareEngine = useFlareEngine({
    currentProjectPath: controls?.currentProjectPath ?? null,
    mapName: mapName ?? null,
    onBeforeLaunch: flareEngineSave,
  });

  // Merge flare engine state into titleBarProps
  const enhancedTitleBarProps = useMemo(() => ({
    ...titleBarProps,
    flareEngine: {
      isRunning: flareEngine.isRunning,
      lastError: flareEngine.lastError,
      hasProject: !!controls?.currentProjectPath,
      hasMap,
      onLaunch: flareEngine.launch,
    },
  }), [titleBarProps, flareEngine.isRunning, flareEngine.lastError, flareEngine.launch, controls?.currentProjectPath, hasMap]);

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
        sidebarToggleProps={{ show: showSidebarToggle && hasMap, leftCollapsed, onToggle: handleSidebarToggle }}
      />

      <main className="flex flex-1 min-h-0">
        {hasMap && (
          <AppSidebar
            leftCollapsed={leftCollapsed}
            actors={actors}
            rules={rules}
            items={items}
            events={events}
            tileset={{
              ...tileset,
              currentProjectPath: controls?.currentProjectPath
            }}
            layers={layersObj}
            exportStatus={exportStatus}
            controls={enhancedControls}
          />
        )}

        <EditorArea topBarProps={topBarProps} canvasCtx={canvasCtx} bottomToolbarProps={bottomToolbarProps} enemyPanelProps={enemyPanelProps} isDarkMode={isDarkMode} />

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
        />

        <EventDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} eventLocation={eventDialogLocation} editingEventId={editingEventId} />

        <ClearLayerDialog open={showClearLayerDialog} onClose={handleClearLayerClose} onConfirm={handleClearLayerConfirm} />

        <ConfirmActionDialog {...confirmDialogProps} />

        <HelpDialog open={showHelp} activeTab={activeHelpTab} setActiveTab={setActiveHelpTab} onClose={handleHelpClose} />

        <ConflictDialog />
      </main>

      <Toaster />

      <DialogsContainer ctx={c} />

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
