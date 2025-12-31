import React, { createContext, useContext } from 'react';
import useToolbarSetup from '../hooks/useToolbarSetup';

const ToolbarContext = createContext<any | null>(null);

type ToolbarProviderProps = {
  value?: any;
  editor?: any;
  children: React.ReactNode;
};

export const ToolbarProvider = ({ value, editor, children }: ToolbarProviderProps) => {
  const computed = useToolbarSetup({ editor });
  const provided = value ?? computed;
  return <ToolbarContext.Provider value={provided}>{children}</ToolbarContext.Provider>;
};

export function useToolbarContext() {
  const ctx = useContext(ToolbarContext);
  if (!ctx) throw new Error('useToolbarContext must be used within ToolbarProvider');
  return ctx;
}

export default ToolbarContext;
