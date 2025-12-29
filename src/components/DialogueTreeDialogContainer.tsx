import React from 'react';
import DialogueTreeDialog from '@/components/dialogue/DialogueTreeDialog';
import type { DialogueTree } from '@/types';

type DialogueTreeDialogCtx = {
  showDialogueTreeDialog: boolean;
  dialogueTrees: DialogueTree[];
  setDialogueTrees: (t: DialogueTree[]) => void;
  activeDialogueTab?: string | null;
  setActiveDialogueTab: (id: string | null) => void;
  dialogueTabToDelete?: string | null;
  setDialogueTabToDelete: (id: string | null) => void;
  editingObject?: unknown;
  updateEditingObjectProperty: (key: string, value: unknown) => void;
  onDialogueClose: () => void;
};

export default function DialogueTreeDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as DialogueTreeDialogCtx;
  return (
    <DialogueTreeDialog
      showDialogueTreeDialog={c.showDialogueTreeDialog}
      dialogueTrees={c.dialogueTrees}
      setDialogueTrees={c.setDialogueTrees}
      activeDialogueTab={c.activeDialogueTab}
      setActiveDialogueTab={c.setActiveDialogueTab}
      dialogueTabToDelete={c.dialogueTabToDelete}
      setDialogueTabToDelete={c.setDialogueTabToDelete}
      editingObject={c.editingObject}
      updateEditingObjectProperty={c.updateEditingObjectProperty}
      onClose={c.onDialogueClose}
    />
  );
}
