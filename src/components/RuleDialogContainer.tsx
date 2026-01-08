/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import RuleDialog from '@/components/RuleDialog';
import type { RuleStartType } from '@/editor/ruleOptions';

type RuleTriggerOption = {
  id: string;
  label: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
  startType: RuleStartType;
};

type RuleActionSelection = {
  groupId: string;
  actionId: string;
};

type RuleDialogCtx = {
  showRuleDialog: boolean;
  ruleDialogStep?: number;
  ruleDialogError?: string | null;
  ruleNameInput: string;
  setRuleNameInput: React.Dispatch<React.SetStateAction<string>>;
  ruleStartType?: RuleStartType | null;
  setRuleStartType: React.Dispatch<React.SetStateAction<RuleStartType | null>>;
  ruleTriggerId?: string | null;
  setRuleTriggerId: React.Dispatch<React.SetStateAction<string>>;
  ruleActionSelection?: RuleActionSelection | null;
  setRuleActionSelection: React.Dispatch<React.SetStateAction<RuleActionSelection | null>>;
  availableRuleTriggers?: RuleTriggerOption[];
  onRuleClose: () => void;
  handleSaveRule: () => void;
  setRuleDialogStep: (n: number) => void;
};

export default function RuleDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as RuleDialogCtx;
  return (
    <RuleDialog
      open={c.showRuleDialog}
      ruleDialogStep={(c.ruleDialogStep === 1) ? 'actions' : 'start'}
      ruleDialogError={c.ruleDialogError ?? null}
      ruleNameInput={c.ruleNameInput}
      setRuleNameInput={c.setRuleNameInput}
      ruleStartType={c.ruleStartType ?? null}
      setRuleStartType={(v) => (c.setRuleStartType ? c.setRuleStartType(v) : undefined)}
      ruleTriggerId={c.ruleTriggerId ?? ''}
      setRuleTriggerId={(v) => (c.setRuleTriggerId ? c.setRuleTriggerId(v) : undefined)}
      ruleActionSelection={c.ruleActionSelection ?? null}
      setRuleActionSelection={(v) => (c.setRuleActionSelection ? c.setRuleActionSelection(v) : undefined)}
      availableRuleTriggers={c.availableRuleTriggers ?? []}
      onClose={c.onRuleClose ?? (() => {})}
      onSave={c.handleSaveRule ?? (() => {})}
      onSetStep={(step) => { if (c.setRuleDialogStep) c.setRuleDialogStep(step === 'start' ? 0 : 1); }}
    />
  );
}
