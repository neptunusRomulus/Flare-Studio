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
};

const SidebarRulesArea: React.FC<Props> = ({ rulesList, handleAddRule, handleEditRule }) => {
  return <SidebarRulesPanel rulesList={rulesList} onAddRule={handleAddRule} onEditRule={handleEditRule} />;
};

export default SidebarRulesArea;
