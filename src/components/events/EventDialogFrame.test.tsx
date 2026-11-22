// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventDialogFrame from '@/components/events/EventDialogFrame';

afterEach(cleanup);

function renderFrame(overrides: { onClose?: () => void; onSave?: () => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onSave = overrides.onSave ?? vi.fn();
  render(
    <EventDialogFrame
      title="Event instance"
      position={{ x: 10, y: 20 }}
      size={{ width: 400, height: 300 }}
      dialogRef={{ current: null }}
      onHeaderMouseDown={() => {}}
      onResizeMouseDown={() => {}}
      onClose={onClose}
      onSave={onSave}
    >
      <p>form body</p>
    </EventDialogFrame>,
  );
  return { onClose, onSave };
}

describe('EventDialogFrame', () => {
  it('shows the title and the body it is given', () => {
    renderFrame();
    expect(screen.getByRole('heading', { name: 'Event instance' })).toBeTruthy();
    expect(screen.getByText('form body')).toBeTruthy();
  });

  it('reports close and save through the buttons', () => {
    const { onClose, onSave } = renderFrame();
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('keeps the window at the position it was given', () => {
    renderFrame();
    const heading = screen.getByRole('heading', { name: 'Event instance' });
    const window_ = heading.closest('div[style]') as HTMLElement;
    expect(window_.style.position).toBe('fixed');
    expect(window_.style.left).toBe('10px');
    expect(window_.style.top).toBe('20px');
  });
});
