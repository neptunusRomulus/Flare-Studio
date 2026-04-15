import React from 'react';
import SidebarStatusesPanel from '@/components/SidebarStatusesPanel';

type Props = {
  handleOpenStatusDialog: () => void;
};

const SidebarStatusesArea: React.FC<Props> = ({ handleOpenStatusDialog }) => {
  return <SidebarStatusesPanel onAddStatus={handleOpenStatusDialog} />;
};

export default SidebarStatusesArea;
