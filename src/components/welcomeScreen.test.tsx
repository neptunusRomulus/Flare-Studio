// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import WelcomeScreen from '@/components/WelcomeScreen';

function renderWelcome() {
  return render(
    <WelcomeScreen
      onCreateNewMap={vi.fn()}
      onOpenMap={vi.fn()}
      isDarkMode={false}
    />,
  );
}

describe('welcome screen zen mode', () => {
  beforeEach(() => {
    // Node's global localStorage is undefined without --localstorage-file; the screen reads it on mount.
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

  it('has no title bar: the content starts at the top and the window controls hide at the edge', () => {
    renderWelcome();
    const bar = screen.getByTestId('window-control-bar');
    expect(bar.getAttribute('data-state')).toBe('closed');
    // Only the hover-reveal bar is a drag region now.
    expect(document.querySelectorAll('.drag-region')).toHaveLength(1);
    expect(bar.classList.contains('drag-region')).toBe(true);
    // The buttons live in a compact no-drag pill; the rest of the strip is the drag region.
    const pill = screen.getByTestId('window-control-pill');
    expect(pill.classList.contains('no-drag')).toBe(true);
    expect(pill.querySelector('[aria-label="Minimize"]')).not.toBeNull();
    expect(pill.querySelector('[aria-label="Maximize"]')).not.toBeNull();
    expect(pill.querySelector('[aria-label="Close"]')).not.toBeNull();
  });

  it('drops the "Flare Studio" title text but keeps the floating round mark', () => {
    renderWelcome();
    expect(screen.queryByText('Flare Studio')).toBeNull();
    const mark = document.querySelector('.brand-mark');
    expect(mark).not.toBeNull();
    expect(mark?.closest('.rounded-full')).not.toBeNull();
  });

  it('shows no app menu button when there is no project open', () => {
    renderWelcome();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Minimize' })).toBeNull();
    expect(screen.getByText('Recent Projects')).toBeInTheDocument();
  });

  it('keeps zen mode on the create-project form', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderWelcome();

    await user.click(screen.getByRole('button', { name: 'Create New Project' }));

    expect(screen.getByText('Create a New Flare Project')).toBeInTheDocument();
    expect(document.querySelectorAll('.drag-region')).toHaveLength(1);
    expect(screen.getByTestId('window-control-bar')).toBeInTheDocument();
    expect(document.querySelector('.brand-mark')).not.toBeNull();
    expect(screen.queryByText('Flare Studio')).toBeNull();
  });
});
