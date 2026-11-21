import { describe, expect, it } from 'vitest';
import { parseCutsceneFile, serializeCutsceneFile } from './cutsceneFile';

const FIXTURE = `caption_margins=5,5
music=music/theme.ogg

[scene]
image=images/cutscenes/city.jpg,1
caption=Hello
pause=-1
caption=There is always hope.

INCLUDE cutscenes/credits.txt

[vscroll]
text=Thanks
separator=16
text=You!
`;

describe('cutsceneFile', () => {
  it('keeps scene component order, INCLUDE lines and vscroll rows', () => {
    const parsed = parseCutsceneFile(FIXTURE);
    expect(parsed.music).toBe('music/theme.ogg');
    expect(parsed.parts[0].kind).toBe('scene');
    if (parsed.parts[0].kind !== 'scene') return;
    expect(parsed.parts[0].components.map((row) => row.key)).toEqual(['image', 'caption', 'pause', 'caption']);
    expect(parsed.parts[1]).toMatchObject({ kind: 'include', path: 'cutscenes/credits.txt' });
    if (parsed.parts[2].kind !== 'vscroll') throw new Error('expected vscroll');
    expect(parsed.parts[2].components.map((row) => row.value)).toEqual(['Thanks', '16', 'You!']);
  });

  it('round-trips', () => {
    const out = serializeCutsceneFile(parseCutsceneFile(FIXTURE));
    expect(out).toContain('INCLUDE cutscenes/credits.txt');
    expect(serializeCutsceneFile(parseCutsceneFile(out)).trim()).toBe(out.trim());
  });
});
