// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopBar from '@/components/TopBar';

function Harness({ enemy = false }: { enemy?: boolean }) {
  const [tipsMinimized, setTipsMinimized] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      <TopBar
        toolbarExpanded
        containerRef={React.createRef<HTMLDivElement>()}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        handleUndo={() => {}}
        handleRedo={() => {}}
        handleZoomIn={() => {}}
        handleZoomOut={() => {}}
        handleResetZoom={() => {}}
        tipsMinimized={tipsMinimized}
        setTipsMinimized={setTipsMinimized}
        setShowHelp={setShowHelp}
        isEnemyTabActive={enemy}
      />
      {showHelp ? <div>Full help dialog</div> : null}
    </>
  );
}

describe('canvas help in the zoom controls', () => {
  it('opens a tips panel under the zoom group and matches its width', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole('region', { name: 'Canvas help' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show canvas help' }));

    const panel = screen.getByRole('region', { name: 'Canvas help' });
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent('Left Click');
    expect(panel).toHaveTextContent('to Paint');
    expect(panel.className).toContain('absolute');
    expect(panel.className).toContain('inset-x-0');
    expect(panel.className).toContain('top-full');
    expect(panel.className).toContain('w-full');

    const group = panel.parentElement;
    expect(group).not.toBeNull();
    expect(group?.classList.contains('relative')).toBe(true);
    expect(group?.querySelector('[aria-label="Map controls"]')).toBeNull();
    // The panel is a sibling of the zoom capsule, not clipped inside it.
    expect(panel.previousElementSibling?.className).toContain('rounded-full');
  });

  it('hides the tips on an enemy tab and can open the full help dialog', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Show canvas help' }));
    await user.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByText('Full help dialog')).toBeInTheDocument();

    rerender(<Harness enemy />);
    expect(screen.queryByRole('button', { name: 'Show canvas help' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Canvas help' })).not.toBeInTheDocument();
  });
});
