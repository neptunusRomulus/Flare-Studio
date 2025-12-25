import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { GitBranch, Shield, User } from 'lucide-react';
import { RULE_ACTION_GROUPS, RULE_TRIGGER_LOOKUP } from '@/editor/ruleOptions';
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

type RuleDialogProps = {
  open: boolean;
  ruleDialogStep: 'start' | 'actions';
  ruleDialogError: string | null;
  ruleNameInput: string;
  setRuleNameInput: React.Dispatch<React.SetStateAction<string>>;
  ruleStartType: RuleStartType | null;
  setRuleStartType: React.Dispatch<React.SetStateAction<RuleStartType | null>>;
  ruleTriggerId: string;
  setRuleTriggerId: React.Dispatch<React.SetStateAction<string>>;
  ruleActionSelection: RuleActionSelection | null;
  setRuleActionSelection: React.Dispatch<React.SetStateAction<RuleActionSelection | null>>;
  availableRuleTriggers: RuleTriggerOption[];
  onClose: () => void;
  onSave: () => void;
  onSetStep: (step: 'start' | 'actions') => void;
};

const RuleDialog = ({
  open,
  ruleDialogStep,
  ruleDialogError,
  ruleNameInput,
  setRuleNameInput,
  ruleStartType,
  setRuleStartType,
  ruleTriggerId,
  setRuleTriggerId,
  ruleActionSelection,
  setRuleActionSelection,
  availableRuleTriggers,
  onClose,
  onSave,
  onSetStep
}: RuleDialogProps) => (
  <Dialog
    open={open}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        onClose();
      }
    }}
  >
    <DialogContent className="max-w-xl w-[520px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-orange-500" />
          Add Rule
        </DialogTitle>
        <DialogDescription>Give the rule a name and pick how it begins.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {ruleDialogStep === 'start' ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={ruleNameInput}
                onChange={(event) => setRuleNameInput(event.target.value)}
                placeholder="Rule name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">How does this rule start?</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { id: 'player', label: 'Started by player', hint: 'Triggered by player actions', icon: User },
                  { id: 'game', label: 'Started by the game', hint: 'Triggered by world or system', icon: Shield }
                ].map((option) => {
                  const IconComp = option.icon;
                  const isActive = ruleStartType === option.id;
                  return (
                    <Tooltip
                      key={option.id}
                      content={
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.hint}</span>
                        </div>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => setRuleStartType(option.id as RuleStartType)}
                        className={`flex items-center justify-center rounded-md p-1 transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          isActive
                            ? 'bg-orange-50 dark:bg-orange-900/20 shadow-md border-orange-500'
                            : 'hover:bg-muted/60 border-transparent'
                        }`}
                        aria-label={option.label}
                      >
                        <span className={`w-10 h-10 rounded-md flex items-center justify-center ${isActive ? 'bg-white dark:bg-orange-900/40 text-orange-600 dark:text-orange-200' : 'bg-muted text-foreground/80'}`}>
                          <IconComp className="w-5 h-5" />
                        </span>
                        <span className="sr-only">{option.label}</span>
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium">Pick a trigger</label>
                <span className="text-xs text-muted-foreground">
                  {ruleStartType === 'player'
                    ? 'Player driven events'
                    : ruleStartType === 'game'
                      ? 'Game driven events'
                      : 'Select how the rule starts'}
                </span>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                {ruleStartType ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 min-h-[140px] items-start">
                    {availableRuleTriggers.map((option) => {
                      const IconComp = option.icon;
                      const isActive = ruleTriggerId === option.id;
                      return (
                        <Tooltip key={option.id} content={option.tooltip || option.label}>
                          <button
                            type="button"
                            onClick={() => setRuleTriggerId(option.id)}
                            className={`flex flex-col items-center gap-1 rounded-md p-0 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive
                                ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-200 shadow-md border-orange-500'
                                : 'border-transparent hover:bg-muted/60'
                            }`}
                          >
                            <span className={`w-10 h-10 rounded-md flex items-center justify-center ${isActive ? 'bg-white dark:bg-orange-900/40 text-orange-600 dark:text-orange-200' : 'bg-muted text-foreground/80'}`}>
                              <IconComp className="w-5 h-5" />
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {option.label}
                            </span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-6">
                    Pick a start type to see triggers.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Pick an action</label>
              <div className="grid gap-3">
                {RULE_ACTION_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.id} className="rounded-md border border-border bg-muted/50 px-3 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <GroupIcon className="w-4 h-4 text-orange-500" />
                        {group.title}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{group.tooltip}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.actions.map((action) => {
                          const ActionIcon = action.icon;
                          const isActive = ruleActionSelection?.groupId === group.id && ruleActionSelection.actionId === action.id;
                          return (
                            <Tooltip content={action.label} key={action.id}>
                              <button
                                type="button"
                                className={`rounded-md border px-2 py-2 ${isActive ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-background hover:bg-muted/60'}`}
                                onClick={() => setRuleActionSelection({ groupId: group.id, actionId: action.id })}
                              >
                                <ActionIcon className="w-5 h-5" />
                              </button>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-md border border-gray-300 dark:border-neutral-700 bg-neutral-900 px-3 py-3 text-xs flex items-center gap-3 shadow-inner">
              <span className="font-semibold text-foreground">Preview</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="px-3 py-2 rounded-md bg-orange-500 text-white text-xs font-medium truncate">
                  {ruleStartType ? (ruleStartType === 'player' ? 'Started by player' : 'Started by the game') : 'Pick a start type'}
                </span>
                <span className="px-3 py-2 rounded-md bg-orange-500 text-white text-xs font-medium truncate">
                  {ruleTriggerId ? (RULE_TRIGGER_LOOKUP[ruleTriggerId]?.label || RULE_TRIGGER_LOOKUP[ruleTriggerId]?.tooltip || 'Trigger') : 'Pick a trigger'}
                </span>
                <span className="text-white font-extrabold text-lg px-1">→</span>
                <span className="px-3 py-2 rounded-md bg-orange-500 text-white text-xs font-medium truncate">
                  {ruleActionSelection
                    ? RULE_ACTION_GROUPS.find((g) => g.id === ruleActionSelection.groupId)?.actions.find((a) => a.id === ruleActionSelection.actionId)?.label || 'Action'
                    : 'Pick an action'}
                </span>
              </div>
            </div>
          </div>
        )}

        {ruleDialogError && (
          <div className="text-sm text-red-500">{ruleDialogError}</div>
        )}
      </div>

      <DialogFooter className="justify-between">
        {ruleDialogStep === 'actions' ? (
          <>
            <Button
              variant="outline"
              onClick={() => onSetStep('start')}
            >
              Back
            </Button>
            <Button onClick={onSave}>Save Rule</Button>
          </>
        ) : (
          <>
            <Button onClick={onSave}>Save Rule</Button>
            <Button
              variant="outline"
              onClick={() => onSetStep('actions')}
            >
              Next &gt;
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default RuleDialog;
