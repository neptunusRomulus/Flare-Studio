import React, { createContext, useContext } from 'react';
import useAssembledSidebar from '../hooks/useAssembledSidebar';

const SidebarContext = createContext<Record<string, unknown> | null>(null);

type SidebarProviderProps = {
  deps: Record<string, unknown>;
  children: React.ReactNode | ((assembledSidebar: unknown) => React.ReactNode);
};

export const SidebarProvider = ({ deps, children }: SidebarProviderProps) => {
  const assembledSidebar = useAssembledSidebar(deps as unknown);

  const provider = (
    <SidebarContext.Provider value={assembledSidebar as Record<string, unknown>}>
      {typeof children === 'function' ? (children as (assembledSidebar: unknown) => React.ReactNode)(assembledSidebar) : children}
    </SidebarContext.Provider>
  );

  return provider;
};

export function useSidebarContext() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarContext must be used within SidebarProvider');
  return ctx;
}

export default SidebarContext;
