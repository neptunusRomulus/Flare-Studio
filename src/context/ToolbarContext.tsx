import React, { createContext, useContext } from 'react';
import useToolbarSetup from '../hooks/useToolbarSetup';
import type { TileMapEditor } from '@/editor/TileMapEditor';

const ToolbarContext = createContext<Record<string, unknown> | null>(null);

type ToolbarProviderProps = {
  value?: Record<string, unknown>;
  editor?: TileMapEditor | null;
  children: React.ReactNode;
};

export const ToolbarProvider = ({ value, editor, children }: ToolbarProviderProps) => {
  const computed = useToolbarSetup({ editor: editor as TileMapEditor | null });
  const provided = value ?? computed;
  return <ToolbarContext.Provider value={provided}>{children}</ToolbarContext.Provider>;
};

export function useToolbarContext() {
  const ctx = useContext(ToolbarContext);
  if (!ctx) throw new Error('useToolbarContext must be used within ToolbarProvider');
  return ctx;
}

export default ToolbarContext;
