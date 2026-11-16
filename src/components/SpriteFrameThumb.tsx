import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import NpcAssetThumb from '@/components/NpcAssetThumb';

export type SpriteFrameRect = { x: number; y: number; w: number; h: number };

type Props = {
  imagePath: string | null | undefined;
  /** Crop inside the sprite sheet (first stance frame). Without it the whole image is shown. */
  frame?: SpriteFrameRect | null;
  alt: string;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
};

const BOX = 96;

/** Cropped sprite-sheet thumbnail: enemy sheets are packed, so a frame reads better than the sheet. */
const SpriteFrameThumb = ({ imagePath, frame, alt, className = '', selected = false, onClick, title }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const useCrop = Boolean(imagePath && frame && frame.w > 0 && frame.h > 0);

  useEffect(() => {
    setReady(false);
    if (!useCrop || !imagePath) return;
    const api = window.electronAPI;
    if (!api?.readFileAsDataURL) return;
    let cancelled = false;
    api.readFileAsDataURL(imagePath).then((url) => {
      if (cancelled || !url) return;
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !frame) return;
        const scale = Math.min(BOX / frame.w, BOX / frame.h);
        const w = Math.max(1, Math.round(frame.w * scale));
        const h = Math.max(1, Math.round(frame.h * scale));
        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, w, h);
        setReady(true);
      };
      img.onerror = () => { if (!cancelled) setReady(false); };
      img.src = url;
    }).catch(() => { /* keep the label fallback */ });
    return () => { cancelled = true; };
  }, [imagePath, frame, useCrop]);

  if (!useCrop) {
    return (
      <NpcAssetThumb
        imagePath={imagePath}
        alt={alt}
        className={className}
        selected={selected}
        onClick={onClick}
        title={title}
      />
    );
  }

  const body = (
    <span className="flex h-full w-full items-center justify-center p-1">
      <canvas
        ref={canvasRef}
        aria-label={alt}
        role="img"
        className={`max-h-full max-w-full ${ready ? '' : 'hidden'}`}
        style={{ imageRendering: 'pixelated' }}
      />
      {!ready && <span className="text-[9px] text-muted-foreground/70 text-center px-1 leading-tight">{alt}</span>}
    </span>
  );

  if (onClick) {
    return (
      <Button
        type="button"
        variant="ghost"
        title={title || alt}
        onClick={onClick}
        className={`h-auto p-0 flex items-center justify-center overflow-hidden rounded border bg-muted/40 ${
          selected ? 'border-orange-500 ring-1 ring-orange-500/40' : 'border-border hover:border-foreground/40'
        } ${className}`}
      >
        {body}
      </Button>
    );
  }

  return (
    <div title={title || alt} className={`flex items-center justify-center overflow-hidden rounded border border-border bg-muted/40 ${className}`}>
      {body}
    </div>
  );
};

export default SpriteFrameThumb;
