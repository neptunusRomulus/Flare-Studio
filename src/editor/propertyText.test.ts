import { describe, expect, it } from 'vitest';
import { propertyRecord, propertyText } from './propertyText';

describe('propertyText', () => {
  it('keeps a plain string and replaces empty values with the fallback', () => {
    expect(propertyText('town')).toBe('town');
    expect(propertyText('')).toBe('');
    expect(propertyText(undefined, 'fallback')).toBe('fallback');
    expect(propertyText(null, 'fallback')).toBe('fallback');
  });

  it('reads the first element of a repeated property', () => {
    expect(propertyText(['first', 'second'])).toBe('first');
    expect(propertyText([])).toBe('');
    expect(propertyText([''], 'fallback')).toBe('fallback');
  });

  it('copies a property bag as strings', () => {
    expect(propertyRecord({ name: 'antlion', loot: ['chest', 'extra'] })).toEqual({
      name: 'antlion',
      loot: 'chest',
    });
  });
});
