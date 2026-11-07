import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '@/context/AppContext';
import useAssembledSidebar from '@/hooks/useAssembledSidebar';
import AppSidebar from './AppSidebar';

function Probe({ deps }: { deps: Record<string, unknown> }) {
  const sb = useAssembledSidebar(deps) as Record<string, unknown>;
  return <pre>{JSON.stringify(sb.gameSettings ?? null)}</pre>;
}

const noop = () => {};
const layer = { id: 11, name: 'Game Settings', type: 'gameSettings', data: [], visible: true, transparency: 1 };

function sidebarProps(isGameSettingsLayer: boolean) {
  return {
    leftCollapsed: false,
    actors: { isNpcLayer: false, isEnemyLayer: false, actorEntries: [], draggingNpcId: null, handleEditObject: noop, handleEditEnemyTemplate: noop, handleDuplicateObject: noop, handleDeleteObject: noop, handleNpcDragStart: noop, handleNpcDragEnd: noop, handleReorderActors: noop, handleOpenActorDialog: noop },
    events: { isEventLayer: false, eventEntries: [], draggingEventId: null, handleEditEvent: noop, handleDuplicateEvent: noop, handleDeleteEvent: noop, setEventHoverTooltip: noop, handleEventDragStart: noop, handleEventDragEnd: noop, handleReorderEvents: noop, handleOpenEventDialog: noop },
    rules: { isRulesLayer: false, rulesList: [], handleAddRule: noop, handleEditRule: noop },
    statuses: { isStatusesLayer: false, handleOpenStatusDialog: noop },
    items: { isItemsLayer: false, itemsList: [], expandedItemCategories: new Set(), setExpandedItemCategories: noop, handleOpenItemEdit: noop, handleDuplicateItem: noop, handleDeleteItem: noop, handleOpenItemDialog: noop },
    gameSettings: { isGameSettingsLayer },
    tileset: { editor: null, activeLayer: layer, tabTick: 0, setTabTick: noop, brushTool: 'none', isCollisionLayer: false, handleFileUpload: noop, handleToggleBrushTool: noop, handleDeleteActiveTab: noop, toast: noop, handleOpenActorDialog: noop },
    layers: { layers: [layer], activeLayerId: 11, hoveredLayerId: null, layersPanelExpanded: false, setLayersPanelExpanded: noop, setHoveredLayerId: noop, handleSetActiveLayer: noop, handleToggleLayerVisibility: noop, handleLayerTransparencyChange: noop, showTooltipWithDelay: noop, hideTooltip: noop, leftCollapsed: false },
    exportStatus: { isExporting: false, exportProgress: 0 },
    controls: {},
  } as unknown as React.ComponentProps<typeof AppSidebar>;
}

describe('Game Settings sidebar', () => {
  it('keeps the Game Settings flag through sidebar assembly', () => {
    const html = renderToStaticMarkup(<Probe deps={{ gameSettings: { isGameSettingsLayer: true } }} />);
    expect(html).toContain('isGameSettingsLayer&quot;:true');
  });

  it('shows the tile size form instead of the tileset palette', () => {
    const html = renderToStaticMarkup(<AppProvider value={{ currentProjectPath: null }}><AppSidebar {...sidebarProps(true)} /></AppProvider>);
    expect(html).toContain('Apply tile size');
    expect(html).not.toContain('No tileset loaded');
  });
});
