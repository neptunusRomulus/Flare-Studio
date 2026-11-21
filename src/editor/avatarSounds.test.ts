import { describe, expect, it } from 'vitest';
import {
  parseAvatarSfx,
  parseStepSounds,
  serializeAvatarSfx,
  serializeStepSounds,
  avatarSfxRelPath,
} from './avatarSounds';

const MALE = `# male body
sfx_attack=swing,soundfx/melee_attack.ogg
sfx_attack=swing,soundfx/melee_attack_2.ogg
sfx_hit=soundfx/male_hit.ogg
sfx_die=soundfx/male_die.ogg
sfx_critdie=soundfx/male_die.ogg
sfx_block=soundfx/powers/block.ogg
sfx_levelup=soundfx/level_up.ogg
sfx_lowhp=soundfx/heartbeat.ogg,true
`;

describe('avatarSounds', () => {
  it('parses engine/avatar body sounds and keeps the header comment', () => {
    expect(avatarSfxRelPath('Male Base')).toBe('engine/avatar/Male_Base.txt');
    const parsed = parseAvatarSfx(MALE);
    expect(parsed.header).toBe('# male body');
    expect(parsed.attacks).toEqual([
      { animation: 'swing', file: 'soundfx/melee_attack.ogg' },
      { animation: 'swing', file: 'soundfx/melee_attack_2.ogg' },
    ]);
    expect(parsed.hit).toEqual(['soundfx/male_hit.ogg']);
    expect(parsed.lowhp).toBe('soundfx/heartbeat.ogg,true');
    expect(serializeAvatarSfx(parsed, MALE)).toBe(MALE);
    expect(serializeAvatarSfx({ ...parsed, levelup: '' }, MALE)).not.toContain('sfx_levelup');
  });

  it('parses items/step_sounds.txt and keeps a leading comment', () => {
    const text = `# steps\n\nid=cloth\nstep=soundfx/steps/step_cloth1.ogg\nstep=soundfx/steps/step_cloth2.ogg\n\nid=metal\nstep=soundfx/steps/step_metal1.ogg\n`;
    expect(parseStepSounds(text)).toEqual([
      { id: 'cloth', steps: ['soundfx/steps/step_cloth1.ogg', 'soundfx/steps/step_cloth2.ogg'] },
      { id: 'metal', steps: ['soundfx/steps/step_metal1.ogg'] },
    ]);
    const next = serializeStepSounds(parseStepSounds(text), text);
    expect(next).toContain('# steps');
    expect(next).toContain('id=cloth');
    expect(next).toContain('id=metal');
    expect(parseStepSounds(next)).toEqual(parseStepSounds(text));
  });
});
