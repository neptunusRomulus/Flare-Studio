import { describe, expect, it } from 'vitest';
import { parseSubtitlesFile, serializeSubtitlesFile } from './subtitlesFile';

const FIXTURE = `# header note

[style]
text_pos=0,0,center,top,font_subtitles
pos=0,-192
align=bottom

# female vendor 1
[subtitle]
id=soundfx/npcs/female_merchant_01.ogg
text=Take a look around.

[subtitle]
id=soundfx/npcs/female_merchant_02.ogg
text=Looking to buy something?
`;

describe('subtitlesFile', () => {
  it('parses style and subtitle rows, keeping comments', () => {
    const parsed = parseSubtitlesFile(FIXTURE);
    expect(parsed.header).toContain('# header note');
    expect(parsed.style).toMatchObject({
      text_pos: '0,0,center,top,font_subtitles',
      pos: '0,-192',
      align: 'bottom',
    });
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      id: 'soundfx/npcs/female_merchant_01.ogg',
      text: 'Take a look around.',
    });
    expect(parsed.rows[0].comment).toContain('# female vendor 1');
  });

  it('omits empty keys and keeps comments on serialize', () => {
    const out = serializeSubtitlesFile(parseSubtitlesFile(FIXTURE));
    expect(out).toContain('# header note');
    expect(out).toContain('# female vendor 1');
    expect(out).toContain('id=soundfx/npcs/female_merchant_01.ogg');
    expect(out).toContain('text=Take a look around.');
    expect(out).not.toMatch(/background_color=/);
    expect(serializeSubtitlesFile(parseSubtitlesFile(out)).trim()).toBe(out.trim());
  });
});
