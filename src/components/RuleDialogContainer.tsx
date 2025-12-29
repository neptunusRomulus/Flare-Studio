import React from 'react';
import RuleDialog from '@/components/RuleDialog';

export default function RuleDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
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
