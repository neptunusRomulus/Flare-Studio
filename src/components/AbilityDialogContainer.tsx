import React from 'react';
import AbilityDialog from '@/components/AbilityDialog';

export default function AbilityDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
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
