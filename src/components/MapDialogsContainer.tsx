/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import MapDialogs from '@/components/MapDialogs';

type HeroEditData = {
  currentX: number;
  currentY: number;
  mapWidth: number;
  mapHeight: number;
  onConfirm: (x: number, y: number) => void;
};

type MapDialogsCtx = {
  showCreateMapDialog?: boolean;
  setShowCreateMapDialog?: (v: boolean) => void;
  newMapName?: string;
  setNewMapName?: (v: string) => void;
  newMapWidth?: number;
  setNewMapWidth?: (n: number) => void;
  newMapHeight?: number;
  setNewMapHeight?: (n: number) => void;
  newMapStarting?: boolean;
  setNewMapStarting?: (s: boolean) => void;
  createMapError?: string | null;
  setCreateMapError?: (s: string | null) => void;
  isPreparingNewMap?: boolean;
  handleConfirmCreateMap?: () => void;
  showHeroEditDialog?: boolean;
  setShowHeroEditDialog?: (v: boolean) => void;
  heroEditData?: HeroEditData | null;
  setHeroEditData?: (d: HeroEditData | null) => void;
  handleHeroEditCancel?: () => void;
  handleHeroEditConfirm?: (x: number, y: number) => void;
};

export default function MapDialogsContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as MapDialogsCtx;
  return (
    <MapDialogs
      showCreateMapDialog={c.showCreateMapDialog ?? false}
      setShowCreateMapDialog={c.setShowCreateMapDialog ?? (() => {})}
      newMapName={c.newMapName ?? ''}
      setNewMapName={c.setNewMapName ?? (() => {})}
      newMapWidth={c.newMapWidth ?? 20}
      setNewMapWidth={c.setNewMapWidth ?? (() => {})}
      newMapHeight={c.newMapHeight ?? 15}
      setNewMapHeight={c.setNewMapHeight ?? (() => {})}
      newMapStarting={!!c.newMapStarting}
      setNewMapStarting={(v) => (c.setNewMapStarting ? c.setNewMapStarting(Boolean(v)) : undefined)}
      createMapError={c.createMapError ?? null}
      setCreateMapError={(s) => (c.setCreateMapError ? c.setCreateMapError(s) : undefined)}
      isPreparingNewMap={c.isPreparingNewMap ?? false}
      handleConfirmCreateMap={c.handleConfirmCreateMap ?? (() => {})}
      showHeroEditDialog={c.showHeroEditDialog ?? false}
      setShowHeroEditDialog={c.setShowHeroEditDialog ?? (() => {})}
      heroEditData={c.heroEditData ?? null}
      setHeroEditData={(d) => (c.setHeroEditData ? c.setHeroEditData(d) : undefined)}
      handleHeroEditCancel={c.handleHeroEditCancel ?? (() => {})}
      handleHeroEditConfirm={(x, y) => (c.handleHeroEditConfirm ? c.handleHeroEditConfirm(x, y) : undefined)}
    />
  );
}
