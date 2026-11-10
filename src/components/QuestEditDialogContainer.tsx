import React from 'react';
import QuestEditDialog, { type QuestDraft } from '@/components/QuestEditDialog';

type QuestDialogCtx = {
  showQuestDialog?: boolean;
  setQuestDraft?: React.Dispatch<React.SetStateAction<QuestDraft>>;
  questDraft?: QuestDraft;
  handleCloseQuestDialog?: () => void;
  handleSaveQuest?: () => void;
};

export default function QuestEditDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as QuestDialogCtx;
  const defaultDraft: QuestDraft = {
    name: '',
    complete_status: '',
    quest_text: '',
    requires_status: '',
    requires_not_status: '',
    requires_level: '',
    requires_not_level: '',
    requires_currency: '',
    requires_not_currency: '',
    itemRequirements: [],
    requires_class: '',
    requires_not_class: '',
    steps: [],
  };

  return (
    <QuestEditDialog
      open={Boolean(c.showQuestDialog)}
      onOpenChange={(open) => {
        if (!open) c.handleCloseQuestDialog?.();
      }}
      questDraft={c.questDraft ?? defaultDraft}
      setQuestDraft={c.setQuestDraft ?? (() => {})}
      onSave={c.handleSaveQuest ?? (() => {})}
    />
  );
}
