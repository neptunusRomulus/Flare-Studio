// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/context/AppContext';
import ItemEditDialog from './ItemEditDialog';
import { askConfirm, InlineConfirmHost } from './ui/inline-confirm';
import { answerConfirm, getPendingConfirm } from './ui/inlineConfirmCore';

afterEach(() => {
  if (getPendingConfirm()) answerConfirm(false);
  cleanup();
});

const item = {
  id: 7,
  name: 'Potion',
  filePath: '/proj/items/potion.txt',
  role: 'consumable',
};

function renderDialog(onDeleteItem?: React.ComponentProps<typeof ItemEditDialog>['onDeleteItem']) {
  const handleCloseItemEdit = vi.fn();
  render(
    <AppProvider value={{ currentProjectPath: '/proj' }}>
      <ItemEditDialog
        showItemEditDialog
        editingItem={item}
        updateEditingItemField={() => {}}
        handleCloseItemEdit={handleCloseItemEdit}
        handleSaveItemEdit={() => {}}
        onDeleteItem={onDeleteItem}
      />
      <InlineConfirmHost />
    </AppProvider>,
  );
  return { handleCloseItemEdit };
}

describe('ItemEditDialog delete', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('warns and does nothing when onDeleteItem is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderDialog(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Item' }));
    expect(warn).toHaveBeenCalledWith('ItemEditDialog: onDeleteItem is missing; cannot delete.');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    warn.mockRestore();
  });

  it('still shows the confirm after a slow scan, even if a mousedown happens in between', async () => {
    let finishScan: () => void = () => {};
    const onDeleteItem = vi.fn(async () => {
      await new Promise<void>((resolve) => { finishScan = resolve; });
      const ok = await askConfirm('Used in 1 place (enemies/goblin.txt). Delete anyway? References will stay.');
      return ok;
    });
    const { handleCloseItemEdit } = renderDialog(onDeleteItem);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Item' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    finishScan();
    expect(await screen.findByRole('alertdialog', {
      name: 'Used in 1 place (enemies/goblin.txt). Delete anyway? References will stay.',
    })).toBeTruthy();
    expect(handleCloseItemEdit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(handleCloseItemEdit).not.toHaveBeenCalled();
  });
});
