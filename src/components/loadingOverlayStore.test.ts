import { describe, it, expect } from 'vitest';
import { beginLoading, endLoading, expireLoading, isLoading, loadingCount, progressLoading } from './loadingOverlayStore';

describe('loading overlay state', () => {
  it('visible while any token active', () => {
    let s = beginLoading({ tokens: [] }, 'open', 0);
    s = beginLoading(s, 'template', 0);
    s = endLoading(s, 'open');
    expect(isLoading(s)).toBe(true);
    s = endLoading(s, 'template');
    expect(isLoading(s)).toBe(false);
  });
  it('progress count', () => {
    let s = beginLoading({ tokens: [] }, 'template', 0);
    expect(loadingCount(s)).toBeNull();
    s = progressLoading(s, 'template', 3, 8);
    expect(loadingCount(s)).toBe('3/8');
  });
  it('never sticks: tokens expire', () => {
    const s = beginLoading({ tokens: [] }, 'template', 0);
    expect(isLoading(expireLoading(s, 29999))).toBe(true);
    expect(isLoading(expireLoading(s, 30000))).toBe(false);
  });
  it('restarting a key does not duplicate', () => {
    let s = beginLoading({ tokens: [] }, 'open', 0);
    s = beginLoading(s, 'open', 5);
    expect(s.tokens.length).toBe(1);
  });
});
