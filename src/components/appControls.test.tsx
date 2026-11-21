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

  it('uses the rounded-square mark itself as the button, with no circular chrome or title-bar styles', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges={false} />);
    expect(html).toContain('rounded-[18.75%]');
    expect(html).toContain('h-7 w-7');
    expect(html).toContain('no-drag');
    expect(html).toContain('hover:brightness-110');
    expect(html).toContain('focus-visible:ring-orange-500');
    expect(html).not.toContain('rounded-full');
    expect(html).not.toContain('bg-white/90');
    expect(html).not.toContain('shadow-lg');
    // No title text next to the mark, and no green "saved" dot.
    expect(html).not.toContain('Flare Studio');
    expect(html).not.toContain('bg-green-500');
    expect(html).not.toContain('data-save-state="saved"');
    expect(html).not.toContain('All changes saved');
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

describe('logo save marks', () => {
  it('keeps a red unsaved dot after a silent crash backup', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges saveStatus="backed-up" />);
    expect(html).toContain('data-save-state="unsaved"');
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('bg-amber-400');
    expect(html).not.toContain('data-save-state="backed-up"');
    expect(html).not.toContain('data-save-state="recovery"');
  });

  it('does not show a recover mark on the logo', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges={false} saveStatus="saved" />);
    expect(html).not.toContain('data-save-state="recovery"');
    expect(html).not.toContain('Recovery backup waiting');
    expect(html).not.toContain('bg-amber-400');
  });

  it('shows a red error mark when a save failed', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges saveStatus="error" />);
    expect(html).toContain('data-save-state="error"');
    expect(html).toContain('bg-red-500');
    expect(menuTooltip(true, 'error')).toBe('Save failed — open the menu to try again');
  });
});
