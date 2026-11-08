import { describe, it, expect } from 'vitest';
import { clampPanelWidth, fitZoom, clientToImage, isDrawingLayer, PALETTE_PANEL_MIN } from './paletteLayout';

describe('palette dock layout', () => {
  it('clamps width', () => {
    expect(clampPanelWidth(100, 1920)).toBe(PALETTE_PANEL_MIN);
    expect(clampPanelWidth(5000, 1920)).toBe(900);
    expect(clampPanelWidth(5000, 1000)).toBe(600);
    expect(clampPanelWidth(NaN, 1920)).toBe(380);
  });
  it('fits image width', () => {
    expect(fitZoom(528, 256)).toBe(2);
    expect(fitZoom(380, 2048)).toBe(0.25);
    expect(fitZoom(380, 0)).toBe(1);
  });
  it('maps clicks to image pixels at any scale', () => {
    const rect = { left: 10, top: 20, width: 1024, height: 512 };
    expect(clientToImage(10 + 512, 20 + 256, rect, 512, 256)).toEqual({ x: 256, y: 128 });
  });
  it('drawing layers', () => {
    expect(isDrawingLayer('collision')).toBe(true);
    expect(isDrawingLayer('npc')).toBe(false);
  });
});
