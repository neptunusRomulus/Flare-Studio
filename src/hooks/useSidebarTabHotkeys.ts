import { useEffect } from 'react';
import type { TileLayer } from '@/types';
import {
  groupOfType,
  mainLayerTargetId,
  mainTabTargetFor,
  MAIN_LAYERS,
  rememberGroupTarget,
  tabTargetFor,
} from '@/components/targetGroups';
import { isMapTarget, rememberTarget } from '@/components/mapTargets';

/**
 * Tab cycles targets inside the active group; Shift+Tab cycles main layers.
 * Same rules as the old MainLayerSwitch / MapTargetSwitch keyboard handlers.
 */
export function useSidebarTabHotkeys(
  layers: TileLayer[],
  activeLayer: TileLayer | null,
  onSelectLayer: (id: number) => void,
): void {
  useEffect(() => {
    const available = MAIN_LAYERS.filter((m) => mainLayerTargetId(m.id, layers) !== null).map((m) => m.id);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const main = mainTabTargetFor(e, activeLayer?.type, target, available);
      if (main) {
        const id = mainLayerTargetId(main, layers);
        if (id !== null) {
          e.preventDefault();
          onSelectLayer(id);
        }
        return;
      }
      const next = tabTargetFor(e, activeLayer?.type, target);
      if (!next) return;
      const layer = layers.find((item) => item.type === next);
      if (!layer) return;
      e.preventDefault();
      const group = groupOfType(next);
      if (group) rememberGroupTarget(group, next);
      if (isMapTarget(next)) rememberTarget(next);
      onSelectLayer(layer.id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
}
