import React from 'react';
import { ToolbarProvider } from './context/ToolbarContext';
import { SidebarProvider } from './context/SidebarContext';
import { SaveQueueProvider } from './context/SaveQueueContext';
import { SaveHealthProvider } from './context/SaveHealthContext';
import { RetryStrategyProvider } from './context/RetryStrategyContext';
import { SaveTransactionProvider } from './context/SaveTransactionContext';
import { ConflictResolutionProvider } from './context/ConflictResolutionContext';
import { SaveErrorProvider } from './context/SaveErrorContext';
import { StudioHintsProvider } from './context/StudioHintsContext';
import useSidebarDeps from './hooks/useSidebarDeps';
import { AppProvider } from './context/AppContext';
import { PowerIconAtlasProvider } from './context/PowerIconAtlasContext';
import AppMain from './components/AppMain';
import { InlineConfirmHost } from './components/ui/inline-confirm';
import useAppController from './hooks/useAppController';
import useInterfaceScale from './hooks/useInterfaceScale';
import type { AppMainSidebarDeps } from './hooks/useAppMainSidebarDeps';
import type { AssembledSidebar } from './hooks/useAssembledSidebar';
import type useAppMainBuilder from './hooks/useAppMainBuilder';

/** The app-wide context object assembled from the sidebar deps. */
type AppMainCtx = ReturnType<ReturnType<typeof useAppMainBuilder>['buildAppMainCtxFromSidebar']>;

function AppMainWrapper({
  sidebarDeps,
  buildAppMainCtxFromSidebar
}: {
  sidebarDeps: AppMainSidebarDeps;
  buildAppMainCtxFromSidebar: (s: AssembledSidebar) => AppMainCtx;
}) {
  return (
    <SidebarProvider deps={useSidebarDeps(sidebarDeps)}>
      {(assembledSidebar) => {
        // Build context directly on each render - getting fresh state from useAppMainBuilder hooks
        const appCtx = buildAppMainCtxFromSidebar(assembledSidebar);
        return (
          <AppProvider value={appCtx}>
            <PowerIconAtlasProvider>
              <AppMain />
            </PowerIconAtlasProvider>
          </AppProvider>
        );
      }}
    </SidebarProvider>
  );
}

function AppTree() {
  const { toolbarValue, sidebarDeps, buildAppMainCtxFromSidebar } = useAppController();

  return (
    <ToolbarProvider value={toolbarValue}>
      <AppMainWrapper sidebarDeps={sidebarDeps} buildAppMainCtxFromSidebar={buildAppMainCtxFromSidebar} />
      <InlineConfirmHost />
    </ToolbarProvider>
  );
}

export default function App() {
  useInterfaceScale();

  return (
    <StudioHintsProvider>
    <SaveErrorProvider>
      <RetryStrategyProvider initialConfig={{ maxRetries: 3, initialDelayMs: 500 }}>
        <SaveTransactionProvider>
          <SaveQueueProvider>
            <SaveHealthProvider>
            <ConflictResolutionProvider>
              <AppTree />
            </ConflictResolutionProvider>
            </SaveHealthProvider>
          </SaveQueueProvider>
        </SaveTransactionProvider>
      </RetryStrategyProvider>
    </SaveErrorProvider>
    </StudioHintsProvider>
  );
}
