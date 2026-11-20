import { describe, expect, it } from 'vitest';
import {
  applyPowerName,
  appendNewPowerDefinition,
  collectPowerRefs,
  defaultPowerName,
  formatPowerLabel,
  isPlaceholderPowerName,
  mergePowerRefs,
  nextNumericPowerId,
} from './powerCatalog';

describe('powerCatalog', () => {
  it('formats names with ids and marks missing names', () => {
    expect(formatPowerLabel({ id: '5', name: 'Cleave' })).toBe('Cleave (#5)');
    expect(formatPowerLabel({ id: '5', name: '' })).toBe('Unnamed (#5)');
    expect(formatPowerLabel({ id: '', name: '' })).toBe('Unnamed');
    expect(isPlaceholderPowerName('')).toBe(true);
    expect(isPlaceholderPowerName('Power')).toBe(true);
    expect(isPlaceholderPowerName('New Power 12')).toBe(true);
    expect(isPlaceholderPowerName('Cleave')).toBe(false);
    expect(defaultPowerName('12')).toBe('New Power 12');
    expect(nextNumericPowerId(['4', '12', 'sword'])).toBe('13');
  });

  it('reads names from power definition files and lets the project override a mod', () => {
    const mod = collectPowerRefs({
      'powers/powers.txt': '[power]\nid=5\nname=Mod Cleave\n\n[power]\nid=9\nname=Shield Bash\n',
      'powers/trees/default.txt': '[power]\nid=5\n',
    }, 'mod');
    const project = collectPowerRefs({
      'powers/powers.txt': '[power]\nid=5\nname=Hero Cleave\n',
    }, 'project');
    const merged = mergePowerRefs([mod, project]);
    expect(merged.find((item) => item.id === '5')).toMatchObject({ name: 'Hero Cleave', source: 'project' });
    expect(merged.find((item) => item.id === '9')).toMatchObject({ name: 'Shield Bash', source: 'mod' });
    expect(merged.some((item) => item.path?.startsWith('powers/trees/'))).toBe(false);
  });

  it('writes name= on an existing block or appends a new one', () => {
    const updated = applyPowerName('[power]\nid=5\nname=Power\ntype=fixed\n', '5', 'Cleave');
    expect(updated).toContain('name=Cleave');
    expect(updated).toContain('type=fixed');
    const created = applyPowerName('', '12', 'New Power 12');
    expect(created).toBe('[power]\nid=12\nname=New Power 12\n');
    const fresh = appendNewPowerDefinition('', '12', 'New Power 12');
    expect(fresh).toBe('[power]\nid=12\nname=New Power 12\ntype=fixed\n');
  });
});
