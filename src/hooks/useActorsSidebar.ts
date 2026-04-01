import type React from 'react';
import type { MapObject, TileLayer } from '../types';
import type { ItemRole } from '../editor/itemRoles';

type RulesListItem = { id: string; name: string; startType: string; triggerId: string };

export type ActorsSidebarParams = {
  isNpcLayer: boolean;
  isEnemyLayer: boolean;
  actorEntries: MapObject[];
  draggingNpcId: number | null;
  handleEditObject: (id: number) => void;
  setNpcHoverTooltip: (p: { x: number; y: number } | null) => void;
  handleNpcDragStart: (e: React.DragEvent, actorId: number) => void;
  handleNpcDragEnd: () => void;
  handleOpenActorDialog: (type: 'npc' | 'enemy') => void;

  isRulesLayer: boolean;
  rulesList: RulesListItem[];
  handleAddRule: () => void;

  isItemsLayer: boolean;
  itemsList: unknown[];
  expandedItemCategories: Set<ItemRole>;
  setExpandedItemCategories: React.Dispatch<React.SetStateAction<Set<ItemRole>>>;
  handleOpenItemEdit: (item: unknown) => void;
  handleOpenItemDialog: () => void;

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
    toolbarRef?: React.RefObject<HTMLDivElement>;
    canvasRef?: React.RefObject<HTMLCanvasElement>;
    tooltip?: unknown;
  };
  leftCollapsed: boolean;
};

export default function useActorsSidebar(params?: Partial<ActorsSidebarParams>) {
  const noopBooleanDispatch: React.Dispatch<React.SetStateAction<boolean>> = () => {};
  const noopNullableNumberDispatch: React.Dispatch<React.SetStateAction<number | null>> = () => {};
  const noopItemCategoriesDispatch: React.Dispatch<React.SetStateAction<Set<ItemRole>>> = () => {};
  const noopHandleNumber = (_id: number) => {};
  const noopTwoArgs = (_id: number, _delta: number) => {};
  const noopDrag = (_e: React.DragEvent, _actorId: number) => {};
  const noopNode = () => {};
  const noopTooltipWithDelay = (_text: React.ReactNode, _target: HTMLElement) => {};
  const noopHoverTooltip = (_p: { x: number; y: number } | null) => {};
  const noopActorDialog = (_type: 'npc' | 'enemy') => {};
  const noopItemEdit = (_item: unknown) => {};
  const defaultParams: ActorsSidebarParams = {
    isNpcLayer: false,
    isEnemyLayer: false,
    actorEntries: [],
    draggingNpcId: null,
    handleEditObject: noopHandleNumber,
    setNpcHoverTooltip: noopHoverTooltip,
    handleNpcDragStart: noopDrag,
    handleNpcDragEnd: noopNode,
    handleOpenActorDialog: noopActorDialog,
    isRulesLayer: false,
    rulesList: [],
    handleAddRule: noopNode,
    isItemsLayer: false,
    itemsList: [],
    expandedItemCategories: new Set<ItemRole>(),
    setExpandedItemCategories: noopItemCategoriesDispatch,
    handleOpenItemEdit: noopItemEdit,
    handleOpenItemDialog: noopNode,
    layers: [],
    activeLayerId: null,
    hoveredLayerId: null,
    layersPanelExpanded: false,
    setLayersPanelExpanded: noopBooleanDispatch,
    setHoveredLayerId: noopNullableNumberDispatch,
    handleSetActiveLayer: noopHandleNumber,
    handleToggleLayerVisibility: noopHandleNumber,
    handleLayerTransparencyChange: noopTwoArgs,
    showTooltipWithDelay: noopTooltipWithDelay,
    hideTooltip: noopNode,
    uiHelpers: undefined,
    leftCollapsed: false
  };
  const p: ActorsSidebarParams = { ...defaultParams, ...(params ?? {}) };

  const actors = {
    isNpcLayer: p.isNpcLayer,
    isEnemyLayer: p.isEnemyLayer,
    actorEntries: p.actorEntries,
    draggingNpcId: p.draggingNpcId,
    handleEditObject: p.handleEditObject,
    handleNpcDragStart: p.handleNpcDragStart,
    handleNpcDragEnd: p.handleNpcDragEnd,
    handleOpenActorDialog: p.handleOpenActorDialog
  };

  const rules = { isRulesLayer: p.isRulesLayer, rulesList: p.rulesList, handleAddRule: p.handleAddRule };

  const items = {
    isItemsLayer: p.isItemsLayer,
    itemsList: p.itemsList,
    expandedItemCategories: p.expandedItemCategories,
    setExpandedItemCategories: p.setExpandedItemCategories,
    handleOpenItemEdit: p.handleOpenItemEdit,
    handleOpenItemDialog: p.handleOpenItemDialog
  };

  const layersObj = {
    layers: p.layers,
    activeLayerId: p.activeLayerId,
    hoveredLayerId: p.hoveredLayerId,
    layersPanelExpanded: p.layersPanelExpanded,
    setLayersPanelExpanded: p.setLayersPanelExpanded,
    setHoveredLayerId: p.setHoveredLayerId,
    handleSetActiveLayer: p.handleSetActiveLayer,
    handleToggleLayerVisibility: p.handleToggleLayerVisibility,
    handleLayerTransparencyChange: p.handleLayerTransparencyChange,
    showTooltipWithDelay: p.showTooltipWithDelay,
    hideTooltip: p.hideTooltip,
    uiHelpers: p.uiHelpers,
    leftCollapsed: p.leftCollapsed
  };

  return { actors, rules, items, layersObj } as const;
}
