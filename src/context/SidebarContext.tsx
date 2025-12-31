import React, { createContext, useContext } from 'react';
import useAssembledSidebar from '../hooks/useAssembledSidebar';

const SidebarContext = createContext<any | null>(null);

type SidebarProviderProps = {
  deps: any;
  children: React.ReactNode | ((assembledSidebar: any) => React.ReactNode);
};

export const SidebarProvider = ({ deps, children }: SidebarProviderProps) => {
  const assembledSidebar = useAssembledSidebar(deps);

  const provider = (
    <SidebarContext.Provider value={assembledSidebar}>{typeof children === 'function' ? (children as any)(assembledSidebar) : children}</SidebarContext.Provider>
  );

  return provider;
};

export function useSidebarContext() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarContext must be used within SidebarProvider');
  return ctx;
}

export default SidebarContext;
