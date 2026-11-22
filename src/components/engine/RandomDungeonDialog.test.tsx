// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RandomDungeonDialog from './RandomDungeonDialog';

const files = new Map<string, string>();

function makeApi() {
  return {
    readFile: vi.fn(async (path: string) => files.get(path) ?? ''),
    writeFile: vi.fn(async (path: string, text: string) => {
      files.set(path, text);
      return true;
    }),
    readDir: vi.fn(async (path: string) => {
      if (path.endsWith('/maps')) return [];
      return [];
    }),
  };
}

describe('RandomDungeonDialog', () => {
  beforeEach(() => {
    files.clear();
    (window as unknown as { electronAPI: unknown }).electronAPI = makeApi();
  });

  afterEach(() => {
    cleanup();
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it('draws an entrance and an exit, then writes a ready rules file with doors closed', async () => {
    const onOpenRoom = vi.fn();
    render(
      <RandomDungeonDialog
        open
        onOpenChange={vi.fn()}
        projectPath="/proj"
        flarePath={null}
        defaultName="Dungeon"
        onOpenRoom={onOpenRoom}
      />,
    );

    await screen.findByText(/Entrance missing/);
    await userEvent.click(screen.getByRole('button', { name: 'Draw entrance room' }));
    await screen.findByText(/Exit missing/);
    expect(onOpenRoom).toHaveBeenCalledWith('maps/dungeon_entrance.txt');

    await userEvent.click(screen.getByRole('button', { name: 'Draw exit room' }));
    await screen.findByText('✓ Ready');
    expect(onOpenRoom).toHaveBeenCalledWith('maps/dungeon_exit.txt');

    await waitFor(() => {
      expect(files.get('/proj/maps/procgen_rules/dungeon.txt')).toContain('doors_max=0');
    });
    const rules = files.get('/proj/maps/procgen_rules/dungeon.txt') ?? '';
    expect(rules).toContain('filename=maps/dungeon/openings.txt');
    expect(rules).toContain('filename=maps/dungeon_entrance.txt');
    expect(rules).toContain('filename=maps/dungeon_exit.txt');
    expect(files.get('/proj/maps/dungeon.txt')).toContain('procgen_filename=maps/procgen_rules/dungeon.txt');
    expect(screen.queryByLabelText('Max doors')).toBeNull();
    expect(screen.getByText('Advanced settings')).toBeTruthy();
  });
});
