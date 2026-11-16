// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaletteDock from './PaletteDock';
import type { TileLayer } from '@/types';

const layers = [
  { id: 1, name: 'Ground', type: 'background', visible: true, transparency: 0 },
  { id: 2, name: 'Object', type: 'object', visible: true, transparency: 0 },
  { id: 3, name: 'Collision', type: 'collision', visible: true, transparency: 0 },
  { id: 4, name: 'NPC', type: 'npc', visible: true, transparency: 0 },
  { id: 5, name: 'Enemy', type: 'enemy', visible: true, transparency: 0 },
  { id: 6, name: 'Event', type: 'event', visible: true, transparency: 0 },
] as unknown as TileLayer[];

function renderDock(overrides: Record<string, unknown> = {}) {
  const onSelectLayer = vi.fn();
  const utils = render(
    <PaletteDock
      open
      content={<div>List content</div>}
      footer={<div>Footer content</div>}
      mapLayers={layers}
      activeLayer={layers[0]}
      onSelectLayer={onSelectLayer}
      editor={null}
      tabTick={0}
      setTabTick={() => {}}
      brushTool="none"
      isCollisionLayer={false}
      handleToggleBrushTool={() => {}}
      toast={vi.fn() as never}
      handleOpenActorDialog={() => {}}
      {...overrides}
    >
      {(overlay) => <div data-testid="canvas">{overlay}</div>}
    </PaletteDock>,
  );
  return { ...utils, onSelectLayer };
}

const card = () => screen.getByLabelText('Sidebar list');

describe('hybrid sidebar: rail + floating card', () => {
  afterEach(cleanup);

  it('shows only the rail targets and the floating list card', async () => {
    renderDock();
    expect(screen.getByLabelText('Sidebar')).toBeInTheDocument();
    // Rail lists leaf targets, not the old main/sub switch rows.
    expect(screen.getByRole('radio', { name: 'Ground' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Enemy' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Entities' })).not.toBeInTheDocument();
    const list = await screen.findByLabelText('Sidebar list');
    expect(list).toHaveTextContent('List content');
    expect(list).toHaveTextContent('Footer content');
  });

  it('closes the card when the active rail icon is clicked again, keeping the rail', async () => {
    const user = userEvent.setup();
    const { onSelectLayer } = renderDock();
    await screen.findByLabelText('Sidebar list');

    await user.click(screen.getByRole('radio', { name: 'Ground' }));
    expect(onSelectLayer).not.toHaveBeenCalled();
    await waitFor(() => expect(card().getAttribute('aria-hidden')).toBe('true'));
    expect(card().style.pointerEvents).toBe('none');
    // Rail stays: the canvas only loses the list.
    expect(screen.getByLabelText('Sidebar')).toBeInTheDocument();
  });

  it('selects another target and reopens a closed card', async () => {
    const user = userEvent.setup();
    const { onSelectLayer } = renderDock();
    await screen.findByLabelText('Sidebar list');

    await user.click(screen.getByRole('radio', { name: 'Ground' }));
    await waitFor(() => expect(card().getAttribute('aria-hidden')).toBe('true'));

    await user.click(screen.getByRole('radio', { name: 'Enemy' }));
    expect(onSelectLayer).toHaveBeenCalledWith(5);
    await waitFor(() => expect(card().getAttribute('aria-hidden')).toBe('false'));
  });

  it('closes the card on Escape', async () => {
    const user = userEvent.setup();
    renderDock();
    await screen.findByLabelText('Sidebar list');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(card().getAttribute('aria-hidden')).toBe('true'));
  });

  it('hides the whole rail when there is nothing to edit', () => {
    renderDock({ open: false });
    expect(screen.queryByLabelText('Sidebar')).not.toBeInTheDocument();
  });
});
