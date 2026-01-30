'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, X, RotateCw } from 'lucide-react';
import { useSaveError } from '@/context/SaveErrorContext';
import type { SaveError } from '@/context/SaveErrorContext';

export interface SaveErrorNotificationPanelProps {
  position?: 'top' | 'bottom';
  maxHeight?: string;
  onRetry?: (errorId: string) => Promise<void>;
  autoCollapseMs?: number;
}

export default function SaveErrorNotificationPanel({
  position = 'bottom',
  maxHeight = 'max-h-96',
  onRetry,
  autoCollapseMs
}: SaveErrorNotificationPanelProps) {
  const { errors, dismissError, markErrorResolved } = useSaveError();
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [retrying, setRetrying] = React.useState<string | null>(null);

  const unresolvedErrors = useMemo(
    () => errors.filter((e) => !e.context?.isResolved),
    [errors]
  );

  // Auto-collapse after dismissing last error
  React.useEffect(() => {
    if (unresolvedErrors.length === 0 && isExpanded && autoCollapseMs) {
      const timer = setTimeout(() => setIsExpanded(false), autoCollapseMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [unresolvedErrors.length, isExpanded, autoCollapseMs]);

  const handleDismiss = (errorId: string) => {
    dismissError(errorId);
  };

  const handleRetry = async (error: SaveError) => {
    if (!onRetry) {
      console.warn('[SaveErrorPanel] No retry handler provided');
      return;
    }

    setRetrying(error.id);
    try {
      await onRetry(error.id);
      markErrorResolved(error.id);
      console.log('[SaveErrorPanel] Retry successful for error:', error.id);
    } catch (err) {
      console.error('[SaveErrorPanel] Retry failed:', err);
    } finally {
      setRetrying(null);
    }
  };

  if (unresolvedErrors.length === 0) {
    return null;
  }

  const positionClasses = position === 'top' ? 'top-0' : 'bottom-0';

  return (
    <div
      className={`fixed ${positionClasses} left-0 right-0 z-50 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 shadow-lg transition-all duration-200`}
    >
      <div className="max-w-full">
        {/* Header with toggle */}
        <div className="flex items-center justify-between px-4 py-3 bg-red-100 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-900 dark:text-red-100">
              {unresolvedErrors.length === 1
                ? '1 Save Error'
                : `${unresolvedErrors.length} Save Errors`}
            </span>
            <span className="text-xs text-red-700 dark:text-red-300 ml-2">
              (Unsaved changes at risk)
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 rounded transition-colors"
          >
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* Error list */}
        {isExpanded && (
          <div className={`${maxHeight} overflow-y-auto`}>
            {unresolvedErrors.map((error) => (
              <div
                key={error.id}
                className="px-4 py-3 border-b border-red-200 dark:border-red-800/50 last:border-b-0 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 break-words">
                      {error.message}
                    </h4>
                    {error.context?.filePath && (
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1 break-all">
                        File: {error.context.filePath}
                      </p>
                    )}
                    {error.context?.operationType && (
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1 capitalize">
                        Operation: {error.context.operationType}
                      </p>
                    )}
                    {error.context?.retryCount !== undefined && error.context.retryCount > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Retries: {error.context.retryCount}
                      </p>
                    )}
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0 mt-0.5">
                    {onRetry && (
                      <button
                        onClick={() => handleRetry(error)}
                        disabled={retrying === error.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 dark:bg-amber-700 dark:hover:bg-amber-600 dark:disabled:bg-amber-600/50 rounded transition-colors"
                      >
                        <RotateCw className={`w-3 h-3 ${retrying === error.id ? 'animate-spin' : ''}`} />
                        {retrying === error.id ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDismiss(error.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary footer */}
        {isExpanded && (
          <div className="px-4 py-2 bg-red-100/50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300 border-t border-red-200 dark:border-red-800">
            <strong>⚠️ Action Required:</strong> Save errors prevent file writes. Please retry or check file permissions.
          </div>
        )}
      </div>
    </div>
  );
}
