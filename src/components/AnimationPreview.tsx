import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Image, Pause, Play } from 'lucide-react';

interface AnimationPreviewProps {
  tilesetPath: string;
  properties: Record<string, string>;
  /** Flare direction row index (0-7). Defaults to 0 (North). */
  direction?: number;
}

/** Parse a Flare duration string like "1200ms", "1.5s", or bare "6" (frame ticks → ms). */
function parseDurationMs(raw: string): number {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 1000;
  if (trimmed.endsWith('ms')) return parseFloat(trimmed) || 1000;
  if (trimmed.endsWith('s')) return (parseFloat(trimmed) || 1) * 1000;
  // Bare number: Flare treats as frame ticks at 60 FPS
  const ticks = parseInt(trimmed, 10);
  return ticks > 0 ? ticks * (1000 / 60) : 1000;
}

/** Draw a checkerboard onto a canvas context for transparency indication. */
function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number, size = 8) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#252540';
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) {
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}

const AnimationPreview: React.FC<AnimationPreviewProps> = ({ tilesetPath, properties, direction = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameIndexRef = useRef<number>(0);
  const reverseRef = useRef<boolean>(false);
  const elapsedRef = useRef<number>(0);

  const [playing, setPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Parse animation properties
  const frameW = parseInt(properties.anim_render_width || '0', 10) || 0;
  const frameH = parseInt(properties.anim_render_height || '0', 10) || 0;
  const frameCount = Math.max(1, parseInt(properties.anim_frames || '1', 10) || 1);
  const durationMs = parseDurationMs(properties.anim_duration || '1000');
  const animType = properties.anim_type || 'looped';
  const alphaMod = parseInt(properties.anim_alpha_mod || '255', 10);
  const blendMode = properties.anim_blend_mode || 'normal';
  const colorMod = properties.anim_color_mod || '255,255,255';

  // Scaling — fit preview to max 128px on the larger axis
  const MAX_PREVIEW = 128;
  const scale = frameW > 0 && frameH > 0 ? Math.min(MAX_PREVIEW / frameW, MAX_PREVIEW / frameH, 2) : 1;
  const canvasW = frameW > 0 ? Math.round(frameW * scale) : MAX_PREVIEW;
  const canvasH = frameH > 0 ? Math.round(frameH * scale) : MAX_PREVIEW;

  // Load image when tilesetPath changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    imgRef.current = null;
    frameIndexRef.current = 0;
    reverseRef.current = false;
    elapsedRef.current = 0;
    setCurrentFrame(0);

    if (!tilesetPath) return;

    const api = (window as unknown as Record<string, unknown>)?.electronAPI as
      | { readFileAsDataURL?: (p: string) => Promise<string | null> }
      | undefined;

    if (!api?.readFileAsDataURL) {
      setError(true);
      return;
    }

    let cancelled = false;
    api.readFileAsDataURL(tilesetPath).then((dataUrl) => {
      if (cancelled || !dataUrl) { if (!cancelled) setError(true); return; }
      const img = new window.Image();
      img.onload = () => { if (!cancelled) { imgRef.current = img; setLoaded(true); } };
      img.onerror = () => { if (!cancelled) setError(true); };
      img.src = dataUrl;
    }).catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; };
  }, [tilesetPath]);

  // Create a color-tinted offscreen canvas if colorMod != 255,255,255
  const tintCanvas = useRef<HTMLCanvasElement | null>(null);
  const needsTint = colorMod !== '255,255,255' && colorMod !== '';

  // Draw a single frame
  const drawFrame = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fw = frameW > 0 ? frameW : img.naturalWidth;
    const fh = frameH > 0 ? frameH : img.naturalHeight;

    // Clear and draw checkerboard
    drawCheckerboard(ctx, canvas.width, canvas.height);

    ctx.save();

    // Alpha
    const alpha = isNaN(alphaMod) ? 1 : Math.max(0, Math.min(255, alphaMod)) / 255;
    ctx.globalAlpha = alpha;

    // Blend mode
    if (blendMode === 'add') {
      ctx.globalCompositeOperation = 'lighter';
    }

    // Source rectangle in sprite sheet
    const srcX = frameIdx * fw;
    const srcY = direction * fh;

    // Detect how many actual rows and columns are in the sheet
    const sheetCols = fw > 0 ? Math.floor(img.naturalWidth / fw) : 1;
    const actualSrcX = (frameIdx % sheetCols) * fw;
    const actualSrcY = direction * fh;

    // Only draw if source fits within image bounds
    if (actualSrcX + fw <= img.naturalWidth && actualSrcY + fh <= img.naturalHeight) {
      if (needsTint) {
        // Tint via offscreen canvas: draw frame, then multiply with color
        if (!tintCanvas.current) tintCanvas.current = document.createElement('canvas');
        const tc = tintCanvas.current;
        tc.width = fw;
        tc.height = fh;
        const tctx = tc.getContext('2d')!;
        tctx.clearRect(0, 0, fw, fh);
        tctx.drawImage(img, actualSrcX, actualSrcY, fw, fh, 0, 0, fw, fh);
        // Apply color multiply
        const parts = colorMod.split(',').map(Number);
        const r = (parts[0] ?? 255) / 255;
        const g = (parts[1] ?? 255) / 255;
        const b = (parts[2] ?? 255) / 255;
        const imageData = tctx.getImageData(0, 0, fw, fh);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.round(d[i] * r);
          d[i + 1] = Math.round(d[i + 1] * g);
          d[i + 2] = Math.round(d[i + 2] * b);
        }
        tctx.putImageData(imageData, 0, 0);
        ctx.drawImage(tc, 0, 0, fw, fh, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(img, actualSrcX, actualSrcY, fw, fh, 0, 0, canvas.width, canvas.height);
      }
    } else if (frameIdx === 0 && direction === 0) {
      // Fallback: draw full image scaled (invalid frame settings)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
  }, [frameW, frameH, direction, alphaMod, blendMode, colorMod, needsTint]);

  // Animation loop
  useEffect(() => {
    if (!loaded || !playing || frameCount <= 1) {
      // Draw static frame
      if (loaded) drawFrame(frameIndexRef.current);
      return;
    }

    const perFrameMs = durationMs / frameCount;

    const tick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      elapsedRef.current += delta;

      if (elapsedRef.current >= perFrameMs) {
        elapsedRef.current -= perFrameMs;
        let idx = frameIndexRef.current;

        if (animType === 'looped') {
          idx = (idx + 1) % frameCount;
        } else if (animType === 'play_once') {
          if (idx < frameCount - 1) idx++;
        } else if (animType === 'back_forth') {
          if (!reverseRef.current) {
            if (idx >= frameCount - 1) { reverseRef.current = true; idx--; }
            else idx++;
          } else {
            if (idx <= 0) { reverseRef.current = false; idx++; }
            else idx--;
          }
        }

        frameIndexRef.current = idx;
        setCurrentFrame(idx);
      }

      drawFrame(frameIndexRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [loaded, playing, frameCount, durationMs, animType, drawFrame]);

  // Redraw when props change while paused
  useEffect(() => {
    if (loaded && !playing) {
      // Clamp frame index if frameCount changed
      if (frameIndexRef.current >= frameCount) {
        frameIndexRef.current = 0;
        setCurrentFrame(0);
      }
      drawFrame(frameIndexRef.current);
    }
  }, [loaded, playing, frameW, frameH, direction, alphaMod, blendMode, colorMod, frameCount, drawFrame]);

  if (!tilesetPath) {
    return (
      <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/50 bg-muted/30" style={{ width: MAX_PREVIEW, height: MAX_PREVIEW }}>
        <Image className="w-6 h-6 text-muted-foreground/30 mb-1" />
        <span className="text-[10px] text-muted-foreground/60 text-center px-2">Import Tileset to See Preview</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground italic">
        Preview unavailable
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground">
        Loading…
      </div>
    );
  }

  const showControls = frameCount > 1;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="rounded border border-border/50"
        style={{ imageRendering: 'pixelated' }}
      />
      {showControls && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {currentFrame + 1}/{frameCount}
          </span>
        </div>
      )}
    </div>
  );
};

export default AnimationPreview;
