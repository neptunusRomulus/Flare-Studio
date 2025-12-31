/* eslint-disable @typescript-eslint/no-explicit-any */
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
      setDialogueTrees={c.setDialogueTrees as React.Dispatch<React.SetStateAction<any[]>>}
      activeDialogueTab={(c.activeDialogueTab as unknown as number) ?? 0}
      setActiveDialogueTab={(id) => (c.setActiveDialogueTab ? c.setActiveDialogueTab(String(id)) : undefined)}
      dialogueTabToDelete={(c.dialogueTabToDelete as unknown as number) ?? null}
      setDialogueTabToDelete={(id) => (c.setDialogueTabToDelete ? c.setDialogueTabToDelete(String(id)) : undefined)}
      editingObject={c.editingObject as any ?? null}
      updateEditingObjectProperty={(k, v) => (c.updateEditingObjectProperty ? c.updateEditingObjectProperty(k, v) : undefined)}
      onClose={c.onDialogueClose ?? (() => {})}
    />
  );
}
