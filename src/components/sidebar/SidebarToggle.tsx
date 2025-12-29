import React from 'react';
import SidebarToggleInner from '@/components/sidebar/SidebarToggleInner';

type SidebarToggleProps = {
  show: boolean;
  leftCollapsed: boolean;
  onToggle: () => void;
};

const SidebarToggle = ({ show, leftCollapsed, onToggle }: SidebarToggleProps) => {
  if (!show) return null;
  return (
    <button
      onClick={onToggle}
      aria-label={leftCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      style={{ left: leftCollapsed ? 0 : 224 }}
      className="no-drag no-press-shift press-fill-effect fixed top-1/2 transform -translate-y-1/2 z-50 bg-white/90 dark:bg-neutral-900/90 border border-border rounded-l-md p-1 shadow-md hover:bg-white dark:hover:bg-neutral-800"
    >
      <SidebarToggleInner leftCollapsed={leftCollapsed} />
    </button>
  );
};

export default SidebarToggle;
