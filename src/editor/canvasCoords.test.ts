import { describe, expect, it } from 'vitest';
import { canvasToClient, clientToCanvas } from './canvasCoords';

const canvas = (width: number, height: number, rect: { left: number; top: number; width: number; height: number }) => ({
  width,
  height,
  getBoundingClientRect: () => rect,
});

describe('canvasCoords', () => {
  it('is a no-op when backing store and CSS box match', () => {
    const c = canvas(800, 600, { left: 10, top: 20, width: 800, height: 600 });
    expect(clientToCanvas(110, 80, c)).toEqual({ x: 100, y: 60 });
    expect(canvasToClient(100, 60, c)).toEqual({ x: 110, y: 80 });
  });

  it('maps mouse position into backing pixels under UI zoom / devicePixelRatio', () => {
    // 800 CSS px canvas shown at 1.5x (rect 1200) with a 2x backing store (1600).
    const c = canvas(1600, 1200, { left: 0, top: 0, width: 1200, height: 900 });
    expect(clientToCanvas(600, 450, c)).toEqual({ x: 800, y: 600 });
    expect(canvasToClient(800, 600, c)).toEqual({ x: 600, y: 450 });
  });
});
