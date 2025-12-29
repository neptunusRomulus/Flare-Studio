import type { ActorDialogState } from '@/editor/actorRoles';

type Params = {
  actorDialogState: ActorDialogState | null | undefined;
  actorDialogError: string | null;
  canUseTilesetDialog: boolean;
  handleCloseActorDialog: () => void;
  handleActorFieldChange: (field: 'name' | 'tilesetPath' | 'portraitPath', value: string) => void;
  handleActorRoleToggle: (role: keyof ActorDialogState) => void;
  handleActorTilesetBrowse: () => Promise<void> | void;
  handleActorPortraitBrowse: () => Promise<void> | void;
  handleActorSubmit: (editAfter?: boolean) => Promise<void> | void;
};

export default function useActorDialogCtx(params: Params) {
  const {
    actorDialogState,
    actorDialogError,
    canUseTilesetDialog,
    handleCloseActorDialog,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit
  } = params;

  return {
    actorDialogState,
    actorDialogError,
    canUseTilesetDialog,
    handleCloseActorDialog,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit
  } as const;
}
