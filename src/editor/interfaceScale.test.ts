import { describe, expect, it } from 'vitest';
import {
  INTERFACE_SCALE_DEFAULT,
  applyTextScaleToDocument,
  clampScale,
  interfaceZoomFactor,
  matchInterfaceScaleShortcut,
  parseScale,
  readStoredScales,
  stepScale,
  writeStoredScales,
} from './interfaceScale';

describe('interface and text scale', () => {
  it('clamps and snaps to 10% steps between 75 and 200', () => {
    expect(clampScale(100)).toBe(100);
    expect(clampScale(74)).toBe(75);
    expect(clampScale(201)).toBe(200);
    expect(clampScale(116)).toBe(120);
    expect(clampScale(114)).toBe(110);
    expect(parseScale('87')).toBe(90);
    expect(parseScale('nope')).toBe(INTERFACE_SCALE_DEFAULT);
    expect(interfaceZoomFactor(150)).toBe(1.5);
  });

  it('steps up and down without leaving the range', () => {
    expect(stepScale(100, 1)).toBe(110);
    expect(stepScale(100, -1)).toBe(90);
    expect(stepScale(75, -1)).toBe(75);
    expect(stepScale(200, 1)).toBe(200);
  });

  it('matches browser and VS Code zoom shortcuts', () => {
    const ctrl = { ctrlKey: true };
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'Equal', key: '=' })).toBe('in');
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'Equal', key: '+' })).toBe('in');
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'NumpadAdd', key: '+' })).toBe('in');
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'Minus', key: '-' })).toBe('out');
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'NumpadSubtract', key: '-' })).toBe('out');
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'Digit0', key: '0' })).toBe('reset');
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'Numpad0', key: '0' })).toBe('reset');
    expect(matchInterfaceScaleShortcut({ metaKey: true, code: 'Equal', key: '=' })).toBe('in');
    expect(matchInterfaceScaleShortcut({ ...ctrl, altKey: true, code: 'Equal', key: '=' })).toBeNull();
    expect(matchInterfaceScaleShortcut({ ...ctrl, code: 'KeyS', key: 's' })).toBeNull();
    expect(matchInterfaceScaleShortcut({ code: 'Equal', key: '=' })).toBeNull();
  });

  it('reads and writes app settings and applies the root font size', () => {
    const store: Record<string, string> = {};
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    writeStoredScales(storage, { interfaceScale: 120, textScale: 90 });
    expect(readStoredScales(storage)).toEqual({ interfaceScale: 120, textScale: 90 });
    const root = { style: { fontSize: '' } };
    applyTextScaleToDocument(150, root);
    expect(root.style.fontSize).toBe('24px');
  });
});
