/** Convert between client (CSS / zoomed) coordinates and canvas backing-store pixels. */

export type CanvasLike = {
  width: number;
  height: number;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
};

export function clientToCanvas(clientX: number, clientY: number, canvas: CanvasLike): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width === 0 ? 1 : canvas.width / rect.width;
  const sy = rect.height === 0 ? 1 : canvas.height / rect.height;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

export function canvasToClient(canvasX: number, canvasY: number, canvas: CanvasLike): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width === 0 ? 1 : rect.width / canvas.width;
  const sy = canvas.height === 0 ? 1 : rect.height / canvas.height;
  return { x: rect.left + canvasX * sx, y: rect.top + canvasY * sy };
}
