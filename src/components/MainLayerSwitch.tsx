import React from 'react';
import type { TileLayer } from '@/types';
import SlidingSwitch from '@/components/SlidingSwitch';
import { GROUP_ICON } from '@/components/targetIcons';
import { mainLayerOf, mainLayerTargetId, MAIN_LAYERS } from '@/components/targetGroups';

type Props = { layers: TileLayer[]; activeLayer: TileLayer | null; onSelectLayer: (id: number) => void };

/** Map | Entities | Content | Game Settings switch at the top of the right dock. */
const MainLayerSwitch: React.FC<Props> = ({ layers, activeLayer, onSelectLayer }) => {
  const available = MAIN_LAYERS.filter(m => mainLayerTargetId(m.id, layers) !== null);
  const select = (key: string) => {
    const id = mainLayerTargetId(key, layers);
    if (id !== null) onSelectLayer(id);
  };
  return (
    <div className="flex items-center justify-center pb-2">
      <SlidingSwitch
        ariaLabel="Layers"
        items={available.map(m => ({ key: m.id, icon: GROUP_ICON[m.id], label: m.label, tooltip: m.label }))}
        selected={mainLayerOf(activeLayer?.type)}
        onSelect={select}
      />
    </div>
  );
};

export default MainLayerSwitch;
