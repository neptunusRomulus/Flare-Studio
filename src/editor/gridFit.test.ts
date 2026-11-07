import { describe, it, expect } from 'vitest';
import { gridFitWarning } from './importTileset';

describe('gridFitWarning', () => {
  it('is quiet for exact multiples', () => {
    expect(gridFitWarning(1920, 960, 192, 96)).toBeNull();
    expect(gridFitWarning(192, 96, 192, 96)).toBeNull();
  });
  it('warns with tile and image size otherwise', () => {
    expect(gridFitWarning(2180, 3612, 192, 96)).toBe("This tileset doesn't fit 192×96 tiles (2180×3612)");
    expect(gridFitWarning(1920, 1000, 192, 96)).not.toBeNull();
  });
  it('is safe for zero or invalid sizes', () => {
    expect(gridFitWarning(0, 96, 192, 96)).toBeNull();
    expect(gridFitWarning(192, 96, 0, 96)).toBeNull();
    expect(gridFitWarning(NaN, 96, 192, 96)).toBeNull();
    expect(gridFitWarning(-192, 96, 192, 96)).toBeNull();
  });
});
