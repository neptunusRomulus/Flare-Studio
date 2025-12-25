import React from 'react';
import EditEnemyWindow from '@/components/EditEnemyWindow';
import type { MapObject } from '@/types';

interface EnemyTabPanelProps {
  enemy?: MapObject | null;
  onSave?: (updated: MapObject) => void;
  showCloseConfirm?: boolean;
  onCloseDecision?: (decision: 'save' | 'discard' | 'cancel') => void;
}

export default function EnemyTabPanel({ enemy, onSave, showCloseConfirm = false, onCloseDecision }: EnemyTabPanelProps) {
  if (!enemy) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
        Select an enemy to edit.
      </div>
    );
  }

  return (
    <div className="h-full">
      <EditEnemyWindow
        open
        inline
        enemy={enemy}
        onSave={onSave}
        showCloseConfirm={showCloseConfirm}
        onCloseDecision={onCloseDecision}
      />
    </div>
  );
}
