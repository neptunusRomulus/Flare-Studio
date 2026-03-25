import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
 * Session Recovery Dialog Component
 * 
 * Displays when app detects a crash from previous session.
 * Shows crash information and recovery options.
 * 
 * Features:
 * - Shows map name that was being edited
 * - Shows when crash occurred
 * - Option to recover from backup
 * - Option to start fresh (dismiss recovery)
 * - Shows error message if recovery fails
 */
const SessionRecoveryDialog: React.FC<SessionRecoveryDialogProps> = ({
  isOpen,
  mapName,
  crashTime,
  timeSinceCrash,
  isRecovering,
  error,
  onRecover,
  onDismiss
}) => {
  if (!isOpen) return null;

  const handleRecover = async () => {
    try {
      await onRecover();
    } catch (err) {
      console.error('Recovery failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-start gap-3 bg-card">
          <AlertTriangle className="w-5 h-5 text-foreground/80 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">App Crashed</h2>
            <p className="text-sm text-muted-foreground mt-1">
              We detected an unexpected crash. Would you like to recover your work?
            </p>
          </div>
          {!isRecovering && !error && (
            <button
              onClick={onDismiss}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-3">
          {/* Map Name */}
          {mapName && (
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Map
              </p>
              <p className="text-sm font-medium text-foreground mt-1">
                {mapName}
              </p>
            </div>
          )}

          {/* Crash Time */}
          {crashTime && timeSinceCrash && (
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Crash Time
              </p>
              <p className="text-sm font-medium text-foreground mt-1">
                {timeSinceCrash}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {crashTime}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-muted/40 border border-border rounded-xl p-3">
              <p className="text-sm text-foreground">
                <span className="font-semibold">Recovery Error: </span>
                {error}
              </p>
            </div>
          )}

          {/* Info Message */}
          {!isRecovering && !error && (
            <div className="bg-muted/40 border border-border rounded-xl p-3">
              <p className="text-sm text-muted-foreground">
                A backup of your work has been automatically saved. You can recover from the last known state or start fresh.
              </p>
            </div>
          )}

          {/* Recovering State */}
          {isRecovering && (
            <div className="bg-muted/40 border border-border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Recovering your session...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-card border-t border-border px-6 py-4 flex gap-3 justify-end">
          {!isRecovering && !error && (
            <>
              <Button
                onClick={onDismiss}
                variant="outline"
                disabled={isRecovering}
              >
                Start Fresh
              </Button>
              <Button
                onClick={handleRecover}
                disabled={isRecovering}
                className="rounded-xl"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Recover Session
              </Button>
            </>
          )}
          {(isRecovering || error) && (
            <Button
              onClick={onDismiss}
              disabled={isRecovering}
              variant="outline"
              className="rounded-xl"
            >
              {isRecovering ? 'Recovering...' : 'Close'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionRecoveryDialog;
