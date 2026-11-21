// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useCloseGuard from './useCloseGuard';
import { decideClose } from '@/hooks/closePrompt';
import { SaveQueueProvider } from '@/context/SaveQueueContext';

vi.mock('@/hooks/closePrompt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/closePrompt')>();
  return { ...actual, decideClose: vi.fn(actual.decideClose) };
});

const mockedDecide = vi.mocked(decideClose);

function wrapper({ children }: { children: React.ReactNode }) {
  return <SaveQueueProvider>{children}</SaveQueueProvider>;
}

type Handler = (() => void) | null;

describe('useCloseGuard', () => {
  let beforeClose: Handler = null;
  let saveAndClose: Handler = null;
  let beforeQuit: Handler = null;
  const confirmClose = vi.fn(async () => true);
  const closeAfterSave = vi.fn();
  const appShutdownComplete = vi.fn();

  beforeEach(() => {
    beforeClose = null;
    saveAndClose = null;
    beforeQuit = null;
    confirmClose.mockClear();
    closeAfterSave.mockClear();
    appShutdownComplete.mockClear();
    mockedDecide.mockReset();
    window.electronAPI = {
      onBeforeClose: (cb: Handler) => { beforeClose = cb; },
      confirmClose,
      onSaveAndClose: (cb: Handler) => { saveAndClose = cb; },
      closeAfterSave,
      onAppBeforeQuit: (cb: Handler) => { beforeQuit = cb; },
      appShutdownComplete,
    } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    delete (window as { electronAPI?: unknown }).electronAPI;
  });

  it('closes without prompting when nothing is dirty', async () => {
    mockedDecide.mockResolvedValue('close');
    const onDiscard = vi.fn();
    renderHook(() => useCloseGuard({ isDirty: () => false, saveAll: async () => {}, onDiscard }), { wrapper });
    await act(async () => { await (beforeClose as () => Promise<void>)(); });
    expect(mockedDecide).toHaveBeenCalledWith(false);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(confirmClose).toHaveBeenCalledWith('close');
  });

  it('asks when dirty, and Discard clears the leftover backup then confirms', async () => {
    mockedDecide.mockResolvedValue('discard');
    const onDiscard = vi.fn();
    renderHook(() => useCloseGuard({ isDirty: () => true, saveAll: async () => {}, onDiscard }), { wrapper });
    await act(async () => { await (beforeClose as () => Promise<void>)(); });
    expect(mockedDecide).toHaveBeenCalledWith(true);
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(confirmClose).toHaveBeenCalledWith('discard');
  });

  it('runs a full save then closeAfterSave on save-and-close', async () => {
    const saveAll = vi.fn(async () => {});
    renderHook(() => useCloseGuard({ isDirty: () => true, saveAll }), { wrapper });
    await act(async () => { await (saveAndClose as () => Promise<void>)(); });
    expect(saveAll).toHaveBeenCalledTimes(1);
    expect(closeAfterSave).toHaveBeenCalledTimes(1);
  });

  it('still closes after a failed save-and-close so the window is not stuck', async () => {
    const saveAll = vi.fn(async () => { throw new Error('disk full'); });
    renderHook(() => useCloseGuard({ isDirty: () => true, saveAll }), { wrapper });
    await act(async () => { await (saveAndClose as () => Promise<void>)(); });
    expect(closeAfterSave).toHaveBeenCalledTimes(1);
  });

  it('flushes pending saves then signals shutdown on app-before-quit', async () => {
    renderHook(() => useCloseGuard({ isDirty: () => false, saveAll: async () => {} }), { wrapper });
    await act(async () => { await (beforeQuit as () => Promise<void>)(); });
    expect(appShutdownComplete).toHaveBeenCalledTimes(1);
  });
});
