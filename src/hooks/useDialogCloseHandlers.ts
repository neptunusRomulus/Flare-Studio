import React, { useCallback } from 'react';

export default function useDialogCloseHandlers(args: {
  closeRuleDialog: () => void;
  setRuleDialogError: (v: string | null) => void;
  // Accept flexible setters to match App's state setters
  setRuleDialogStep: React.Dispatch<React.SetStateAction<any>>;
  setRuleStartType: React.Dispatch<React.SetStateAction<any>>;
  setRuleTriggerId: React.Dispatch<React.SetStateAction<any>>;
  setRuleActionSelection: React.Dispatch<React.SetStateAction<any>>;
  setShowDialogueTreeDialog: React.Dispatch<React.SetStateAction<any>>;
  setDialogueTabToDelete: React.Dispatch<React.SetStateAction<any>>;
}) {
  const { closeRuleDialog, setRuleDialogError, setRuleDialogStep, setRuleStartType, setRuleTriggerId, setRuleActionSelection, setShowDialogueTreeDialog, setDialogueTabToDelete } = args;

  const handleRuleClose = useCallback(() => {
    closeRuleDialog();
    setRuleDialogError(null);
    setRuleDialogStep('start');
    setRuleStartType(null);
    setRuleTriggerId('');
    setRuleActionSelection(null);
  }, [closeRuleDialog, setRuleDialogError, setRuleDialogStep, setRuleStartType, setRuleTriggerId, setRuleActionSelection]);

  const handleDialogueClose = useCallback(() => { setShowDialogueTreeDialog(false); setDialogueTabToDelete(null); }, [setShowDialogueTreeDialog, setDialogueTabToDelete]);

  return { handleRuleClose, handleDialogueClose };
}
