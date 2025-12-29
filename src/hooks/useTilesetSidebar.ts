import type React from 'react';
import type { TileMapEditor } from '../editor/TileMapEditor';
import type { TileLayer, Stamp } from '../types';

type BrushTool = 'none' | 'move' | 'merge' | 'separate' | 'remove';

export type TilesetSidebarParams = {
  editor: TileMapEditor | null;
  activeLayer: TileLayer | null;
  tabTick: number;
  setTabTick: React.Dispatch<React.SetStateAction<number>>;
  brushTool: BrushTool;
  isCollisionLayer: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => void;
  handleToggleBrushTool: (tool: 'move' | 'merge' | 'separate' | 'remove') => void;
  handleDeleteActiveTab: () => void;
  toast: typeof import('../hooks/use-toast').toast;
  handleOpenActorDialogForTileset?: (type: 'npc' | 'enemy') => void;
  stampsState?: {
    stamps: Stamp[];
    selectedStamp: Stamp | null;
  } | null;
};

export default function useTilesetSidebar(params: TilesetSidebarParams) {
  const p = params;

  const tileset = {
    editor: p.editor,
    activeLayer: p.activeLayer,
    tabTick: p.tabTick,
    setTabTick: p.setTabTick,
    brushTool: p.brushTool,
    isCollisionLayer: p.isCollisionLayer,
    handleFileUpload: p.handleFileUpload,
    handleToggleBrushTool: p.handleToggleBrushTool,
    handleDeleteActiveTab: p.handleDeleteActiveTab,
    toast: p.toast,
    handleOpenActorDialog: p.handleOpenActorDialogForTileset,
    stampsState: p.stampsState
  };

  return { tileset } as const;
}

