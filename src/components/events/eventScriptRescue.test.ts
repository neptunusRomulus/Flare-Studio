import { describe, expect, it } from 'vitest';
import { planScriptRescue } from '@/components/events/eventScriptRescue';

const coordinates = { x: 12, y: 34 };

describe('planScriptRescue', () => {
  it('names the script after the map and the position', () => {
    const plan = planScriptRescue({
      script: '',
      leftover: [{ key: 'say', value: 'Hello' }],
      projectPath: '/proj',
      mapName: 'My Map 1',
      coordinates,
    });
    expect(plan?.script).toBe('scripts/my_map_1_12_34.txt');
    expect(plan?.absPath).toBe('/proj/scripts/my_map_1_12_34.txt');
    expect(plan?.content).toContain('say');
  });

  it('writes nothing when the event already names a script', () => {
    expect(planScriptRescue({ script: 'scripts/x.txt', leftover: [{ key: 'a', value: 'b' }], projectPath: '/p', coordinates })).toBeNull();
  });

  it('writes nothing when there is no leftover to keep', () => {
    expect(planScriptRescue({ script: '', leftover: [], projectPath: '/p', coordinates })).toBeNull();
  });

  it('writes nothing outside a project', () => {
    expect(planScriptRescue({ script: '', leftover: [{ key: 'a', value: 'b' }], projectPath: null, coordinates })).toBeNull();
  });

  it('falls back to "map" when the map has no name yet', () => {
    const plan = planScriptRescue({ script: '', leftover: [{ key: 'a', value: 'b' }], projectPath: '/p', mapName: '', coordinates });
    expect(plan?.script).toBe('scripts/map_12_34.txt');
  });
});
