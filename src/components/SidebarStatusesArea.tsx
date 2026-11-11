import React from 'react';
import PowersPanel from '@/components/powers/PowersPanel';

type Props = {
  handleOpenStatusDialog: () => void;
  projectPath?: string | null;
};

/** Statuses layer: Skills, Monster Attacks, Item Uses, Traps, Buffs, Debuffs and Story Flags. */
const SidebarStatusesArea: React.FC<Props> = ({ projectPath }) => <PowersPanel projectPath={projectPath} />;

export default SidebarStatusesArea;
