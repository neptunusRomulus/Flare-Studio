// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useSidebarTabHotkeys } from '@/hooks/useSidebarTabHotkeys';
import type { TileLayer } from '@/types';

const layers = [
  { id: 1, name: 'Ground', type: 'background', visible: true, transparency: 0 },
  { id: 2, name: 'Object', type: 'object', visible: true, transparency: 0 },
  { id: 4, name: 'NPC', type: 'npc', visible: true, transparency: 0 },
] as unknown as TileLayer[];

function Harness(props: {
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
}) {
  useSidebarTabHotkeys(props.layers, props.activeLayer, props.onSelectLayer);
  return null;
}

function fireTab(shiftKey = false) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
}

describe('useSidebarTabHotkeys', () => {
  afterEach(() => { cleanup(); });

  it('binds the capture keydown listener once, even when the callback changes', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const first = vi.fn();
    const { rerender } = render(
      <Harness layers={layers} activeLayer={layers[0]} onSelectLayer={first} />,
    );
    const binds = add.mock.calls.filter((call) => call[0] === 'keydown' && call[2] === true).length;
    expect(binds).toBe(1);

    const second = vi.fn();
    rerender(<Harness layers={layers} activeLayer={layers[0]} onSelectLayer={second} />);
    rerender(<Harness layers={layers} activeLayer={layers[1]} onSelectLayer={second} />);
    expect(add.mock.calls.filter((call) => call[0] === 'keydown' && call[2] === true).length).toBe(binds);
    add.mockRestore();
  });

  it('reads the latest callback through a ref after a rerender', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <Harness layers={layers} activeLayer={layers[0]} onSelectLayer={first} />,
    );
    rerender(<Harness layers={layers} activeLayer={layers[0]} onSelectLayer={second} />);
    fireTab();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(2);
  });
});
