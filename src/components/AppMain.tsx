import React from 'react';
import { useAppContext } from '../context/AppContext';
import WelcomeScreen from '../components/WelcomeScreen';
import AppShell from '@/components/AppShell';
import AppSidebar from '@/components/AppSidebar';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import ClearLayerDialog from '@/components/ClearLayerDialog';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import HelpDialog from '@/components/HelpDialog';
import EditorArea from '@/components/EditorArea';
import { Toaster } from '@/components/ui/toaster';
import DialogsContainer from '@/components/DialogsContainer';

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
    showActiveGid,
    setShowActiveGid,
    setShowSidebarToggle,
    showMapSettingsOnly,
    handleCloseMapSettings,
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
        sidebarToggleProps={{ show: showSidebarToggle, leftCollapsed, onToggle: handleSidebarToggle }}
      />

      <main className="flex flex-1 min-h-0">
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

        <EngineSettingsDialog
          open={showSettings}
          onClose={handleCloseSettings}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          editor={editor}
          autoSaveEnabled={autoSaveEnabled}
          setAutoSaveEnabledState={setAutoSaveEnabledState}
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
        />

        <ClearLayerDialog open={showClearLayerDialog} onClose={handleClearLayerClose} onConfirm={handleClearLayerConfirm} />

        <ConfirmActionDialog {...confirmDialogProps} />

        <HelpDialog open={showHelp} activeTab={activeHelpTab} setActiveTab={setActiveHelpTab} onClose={handleHelpClose} />

        <EditorArea topBarProps={topBarProps} canvasCtx={canvasCtx} bottomToolbarProps={bottomToolbarProps} enemyPanelProps={enemyPanelProps} />
      </main>

      <Toaster />

      <DialogsContainer ctx={c} />

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
