// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useAppMainObjectCommands from './useAppMainObjectCommands';

vi.mock('@/editor/projectFiles', () => ({
  loadProjectTextMap: vi.fn(),
}));
vi.mock('@/components/ui/inline-confirm', () => ({
  askConfirm: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

import { loadProjectTextMap } from '@/editor/projectFiles';
import { askConfirm } from '@/components/ui/inline-confirm';
import { toast } from '@/hooks/use-toast';

const item = { id: 7, name: 'Potion', filePath: '/proj/items/potion.txt' };

function hook() {
  return renderHook(() => useAppMainObjectCommands({
    editor: null,
    realSyncMapObjects: undefined,
    showNpcActorArea: false,
    showEnemyActorArea: false,
    currentProjectPath: '/proj',
    itemsHook: { refreshItemsList: vi.fn().mockResolvedValue(undefined) },
  }));
}

describe('handleDeleteItem', () => {
  beforeEach(() => {
    vi.mocked(loadProjectTextMap).mockReset();
    vi.mocked(askConfirm).mockReset();
    vi.mocked(toast).mockReset();
    vi.mocked(loadProjectTextMap).mockResolvedValue({});
    vi.mocked(askConfirm).mockResolvedValue(false);
    window.electronAPI = {
      deleteItemFile: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error toast when the project scan throws, and does not open a confirm', async () => {
    vi.mocked(loadProjectTextMap).mockRejectedValue(new Error('scan failed'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = hook();
    await expect(result.current.handleDeleteItem(item)).resolves.toBe(false);
    err.mockRestore();
    expect(askConfirm).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', variant: 'destructive' }));
  });

  it('passes the captured anchor to askConfirm', async () => {
    const anchor = { left: 10, top: 20, width: 30, height: 40 };
    const { result } = hook();
    await result.current.handleDeleteItem(item, anchor);
    expect(askConfirm).toHaveBeenCalledWith(expect.stringContaining('Delete item 7?'), anchor);
  });

  it('ignores a second click while a scan is already in progress', async () => {
    let release: (files: Record<string, string>) => void = () => {};
    vi.mocked(loadProjectTextMap).mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { result } = hook();
    const first = result.current.handleDeleteItem(item, { left: 1, top: 1, width: 1, height: 1 });
    const second = result.current.handleDeleteItem(item);
    await expect(second).resolves.toBe(false);
    release({});
    await expect(first).resolves.toBe(false);
    expect(loadProjectTextMap).toHaveBeenCalledTimes(1);
    expect(askConfirm).toHaveBeenCalledTimes(1);
  });
});
