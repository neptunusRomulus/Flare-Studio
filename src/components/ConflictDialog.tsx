import React, { useState } from 'react';
import { useConflictResolution, type ConflictResolution } from '@/context/ConflictResolutionContext';

/**
 * Conflict Resolution Dialog Component
 * 
 * Displays file conflict prompts to users when external modifications detected
 * Allows user to choose: Reload, Keep App, or Cancel
 * 
 * Shows:
 * - File path that has conflict
 * - Reason for conflict (e.g., "Modified 5 minutes ago externally")
 * - Severity level (warning or critical)
 * - Action buttons for each resolution
 * - Loading state while processing user choice
 */
export default function ConflictDialog() {
  const { isPromptVisible, currentConflict, resolveConflict } = useConflictResolution();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ConflictResolution | null>(null);

  if (!isPromptVisible || !currentConflict) {
    return null;
  }

  const handleAction = (action: ConflictResolution) => {
    setIsProcessing(true);
    setSelectedAction(action);
    
    // Small delay to show user their selection was received
    setTimeout(() => {
      resolveConflict(action);
      setIsProcessing(false);
      setSelectedAction(null);
    }, 200);
  };

  const isWarning = currentConflict.severity === 'warning';
  const isCritical = currentConflict.severity === 'critical';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isCritical && (
              <svg
                className="w-6 h-6 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {isWarning && (
              <svg
                className="w-6 h-6 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isCritical ? 'File Conflict Detected' : 'File Modification Warning'}
            </h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentConflict.reason}
          </p>
        </div>

        {/* File Path */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 space-y-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">FILE</p>
          <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
            {currentConflict.filePath}
          </p>
        </div>

        {/* Conflicting Files List (if multiple) */}
        {currentConflict.conflictingFiles && currentConflict.conflictingFiles.length > 1 && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {currentConflict.conflictingFiles.length} FILES AFFECTED
            </p>
            <ul className="space-y-1">
              {currentConflict.conflictingFiles.slice(0, 5).map((file) => (
                <li key={file} className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                  • {file}
                </li>
              ))}
              {currentConflict.conflictingFiles.length > 5 && (
                <li className="text-xs text-gray-600 dark:text-gray-400">
                  ... and {currentConflict.conflictingFiles.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Severity Info */}
        {isCritical && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Risk:</strong> The external changes may be lost if you choose &quot;Keep App&quot;. Consider reloading to preserve external modifications.
            </p>
          </div>
        )}

        {isWarning && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Files were recently modified externally. You can reload to get the latest version or keep your current changes.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-4">
          {/* Reload Button */}
          <button
            onClick={() => handleAction('reload')}
            disabled={isProcessing}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
          >
            {selectedAction === 'reload' && isProcessing && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>Reload External Version</span>
          </button>

          {/* Keep App Button */}
          <button
            onClick={() => handleAction('keep_app')}
            disabled={isProcessing}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
          >
            {selectedAction === 'keep_app' && isProcessing && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>Keep App Version</span>
          </button>

          {/* Cancel Button */}
          <button
            onClick={() => handleAction('cancel')}
            disabled={isProcessing}
            className="w-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
          >
            {selectedAction === 'cancel' && isProcessing && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>Cancel Save</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Tip:</strong> You have 5 minutes to make a choice. No response will auto-cancel the save operation.
          </p>
        </div>
      </div>
    </div>
  );
}
