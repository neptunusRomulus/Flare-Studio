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

export default function App() {
  const { toolbarValue, sidebarDeps, buildAppMainCtxFromSidebar } = useAppController();

  return (
    <SaveErrorProvider>
      <RetryStrategyProvider initialConfig={{ maxRetries: 3, initialDelayMs: 500 }}>
        <SaveTransactionProvider>
          <SaveQueueProvider>
            <ConflictResolutionProvider>
              <ToolbarProvider value={toolbarValue}>
                <SidebarProvider deps={useSidebarDeps(sidebarDeps)}>
                  {(assembledSidebar: unknown) => {
                    const appCtxBuilt = buildAppMainCtxFromSidebar(assembledSidebar as Record<string, unknown> | null);
                    return (
                      <AppProvider value={appCtxBuilt}>
                        <AppMain />
                      </AppProvider>
                    );
                  }}
                </SidebarProvider>
              </ToolbarProvider>
            </ConflictResolutionProvider>
          </SaveQueueProvider>
        </SaveTransactionProvider>
      </RetryStrategyProvider>
    </SaveErrorProvider>
  );
}
