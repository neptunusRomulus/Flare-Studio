import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MapHoverDisplay from './MapHoverDisplay';

const base = { hoverCoords: { x: 3, y: 4 }, showActiveGid: true, activeGidValue: '(none)', hoverGidValue: '17', isEnemyTabActive: false };

describe('GID readout', () => {
  it('is hidden unless debug mode is on', () => {
    expect(renderToStaticMarkup(<MapHoverDisplay {...base} />)).toBe('');
    expect(renderToStaticMarkup(<MapHoverDisplay {...base} debugMode={false} />)).toBe('');
  });
  it('shows coords + GID in debug mode, offset clear of the minimap', () => {
    const html = renderToStaticMarkup(<MapHoverDisplay {...base} debugMode left={172} />);
    expect(html).toContain('(3, 4) GID: 17');
    expect(html).toContain('left:172px');
  });
});
