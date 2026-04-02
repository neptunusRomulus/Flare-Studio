import React from 'react';
import ActorDialog from '@/components/ActorDialog';
import type { ActorDialogState, ActorRoleKey } from '@/editor/actorRoles';

type ActorDialogCtx = {
  actorDialogState: ActorDialogState | null;
  actorDialogError?: string | null;
  handleCloseActorDialog: () => void;
  handleActorFieldChange: (field: 'name' | 'tilesetPath' | 'portraitPath' | 'locationX' | 'locationY', value: string) => void;
  handleActorRoleToggle: (role: ActorRoleKey) => void;
  handleActorSubmit: (editAfter?: boolean) => Promise<void> | void;
};

export default function ActorDialogContainer({ ctx }: { ctx: ActorDialogCtx }) {
  const c = ctx;
  return (
    <ActorDialog
      actorDialogState={c.actorDialogState ?? null}
      actorDialogError={c.actorDialogError ?? null}
      onClose={c.handleCloseActorDialog}
      onFieldChange={c.handleActorFieldChange}
      onRoleToggle={c.handleActorRoleToggle}
      onSubmit={c.handleActorSubmit}
    />
  );
}
