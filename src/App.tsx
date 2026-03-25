import React from 'react';
import { ToolbarProvider } from './context/ToolbarContext';
import { SidebarProvider } from './context/SidebarContext';
import { SaveQueueProvider } from './context/SaveQueueContext';
import { RetryStrategyProvider } from './context/RetryStrategyContext';
import { SaveTransactionProvider } from './context/SaveTransactionContext';
import { ConflictResolutionProvider } from './context/ConflictResolutionContext';
import { SaveErrorProvider } from './context/SaveErrorContext';
import useSidebarDeps from './hooks/useSidebarDeps';
import { AppProvider } from './context/AppContext';
import AppMain from './components/AppMain';
import useAppController from './hooks/useAppController';

function AppMainWrapper({ 
  sidebarDeps, 
  buildAppMainCtxFromSidebar
}: { 
  sidebarDeps: unknown; 
  buildAppMainCtxFromSidebar: (s: Record<string, unknown> | null) => Record<string, unknown>;
}) {
  return (
    <SidebarProvider deps={useSidebarDeps(sidebarDeps)}>
      {(assembledSidebar: unknown) => {
        // Build context directly on each render - getting fresh state from useAppMainBuilder hooks
        const appCtx = buildAppMainCtxFromSidebar(assembledSidebar as Record<string, unknown> | null);
        return (
          <AppProvider value={appCtx}>
            <AppMain />
          </AppProvider>
        );
      }}
    </SidebarProvider>
  );
}

export default function App() {
  const { toolbarValue, sidebarDeps, buildAppMainCtxFromSidebar } = useAppController();

  return (
    <SaveErrorProvider>
      <RetryStrategyProvider initialConfig={{ maxRetries: 3, initialDelayMs: 500 }}>
        <SaveTransactionProvider>
          <SaveQueueProvider>
            <ConflictResolutionProvider>
              <ToolbarProvider value={toolbarValue}>
                <AppMainWrapper sidebarDeps={sidebarDeps} buildAppMainCtxFromSidebar={buildAppMainCtxFromSidebar} />
              </ToolbarProvider>
            </ConflictResolutionProvider>
          </SaveQueueProvider>
        </SaveTransactionProvider>
      </RetryStrategyProvider>
    </SaveErrorProvider>
  );
}
