/**
 * Dialog Effects Panel Component
 * 
 * Right side of the dialogue node editor.
 * Contains: Conditions, Rewards & Inventory, World & Flow (Advanced)
 */

import React from 'react';
import { DialogNode } from '../../types/dialogueEditor';
import { ConditionsPanel } from './ConditionsPanel';
import { RewardsPanel } from './RewardsPanel';
import { WorldFlowPanel } from './WorldFlowPanel';

interface DialogEffectsPanelProps {
  node: DialogNode;
  onChange: (updates: Partial<DialogNode>) => void;
}

export const DialogEffectsPanel: React.FC<DialogEffectsPanelProps> = ({
  node,
  onChange
}) => {
  const [expandedPanels, setExpandedPanels] = React.useState({
    conditions: true,
    rewards: true,
    worldFlow: false
  });

  const togglePanel = (panel: keyof typeof expandedPanels) => {
    setExpandedPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground mb-2">
        When player chooses this...
      </div>

      <ConditionsPanel
        conditions={node.conditions}
        onChange={(conditions) => onChange({ conditions })}
        expanded={expandedPanels.conditions}
        onToggleExpand={() => togglePanel('conditions')}
      />

      <RewardsPanel
        rewards={node.rewards}
        onChange={(rewards) => onChange({ rewards })}
        expanded={expandedPanels.rewards}
        onToggleExpand={() => togglePanel('rewards')}
      />

      <WorldFlowPanel
        config={node.worldFlow}
        onChange={(worldFlow) => onChange({ worldFlow })}
        expanded={expandedPanels.worldFlow}
        onToggleExpand={() => togglePanel('worldFlow')}
      />
    </div>
  );
};

export default DialogEffectsPanel;
