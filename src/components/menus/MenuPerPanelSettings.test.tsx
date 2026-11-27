// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MenuPerPanelSettings from './MenuPerPanelSettings';
import type { MenuPanel } from '@/editor/menuLayout';

afterEach(() => cleanup());

function panel(file: string, values: Record<string, string[]> = {}): MenuPanel {
  return {
    file,
    name: file,
    pos: { x: 0, y: 0, w: 640, h: 480 },
    align: 'topleft',
    values,
    text: '',
  };
}

describe('MenuPerPanelSettings', () => {
  it('uses the engine default for switches missing from the file', () => {
    render(<MenuPerPanelSettings panel={panel('inventory.txt')} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Show character preview' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show sort button' })).not.toBeChecked();
  });

  it('keeps true defaults for menus that start with them enabled', () => {
    render(<MenuPerPanelSettings panel={panel('gamenew.txt')} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Show class list' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show class description' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Start with a random class' })).not.toBeChecked();
  });

  it('writes durations with the unit the engine expects', () => {
    const onChange = vi.fn();
    render(<MenuPerPanelSettings panel={panel('enemy.txt')} onChange={onChange} />);
    const input = screen.getByLabelText('Hide after');
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith('timeout', ['10s']);
  });

  it('renders simple fields for menus that previously had none', () => {
    render(<MenuPerPanelSettings panel={panel('hudlog.txt')} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Show message overlay' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Start messages at the bottom' })).toBeChecked();
  });

  it('edits a label and keeps its alignment', () => {
    const onChange = vi.fn();
    render(<MenuPerPanelSettings panel={panel('character.txt', { label_title: ['10,20,right,top'] })} onChange={onChange} />);
    expect(screen.getByLabelText('Character title X')).toHaveValue('10');
    fireEvent.change(screen.getByLabelText('Character title X'), { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith('label_title', ['30,20,right,top']);
  });

  it('hides a label without losing its position', () => {
    const onChange = vi.fn();
    render(<MenuPerPanelSettings panel={panel('character.txt', { label_title: ['10,20,left,center'] })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Hide character title' }));
    expect(onChange).toHaveBeenCalledWith('label_title', ['hidden']);
  });

  it('edits the name and area of a primary stat', () => {
    const onChange = vi.fn();
    render(<MenuPerPanelSettings panel={panel('character.txt', { primary: ['strength,1,2,3,4'] })} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Primary stat area name'), { target: { value: 'dexterity' } });
    expect(onChange).toHaveBeenCalledWith('primary', ['dexterity,1,2,3,4']);
  });

  it('edits an equipment set button image', () => {
    const onChange = vi.fn();
    render(<MenuPerPanelSettings panel={panel('inventory.txt', { set_previous: ['1,2,images/previous.png'] })} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Previous set button image'), { target: { value: 'images/back.png' } });
    expect(onChange).toHaveBeenCalledWith('set_previous', ['1,2,images/back.png']);
  });
});
