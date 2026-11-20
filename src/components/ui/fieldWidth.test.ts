import { describe, expect, it } from 'vitest';
import { DEFAULT_FIELD_WIDTH, FIELD_WIDTH, fieldWidthClass } from './fieldWidth';

describe('fieldWidth', () => {
  it('defaults ordinary fields to a capped name width and numbers to num', () => {
    expect(DEFAULT_FIELD_WIDTH).toBe('name');
    expect(fieldWidthClass(undefined)).toBe(FIELD_WIDTH.name);
    expect(fieldWidthClass(undefined, 'number')).toBe(FIELD_WIDTH.num);
    expect(fieldWidthClass('full', 'number')).toBe(FIELD_WIDTH.full);
    expect(FIELD_WIDTH.num).toContain('w-20');
    expect(FIELD_WIDTH.path).toContain('max-w-md');
    expect(FIELD_WIDTH.name).not.toBe('w-full');
  });
});
