// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppProvider } from '@/context/AppContext';
import EngineSettingsDialog from './EngineSettingsDialog';

const props = {
  open: true,
  onClose: () => {},
  isDarkMode: false,
  setIsDarkMode: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
  editor: null,
  showActiveGid: false,
  setShowActiveGid: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
  debugMode: false,
  setDebugMode: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
};

describe('Engine Settings dialog', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('has no World tab', () => {
    render(
      <AppProvider value={{ currentProjectPath: null }}>
        <EngineSettingsDialog {...props} />
      </AppProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Engine Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'World' })).toBeNull();
    expect(screen.queryByText('Cutscene')).toBeNull();
  });
});
