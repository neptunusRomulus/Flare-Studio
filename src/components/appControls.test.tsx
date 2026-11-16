import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AppControls, { menuTooltip } from './AppControls';

const noop = () => {};
const anoop = async () => {};
const props = { currentProjectPath: '/p', onSaveAndQuit: anoop, onQuit: noop, onShowProjectFolder: noop, onShowHelp: noop, onSaveAsCopy: anoop, onRestart: noop, onExport: noop, onCheckUpdates: noop, handleManualSave: noop, isManuallySaving: false, isPreparingNewMap: false, setShowSettings: noop };

describe('floating logo menu button', () => {
  it('uses the Flare Studio mark as the menu button, with a red unsaved dot on the logo and no separate Save button', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges iconUrl="flare.png" />);
    expect(html).toContain('aria-label="Menu"');
    expect(html).toContain('viewBox="0 0 512 512"');
    expect(html).toContain('motion-reduce:transition-none');
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('aria-label="Save project"');
    expect(html).not.toContain('Engine Settings');
  });

  it('is a round floating button in the zoom / Play control style instead of a title-bar button', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges={false} />);
    expect(html).toContain('rounded-full');
    expect(html).toContain('h-9 w-9');
    expect(html).toContain('bg-white/90');
    expect(html).toContain('dark:bg-neutral-900/90');
    expect(html).toContain('shadow-lg');
    expect(html).toContain('no-drag');
    // No title text next to the mark.
    expect(html).not.toContain('Flare Studio');
  });

  it('moves the title-bar save feedback into the button tooltip', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges={false} saveStatus="saving" />);
    expect(html).toContain('aria-label="Menu"');
    expect(menuTooltip(false, 'saving')).toBe('Saving…');
    expect(menuTooltip(false, 'error')).toBe('Save failed — open the menu to try again');
    expect(menuTooltip(true, 'unsaved')).toBe('Unsaved changes — open the menu to save (Ctrl+S)');
    expect(menuTooltip(false, 'saved')).toBe('Menu — all changes saved');
  });
});
