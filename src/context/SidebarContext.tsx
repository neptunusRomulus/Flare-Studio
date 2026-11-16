import React, { createContext, useContext } from 'react';
import useAssembledSidebar, { type AssembledSidebar } from '../hooks/useAssembledSidebar';

const SidebarContext = createContext<AssembledSidebar | null>(null);

type SidebarProviderProps = {
  deps: Record<string, unknown>;
  children: React.ReactNode | ((assembledSidebar: AssembledSidebar) => React.ReactNode);
};

export const SidebarProvider = ({ deps, children }: SidebarProviderProps) => {
  const assembledSidebar = useAssembledSidebar(deps);

  const provider = (
    <SidebarContext.Provider value={assembledSidebar}>
      {typeof children === 'function' ? children(assembledSidebar) : children}
    </SidebarContext.Provider>
  );

  return provider;
};

export function useSidebarContext(): AssembledSidebar {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarContext must be used within SidebarProvider');
  return ctx;
}

export default SidebarContext;
