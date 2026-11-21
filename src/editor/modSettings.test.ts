import { describe, expect, it } from 'vitest';
import { loadOrder, parseModSettings, serializeModSettings, serializeRequire } from './modSettings';

const FIXTURE = `# manifest
description=The campaign
description_locale=tr,Kampanya
requires=fantasycore:1.15
game=flare-game
version=1.15.01
engine_version_min=1.14.280
`;

describe('modSettings', () => {
  it('parses requires with a version bound and keeps comments', () => {
    const parsed = parseModSettings(FIXTURE);
    expect(parsed.description).toBe('The campaign');
    expect(parsed.locales[0]).toEqual({ lang: 'tr', text: 'Kampanya' });
    expect(parsed.requires).toEqual([{ name: 'fantasycore', min: '1.15', max: '' }]);
    expect(serializeRequire(parsed.requires[0])).toBe('fantasycore:1.15');
    expect(loadOrder(parsed, 'empyrean_campaign')).toEqual(['fantasycore', 'empyrean_campaign']);
  });

  it('round-trips and omits empty keys', () => {
    const out = serializeModSettings(parseModSettings(FIXTURE));
    expect(out).toContain('# manifest');
    expect(out).not.toMatch(/engine_version_max=/);
    expect(serializeModSettings(parseModSettings(out)).trim()).toBe(out.trim());
  });
});
