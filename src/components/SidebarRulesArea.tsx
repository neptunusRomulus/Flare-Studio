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
};

const SidebarRulesArea: React.FC<Props> = ({ rulesList, handleAddRule }) => {
  return <SidebarRulesPanel rulesList={rulesList} onAddRule={handleAddRule} />;
};

export default SidebarRulesArea;
