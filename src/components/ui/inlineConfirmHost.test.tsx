// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { askConfirm, InlineConfirmHost } from './inline-confirm';
import { answerConfirm, getPendingConfirm } from './inlineConfirmCore';

afterEach(() => {
  if (getPendingConfirm()) answerConfirm(false);
  cleanup();
});

describe('InlineConfirmHost askConfirm', () => {
  it('does not dismiss the bubble because of a mousedown in the same tick as opening', async () => {
    render(<InlineConfirmHost />);
    act(() => {
      void askConfirm('Delete this item?', { left: 40, top: 40, width: 24, height: 24 });
    });
    expect(screen.getByRole('alertdialog', { name: 'Delete this item?' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.getByRole('alertdialog', { name: 'Delete this item?' })).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: 'Delete this item?' })).toBeNull();
    });
  });

  it('still shows the bubble if a document mousedown happens during a delayed scan', async () => {
    render(
      <>
        <button
          type="button"
          onClick={() => {
            window.setTimeout(() => {
              act(() => {
                void askConfirm('Delete this item?', { left: 40, top: 40, width: 24, height: 24 });
              });
            }, 40);
          }}
        >
          Delete
        </button>
        <InlineConfirmHost />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.mouseDown(document.body);
    expect(await screen.findByRole('alertdialog', { name: 'Delete this item?' })).toBeTruthy();
  });
});
