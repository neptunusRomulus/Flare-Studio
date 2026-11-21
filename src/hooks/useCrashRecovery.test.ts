// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useCrashRecovery, { waitUntil } from './useCrashRecovery';
import { CRASH_BACKUP_MAX_AGE_MS } from '@/editor/saveHealth';

describe('waitUntil', () => {
  it('resolves when the probe becomes truthy and times out otherwise', async () => {
    let ready = false;
    setTimeout(() => { ready = true; }, 20);
    await expect(waitUntil(() => ready, 200, 10)).resolves.toBe(true);
    await expect(waitUntil(() => false, 30, 10)).resolves.toBe(null);
  });
});

describe('useCrashRecovery', () => {
  const readCrashBackup = vi.fn();
  const clearCrashBackup = vi.fn(async () => true);

  beforeEach(() => {
    readCrashBackup.mockReset();
    clearCrashBackup.mockReset();
    clearCrashBackup.mockResolvedValue(true);
    window.electronAPI = { readCrashBackup, clearCrashBackup } as unknown as typeof window.electronAPI;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('offers a fresh leftover backup for the project without using sessionStorage', async () => {
    const backup = { timestamp: Date.now(), mapName: 'dungeon', mapWidth: 20, mapHeight: 15 };
    readCrashBackup.mockResolvedValue(backup);
    const onRecoveryFound = vi.fn();
    const { result } = renderHook(() => useCrashRecovery({ projectPath: '/proj', onRecoveryFound }));
    await waitFor(() => expect(result.current.hasCrashBackup).toBe(true));
    expect(result.current.mapName).toBe('dungeon');
    expect(onRecoveryFound).toHaveBeenCalledWith(backup);
    expect(window.sessionStorage.getItem('app_session_active')).toBe(null);
  });

  it('deletes and ignores backups older than 24 hours', async () => {
    readCrashBackup.mockResolvedValue({
      timestamp: Date.now() - CRASH_BACKUP_MAX_AGE_MS - 1000,
      mapName: 'old',
      mapWidth: 10,
      mapHeight: 10,
    });
    const onRecoveryFound = vi.fn();
    const { result } = renderHook(() => useCrashRecovery({ projectPath: '/proj', onRecoveryFound }));
    await waitFor(() => expect(clearCrashBackup).toHaveBeenCalledWith('/proj'));
    expect(result.current.hasCrashBackup).toBe(false);
    expect(onRecoveryFound).not.toHaveBeenCalled();
  });

  it('restores through onRecoverBackup then clears the file; discard also clears it', async () => {
    const backup = { timestamp: Date.now(), mapName: 'keep', mapWidth: 8, mapHeight: 8 };
    readCrashBackup.mockResolvedValue(backup);
    const onRecoverBackup = vi.fn(async () => true);
    const { result } = renderHook(() => useCrashRecovery({ projectPath: '/proj', onRecoverBackup }));
    await waitFor(() => expect(result.current.hasCrashBackup).toBe(true));
    let ok = false;
    await act(async () => { ok = await result.current.recoverSession(); });
    expect(ok).toBe(true);
    expect(onRecoverBackup).toHaveBeenCalledWith(backup);
    expect(clearCrashBackup).toHaveBeenCalledWith('/proj');
    expect(result.current.hasCrashBackup).toBe(false);
  });

  it('does not treat a null project path as a crash', async () => {
    readCrashBackup.mockResolvedValue({ timestamp: Date.now(), mapName: 'x', mapWidth: 1, mapHeight: 1 });
    const { result } = renderHook(() => useCrashRecovery({ projectPath: null }));
    await waitFor(() => expect(result.current.hasCrashBackup).toBe(false));
    expect(readCrashBackup).not.toHaveBeenCalled();
  });
});
