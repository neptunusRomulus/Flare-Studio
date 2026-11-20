// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import WindowControlBar, {
  WINDOW_BAR_HEIGHT_PX,
  WINDOW_BAR_HIDE_MS,
  WINDOW_BAR_HOT_ZONE,
  WINDOW_BAR_OFFSET_VAR,
} from '@/components/WindowControlBar';

const noop = () => {};

function bar() {
  return screen.getByTestId('window-control-bar');
}

function offset() {
  return document.documentElement.style.getPropertyValue(WINDOW_BAR_OFFSET_VAR);
}

describe('zen window control bar', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.documentElement.style.removeProperty(WINDOW_BAR_OFFSET_VAR);
  });

  it('stays hidden and inert until the pointer touches the top edge', () => {
    render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    expect(bar().getAttribute('data-state')).toBe('closed');
    expect(bar().hasAttribute('inert')).toBe(true);
    expect(bar().className).toContain('-translate-y-full');
    expect(bar().className).toContain('opacity-0');
  });

  it('slides a compact top-right pill and keeps a full-width drag region with no-drag buttons', () => {
    render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    fireEvent.mouseMove(window, { clientY: WINDOW_BAR_HOT_ZONE });

    expect(bar().getAttribute('data-state')).toBe('open');
    expect(bar().hasAttribute('inert')).toBe(false);
    expect(bar().className).toContain('drag-region');
    expect(bar().className).toContain('translate-y-0');
    // The strip itself has no solid full-width background; only the pill does.
    expect(bar().className).not.toContain('bg-white/90');
    expect(bar().className).not.toContain('border-b');
    const pill = screen.getByTestId('window-control-pill');
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain('no-drag');
    expect(pill.className).toContain('bg-white/90');
    expect(pill.querySelector('.no-drag, button')).not.toBeNull();
  });

  it('shifts floating chrome down via a CSS variable while the bar is open', () => {
    render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    expect(offset()).toBe('');
    fireEvent.mouseMove(window, { clientY: 0 });
    expect(offset()).toBe(`${WINDOW_BAR_HEIGHT_PX}px`);

    fireEvent.mouseMove(window, { clientY: 200 });
    act(() => { vi.advanceTimersByTime(WINDOW_BAR_HIDE_MS); });
    expect(offset()).toBe('0px');
  });

  it('clears the CSS variable when the bar unmounts', () => {
    const { unmount } = render(<WindowControlBar onMinimize={noop} onMaximize={noop} onClose={noop} />);
    fireEvent.mouseMove(window, { clientY: 0 });
    expect(offset()).toBe(`${WINDOW_BAR_HEIGHT_PX}px`);
    unmount();
    expect(offset()).toBe('');
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
