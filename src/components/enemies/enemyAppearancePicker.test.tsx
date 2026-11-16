// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnemyAppearancePicker from './EnemyAppearancePicker';

// The node test runner has no localStorage backing; pin the Flare path instead.
vi.mock('@/flare/flarePathStore', () => ({ getStoredFlarePath: () => '/flare' }));

const listing = {
  ok: true,
  mod: 'fantasycore',
  modDir: '/flare/mods/fantasycore',
  npcLooks: [],
  portraits: [{ key: 'male01', path: 'images/portraits/male01.png', imagePath: '/flare/mods/fantasycore/images/portraits/male01.png' }],
  enemyLooks: [
    {
      key: 'goblin',
      animation: 'animations/enemies/goblin.txt',
      image: 'images/enemies/goblin.png',
      imagePath: '/flare/mods/fantasycore/images/enemies/goblin.png',
      frame: { x: 142, y: 977, w: 111, h: 96 },
    },
  ],
  npcs: [],
  enemies: [],
  missing: [],
};

describe('EnemyAppearancePicker', () => {
  beforeEach(() => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      listTemplateActors: vi.fn(async () => listing),
      readDir: vi.fn(async () => []),
      readFile: vi.fn(async () => null),
      fileExists: vi.fn(async () => false),
      readFileAsDataURL: vi.fn(async () => null),
    };
  });

  afterEach(() => {
    cleanup();
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it('lists fantasycore enemy sprites and applies the look on click', async () => {
    const onSelectLook = vi.fn();
    render(
      <EnemyAppearancePicker
        projectPath="/proj"
        animations=""
        tilesetPath=""
        portraitPath=""
        onSelectLook={onSelectLook}
        onSelectPortrait={vi.fn()}
      />,
    );
    const goblin = await screen.findByTitle('Goblin');
    await userEvent.click(goblin);
    expect(onSelectLook).toHaveBeenCalledWith({
      animations: 'animations/enemies/goblin.txt',
      tilesetPath: 'animations/enemies/goblin.txt',
      gfx: null,
    });
  });

  it('opens the portrait list and applies the portrait on click', async () => {
    const onSelectPortrait = vi.fn();
    render(
      <EnemyAppearancePicker
        projectPath="/proj"
        animations=""
        tilesetPath=""
        portraitPath=""
        onSelectLook={vi.fn()}
        onSelectPortrait={onSelectPortrait}
      />,
    );
    const portraitTrigger = await screen.findByRole('button', { name: /Portrait/i });
    await userEvent.click(portraitTrigger);
    const male = await screen.findByTitle('Male 01');
    await userEvent.click(male);
    expect(onSelectPortrait).toHaveBeenCalledWith({
      portraitPath: 'images/portraits/male01.png',
      portraitSourcePath: null,
    });
  });

  it('marks the current look as selected', async () => {
    render(
      <EnemyAppearancePicker
        projectPath="/proj"
        animations="animations/enemies/goblin.txt"
        tilesetPath="animations/enemies/goblin.txt"
        portraitPath=""
        onSelectLook={vi.fn()}
        onSelectPortrait={vi.fn()}
      />,
    );
    const goblin = await screen.findByTitle('Goblin');
    await waitFor(() => expect(goblin.className).toContain('border-orange-500'));
  });
});
