import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { GitBranch, Plus } from 'lucide-react';
import { RULE_TRIGGER_LOOKUP } from '@/editor/ruleOptions';
import type { RuleStartType } from '@/editor/ruleOptions';

type RuleListEntry = {
  id: string;
  name: string;
  startType: RuleStartType;
  triggerId: string;
};

type SidebarRulesPanelProps = {
  rulesList: RuleListEntry[];
  onAddRule: () => void;
};

const SidebarRulesPanel = ({ rulesList, onAddRule }: SidebarRulesPanelProps) => (
  <div className="flex flex-col flex-1">
    <div className="flex-1 min-h-0 border border-dashed border-border rounded-md overflow-y-auto">
      {rulesList.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-4 text-center">
          Click &quot;+ Rule&quot; to create your first rule.
        </div>
      ) : (
        <div className="flex flex-col gap-1 p-2">
          {rulesList.map((rule) => {
            const triggerMeta = RULE_TRIGGER_LOOKUP[rule.triggerId];
            const TriggerIcon = triggerMeta?.icon;
            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 p-2 bg-muted/50 hover:bg-muted rounded-md border border-border cursor-pointer transition-colors w-full"
                title={rule.name}
              >
                <GitBranch className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{rule.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-[11px] px-2 py-0.5">
                      {rule.startType === 'player' ? 'Started by player' : 'Started by the game'}
                    </Badge>
                    {TriggerIcon && (
                      <Tooltip content={triggerMeta?.tooltip || triggerMeta?.label || 'Trigger'}>
                        <div className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground">
                          <TriggerIcon className="w-4 h-4" />
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    <div className="flex justify-center py-2">
      <Tooltip content="Add Rule" side="bottom">
        <Button
          variant="default"
          size="sm"
          aria-label="Add Rule"
          className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onAddRule();
          }}
        >
          <Plus className="w-3 h-3 mr-1" />
          Rule
        </Button>
      </Tooltip>
    </div>
  </div>
);

export default SidebarRulesPanel;
