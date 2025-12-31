/* eslint-disable @typescript-eslint/no-explicit-any */
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
      ruleDialogStep={(c.ruleDialogStep === 1) ? 'actions' : 'start'}
      ruleDialogError={c.ruleDialogError ?? null}
      ruleNameInput={c.ruleNameInput}
      setRuleNameInput={(v) => (typeof v === 'function' ? c.setRuleNameInput(v('')) : c.setRuleNameInput(v))}
      ruleStartType={(c.ruleStartType as any) ?? null}
      setRuleStartType={(v) => c.setRuleStartType ? c.setRuleStartType(v as any) : undefined}
      ruleTriggerId={c.ruleTriggerId ?? ''}
      setRuleTriggerId={(v) => c.setRuleTriggerId ? c.setRuleTriggerId(v as any) : undefined}
      ruleActionSelection={c.ruleActionSelection as any ?? null}
      setRuleActionSelection={(v) => (c.setRuleActionSelection ? c.setRuleActionSelection(v) : undefined)}
      availableRuleTriggers={(c.availableRuleTriggers as any) ?? []}
      onClose={c.onRuleClose ?? (() => {})}
      onSave={c.handleSaveRule ?? (() => {})}
      onSetStep={(step) => { if (c.setRuleDialogStep) c.setRuleDialogStep(step === 'start' ? 0 : 1); }}
    />
  );
}
