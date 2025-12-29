import React from 'react';
import AbilityDialog from '@/components/AbilityDialog';

type AbilityDialogCtx = {
  showAbilityDialog: boolean;
  abilityNameInput: string;
  setAbilityNameInput: (v: string) => void;
  handleCloseAbilityDialog: () => void;
  handleCreateAbility: (name: string) => void;
};

export default function AbilityDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as AbilityDialogCtx;
  return (
    <AbilityDialog
      open={c.showAbilityDialog}
      abilityNameInput={c.abilityNameInput}
      onNameChange={c.setAbilityNameInput}
      onClose={c.handleCloseAbilityDialog}
      onCreate={c.handleCreateAbility}
    />
  );
}
