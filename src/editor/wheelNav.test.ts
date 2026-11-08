import { describe, it, expect } from 'vitest';
import { classifyWheel, pinchFactor, panForZoomAt } from './wheelNav';

const ev = (deltaY: number, o: Partial<{ deltaX: number; deltaMode: number; ctrlKey: boolean }> = {}) =>
  ({ deltaX: 0, deltaMode: 0, ctrlKey: false, deltaY, ...o });

describe('classifyWheel', () => {
  it('pinch / ctrl+wheel zooms', () => expect(classifyWheel(ev(3.2, { ctrlKey: true }))).toBe('pinch'));
  it('mouse wheel notch steps', () => {
    expect(classifyWheel(ev(100))).toBe('step');
    expect(classifyWheel(ev(-120))).toBe('step');
    expect(classifyWheel(ev(3, { deltaMode: 1 }))).toBe('step');
  });
  it('touchpad scroll pans', () => {
    expect(classifyWheel(ev(4.5))).toBe('pan');
    expect(classifyWheel(ev(12))).toBe('pan');
    expect(classifyWheel(ev(0, { deltaX: 7 }))).toBe('pan');
    expect(classifyWheel(ev(100, { deltaX: 2 }))).toBe('pan');
  });
});

describe('zoom helpers', () => {
  it('pinch factor direction', () => {
    expect(pinchFactor(-10)).toBeGreaterThan(1);
    expect(pinchFactor(10)).toBeLessThan(1);
  });
  it('keeps world point under cursor', () => {
    const W2 = 400, pan = 30, cx = 250, z0 = 1, z1 = 2;
    const world = cx / z0 - W2 - pan;
    const p1 = panForZoomAt(pan, cx, z0, z1);
    expect((world + W2 + p1) * z1).toBeCloseTo(cx);
  });
});
