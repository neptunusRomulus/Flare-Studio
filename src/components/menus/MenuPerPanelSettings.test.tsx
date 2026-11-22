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
});
