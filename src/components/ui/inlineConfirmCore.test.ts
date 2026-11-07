import { describe, it, expect } from 'vitest';
import { placeConfirm, askConfirm, answerConfirm, getPendingConfirm } from './inlineConfirmCore';

const a = { left: 100, top: 100, width: 40, height: 20 };

describe('placeConfirm', () => {
  it('centers under the anchor', () => {
    expect(placeConfirm(a, 100, 30, 1000, 800)).toEqual({ left: 70, top: 124 });
  });
  it('flips above near the bottom edge', () => {
    const low = { ...a, top: 770 };
    expect(placeConfirm(low, 100, 30, 1000, 800).top).toBe(736);
  });
  it('clamps to the viewport horizontally', () => {
    expect(placeConfirm({ ...a, left: 0 }, 100, 30, 1000, 800).left).toBe(8);
  });
});

describe('askConfirm', () => {
  it('resolves with the answer and clears the pending request', async () => {
    const p = askConfirm('Discard changes?', a);
    expect(getPendingConfirm()?.message).toBe('Discard changes?');
    answerConfirm(true);
    await expect(p).resolves.toBe(true);
    expect(getPendingConfirm()).toBeNull();
  });
  it('a new request cancels the previous one', async () => {
    const first = askConfirm(undefined, a);
    const second = askConfirm(undefined, a);
    await expect(first).resolves.toBe(false);
    answerConfirm(false);
    await expect(second).resolves.toBe(false);
  });
});
