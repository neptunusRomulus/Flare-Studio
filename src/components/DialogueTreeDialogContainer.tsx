/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import DialogueTreeDialog from '@/components/dialogue/DialogueTreeDialog';
import type { DialogueTree, MapObject } from '@/types';

type DialogueTreeDialogCtx = {
  showDialogueTreeDialog?: boolean;
  dialogueTrees?: DialogueTree[];
  setDialogueTrees?: React.Dispatch<React.SetStateAction<DialogueTree[]>>;
  activeDialogueTab?: number;
  setActiveDialogueTab?: React.Dispatch<React.SetStateAction<number>>;
  dialogueTabToDelete?: number | null;
  setDialogueTabToDelete?: React.Dispatch<React.SetStateAction<number | null>>;
  editingObject?: MapObject | null;
  updateEditingObjectProperty?: (key: string, value: string | null) => void;
  onDialogueClose?: () => void;
};

export default function DialogueTreeDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as DialogueTreeDialogCtx & { projectMaps?: string[] };
  // Try to get projectMaps from context if available
  const projectMaps = (c.projectMaps ?? (window.__ISM_TILE_PROJECT_MAPS__ ?? []));
  return (
    <DialogueTreeDialog
      showDialogueTreeDialog={c.showDialogueTreeDialog ?? false}
      dialogueTrees={c.dialogueTrees ?? []}
      setDialogueTrees={(c.setDialogueTrees ?? (() => {})) as React.Dispatch<React.SetStateAction<DialogueTree[]>>}
      activeDialogueTab={c.activeDialogueTab ?? 0}
      setActiveDialogueTab={(c.setActiveDialogueTab ?? (() => {})) as React.Dispatch<React.SetStateAction<number>>}
      dialogueTabToDelete={c.dialogueTabToDelete ?? null}
      setDialogueTabToDelete={(c.setDialogueTabToDelete ?? (() => {})) as React.Dispatch<React.SetStateAction<number | null>>}
      editingObject={c.editingObject ?? null}
      updateEditingObjectProperty={(k, v) => (c.updateEditingObjectProperty ? c.updateEditingObjectProperty(k, v) : undefined)}
      onClose={c.onDialogueClose ?? (() => {})}
      projectMaps={projectMaps}
    />
  );
}
