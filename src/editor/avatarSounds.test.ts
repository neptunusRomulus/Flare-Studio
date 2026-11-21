import { describe, expect, it } from 'vitest';
import {
  parseAvatarSfx,
  parseStepSounds,
  serializeAvatarSfx,
  serializeStepSounds,
  avatarSfxRelPath,
  loadAvatarSfxFiles,
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

  it('loads body files from a required mod and prefers a project override', async () => {
    const files: Record<string, string> = {
      '/proj/project.json': JSON.stringify({ requires: ['fantasycore'] }),
      '/proj/engine/avatar/female.txt': 'sfx_hit=soundfx/custom_female_hit.ogg\n',
      '/opt/flare-game/mods/fantasycore/engine/avatar/male.txt': 'sfx_hit=soundfx/male_hit.ogg\n',
      '/opt/flare-game/mods/fantasycore/engine/avatar/female.txt': 'sfx_hit=soundfx/female_hit.ogg\n',
    };
    const dirs: Record<string, Array<{ name: string; isDirectory?: boolean }>> = {
      '/proj/engine/avatar': [{ name: 'female.txt' }],
      '/opt/flare-game/mods/fantasycore/engine/avatar': [{ name: 'male.txt' }, { name: 'female.txt' }],
    };
    const loaded = await loadAvatarSfxFiles({
      projectPath: '/proj',
      flarePath: '/opt/flare-engine',
      fs: {
        readFile: async (abs) => files[abs] || '',
        readDir: async (abs) => dirs[abs] || [],
      },
    });
    expect(loaded['engine/avatar/male.txt']).toContain('male_hit');
    expect(loaded['engine/avatar/female.txt']).toContain('custom_female_hit');
    expect(loaded['engine/avatar/female.txt']).not.toContain('soundfx/female_hit.ogg');
  });
});
