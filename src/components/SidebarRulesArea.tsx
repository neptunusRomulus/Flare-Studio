import React from 'react';
import SidebarRulesPanel from '@/components/SidebarRulesPanel';

type RuleListEntry = {
  id: string;
  name: string;
  startType: import('@/editor/ruleOptions').RuleStartType;
  triggerId: string;
};

type Props = {
  rulesList: RuleListEntry[];
  handleAddRule: () => void;
  handleEditRule: (ruleId: string) => void;
  questMapOpen?: boolean;
  onToggleQuestMap?: () => void;
};

const SidebarRulesArea: React.FC<Props> = ({ rulesList, handleAddRule, handleEditRule, questMapOpen, onToggleQuestMap }) => {
  return <SidebarRulesPanel rulesList={rulesList} onAddRule={handleAddRule} onEditRule={handleEditRule} questMapOpen={questMapOpen} onToggleQuestMap={onToggleQuestMap} />;
};

export default SidebarRulesArea;
