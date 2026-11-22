// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventGeneratedMapsSection from '@/components/events/EventGeneratedMapsSection';

afterEach(cleanup);

describe('EventGeneratedMapsSection', () => {
  it('reports only the field that changed', () => {
    const onChange = vi.fn();
    render(<EventGeneratedMapsSection values={{ filename: '', link: '', doorLevel: '' }} conflicting={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Layout file'), { target: { value: 'rules/cave.txt' } });
    expect(onChange).toHaveBeenLastCalledWith({ filename: 'rules/cave.txt' });
    fireEvent.change(screen.getByLabelText('Connects to'), { target: { value: 'north' } });
    expect(onChange).toHaveBeenLastCalledWith({ link: 'north' });
    fireEvent.change(screen.getByLabelText('Door level'), { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith({ doorLevel: '3' });
  });

  it('warns only when another event owns the layout file', () => {
    render(<EventGeneratedMapsSection values={{ filename: 'a', link: '', doorLevel: '' }} conflicting onChange={() => {}} />);
    expect(screen.getByText(/Another event already has one/)).toBeTruthy();
    cleanup();
    render(<EventGeneratedMapsSection values={{ filename: 'a', link: '', doorLevel: '' }} conflicting={false} onChange={() => {}} />);
    expect(screen.queryByText(/Another event already has one/)).toBeNull();
  });
});
