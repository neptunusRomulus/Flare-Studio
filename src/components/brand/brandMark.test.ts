import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_CHARCOAL, BRAND_EMBER, BRAND_FLAME_SMALL_D } from './BrandMark';

describe('brand mark', () => {
  it('matches the small-size icon asset', () => {
    const svg = readFileSync(resolve(__dirname, '../../../assets/brand/flare-studio-icon-small.svg'), 'utf8');
    expect(svg).toContain(`d="${BRAND_FLAME_SMALL_D}"`);
    expect(svg).toContain(`fill="${BRAND_CHARCOAL}"`);
    expect(svg).toContain(`fill="${BRAND_EMBER}"`);
  });
});
