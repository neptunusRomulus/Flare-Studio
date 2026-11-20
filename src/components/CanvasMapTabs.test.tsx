import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CanvasMapTabs from './CanvasMapTabs';

const noop = () => {};
const tabs = [{ id: 'map-a', name: 'Map A' }];

const render = (appMenu?: React.ReactNode) => renderToStaticMarkup(
  <CanvasMapTabs
    tabs={tabs}
    activeTabId="map-a"
    onSwitchTab={noop}
    onOpenMapSettings={noop}
    onCloseTab={noop}
    onCreateNewMap={noop}
    appMenu={appMenu}
  />,
);

describe('canvas map tabs', () => {
  it('parks the logo menu just left of the strip so it follows the strip as it grows', () => {
    const html = render(<span data-testid="logo">logo</span>);
    expect(html).toContain('right-full');
    expect(html).toContain('top-2');
    expect(html).toContain('mr-2');
    expect(html).not.toContain('top-1/2');
    expect(html).not.toContain('-translate-y-1/2');
    // The logo is nested inside the strip, i.e. after the orange strip opens in the markup.
    expect(html.indexOf('data-testid="logo"')).toBeGreaterThan(html.indexOf('bg-orange-600'));
  });

  it('renders no logo slot when there is no menu to show', () => {
    const html = render();
    expect(html).not.toContain('right-full');
  });

  it('yields to the window-control reveal bar so the strip is not covered', () => {
    expect(render()).toContain('floats-below-window-bar');
  });
});
