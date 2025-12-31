import React, { createContext, useContext } from 'react';

const AppContext = createContext<any | null>(null);

export const AppProvider = ({ value, children }: { value: any; children: React.ReactNode }) => (
  <AppContext.Provider value={value}>{children}</AppContext.Provider>
);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export default AppContext;
