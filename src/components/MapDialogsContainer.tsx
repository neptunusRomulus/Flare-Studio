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
  handleHeroEditConfirm: () => void;
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
      newMapStarting={c.newMapStarting}
      setNewMapStarting={c.setNewMapStarting}
      createMapError={c.createMapError}
      setCreateMapError={c.setCreateMapError}
      isPreparingNewMap={c.isPreparingNewMap}
      handleConfirmCreateMap={c.handleConfirmCreateMap}
      showHeroEditDialog={c.showHeroEditDialog}
      setShowHeroEditDialog={c.setShowHeroEditDialog}
      heroEditData={c.heroEditData}
      setHeroEditData={c.setHeroEditData}
      handleHeroEditCancel={c.handleHeroEditCancel}
      handleHeroEditConfirm={c.handleHeroEditConfirm}
    />
  );
}
