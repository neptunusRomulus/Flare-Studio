import React from 'react';
import DialogueTreeDialog from '@/components/dialogue/DialogueTreeDialog';

export default function DialogueTreeDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
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
