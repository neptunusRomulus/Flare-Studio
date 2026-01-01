import React, { createContext, useContext } from 'react';

const AppContext = createContext<Record<string, unknown> | null>(null);

export const AppProvider = ({ value, children }: { value: Record<string, unknown>; children: React.ReactNode }) => (
  <AppContext.Provider value={value}>{children}</AppContext.Provider>
);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export default AppContext;
