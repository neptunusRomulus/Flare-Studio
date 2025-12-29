import React from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import SidebarActorArea from '@/components/SidebarActorArea';
import SidebarRulesArea from '@/components/SidebarRulesArea';
import SidebarItemsArea from '@/components/SidebarItemsArea';
import TilesetPanel from '@/components/sidebar/TilesetPanel';
import SidebarLayersArea from '@/components/SidebarLayersArea';
import SidebarControlsArea, { ControlsProps } from '@/components/SidebarControlsArea';
import type { MapObject, TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { RuleStartType } from '@/editor/ruleOptions';
import type { ItemRole, ItemResourceSubtype } from '@/editor/itemRoles';

type ItemSummary = {
  id: number;
  name: string;
  category: string;
  filePath: string;
  fileName: string;
  role: ItemRole;
  resourceSubtype?: ItemResourceSubtype;
};

type SidebarProps = {
  leftCollapsed: boolean;
  actors: {
    isNpcLayer: boolean;
    isEnemyLayer: boolean;
    actorEntries: MapObject[];
    draggingNpcId: number | null;
    handleEditObject: (id: number) => void;
    setNpcHoverTooltip: (p: { x: number; y: number } | null) => void;
    handleNpcDragStart: (e: React.DragEvent, actorId: number) => void;
    handleNpcDragEnd: () => void;
    handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
  };

  rules: {
    isRulesLayer: boolean;
    rulesList: Array<{ id: string; name: string; startType: RuleStartType; triggerId: string }>;
    handleAddRule: () => void;
  };

  items: {
    isItemsLayer: boolean;
    itemsList: ItemSummary[];
    expandedItemCategories: Set<ItemRole>;
    setExpandedItemCategories: React.Dispatch<React.SetStateAction<Set<ItemRole>>>;
    handleOpenItemEdit: (item: ItemSummary) => void;
    handleOpenItemDialog: () => void;
  };

  tileset: {
    editor: TileMapEditor | null;
    activeLayer: TileLayer | null;
    tabTick: number;
    setTabTick: React.Dispatch<React.SetStateAction<number>>;
    brushTool: 'none' | 'move' | 'merge' | 'separate' | 'remove';
    isCollisionLayer: boolean;
    // Brush toolbar visibility/node are handled internally by the BrushToolbar hook
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => void;
    handleToggleBrushTool: (tool: 'move' | 'merge' | 'separate' | 'remove') => void;
    handleDeleteActiveTab: () => void;
    toast: typeof import('@/hooks/use-toast').toast;
    handleOpenActorDialog: (type: 'npc' | 'enemy') => void;
      stampsState?: unknown;
  };

  layers: {
    layers: TileLayer[];
    activeLayerId: number | null;
    hoveredLayerId: number | null;
    layersPanelExpanded: boolean;
    setLayersPanelExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    setHoveredLayerId: React.Dispatch<React.SetStateAction<number | null>>;
    handleSetActiveLayer: (id: number) => void;
    handleToggleLayerVisibility: (id: number) => void;
    handleLayerTransparencyChange: (id: number, delta: number) => void;
      showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
      hideTooltip: () => void;
      uiHelpers?: {
        showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
        hideTooltip: () => void;
      };
    leftCollapsed: boolean;
  };

  exportStatus: {
    isExporting: boolean;
    exportProgress: number;
  };

  controls: ControlsProps;
};

export default function AppSidebar(p: SidebarProps) {

  return (
    <SidebarLayout leftCollapsed={p.leftCollapsed}>
      <section className="flex flex-col flex-1">
        {(p.actors.isNpcLayer || p.actors.isEnemyLayer) && (
          <SidebarActorArea
            isNpcLayer={p.actors.isNpcLayer}
            isEnemyLayer={p.actors.isEnemyLayer}
            actorEntries={p.actors.actorEntries}
            leftCollapsed={p.leftCollapsed}
            draggingNpcId={p.actors.draggingNpcId}
            handleEditObject={p.actors.handleEditObject}
            setNpcHoverTooltip={p.actors.setNpcHoverTooltip}
            handleNpcDragStart={p.actors.handleNpcDragStart}
            handleNpcDragEnd={p.actors.handleNpcDragEnd}
            handleOpenActorDialog={p.actors.handleOpenActorDialog}
          />
        )}

        {p.rules.isRulesLayer && (
          <SidebarRulesArea rulesList={p.rules.rulesList} handleAddRule={p.rules.handleAddRule} />
        )}

        {p.items.isItemsLayer && (
          <SidebarItemsArea
            itemsList={p.items.itemsList}
            expandedItemCategories={p.items.expandedItemCategories}
            setExpandedItemCategories={p.items.setExpandedItemCategories}
            handleOpenItemEdit={p.items.handleOpenItemEdit}
            handleOpenItemDialog={p.items.handleOpenItemDialog}
          />
        )}

        {!p.actors.isNpcLayer && !p.actors.isEnemyLayer && !p.items.isItemsLayer && !p.rules.isRulesLayer && (
          <TilesetPanel
            editor={p.tileset.editor}
            activeLayer={p.tileset.activeLayer}
            tabTick={p.tileset.tabTick}
            setTabTick={p.tileset.setTabTick}
            brushTool={p.tileset.brushTool}
            isCollisionLayer={p.tileset.isCollisionLayer}
            
            handleFileUpload={p.tileset.handleFileUpload}
            handleToggleBrushTool={p.tileset.handleToggleBrushTool}
            handleDeleteActiveTab={p.tileset.handleDeleteActiveTab}
            toast={p.tileset.toast}
            handleOpenActorDialog={p.tileset.handleOpenActorDialog}
            stampsState={p.tileset.stampsState}
          />
        )}
      </section>

      <SidebarLayersArea
        layers={p.layers.layers}
        activeLayerId={p.layers.activeLayerId}
        hoveredLayerId={p.layers.hoveredLayerId}
        layersPanelExpanded={p.layers.layersPanelExpanded}
        setLayersPanelExpanded={p.layers.setLayersPanelExpanded}
        setHoveredLayerId={p.layers.setHoveredLayerId}
        handleSetActiveLayer={p.layers.handleSetActiveLayer}
        handleToggleLayerVisibility={p.layers.handleToggleLayerVisibility}
        handleLayerTransparencyChange={p.layers.handleLayerTransparencyChange}
        showTooltipWithDelay={p.layers.showTooltipWithDelay}
        hideTooltip={p.layers.hideTooltip}
        uiHelpers={p.layers.uiHelpers}
        leftCollapsed={p.layers.leftCollapsed}
      />

      <section className="flex-shrink-0 mt-auto mb-2">
        <div className="w-full h-1.5 mb-2">
          {p.exportStatus.isExporting ? (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-full overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all duration-1000 ease-out rounded-full" style={{ width: `${p.exportStatus.exportProgress}%` }} />
            </div>
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        <SidebarControlsArea controls={p.controls} />
      </section>
    </SidebarLayout>
  );
}
