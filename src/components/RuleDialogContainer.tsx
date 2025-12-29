import React from 'react';
import RuleDialog from '@/components/RuleDialog';
type RuleDialogCtx = {
  showRuleDialog: boolean;
  ruleDialogStep?: number;
  ruleDialogError?: string | null;
  ruleNameInput: string;
  setRuleNameInput: (v: string) => void;
  ruleStartType?: string | null;
  setRuleStartType: (v: string | null) => void;
  ruleTriggerId?: string | null;
  setRuleTriggerId: (v: string | null) => void;
  ruleActionSelection?: unknown;
  setRuleActionSelection: (v: unknown) => void;
  availableRuleTriggers?: unknown;
  onRuleClose: () => void;
  handleSaveRule: () => void;
  setRuleDialogStep: (n: number) => void;
};

export default function RuleDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as RuleDialogCtx;
  return (
    <RuleDialog
      open={c.showRuleDialog}
      ruleDialogStep={c.ruleDialogStep}
      ruleDialogError={c.ruleDialogError}
      ruleNameInput={c.ruleNameInput}
      setRuleNameInput={c.setRuleNameInput}
      ruleStartType={c.ruleStartType}
      setRuleStartType={c.setRuleStartType}
      ruleTriggerId={c.ruleTriggerId}
      setRuleTriggerId={c.setRuleTriggerId}
      ruleActionSelection={c.ruleActionSelection}
      setRuleActionSelection={c.setRuleActionSelection}
      availableRuleTriggers={c.availableRuleTriggers}
      onClose={c.onRuleClose}
      onSave={c.handleSaveRule}
      onSetStep={c.setRuleDialogStep}
    />
  );
}
