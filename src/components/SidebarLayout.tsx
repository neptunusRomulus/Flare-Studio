import React from 'react';

type SidebarLayoutProps = {
  leftCollapsed: boolean;
  children: React.ReactNode;
};

const SidebarLayout = ({ leftCollapsed, children }: SidebarLayoutProps) => (
  <aside
    className={
      `relative border-r border-border bg-muted/30 p-2 overflow-visible flex flex-col transition-all duration-200 ease-in-out app-sidebar ` +
      (leftCollapsed ? 'sidebar-collapsed' : '')
    }
    aria-hidden={leftCollapsed}
  >
    <div className="sidebar-inner flex flex-col h-full">
      {children}
    </div>
  </aside>
);

export default SidebarLayout;
