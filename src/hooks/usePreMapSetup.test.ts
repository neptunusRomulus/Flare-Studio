import { describe, expect, it } from 'vitest';
import { findBackgroundLayer } from '@/hooks/usePreMapSetup';

describe('findBackgroundLayer', () => {
  it('returns the first background layer and ignores the rest', () => {
    const layers = [
      { id: '1', type: 'object' },
      { id: '2', type: 'background' },
      { id: '3', type: 'background' },
    ];
    expect(findBackgroundLayer(layers)?.id).toBe('2');
  });

  it('copes with a map that has no background yet', () => {
    expect(findBackgroundLayer([])).toBeUndefined();
    expect(findBackgroundLayer(undefined)).toBeUndefined();
    expect(findBackgroundLayer(null)).toBeUndefined();
  });
});
