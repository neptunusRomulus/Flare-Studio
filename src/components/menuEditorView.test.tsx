// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/context/AppContext';
import MenuEditorView from './MenuEditorView';

describe('Game Settings canvas (MenuEditorView)', () => {
  afterEach(() => cleanup());

  it('exposes a World tab with the studio world editors, even before a project path is set', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider value={{ currentProjectPath: null }}>
        <MenuEditorView projectPath={null} />
      </AppProvider>,
    );
    expect(screen.getByRole('button', { name: 'Menus' })).toBeInTheDocument();
    const world = screen.getByRole('button', { name: 'World' });
    expect(world).toBeInTheDocument();
    expect(screen.getByText('Open a project to edit menus.')).toBeInTheDocument();

    await user.click(world);
    expect(screen.getByText('Cutscene')).toBeInTheDocument();
    expect(screen.getByText('Language catalog')).toBeInTheDocument();
    expect(screen.getByText('Parallax')).toBeInTheDocument();
    expect(screen.getByText('Fog of war')).toBeInTheDocument();
    expect(screen.getByText('Procedural rules')).toBeInTheDocument();
  });
});
