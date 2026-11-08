import React, { useEffect, useState } from 'react';

type Props = {
  imagePath: string | null | undefined;
  alt: string;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
};

/** Loads a local absolute image path via Electron and shows a pixelated thumbnail. */
const NpcAssetThumb = ({ imagePath, alt, className = '', selected = false, onClick, title }: Props) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    if (!imagePath) return;
    if (imagePath.startsWith('data:')) {
      setSrc(imagePath);
      return;
    }
    const api = window.electronAPI;
    if (!api?.readFileAsDataURL) return;
    api.readFileAsDataURL(imagePath).then((url) => {
      if (!cancelled) setSrc(url || null);
    }).catch(() => {
      if (!cancelled) setSrc(null);
    });
    return () => { cancelled = true; };
  }, [imagePath]);

  const body = src ? (
    <img src={src} alt={alt} className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated' }} />
  ) : (
    <span className="text-[9px] text-muted-foreground/70 text-center px-1 leading-tight">{alt}</span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        title={title || alt}
        onClick={onClick}
        className={`flex items-center justify-center overflow-hidden rounded border bg-muted/40 transition-colors ${
          selected ? 'border-orange-500 ring-1 ring-orange-500/40' : 'border-border hover:border-foreground/40'
        } ${className}`}
      >
        {body}
      </button>
    );
  }

  return (
    <div title={title || alt} className={`flex items-center justify-center overflow-hidden rounded border border-border bg-muted/40 ${className}`}>
      {body}
    </div>
  );
};

export default NpcAssetThumb;
