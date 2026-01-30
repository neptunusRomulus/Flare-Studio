import { useCallback } from 'react';
import type { SaveError } from '@/context/SaveErrorContext';
import { useSaveError } from '@/context/SaveErrorContext';

export interface ErrorNotificationOptions {
  showNotification?: boolean;
  autoDismissMs?: number;
  retryCallback?: () => Promise<void>;
}

export default function useSaveErrorNotification() {
  const { addError, dismissError, markErrorResolved, errors } = useSaveError();

  const notifyError = useCallback(
    (message: string, options?: ErrorNotificationOptions & Omit<SaveError, 'id' | 'timestamp' | 'message'>) => {
      const { showNotification = true, autoDismissMs, ...errorData } = options || {};

      if (!showNotification) {
        console.error('[SaveErrorNotification]', message);
        return null;
      }

      const errorId = addError({
        message,
        code: errorData.code,
        context: {
          filePath: errorData.context?.filePath,
          operationType: errorData.context?.operationType,
          retryCount: errorData.context?.retryCount,
          isResolved: false
        }
      });

      // Auto-dismiss after specified time (if provided)
      if (autoDismissMs && autoDismissMs > 0) {
        setTimeout(() => {
          dismissError(errorId);
        }, autoDismissMs);
      }

      return errorId;
    },
    [addError, dismissError]
  );

  const notifyManualSaveError = useCallback(
    (message: string, filePath?: string, retryCount = 0) => {
      return notifyError(message, {
        code: 'MANUAL_SAVE_FAILED',
        context: {
          operationType: 'manual',
          filePath,
          retryCount
        }
      });
    },
    [notifyError]
  );

  const notifyAutoSaveError = useCallback(
    (message: string, filePath?: string, retryCount = 0) => {
      return notifyError(message, {
        code: 'AUTO_SAVE_FAILED',
        context: {
          operationType: 'auto',
          filePath,
          retryCount
        },
        showNotification: true
      });
    },
    [notifyError]
  );

  const notifyCoordinationError = useCallback(
    (message: string, details?: string) => {
      const fullMessage = details ? `${message}: ${details}` : message;
      return notifyError(fullMessage, {
        code: 'COORDINATION_FAILED',
        context: {
          operationType: 'coordination'
        }
      });
    },
    [notifyError]
  );

  const notifySerializationError = useCallback(
    (message: string, details?: string) => {
      const fullMessage = details ? `${message}: ${details}` : message;
      return notifyError(fullMessage, {
        code: 'SERIALIZATION_FAILED',
        context: {
          operationType: 'serialization'
        }
      });
    },
    [notifyError]
  );

  const resolveError = useCallback(
    (errorId: string | null) => {
      if (errorId) {
        markErrorResolved(errorId);
      }
    },
    [markErrorResolved]
  );

  const getLatestError = (): SaveError | undefined => {
    const unresolvedErrors = errors.filter(e => !e.context?.isResolved);
    return unresolvedErrors[unresolvedErrors.length - 1];
  };

  return {
    notifyError,
    notifyManualSaveError,
    notifyAutoSaveError,
    notifyCoordinationError,
    notifySerializationError,
    resolveError,
    dismissError,
    getLatestError,
    errors,
    hasErrors: errors.filter(e => !e.context?.isResolved).length > 0
  };
}
