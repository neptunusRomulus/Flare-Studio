// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventActionsSection from '@/components/events/EventActionsSection';

afterEach(cleanup);

describe('EventActionsSection', () => {
  it('offers the edit shortcut only when the value names a script file', () => {
    render(<EventActionsSection script="" onScriptChange={() => {}} />);
    expect(screen.queryByText('Edit actions')).toBeNull();
    cleanup();
    render(<EventActionsSection script="scripts/door.txt" onScriptChange={() => {}} />);
    expect(screen.getByText('Edit actions')).toBeTruthy();
  });

  it('hands the clicked path to the caller', () => {
    const onEditScript = vi.fn();
    render(<EventActionsSection script="scripts/door.txt" onScriptChange={() => {}} onEditScript={onEditScript} />);
    fireEvent.click(screen.getByText('Edit actions'));
    expect(onEditScript).toHaveBeenCalledWith('scripts/door.txt');
  });

  it('reports every keystroke', () => {
    const onScriptChange = vi.fn();
    render(<EventActionsSection script="" onScriptChange={onScriptChange} />);
    fireEvent.change(screen.getByLabelText('Event actions'), { target: { value: 'scripts/x.txt' } });
    expect(onScriptChange).toHaveBeenCalledWith('scripts/x.txt');
  });
});
