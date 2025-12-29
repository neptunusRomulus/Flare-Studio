type Params = {
  actorDialogState: unknown;
  actorDialogError: string | null;
  canUseTilesetDialog: boolean;
  handleCloseActorDialog: () => void;
  handleActorFieldChange: (...args: any[]) => any;
  handleActorRoleToggle: (...args: any[]) => any;
  handleActorTilesetBrowse: (...args: any[]) => any;
  handleActorPortraitBrowse: (...args: any[]) => any;
  handleActorSubmit: (...args: any[]) => any;
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
