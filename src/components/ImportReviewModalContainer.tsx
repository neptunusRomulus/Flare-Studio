/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import ImportReviewModal from '@/components/ImportReviewModal';
import type { TilesetProfile } from '@/types';

type AssetOriginPreset = 'top-left' | 'top-center' | 'center' | 'bottom-left' | 'bottom-center';

type ImportReviewModalCtx = {
  showImportReview?: boolean;
  setShowImportReview?: (v: boolean) => void;
  importReviewData?: {
    tilesetFileName: string;
    detectedAssets: Array<{
      gid: number;
      sourceX: number;
      sourceY: number;
      width: number;
      height: number;
      confidence?: number;
    }>;
  } | null;
  importReviewOriginPreset?: AssetOriginPreset;
  setImportReviewData?: (data: any) => void;
  setImportReviewOriginPreset?: (originPreset: AssetOriginPreset) => void;
  handleImportReviewConfirm?: (
    profile: TilesetProfile,
    options?: { tileWidth: number; tileHeight: number; originPreset: AssetOriginPreset }
  ) => void;
  handleImportReviewCancel?: () => void;
};

export default function ImportReviewModalContainer({ ctx }: { ctx: unknown }) {
  const c = (ctx as any)?.dialogsCtx as ImportReviewModalCtx || {};

  return (
    <ImportReviewModal
      isOpen={c.showImportReview ?? false}
      tilesetFileName={c.importReviewData?.tilesetFileName ?? ''}
      detectedAssets={c.importReviewData?.detectedAssets ?? []}
      defaultOriginPreset={c.importReviewOriginPreset ?? 'bottom-center'}
      onConfirm={(profile: TilesetProfile, options?: { tileWidth: number; tileHeight: number; originPreset: AssetOriginPreset }) => {
        c.handleImportReviewConfirm?.(profile, options);
      }}
      onCancel={() => {
        c.handleImportReviewCancel?.();
      }}
      onOriginChange={(originPreset: AssetOriginPreset) => {
        c.setImportReviewOriginPreset?.(originPreset);
      }}
    />
  );
}
