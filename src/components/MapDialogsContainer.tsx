/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import MapDialogs from '@/components/MapDialogs';

type MapDialogsCtx = {
  showCreateMapDialog: boolean;
  setShowCreateMapDialog: (v: boolean) => void;
  newMapName: string;
  setNewMapName: (v: string) => void;
  newMapWidth: number;
  setNewMapWidth: (n: number) => void;
  newMapHeight: number;
  setNewMapHeight: (n: number) => void;
  newMapStarting: string;
  setNewMapStarting: (s: string) => void;
  createMapError?: string | null;
  setCreateMapError: (s: string | null) => void;
  isPreparingNewMap: boolean;
  handleConfirmCreateMap: () => void;
  showHeroEditDialog: boolean;
  setShowHeroEditDialog: (v: boolean) => void;
  heroEditData?: unknown;
  setHeroEditData: (d: unknown) => void;
  handleHeroEditCancel: () => void;
  handleHeroEditConfirm: (x: number, y: number) => void;
};

export default function MapDialogsContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as MapDialogsCtx;
  return (
    <MapDialogs
      showCreateMapDialog={c.showCreateMapDialog}
      setShowCreateMapDialog={c.setShowCreateMapDialog}
      newMapName={c.newMapName}
      setNewMapName={c.setNewMapName}
      newMapWidth={c.newMapWidth}
      setNewMapWidth={c.setNewMapWidth}
      newMapHeight={c.newMapHeight}
      setNewMapHeight={c.setNewMapHeight}
      newMapStarting={!!c.newMapStarting}
      setNewMapStarting={(v) => (c.setNewMapStarting ? c.setNewMapStarting(String(v)) : undefined)}
      createMapError={c.createMapError ?? null}
      setCreateMapError={(s) => (c.setCreateMapError ? c.setCreateMapError(s) : undefined)}
      isPreparingNewMap={c.isPreparingNewMap}
      handleConfirmCreateMap={c.handleConfirmCreateMap}
      showHeroEditDialog={c.showHeroEditDialog}
      setShowHeroEditDialog={c.setShowHeroEditDialog}
      heroEditData={c.heroEditData as any ?? null}
      setHeroEditData={(d) => (c.setHeroEditData ? c.setHeroEditData(d) : undefined)}
      handleHeroEditCancel={c.handleHeroEditCancel}
      handleHeroEditConfirm={(x, y) => (c.handleHeroEditConfirm ? c.handleHeroEditConfirm(x, y) : undefined)}
    />
  );
}
