// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppProvider } from '@/context/AppContext';
import ItemEditDialog from './ItemEditDialog';

beforeEach(() => {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const key of Object.keys(store)) delete store[key]; },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const item = {
  id: 7,
  name: 'Potion',
  filePath: '/proj/items/potion.txt',
  role: 'consumable',
  quality: '',
};

function renderDialog(quality: string, updateEditingItemField = vi.fn()) {
  render(
    <AppProvider value={{ currentProjectPath: '/proj' }}>
      <ItemEditDialog
        showItemEditDialog
        editingItem={{ ...item, quality }}
        updateEditingItemField={updateEditingItemField}
        handleCloseItemEdit={() => {}}
        handleSaveItemEdit={() => {}}
      />
    </AppProvider>,
  );
  return updateEditingItemField;
}

describe('ItemEditDialog custom quality', () => {
  it('writes a quality id that is not one of the built-in rarities', () => {
    const update = renderDialog('');
    const input = screen.getByLabelText('Custom quality');
    fireEvent.change(input, { target: { value: 'legendary' } });
    expect(update).toHaveBeenCalledWith('quality', 'legendary');
  });

  it('shows an existing custom quality in the input', () => {
    renderDialog('legendary');
    expect(screen.getByLabelText('Custom quality')).toHaveValue('legendary');
  });
});

it('shows structured crafting and scaled damage/absorb fields for equipment', () => {
  const update = vi.fn();
  render(
    <AppProvider value={{ currentProjectPath: '/proj' }}>
      <ItemEditDialog
        showItemEditDialog
        editingItem={{ ...item, role: 'equipment' }}
        updateEditingItemField={update}
        handleCloseItemEdit={() => {}}
        handleSaveItemEdit={() => {}}
      />
    </AppProvider>,
  );

  fireEvent.click(screen.getByText('Advanced damage scaling'));
  for (const label of ['Required items', 'Crafting sound', 'Minimum damage', 'Maximum damage', 'Minimum absorb', 'Maximum absorb']) {
    expect(screen.getByLabelText(label)).toBeVisible();
  }

  fireEvent.change(screen.getByLabelText('Required items'), { target: { value: '10,11' } });
  expect(update).toHaveBeenCalledWith('crafting_items', '10,11');
});
