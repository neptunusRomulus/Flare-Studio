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
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-red-900 dark:text-red-100">App Crashed</h2>
            <p className="text-sm text-red-800 dark:text-red-200 mt-1">
              We detected an unexpected crash. Would you like to recover your work?
            </p>
          </div>
          {!isRecovering && !error && (
            <button
              onClick={onDismiss}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
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
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Map
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                {mapName}
              </p>
            </div>
          )}

          {/* Crash Time */}
          {crashTime && timeSinceCrash && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Crash Time
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                {timeSinceCrash}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {crashTime}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                <span className="font-semibold">Recovery Error: </span>
                {error}
              </p>
            </div>
          )}

          {/* Info Message */}
          {!isRecovering && !error && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                A backup of your work has been automatically saved. You can recover from the last known state or start fresh.
              </p>
            </div>
          )}

          {/* Recovering State */}
          {isRecovering && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Recovering your session...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-3 justify-end">
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
                className="bg-blue-600 hover:bg-blue-700 text-white"
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
              className="bg-slate-600 hover:bg-slate-700 text-white"
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
