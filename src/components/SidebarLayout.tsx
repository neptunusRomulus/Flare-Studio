import React from 'react';

type SidebarLayoutProps = {
  leftCollapsed: boolean;
  width?: number;
  onResizeMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
};

const SidebarLayout = ({ leftCollapsed, width, onResizeMouseDown, children }: SidebarLayoutProps) => (
  <aside
    className={
      `relative border-r border-border bg-muted/30 p-2 overflow-visible flex flex-col transition-all duration-200 ease-in-out app-sidebar ` +
      (leftCollapsed ? 'sidebar-collapsed' : '')
    }
    style={width !== undefined ? { width } : undefined}
    aria-hidden={leftCollapsed}
  >
    {onResizeMouseDown && !leftCollapsed && (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={onResizeMouseDown}
        className="absolute top-0 right-0 h-full w-3 cursor-col-resize touch-none hover:bg-border/30"
      />
    )}
    <div className="sidebar-inner flex flex-col h-full">
      {children}
    </div>
  </aside>
);

export default SidebarLayout;
