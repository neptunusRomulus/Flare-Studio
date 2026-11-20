// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppControls from '@/components/AppControls';
import MainMenuDialog from '@/components/MainMenuDialog';

const noop = () => {};
const anoop = async () => {};
const props = { currentProjectPath: '/p', onSaveAndQuit: anoop, onQuit: noop, onShowProjectFolder: noop, onShowHelp: noop, onSaveAsCopy: anoop, onRestart: noop, onExport: noop, onCheckUpdates: noop, handleManualSave: noop, isManuallySaving: false, isPreparingNewMap: false, setShowSettings: noop };

const menuProps = {
  open: true,
  anchorPos: { left: 10, top: 10 },
  onClose: noop,
  currentProjectPath: '/p',
  onSaveAndQuit: anoop,
  onQuit: noop,
  onShowProjectFolder: noop,
  onShowHelp: noop,
  onSaveAsCopy: anoop,
  onRestart: noop,
  onExport: noop,
  onCheckUpdates: noop,
};

describe('save state indicators', () => {
  it('shows no status dot on the logo when everything is saved', () => {
    render(<AppControls {...props} hasUnsavedChanges={false} />);
    expect(screen.queryByLabelText('All changes saved')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Unsaved changes')).not.toBeInTheDocument();
    expect(document.querySelector('[data-save-state]')).toBeNull();
    expect(document.querySelector('.bg-green-500')).toBeNull();
  });

  it('shows a red dot on the logo when there are unsaved changes', () => {
    render(<AppControls {...props} hasUnsavedChanges />);
    expect(screen.getByLabelText('Unsaved changes')).toBeInTheDocument();
    expect(screen.queryByLabelText('All changes saved')).not.toBeInTheDocument();
  });

  it('disables Save in the menu when nothing is unsaved', () => {
    render(<MainMenuDialog {...menuProps} onSave={noop} hasUnsavedChanges={false} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(document.querySelector('[data-save-state="unsaved"]')).toBeNull();
  });

  it('enables Save and dots it red when there are unsaved changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<MainMenuDialog {...menuProps} onSave={onSave} hasUnsavedChanges />);

    const item = screen.getByRole('button', { name: 'Save' });
    expect(item).not.toBeDisabled();
    expect(item.querySelector('[data-save-state="unsaved"]')).not.toBeNull();
    await user.click(item);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
