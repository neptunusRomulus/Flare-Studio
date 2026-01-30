import React, { createContext, useContext, useCallback, useState, useRef } from 'react';

/**
 * Conflict Resolution Context
 * 
 * Manages user prompts and decisions when file conflicts are detected
 * Prevents data loss by requiring explicit user action before overwriting external changes
 * 
 * Resolution strategies:
 * 1. RELOAD_EXTERNAL - Discard app changes, reload file from disk
 * 2. KEEP_APP_VERSION - Keep app version, overwrite external changes (use with caution)
 * 3. CANCEL - Cancel save operation entirely
 * 4. MERGE - Request merge of changes (future: could implement 3-way merge)
 */

export type ConflictResolution = 'reload' | 'keep_app' | 'cancel' | 'merge';

export interface ConflictPromptData {
  filePath: string;
  reason: string;
  severity: 'warning' | 'critical';
  conflictingFiles?: string[];
}

export interface ConflictResolutionContextType {
  // Current conflict prompt state
  isPromptVisible: boolean;
  currentConflict: ConflictPromptData | null;

  // Show conflict prompt to user
  showConflictPrompt: (conflict: ConflictPromptData) => Promise<ConflictResolution>;

  // Hide prompt (called after resolution)
  hideConflictPrompt: () => void;

  // Resolve current conflict
  resolveConflict: (resolution: ConflictResolution) => void;

  // Stats for debugging
  getConflictStats: () => {
    totalConflicts: number;
    lastConflictTime: number | null;
    resolutionHistory: Array<{
      filePath: string;
      resolution: ConflictResolution;
      timestamp: number;
    }>;
  };
}

const ConflictResolutionContext = createContext<ConflictResolutionContextType | undefined>(undefined);

/**
 * Provider component for conflict resolution
 * Wraps application to provide conflict handling throughout component tree
 */
export function ConflictResolutionProvider({ children }: { children: React.ReactNode }) {
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<ConflictPromptData | null>(null);

  const pendingResolutionRef = useRef<{
    resolve: (resolution: ConflictResolution) => void;
    reject: (reason?: unknown) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
  } | null>(null);

  const resolutionHistoryRef = useRef<Array<{
    filePath: string;
    resolution: ConflictResolution;
    timestamp: number;
  }>>([]);

  const conflictCounterRef = useRef(0);

  /**
   * Show conflict prompt to user and wait for resolution
   */
  const showConflictPrompt = useCallback((conflict: ConflictPromptData): Promise<ConflictResolution> => {
    return new Promise((resolve, reject) => {
      conflictCounterRef.current++;

      console.log(
        `[ConflictResolution] Showing conflict prompt #${conflictCounterRef.current}`,
        { filePath: conflict.filePath, severity: conflict.severity }
      );

      setCurrentConflict(conflict);
      setIsPromptVisible(true);

      const timeoutId = setTimeout(() => {
        console.warn(`[ConflictResolution] Prompt timeout for ${conflict.filePath}, auto-canceling`);
        if (pendingResolutionRef.current) {
          pendingResolutionRef.current.resolve('cancel');
        }
      }, 5 * 60 * 1000);

      pendingResolutionRef.current = {
        resolve: (resolution: ConflictResolution) => {
          console.log(`[ConflictResolution] User chose: ${resolution} for ${conflict.filePath}`);
          
          // Record in history
          resolutionHistoryRef.current.push({
            filePath: conflict.filePath,
            resolution,
            timestamp: Date.now()
          });

          // Keep history to last 50 conflicts
          if (resolutionHistoryRef.current.length > 50) {
            resolutionHistoryRef.current.shift();
          }

          // Clear timeout if still pending
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          resolve(resolution);
        },
        reject,
        timeoutId
      };
    });
  }, []);

  /**
   * Hide the conflict prompt
   */
  const hideConflictPrompt = useCallback(() => {
    setIsPromptVisible(false);
    setCurrentConflict(null);

    if (pendingResolutionRef.current?.timeoutId) {
      clearTimeout(pendingResolutionRef.current.timeoutId);
    }
  }, []);

  /**
   * Resolve the current conflict with user's choice
   */
  const resolveConflict = useCallback((resolution: ConflictResolution) => {
    if (!pendingResolutionRef.current) {
      console.warn('[ConflictResolution] No pending conflict to resolve');
      return;
    }

    pendingResolutionRef.current.resolve(resolution);
    pendingResolutionRef.current = null;
    hideConflictPrompt();
  }, [hideConflictPrompt]);

  /**
   * Get conflict statistics for debugging
   */
  const getConflictStats = useCallback(() => {
    return {
      totalConflicts: conflictCounterRef.current,
      lastConflictTime: resolutionHistoryRef.current.length > 0
        ? resolutionHistoryRef.current[resolutionHistoryRef.current.length - 1].timestamp
        : null,
      resolutionHistory: [...resolutionHistoryRef.current]
    };
  }, []);

  const value: ConflictResolutionContextType = {
    isPromptVisible,
    currentConflict,
    showConflictPrompt,
    hideConflictPrompt,
    resolveConflict,
    getConflictStats
  };

  return (
    <ConflictResolutionContext.Provider value={value}>
      {children}
    </ConflictResolutionContext.Provider>
  );
}

/**
 * Hook to use conflict resolution context
 */
export function useConflictResolution() {
  const context = useContext(ConflictResolutionContext);
  if (!context) {
    throw new Error(
      'useConflictResolution must be used within ConflictResolutionProvider'
    );
  }
  return context;
}
