import type { ActorDialogState, ActorRoleKey } from '@/editor/actorRoles';

type Params = {
  actorDialogState: ActorDialogState | null | undefined;
  actorDialogError: string | null;
  handleCloseActorDialog: () => void;
  handleActorFieldChange: (field: 'name' | 'tilesetPath' | 'tilesetSourcePath' | 'portraitPath' | 'portraitSourcePath' | 'locationX' | 'locationY', value: string) => void;
  handleActorRoleToggle: (role: ActorRoleKey) => void;
  handleActorSubmit: (editAfter?: boolean) => Promise<void> | void;
};

export default function useActorDialogCtx(params: Params) {
  const {
    actorDialogState,
    actorDialogError,
    handleCloseActorDialog,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorSubmit
  } = params;

  return {
    actorDialogState,
    actorDialogError,
    handleCloseActorDialog,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorSubmit
  } as const;
}
