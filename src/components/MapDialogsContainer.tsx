import React from 'react';
import MapDialogs from '@/components/MapDialogs';

export default function MapDialogsContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
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
