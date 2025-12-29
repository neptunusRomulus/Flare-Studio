import React from 'react';
import ActorDialog from '@/components/ActorDialog';

type ActorDialogCtx = {
  actorDialogState: unknown;
  actorDialogError?: string | null;
  canUseTilesetDialog: boolean;
  handleCloseActorDialog: () => void;
  handleActorFieldChange: (field: string, value: unknown) => void;
  handleActorRoleToggle: (role: string) => void;
  handleActorTilesetBrowse: () => void;
  handleActorPortraitBrowse: () => void;
  handleActorSubmit: (data: unknown) => void;
};

export default function ActorDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ActorDialogCtx;
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
