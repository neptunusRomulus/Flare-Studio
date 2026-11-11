import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AppControls from './AppControls';

const noop = () => {};
const anoop = async () => {};
const props = { currentProjectPath: '/p', onSaveAndQuit: anoop, onQuit: noop, onShowProjectFolder: noop, onShowHelp: noop, onSaveAsCopy: anoop, onRestart: noop, onExport: noop, onCheckUpdates: noop, handleManualSave: noop, isManuallySaving: false, isPreparingNewMap: false, setShowSettings: noop };

describe('title bar app menu', () => {
  it('uses the Flare Studio mark as the menu button, with Save next to it and no separate settings button', () => {
    const html = renderToStaticMarkup(<AppControls {...props} hasUnsavedChanges iconUrl="flare.png" />);
    expect(html).toContain('aria-label="Menu"');
    expect(html).toContain('viewBox="0 0 512 512"');
    expect(html).toContain('motion-reduce:transition-none');
    expect(html).toContain('aria-label="Save project"');
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('Engine Settings');
  });
});
