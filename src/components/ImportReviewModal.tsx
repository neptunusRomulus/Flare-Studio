import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { AssetRecord, TilesetProfile } from '@/types';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';

type AssetOriginPreset =
  | 'top-left'
  | 'top-center'
  | 'center'
  | 'bottom-left'
  | 'bottom-center';

export interface ImportReviewModalProps {
  isOpen: boolean;
  tilesetFileName: string;
  detectedAssets: Array<{
    gid: number;
    sourceX: number;
    sourceY: number;
    width: number;
    height: number;
    confidence?: number; // 0-1
  }>;
  onConfirm: (
    profile: TilesetProfile,
    options?: { tileWidth: number; tileHeight: number; originPreset: AssetOriginPreset }
  ) => void;
  onCancel: () => void;
  onEditAsset?: (gid: number) => void;
  onOriginChange?: (originPreset: AssetOriginPreset) => void;
  defaultOriginPreset?: AssetOriginPreset;
}

/**
 * ImportReviewModal: Shows detected assets from tileset import for user review
 * Allows confirming asset definitions, editing anchors/footprints, or canceling
 */
// Fixed isometric tile dimensions — not user-configurable
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

export const ImportReviewModal: React.FC<ImportReviewModalProps> = ({
  isOpen,
  tilesetFileName,
  detectedAssets,
  onConfirm,
  onCancel,
  onOriginChange,
  defaultOriginPreset = 'bottom-center'
}) => {
  const tileWidth = TILE_WIDTH;
  const tileHeight = TILE_HEIGHT;
  const [originPreset, setOriginPreset] = React.useState<AssetOriginPreset>(defaultOriginPreset);

  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'import_review', initialWidth: 900, initialHeight: 700, minWidth: 600, minHeight: 500 });

  const lowConfidenceAssets = detectedAssets.filter(a => (a.confidence ?? 1) < 0.8);
  const totalAssets = detectedAssets.length;

  React.useEffect(() => {
    if (!isOpen) return;
    setOriginPreset(defaultOriginPreset);
  }, [isOpen, defaultOriginPreset]);

  const resolveOrigin = (
    asset: { sourceX: number; sourceY: number; width: number; height: number },
    preset: AssetOriginPreset
  ) => {
    switch (preset) {
      case 'top-left':
        return { originX: asset.sourceX, originY: asset.sourceY };
      case 'top-center':
        return { originX: asset.sourceX + Math.floor(asset.width / 2), originY: asset.sourceY };
      case 'center':
        return {
          originX: asset.sourceX + Math.floor(asset.width / 2),
          originY: asset.sourceY + Math.floor(asset.height / 2)
        };
      case 'bottom-left':
        return { originX: asset.sourceX, originY: asset.sourceY + asset.height };
      case 'bottom-center':
      default:
        return { originX: asset.sourceX + Math.floor(asset.width / 2), originY: asset.sourceY + asset.height };
    }
  };

  const handleOriginChange = (value: AssetOriginPreset) => {
    setOriginPreset(value);
    onOriginChange?.(value);
  };

  const handleConfirm = () => {
    const profile: TilesetProfile = {
      id: `profile_${Date.now()}`,
      tilesetFileName,
      assets: detectedAssets.map((asset, idx) => ({
        ...resolveOrigin(asset, originPreset),
        id: `asset_${idx + 1}`,
        profileId: `profile_${Date.now()}`,
        name: `Asset ${idx + 1}`,
        sourceX: asset.sourceX,
        sourceY: asset.sourceY,
        width: asset.width,
        height: asset.height,
        anchorX: 1, // Default: 1x1 footprint
        anchorY: 1,
        footprintWidth: 1,
        footprintHeight: 1,
        category: 'ground', // Default: ground assets
        detectionConfidence: asset.confidence ?? 0.95,
        userVerified: true,
        createdAt: new Date().toISOString()
      })) as AssetRecord[],
      autoDetected: true,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    onConfirm(profile, { tileWidth, tileHeight, originPreset });
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg shadow-lg overflow-hidden flex flex-col relative"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 50,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close import review window"
        className="absolute top-3 right-3 h-7 w-7 text-lg leading-none text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
      <div 
        className="pb-3 px-6 pt-6 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold leading-none tracking-tight">Review Imported Tileset</h3>
            <div className="text-sm pt-1 text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="font-medium text-foreground">{tilesetFileName}</span>
              <span>•</span>
              <span>{totalAssets} assets detected</span>
              {lowConfidenceAssets.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-foreground font-medium">
                    {lowConfidenceAssets.length} low-confidence assets
                  </span>
                </>
              )}
            </span>
            </div>
          </div>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">
          {/* Fixed tile size info */}
          <div className="bg-muted/30 p-3 rounded-md border border-border">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Tile Size
              </label>
              <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border border-border text-foreground">
                {tileWidth}x{tileHeight}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fixed isometric grid. Use merge/separate tools to adjust tile boundaries after import.
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-muted/30 p-3 rounded-md border border-border space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Asset Origin</p>
              <div className="space-y-1">
                {[
                  { value: 'bottom-center', label: 'Bottom-Center (recommended)' },
                  { value: 'bottom-left', label: 'Bottom-Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'top-center', label: 'Top-Center' },
                  { value: 'top-left', label: 'Top-Left' }
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="asset-origin"
                      value={option.value}
                      checked={originPreset === option.value}
                      onChange={() => handleOriginChange(option.value as AssetOriginPreset)}
                      className="h-4 w-4"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {originPreset !== 'bottom-center' && (
                <p className="text-sm font-bold text-red-600">
                  Bottom-center is highly recommended for isometric maps. Change this value if you really know what you are doing.
                </p>
              )}
            </div>

            <div className="bg-muted/20 p-3 rounded-md border border-border">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Confirm to save this import profile. If tile boundaries look wrong, use the merge/separate tools to adjust them after import.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-end gap-3 pt-4 border-t px-6 pb-4">
          <Button 
            variant="default" 
            onClick={handleConfirm}
            className="h-9 w-9 p-0"
            aria-label="Confirm and Save Profile"
            title="Confirm and Save Profile"
          >
            ✓
          </Button>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
          title="Drag to resize"
        >
          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
        </div>
      </div>,
    document.body
  );
};

export default ImportReviewModal;
