import React from 'react';
import ActorDialog from '@/components/ActorDialog';

export default function ActorDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
  return (
    <ActorDialog
      actorDialogState={c.actorDialogState}
      actorDialogError={c.actorDialogError}
      canUseTilesetDialog={c.canUseTilesetDialog}
      onClose={c.handleCloseActorDialog}
      onFieldChange={c.handleActorFieldChange}
      onRoleToggle={c.handleActorRoleToggle}
      onTilesetBrowse={c.handleActorTilesetBrowse}
      onPortraitBrowse={c.handleActorPortraitBrowse}
      onSubmit={c.handleActorSubmit}
    />
  );
}
