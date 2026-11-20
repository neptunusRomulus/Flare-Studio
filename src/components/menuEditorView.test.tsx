// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppProvider } from '@/context/AppContext';
import MenuEditorView from './MenuEditorView';

describe('UI Settings canvas (MenuEditorView)', () => {
  afterEach(() => cleanup());

  it('stays a menus-only preview and has no World tab', () => {
    render(
      <AppProvider value={{ currentProjectPath: null }}>
        <MenuEditorView projectPath={null} />
      </AppProvider>,
    );
    expect(screen.getByText('Open a project to edit menus.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'World' })).toBeNull();
    expect(screen.queryByText('Cutscene')).toBeNull();
  });
});
