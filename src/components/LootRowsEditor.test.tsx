// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseLootChance } from '@/editor/lootChance';
import LootRowsEditor from './LootRowsEditor';

describe('LootRowsEditor missing items', () => {
  it('labels an unknown drop as Missing item #id and keeps a remove button', () => {
    render(
      <LootRowsEditor
        rows={[{ id: '1', chance: parseLootChance('fixed'), quantityMin: 1, quantityMax: 1, isTable: false }]}
        onChange={() => {}}
        items={[{ id: 2, name: 'Vendor Constant Stock' }]}
      />,
    );
    expect(screen.getByText('Missing item #1')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Loot item' })).toHaveClass('text-red-600');
    expect(screen.getByRole('button', { name: 'Remove loot row' })).toBeTruthy();
  });
});
