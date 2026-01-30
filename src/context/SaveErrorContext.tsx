import React, { createContext, useCallback, useState } from 'react';

export interface SaveError {
  id: string;
  message: string;
  code?: string;
  timestamp: number;
  context?: {
    filePath?: string;
    operationType?: 'manual' | 'auto' | 'coordination' | 'serialization';
    retryCount?: number;
    isResolved?: boolean;
  };
}

interface SaveErrorContextType {
  errors: SaveError[];
  addError: (error: Omit<SaveError, 'id' | 'timestamp'>) => string;
  dismissError: (errorId: string) => void;
  clearAllErrors: () => void;
  markErrorResolved: (errorId: string) => void;
  hasUnresolvedErrors: boolean;
  getErrorCount: () => number;
  getUnresolvedErrorCount: () => number;
}

const SaveErrorContext = createContext<SaveErrorContextType | undefined>(undefined);

export function SaveErrorProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<SaveError[]>([]);

  const addError = useCallback((error: Omit<SaveError, 'id' | 'timestamp'>): string => {
    const id = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newError: SaveError = {
      ...error,
      id,
      timestamp: Date.now(),
      context: {
        ...error.context,
        isResolved: false
      }
    };

    console.error(`[SaveError] Error added:`, newError);

    setErrors((prev) => {
      // Prevent duplicate errors within 5 seconds
      const recentDuplicate = prev.some(
        (e) =>
          e.message === newError.message &&
          Date.now() - e.timestamp < 5000 &&
          !e.context?.isResolved
      );

      if (recentDuplicate) {
        console.warn('[SaveError] Duplicate error suppressed');
        return prev;
      }

      return [...prev, newError];
    });

    return id;
  }, []);

  const dismissError = useCallback((errorId: string) => {
    console.log(`[SaveError] Dismissing error: ${errorId}`);
    setErrors((prev) => prev.filter((e) => e.id !== errorId));
  }, []);

  const clearAllErrors = useCallback(() => {
    console.log(`[SaveError] Clearing all errors`);
    setErrors([]);
  }, []);

  const markErrorResolved = useCallback((errorId: string) => {
    console.log(`[SaveError] Marking error resolved: ${errorId}`);
    setErrors((prev) =>
      prev.map((e) =>
        e.id === errorId
          ? {
              ...e,
              context: { ...e.context, isResolved: true }
            }
          : e
      )
    );
  }, []);

  const hasUnresolvedErrors = errors.some((e) => !e.context?.isResolved);
  const getErrorCount = () => errors.length;
  const getUnresolvedErrorCount = () =>
    errors.filter((e) => !e.context?.isResolved).length;

  return (
    <SaveErrorContext.Provider
      value={{
        errors,
        addError,
        dismissError,
        clearAllErrors,
        markErrorResolved,
        hasUnresolvedErrors,
        getErrorCount,
        getUnresolvedErrorCount
      }}
    >
      {children}
    </SaveErrorContext.Provider>
  );
}

export function useSaveError() {
  const context = React.useContext(SaveErrorContext);
  if (!context) {
    throw new Error('useSaveError must be used within SaveErrorProvider');
  }
  return context;
}
