// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import WindowControlBar, { WINDOW_BAR_HIDE_MS, WINDOW_BAR_HOT_ZONE } from '@/components/WindowControlBar';

const noop = () => {};

function bar() {
  return screen.getByTestId('window-control-bar');
}

describe('zen window control bar', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('stays hidden and inert until the pointer touches the top edge', () => {
    render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    expect(bar().getAttribute('data-state')).toBe('closed');
    expect(bar().hasAttribute('inert')).toBe(true);
    expect(bar().className).toContain('-translate-y-full');
    expect(bar().className).toContain('opacity-0');
  });

  it('slides down from the very top edge and is a drag region with no-drag buttons', () => {
    render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    fireEvent.mouseMove(window, { clientY: WINDOW_BAR_HOT_ZONE });

    expect(bar().getAttribute('data-state')).toBe('open');
    expect(bar().hasAttribute('inert')).toBe(false);
    expect(bar().className).toContain('drag-region');
    expect(bar().className).toContain('translate-y-0');
    expect(bar().querySelector('.no-drag')).not.toBeNull();
  });

  it('stays up below the hot zone, then closes about 600ms after the pointer leaves', () => {
    render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    fireEvent.mouseMove(window, { clientY: 0 });
    expect(bar().getAttribute('data-state')).toBe('open');

    fireEvent.mouseMove(window, { clientY: 200 });
    act(() => { vi.advanceTimersByTime(WINDOW_BAR_HIDE_MS - 1); });
    expect(bar().getAttribute('data-state')).toBe('open');

    act(() => { vi.advanceTimersByTime(1); });
    expect(bar().getAttribute('data-state')).toBe('closed');
  });

  it('re-showing cancels the pending hide', () => {
    render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    fireEvent.mouseMove(window, { clientY: 0 });
    fireEvent.mouseMove(window, { clientY: 300 });
    act(() => { vi.advanceTimersByTime(WINDOW_BAR_HIDE_MS - 50); });

    fireEvent.mouseMove(window, { clientY: 2 });
    act(() => { vi.advanceTimersByTime(WINDOW_BAR_HIDE_MS * 2); });
    expect(bar().getAttribute('data-state')).toBe('open');
  });

  it('wires the existing minimize / maximize / close IPC handlers', () => {
    const onMinimize = vi.fn();
    const onMaximize = vi.fn();
    const onClose = vi.fn();
    render(<WindowControlBar onMinimize={onMinimize} onMaximize={onMaximize} onClose={onClose} />);
    fireEvent.mouseMove(window, { clientY: 0 });

    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onMaximize).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
