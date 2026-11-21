// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionRecoveryDialog from './SessionRecoveryDialog';

describe('SessionRecoveryDialog', () => {
  it('asks to restore unsaved changes with Restore and Discard', async () => {
    const onRecover = vi.fn(async () => {});
    const onDismiss = vi.fn();
    render(<SessionRecoveryDialog isOpen onRecover={onRecover} onDismiss={onDismiss} />);
    expect(screen.getByText('Unsaved changes found from your last session. Restore them?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRecover).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
