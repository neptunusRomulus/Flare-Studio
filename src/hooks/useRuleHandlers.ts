import React, { useCallback } from 'react';
import type { RuleStartType } from '@/editor/ruleOptions';

type RuleEntry = { id: string; name: string; startType: RuleStartType; triggerId: string };

export default function useRuleHandlers(args: {
  openRuleDialog: () => void;
  closeRuleDialog: () => void;
  rulesListLength: number;
  ruleNameInput: string;
  setRuleNameInput: React.Dispatch<React.SetStateAction<string>>;
  ruleStartType: RuleStartType | null;
  setRuleDialogError: React.Dispatch<React.SetStateAction<string | null>>;
  setRuleStartType: React.Dispatch<React.SetStateAction<any>>;
  setRuleTriggerId: React.Dispatch<React.SetStateAction<string>>;
  setRuleActionSelection: React.Dispatch<React.SetStateAction<{ groupId: string; actionId: string } | null>>;
  setRuleDialogStep: React.Dispatch<React.SetStateAction<any>>;
  setRulesList: React.Dispatch<React.SetStateAction<RuleEntry[]>>;
}) {
  const { openRuleDialog, closeRuleDialog, rulesListLength, ruleNameInput, setRuleNameInput, ruleStartType, setRuleDialogError, setRuleStartType, setRuleTriggerId, setRuleActionSelection, setRuleDialogStep, setRulesList } = args;

  const handleAddRule = useCallback(() => {
    setRuleDialogError(null);
    setRuleStartType(null);
    setRuleTriggerId('');
    setRuleActionSelection(null);
    setRuleNameInput(`Rule ${rulesListLength + 1}`);
    setRuleDialogStep('start');
    openRuleDialog();
  }, [rulesListLength, openRuleDialog, setRuleDialogStep, setRuleDialogError, setRuleStartType, setRuleTriggerId, setRuleActionSelection, setRuleNameInput]);

  const handleSaveRule = useCallback(() => {
    const trimmedName = ruleNameInput.trim();
    if (!ruleStartType) {
      setRuleDialogError('Select how this rule starts.');
      return;
    }

    if (!trimmedName) {
      setRuleDialogError('Rule name is required.');
      return;
    }

    // Caller is responsible for validating trigger id; keep simple here
    setRulesList((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        name: trimmedName,
        startType: ruleStartType,
        triggerId: ''
      }
    ]);
    closeRuleDialog();
    setRuleDialogError(null);
    setRuleNameInput('');
    setRuleStartType(null);
    setRuleTriggerId('');
    setRuleActionSelection(null);
  }, [ruleNameInput, ruleStartType, closeRuleDialog, setRuleDialogError, setRulesList, setRuleNameInput, setRuleStartType, setRuleTriggerId, setRuleActionSelection]);

  return { handleAddRule, handleSaveRule };
}
