import { useMemo } from 'react';
import type { ImportReviewData } from './useAppMainState';
import { toast } from '@/hooks/use-toast';

type ProjectManagerView = {
  projectMaps?: string[];
  handleOpenMapFromMapsFolder?: (filename: string) => Promise<void>;
  handleManualSave?: () => Promise<void>;
  refreshProjectMaps?: () => Promise<void>;
  isExporting?: boolean;
  exportProgress?: number;
  isManuallySaving?: boolean;
  saveProgress?: number;
};

type AppMainState = ReturnType<typeof import('./useAppMainState').default>;
type ObjectEditing = ReturnType<typeof import('./useObjectEditing').default>;
type MapConfig = ReturnType<typeof import('./useMapConfig').default>;
type LayerHandlers = ReturnType<typeof import('./useLayerHandlers').default>;
type NpcDrag = ReturnType<typeof import('./useNpcDrag').default>;
type EventDrag = ReturnType<typeof import('./useEventDrag').default>;
type TooltipState = ReturnType<typeof import('./useTooltip').default>;

export type AppMainSidebarDepsInput = {
  projectManagerRecord: unknown;
  appState: AppMainState['appState'];
  showNpcActorArea: boolean;
  showEnemyActorArea: boolean;
  objectEditing: ObjectEditing;
  handleDuplicateObject: (objectId: number) => void;
  handleDeleteObject: (objectId: number) => void;
  handleReorderActors: (fromIndex: number, toIndex: number) => void;
  handleNpcDragStart: NpcDrag['handleNpcDragStart'];
  handleNpcDragEnd: NpcDrag['handleNpcDragEnd'];
  activeLayer: { type?: string } | null;
  handleEditEvent: (eventId: number) => void;
  handleDuplicateEvent: (eventId: number) => void;
  handleDeleteEvent: (eventId: number) => void;
  handleReorderEvents: (fromIndex: number, toIndex: number) => void;
  handleEventDragStart: EventDrag['handleEventDragStart'];
  handleEventDragEnd: EventDrag['handleEventDragEnd'];
  handleOpenEventDialog: (location?: { x: number; y: number } | null) => void;
  isRulesLayer: boolean;
  rulesList: AppMainState['rulesList'];
  handleOpenQuestDialog: AppMainState['handleOpenQuestDialog'];
  handleOpenQuestEditDialog: AppMainState['handleOpenQuestEditDialog'];
  isStatusesLayer: boolean;
  handleOpenStatusDialog: () => void;
  isItemsLayer: boolean;
  itemsList: AppMainState['itemsHook']['itemsList'];
  expandedItemCategories: AppMainState['itemsHook']['expandedItemCategories'];
  setExpandedItemCategories: AppMainState['itemsHook']['setExpandedItemCategories'];
  handleOpenItemEdit: AppMainState['itemsHook']['handleOpenItemEdit'];
  handleDuplicateItem: (item: { id: number; name: string; category: string; filePath: string; fileName: string; role?: string; resourceSubtype?: string }) => Promise<void>;
  handleDeleteItem: (item: { id: number; name: string; filePath: string }) => Promise<void>;
  handleOpenItemDialog: AppMainState['itemsHook']['handleOpenItemDialog'];
  isGameSettingsLayer: boolean;
  handleSetActiveLayer: LayerHandlers['handleSetActiveLayer'];
  handleToggleLayerVisibility: LayerHandlers['handleToggleLayerVisibility'];
  handleLayerTransparencyChange: LayerHandlers['handleLayerTransparencyChange'];
  showTooltipWithDelay: TooltipState['showTooltipWithDelay'];
  hideTooltip: TooltipState['hideTooltip'];
  uiHelpers: { tooltip: unknown; toolbarRef: unknown; canvasRef: unknown };
  editor: AppMainState['editorSetup']['editor'];
  handleFileUpload: LayerHandlers['handleFileUpload'];
  handleToggleBrushTool: (tool: 'move' | 'merge' | 'separate' | 'remove') => void;
  handleDeleteTilesetTab: () => void;
  toolbarState: AppMainState['toolbarState'];
  currentProjectPath: string | null;
  setImportReviewOriginPreset: AppMainState['setImportReviewOriginPreset'];
  setImportReviewData: AppMainState['setImportReviewData'];
  setShowImportReview: AppMainState['setShowImportReview'];
  helpState: AppMainState['helpState'];
  mapConfig: MapConfig;
  isNpcLayer: boolean;
  isEnemyLayer: boolean;
  mapsDropdownOpen: boolean;
  mapsSubOpen: boolean;
  mapsDropdownPos: AppMainState['mapsDropdownPos'];
  setMapsDropdownPos: AppMainState['setMapsDropdownPos'];
  mapsButtonRef: AppMainState['mapsButtonRef'];
  mapsPortalRef: AppMainState['mapsPortalRef'];
  setShowSettings: (open: boolean) => void;
};

export default function useAppMainSidebarDeps(args: AppMainSidebarDepsInput) {
  const {
    projectManagerRecord,
    appState,
    showNpcActorArea,
    showEnemyActorArea,
    objectEditing,
    handleDuplicateObject,
    handleDeleteObject,
    handleReorderActors,
    handleNpcDragStart,
    handleNpcDragEnd,
    activeLayer,
    handleEditEvent,
    handleDuplicateEvent,
    handleDeleteEvent,
    handleReorderEvents,
    handleEventDragStart,
    handleEventDragEnd,
    handleOpenEventDialog,
    isRulesLayer,
    rulesList,
    handleOpenQuestDialog,
    handleOpenQuestEditDialog,
    isStatusesLayer,
    handleOpenStatusDialog,
    isItemsLayer,
    itemsList,
    expandedItemCategories,
    setExpandedItemCategories,
    handleOpenItemEdit,
    handleDuplicateItem,
    handleDeleteItem,
    handleOpenItemDialog,
    isGameSettingsLayer,
    handleSetActiveLayer,
    handleToggleLayerVisibility,
    handleLayerTransparencyChange,
    showTooltipWithDelay,
    hideTooltip,
    uiHelpers,
    editor,
    handleFileUpload,
    handleToggleBrushTool,
    handleDeleteTilesetTab,
    toolbarState,
    currentProjectPath,
    setImportReviewOriginPreset,
    setImportReviewData,
    setShowImportReview,
    helpState,
    mapConfig,
    isNpcLayer,
    isEnemyLayer,
    mapsDropdownOpen,
    mapsSubOpen,
    mapsDropdownPos,
    setMapsDropdownPos,
    mapsButtonRef,
    mapsPortalRef,
    setShowSettings,
  } = args;

  const sidebarDeps = useMemo(() => {
    const projectMapsList = (projectManagerRecord as ProjectManagerView)?.projectMaps ?? [];
    const handleOpenMapFromMapsFolderFn =
      typeof (projectManagerRecord as ProjectManagerView)?.handleOpenMapFromMapsFolder === 'function'
        ? (projectManagerRecord as ProjectManagerView).handleOpenMapFromMapsFolder!
        : async () => undefined;
    const handleManualSaveFn =
      typeof (projectManagerRecord as ProjectManagerView)?.handleManualSave === 'function'
        ? (projectManagerRecord as ProjectManagerView).handleManualSave!
        : async () => undefined;
    const refreshProjectMapsFn =
      typeof (projectManagerRecord as ProjectManagerView)?.refreshProjectMaps === 'function'
        ? (projectManagerRecord as ProjectManagerView).refreshProjectMaps!
        : async () => undefined;
    const isExportingValue = Boolean((projectManagerRecord as ProjectManagerView)?.isExporting);
    const exportProgressValue =
      typeof (projectManagerRecord as ProjectManagerView)?.exportProgress === 'number'
        ? (projectManagerRecord as ProjectManagerView).exportProgress!
        : 0;
    const isManuallySavingValue = Boolean((projectManagerRecord as ProjectManagerView)?.isManuallySaving);
    const saveProgressValue =
      typeof (projectManagerRecord as ProjectManagerView)?.saveProgress === 'number'
        ? (projectManagerRecord as ProjectManagerView).saveProgress!
        : 0;

    return {
      leftCollapsed: appState.leftCollapsed,
      actors: {
        isNpcLayer: showNpcActorArea,
        isEnemyLayer: showEnemyActorArea,
        actorEntries: (() => {
          if (showNpcActorArea) {
            return appState.mapObjects.filter((obj) => obj.type === 'npc');
          }
          if (showEnemyActorArea) {
            const seen = new Set<string>();
            return appState.mapObjects.filter((obj) => {
              if (obj.type !== 'enemy') return false;
              const key = `${obj.type}:${obj.category || obj.name || obj.id}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
          return [];
        })(),
        draggingNpcId: appState.draggingNpcId,
        handleEditObject: objectEditing.handleEditObject,
        handleEditEnemyTemplate: objectEditing.handleEditEnemyTemplate,
        handleDuplicateObject,
        handleDeleteObject,
        handleReorderActors,
        setNpcHoverTooltip: appState.setNpcHoverTooltip,
        handleNpcDragStart,
        handleNpcDragEnd,
        handleOpenActorDialog: objectEditing.handleOpenActorDialog,
      },
      events: {
        isEventLayer: activeLayer?.type === 'event',
        eventEntries: activeLayer?.type === 'event' ? appState.mapObjects.filter((obj) => obj.type === 'event') : [],
        draggingEventId: appState.draggingEventId,
        handleEditEvent,
        handleDuplicateEvent,
        handleDeleteEvent,
        handleReorderEvents,
        setEventHoverTooltip: appState.setNpcHoverTooltip,
        handleEventDragStart,
        handleEventDragEnd,
        handleOpenEventDialog,
      },
      rules: {
        isRulesLayer,
        rulesList,
        handleAddRule: handleOpenQuestDialog,
        handleEditRule: handleOpenQuestEditDialog,
      },
      statuses: {
        isStatusesLayer,
        handleOpenStatusDialog,
      },
      items: {
        isItemsLayer,
        itemsList: itemsList,
        expandedItemCategories,
        setExpandedItemCategories,
        handleOpenItemEdit: handleOpenItemEdit,
        handleDuplicateItem,
        handleDeleteItem,
        handleOpenItemDialog: handleOpenItemDialog,
      },
      gameSettings: {
        isGameSettingsLayer,
      },
      tileset: {
        layers: appState.layers,
        activeLayerId: appState.activeLayerId,
        hoveredLayerId: appState.hoveredLayerId,
        layersPanelExpanded: appState.layersPanelExpanded,
        setLayersPanelExpanded: appState.setLayersPanelExpanded,
        setHoveredLayerId: appState.setHoveredLayerId,
        handleSetActiveLayer,
        handleToggleLayerVisibility,
        handleLayerTransparencyChange,
        showTooltipWithDelay,
        hideTooltip,
        uiHelpers,
        editor,
        activeLayer,
        tabTick: appState.tabTick,
        setTabTick: appState.setTabTick,
        brushTool: toolbarState.brushTool,
        isCollisionLayer: activeLayer?.type === 'collision',
        handleFileUpload,
        handleToggleBrushTool,
        handleDeleteActiveTab: handleDeleteTilesetTab,
        toast,
        handleOpenActorDialog: objectEditing.handleOpenActorDialog,
        stampsState: {
          stamps: toolbarState.stamps,
          selectedStamp: toolbarState.selectedStamp,
          stampMode: toolbarState.stampMode
        },
        currentProjectPath,
        onShowImportReview: (data: unknown) => {
          const parsedData = data as ImportReviewData;
          setImportReviewOriginPreset('bottom-center');
          setImportReviewData(parsedData);
          setShowImportReview(true);
        },
        isExporting: isExportingValue,
        exportProgress: exportProgressValue,
        onSaveAndQuit: async () => {
          if (handleManualSaveFn) await handleManualSaveFn();
          appState.setShowWelcome(true);
        },
        onQuit: () => { appState.setShowWelcome(true); },
        onShowProjectFolder: () => {
          if (currentProjectPath) {
            try { (window as unknown as { electronAPI?: { showItemInFolder?: (p: string) => Promise<boolean> } }).electronAPI?.showItemInFolder?.(currentProjectPath); } catch (e) { console.warn(e); }
          }
        },
        onShowHelp: () => { if (typeof helpState.setShowHelp === 'function') helpState.setShowHelp(true); },
        onSaveAsCopy: async () => {
          try {
            const api = (window as unknown as { electronAPI?: { selectDirectory?: () => Promise<string | null>; copyProject?: (src: string, dest: string) => Promise<{ success: boolean; error?: string }> } }).electronAPI;
            if (!api?.selectDirectory || !api?.copyProject || !currentProjectPath) return;
            if (handleManualSaveFn) await handleManualSaveFn();
            const destPath = await api.selectDirectory();
            if (!destPath) return;
            const result = await api.copyProject(currentProjectPath, destPath);
            if (result.success) {
              toast({ title: 'Copy complete', description: `Project copied to ${destPath}` });
            } else {
              toast({ title: 'Copy failed', description: result.error || 'Unknown error', variant: 'destructive' });
            }
          } catch (e) { console.warn('Save as copy failed', e); toast({ title: 'Copy failed', description: String(e), variant: 'destructive' }); }
        },
        onRestart: () => {
          try { (window as unknown as { electronAPI?: { restartApp?: () => void } }).electronAPI?.restartApp?.(); } catch (e) { console.warn(e); }
        },
        onExport: () => { toast({ title: 'Export', description: 'Export is not yet available.' }); },
        onCheckUpdates: () => { toast({ title: 'Updates', description: 'Update checking is not yet available.' }); },
        handleManualSave: handleManualSaveFn,
        isManuallySaving: isManuallySavingValue,
        saveProgress: saveProgressValue,
        isPreparingNewMap: mapConfig.isPreparingNewMap,
      },
      layers: {
        layers: appState.layers,
        activeLayerId: appState.activeLayerId,
        hoveredLayerId: appState.hoveredLayerId,
        layersPanelExpanded: appState.layersPanelExpanded,
        setLayersPanelExpanded: appState.setLayersPanelExpanded,
        setHoveredLayerId: appState.setHoveredLayerId,
        handleSetActiveLayer,
        handleToggleLayerVisibility,
        handleLayerTransparencyChange,
        showTooltipWithDelay,
        hideTooltip,
        uiHelpers,
        leftCollapsed: appState.leftCollapsed
      }
    };
  }, [
    appState.layers,
    appState.activeLayerId,
    appState.hoveredLayerId,
    appState.layersPanelExpanded,
    appState.setLayersPanelExpanded,
    appState.setHoveredLayerId,
    handleSetActiveLayer,
    handleToggleLayerVisibility,
    handleLayerTransparencyChange,
    showTooltipWithDelay,
    hideTooltip,
    uiHelpers,
    appState.leftCollapsed,
    isNpcLayer,
    isEnemyLayer,
    appState.mapObjects,
    appState.draggingNpcId,
    appState.draggingEventId,
    appState.setNpcHoverTooltip,
    handleNpcDragStart,
    handleNpcDragEnd,
    handleReorderActors,
    handleEventDragStart,
    handleEventDragEnd,
    handleReorderEvents,
    isRulesLayer,
    isItemsLayer,
    itemsList,
    expandedItemCategories,
    setExpandedItemCategories,
    editor,
    activeLayer,
    appState.tabTick,
    appState.setTabTick,
    toolbarState.brushTool,
    handleFileUpload,
    handleToggleBrushTool,
    handleDeleteTilesetTab,
    toolbarState.stamps,
    toolbarState.selectedStamp,
    toolbarState.stampMode,
    mapsDropdownOpen,
    mapsSubOpen,
    mapsDropdownPos,
    setMapsDropdownPos,
    mapsButtonRef,
    mapsPortalRef,
    currentProjectPath,
    mapConfig.handleOpenCreateMapDialog,
    mapConfig.isPreparingNewMap,
    setShowSettings,
    objectEditing,
    handleOpenItemEdit,
    handleOpenItemDialog,
    handleOpenQuestDialog,
    rulesList,
    projectManagerRecord,
    setShowImportReview,
    setImportReviewData,
    setImportReviewOriginPreset
  ]);
  return sidebarDeps;
}
