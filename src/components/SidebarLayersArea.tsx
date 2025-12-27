import React from 'react';
import LayersPanel from '@/components/LayersPanel';
import type { TileLayer } from '@/types';

type Props = {
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

const SidebarLayersArea: React.FC<Props> = ({
  layers,
  activeLayerId,
  hoveredLayerId,
  layersPanelExpanded,
  setLayersPanelExpanded,
  setHoveredLayerId,
  handleSetActiveLayer,
  handleToggleLayerVisibility,
  handleLayerTransparencyChange,
  showTooltipWithDelay,
  hideTooltip,
  uiHelpers,
  leftCollapsed
}) => {
  return (
    <LayersPanel
      layers={layers}
      activeLayerId={activeLayerId}
      hoveredLayerId={hoveredLayerId}
      layersPanelExpanded={layersPanelExpanded}
      setLayersPanelExpanded={setLayersPanelExpanded}
      setHoveredLayerId={setHoveredLayerId}
      handleSetActiveLayer={handleSetActiveLayer}
      handleToggleLayerVisibility={handleToggleLayerVisibility}
      handleLayerTransparencyChange={handleLayerTransparencyChange}
      showTooltipWithDelay={uiHelpers?.showTooltipWithDelay ?? showTooltipWithDelay}
      hideTooltip={uiHelpers?.hideTooltip ?? hideTooltip}
      leftCollapsed={leftCollapsed}
    />
  );
};

export default SidebarLayersArea;
