import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import WelcomeScreen from '../components/WelcomeScreen';
import AppShell from '@/components/AppShell';
import AppSidebar from '@/components/AppSidebar';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import MapSettingsDialog from '@/components/MapSettingsDialog';
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

export default function AppMain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = useAppContext() as any;
  
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
    onRecoveryFound: () => setShowRecoveryDialog(true),
    onRecoveryDismissed: () => setShowRecoveryDialog(false)
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
    tileset,
    layersObj,
    exportStatus,
    controls,
    showSettings,
    handleCloseSettings,
    setIsDarkMode,
    editor,
    autoSaveEnabled,
    setAutoSaveEnabledState,
    autoSaveIntervalMs,
    setAutoSaveIntervalMs,
    autoSaveDebounceMs,
    setAutoSaveDebounceMs,
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

  // Set up manual save (Ctrl+S) support - must be called within SaveQueueProvider
  useManualSaveSetup(editor, controls?.currentProjectPath);

  const hasMap = canvasCtx.mapInitialized;

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
        titleBarProps={titleBarProps}
        sidebarToggleProps={{ show: showSidebarToggle && hasMap, leftCollapsed, onToggle: handleSidebarToggle }}
      />

      <main className="flex flex-1 min-h-0">
        {hasMap && (
          <AppSidebar
            leftCollapsed={leftCollapsed}
            actors={actors}
            rules={rules}
            items={items}
            tileset={tileset}
            layers={layersObj}
            exportStatus={exportStatus}
            controls={controls}
          />
        )}

        <EditorArea topBarProps={topBarProps} canvasCtx={canvasCtx} bottomToolbarProps={bottomToolbarProps} enemyPanelProps={enemyPanelProps} />

        <EngineSettingsDialog
          open={showSettings}
          onClose={handleCloseSettings}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          editor={editor}
          autoSaveEnabled={autoSaveEnabled}
          setAutoSaveEnabledState={setAutoSaveEnabledState}
          autoSaveIntervalMs={autoSaveIntervalMs}
          setAutoSaveIntervalMs={setAutoSaveIntervalMs}
          autoSaveDebounceMs={autoSaveDebounceMs}
          setAutoSaveDebounceMs={setAutoSaveDebounceMs}
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
