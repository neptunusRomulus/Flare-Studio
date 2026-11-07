import React, { useMemo } from 'react';
import { InlineChoice, topCenterAnchor } from '@/components/ui/inline-confirm';

interface SessionRecoveryDialogProps {
  isOpen: boolean;
  mapName: string | null;
  crashTime: string | null;
  timeSinceCrash: string | null;
  isRecovering: boolean;
  error: string | null;
  onRecover: () => Promise<void>;
  onDismiss: () => void;
}

/**
 * Startup crash recovery as a small choice card at the top of the window.
 * Doesn't block the rest of the UI and isn't dismissed by outside clicks or Escape.
 */
const SessionRecoveryDialog: React.FC<SessionRecoveryDialogProps> = ({
  isOpen, mapName, timeSinceCrash, isRecovering, error, onRecover, onDismiss,
}) => {
  const anchor = useMemo(() => topCenterAnchor(), [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isOpen) return null;

  if (error) {
    return (
      <InlineChoice
        anchor={anchor}
        side="bottom"
        title="Recovery failed"
        detail={error}
        options={[{ id: 'close', label: 'Close', primary: true }]}
        onChoose={onDismiss}
      />
    );
  }

  const detail = [mapName, timeSinceCrash].filter(Boolean).join(' · ') || undefined;
  return (
    <InlineChoice
      anchor={anchor}
      side="bottom"
      title={isRecovering ? 'Recovering…' : 'Recover last session?'}
      detail={detail}
      busy={isRecovering}
      options={[
        { id: 'recover', label: 'Recover', primary: true },
        { id: 'fresh', label: 'Start fresh' },
      ]}
      onChoose={(id) => {
        if (id === 'recover') {
          onRecover().catch((err) => console.error('Recovery failed:', err));
        } else {
          onDismiss();
        }
      }}
    />
  );
};

export default SessionRecoveryDialog;
