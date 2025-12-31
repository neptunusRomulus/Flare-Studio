import React from 'react';
import ActorDialog from '@/components/ActorDialog';
import type { ActorDialogState, ActorRoleKey } from '@/editor/actorRoles';

type ActorDialogCtx = {
  actorDialogState: ActorDialogState | null;
  actorDialogError?: string | null;
  canUseTilesetDialog: boolean;
  handleCloseActorDialog: () => void;
  handleActorFieldChange: (field: 'name' | 'tilesetPath' | 'portraitPath', value: string) => void;
  handleActorRoleToggle: (role: ActorRoleKey) => void;
  handleActorTilesetBrowse: () => Promise<void> | void;
  handleActorPortraitBrowse: () => Promise<void> | void;
  handleActorSubmit: (editAfter?: boolean) => Promise<void> | void;
};

export default function ActorDialogContainer({ ctx }: { ctx: ActorDialogCtx }) {
  const c = ctx;
  return (
    <ActorDialog
      actorDialogState={c.actorDialogState ?? null}
      actorDialogError={c.actorDialogError ?? null}
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
