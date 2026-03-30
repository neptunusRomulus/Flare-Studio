import { useState, useRef } from 'react';
import type { EditorProjectData } from '../editor/TileMapEditor';
import type { TileLayer, MapObject } from '../types';

export default function useAppState() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeGid, setActiveGid] = useState<string>('(none)');
  const [showActiveGid, setShowActiveGid] = useState<boolean>(true);
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(false);
  const [leftTransitioning, setLeftTransitioning] = useState<boolean>(false);
  const [layers, setLayers] = useState<TileLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [showAddLayerDropdown, setShowAddLayerDropdown] = useState(false);
  const [layersPanelExpanded, setLayersPanelExpanded] = useState(false);
  const [hoveredLayerId, setHoveredLayerId] = useState<number | null>(null);
  const [tipsMinimized, setTipsMinimized] = useState(false);
  const [tabTick, setTabTick] = useState(0);

  const [pendingMapConfig, setPendingMapConfig] = useState<EditorProjectData | null>(null);
  const [isOpeningProject, setIsOpeningProject] = useState(false);

  const [draggingNpcId, setDraggingNpcId] = useState<number | null>(null);
  const [draggingEventId, setDraggingEventId] = useState<number | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState<boolean>(false);
  const [eventDialogLocation, setEventDialogLocation] = useState<{ x: number; y: number } | null>(null);
  const [npcHoverTooltip, setNpcHoverTooltip] = useState<{ x: number; y: number } | null>(null);
  const [npcDeletePopup, setNpcDeletePopup] = useState<{
    npcId: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [mapObjects, setMapObjects] = useState<MapObject[]>([]);

  const createTabForRef = useRef<((name: string, projectPath: string | null, config: EditorProjectData) => void) | null>(null);
  const beforeCreateMapRef = useRef<(() => Promise<void>) | null>(null);

  return {
    showWelcome,
    setShowWelcome,
    activeGid,
    setActiveGid,
    showActiveGid,
    setShowActiveGid,
    leftCollapsed,
    setLeftCollapsed,
    leftTransitioning,
    setLeftTransitioning,
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    showAddLayerDropdown,
    setShowAddLayerDropdown,
    layersPanelExpanded,
    setLayersPanelExpanded,
    hoveredLayerId,
    setHoveredLayerId,
    tipsMinimized,
    setTipsMinimized,
    tabTick,
    setTabTick,
    pendingMapConfig,
    setPendingMapConfig,
    isOpeningProject,
    setIsOpeningProject,
    draggingNpcId,
    setDraggingNpcId,
    draggingEventId,
    setDraggingEventId,
    eventDialogOpen,
    setEventDialogOpen,
    eventDialogLocation,
    setEventDialogLocation,
    npcHoverTooltip,
    setNpcHoverTooltip,
    npcDeletePopup,
    setNpcDeletePopup,
    mapObjects,
    setMapObjects,
    createTabForRef,
    beforeCreateMapRef
  } as const;
}
