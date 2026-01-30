import { useCallback, useRef } from 'react';

/**
 * File Conflict Detection Hook
 * 
 * Detects when files are modified externally while the app is open.
 * Prevents losing external changes on next save by:
 * 1. Tracking file timestamps at load time
 * 2. Checking timestamps before each save
 * 3. Alerting user if external modifications detected
 * 4. Allowing user to reload external version or proceed with caution
 * 
 * External modification scenarios:
 * - Git pull/merge changes files
 * - External editor modifies project files
 * - File sync service (Dropbox, OneDrive) updates file
 * - Developer manually edits files on disk
 */

export interface FileMetadata {
  filePath: string;
  lastModifiedTime: number;  // Timestamp when file was last read by app
  fileSize: number;           // File size for additional verification
  contentHash?: string;       // Optional: hash of content for additional verification
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictingFiles: string[];
  reason?: string;
  severity: 'none' | 'warning' | 'critical';
}

const DEFAULT_CHECK_TOLERANCE_MS = 1000; // Allow 1s tolerance for filesystem updates

export default function useFileConflictDetection() {
  /**
   * Map of file path -> FileMetadata
   * Tracks known file timestamps to detect external modifications
   */
  const fileMetadataRef = useRef<Map<string, FileMetadata>>(new Map());

  /**
   * Register a file as "loaded" by recording its current timestamp
   * Called when app loads a project/map file
   */
  const registerFileLoad = useCallback((filePath: string, fileSize: number, metadata?: {contentHash?: string}) => {
    if (!filePath) return;
    
    const nowMs = Date.now();
    fileMetadataRef.current.set(filePath, {
      filePath,
      lastModifiedTime: nowMs,
      fileSize,
      contentHash: metadata?.contentHash
    });
    
    console.log(`[FileConflict] Registered file load: ${filePath} (size: ${fileSize}B)`);
  }, []);

  /**
   * Register a successful file save
   * Updates the tracked metadata to match newly saved file
   */
  const registerFileSave = useCallback((filePath: string, fileSize: number, metadata?: {contentHash?: string}) => {
    if (!filePath) return;
    
    const nowMs = Date.now();
    fileMetadataRef.current.set(filePath, {
      filePath,
      lastModifiedTime: nowMs,
      fileSize,
      contentHash: metadata?.contentHash
    });
    
    console.log(`[FileConflict] Registered file save: ${filePath} (size: ${fileSize}B)`);
  }, []);

  /**
   * Check if a file has been modified externally since app loaded/saved it
   * 
   * Returns:
   * - ConflictDetectionResult with hasConflict = false if no conflict
   * - ConflictDetectionResult with hasConflict = true if external modification detected
   */
  const checkFileConflict = useCallback(
    async (
      filePath: string,
      currentFileSize: number,
      getCurrentFileStats?: () => Promise<{ modifiedTime: number; size: number } | null>,
      toleranceMs = DEFAULT_CHECK_TOLERANCE_MS
    ): Promise<ConflictDetectionResult> => {
      if (!filePath) {
        return {
          hasConflict: false,
          conflictingFiles: [],
          severity: 'none'
        };
      }

      const metadata = fileMetadataRef.current.get(filePath);
      if (!metadata) {
        // File not tracked yet (first save?)
        console.log(`[FileConflict] File not yet tracked: ${filePath}`);
        return {
          hasConflict: false,
          conflictingFiles: [],
          reason: 'File not tracked (first save)',
          severity: 'none'
        };
      }

      // Check file size as first indicator
      if (currentFileSize !== metadata.fileSize) {
        console.warn(`[FileConflict] File size mismatch for ${filePath}`);
        console.warn(`  - Tracked size: ${metadata.fileSize}B`);
        console.warn(`  - Current size: ${currentFileSize}B`);
        
        return {
          hasConflict: true,
          conflictingFiles: [filePath],
          reason: `File size changed externally (was ${metadata.fileSize}B, now ${currentFileSize}B). External modifications likely.`,
          severity: 'critical'
        };
      }

      // If provided, use actual filesystem check
      if (getCurrentFileStats && typeof getCurrentFileStats === 'function') {
        try {
          const stats = await getCurrentFileStats();
          if (!stats) {
            // Stats unavailable, skip conflict check
            return {
              hasConflict: false,
              conflictingFiles: [],
              reason: 'Could not verify file timestamps',
              severity: 'none'
            };
          }
          
          const currentModifiedTime = stats.modifiedTime;
          const trackedModifiedTime = metadata.lastModifiedTime;
          
          // Check if file was modified more recently than our last save
          const timeDiffMs = currentModifiedTime - trackedModifiedTime;
          
          if (timeDiffMs > toleranceMs) {
            console.warn(`[FileConflict] External modification detected for ${filePath}`);
            console.warn(`  - File modified ${timeDiffMs}ms after app's last save`);
            console.warn(`  - Tracked time: ${new Date(trackedModifiedTime).toISOString()}`);
            console.warn(`  - Current time: ${new Date(currentModifiedTime).toISOString()}`);
            
            return {
              hasConflict: true,
              conflictingFiles: [filePath],
              reason: `File was modified externally ${timeDiffMs}ms after last app save. Risk of losing external changes.`,
              severity: 'critical'
            };
          }
        } catch (err) {
          // If we can't read filesystem stats, log warning but don't block save
          console.warn(`[FileConflict] Could not read file stats for conflict check:`, err);
          return {
            hasConflict: false,
            conflictingFiles: [],
            reason: 'Could not verify file timestamps',
            severity: 'warning'
          };
        }
      }

      // No conflicts detected
      return {
        hasConflict: false,
        conflictingFiles: [],
        severity: 'none'
      };
    },
    []
  );

  /**
   * Batch check multiple files for conflicts
   */
  const checkMultipleFileConflicts = useCallback(
    async (
      files: Array<{
        filePath: string;
        currentSize: number;
        getStats?: () => Promise<{ modifiedTime: number; size: number }>;
      }>,
      toleranceMs = DEFAULT_CHECK_TOLERANCE_MS
    ): Promise<ConflictDetectionResult> => {
      const conflicts: string[] = [];
      let maxSeverity: 'none' | 'warning' | 'critical' = 'none';
      const reasons: string[] = [];

      for (const file of files) {
        const result = await checkFileConflict(
          file.filePath,
          file.currentSize,
          file.getStats,
          toleranceMs
        );

        if (result.hasConflict) {
          conflicts.push(file.filePath);
          reasons.push(result.reason || '');
          
          // Escalate severity
          if (result.severity === 'critical') {
            maxSeverity = 'critical';
          } else if (result.severity === 'warning' && maxSeverity !== 'critical') {
            maxSeverity = 'warning';
          }
        }
      }

      return {
        hasConflict: conflicts.length > 0,
        conflictingFiles: conflicts,
        reason: reasons.length > 0 ? reasons.join('\n') : undefined,
        severity: maxSeverity
      };
    },
    [checkFileConflict]
  );

  /**
   * Clear all tracked file metadata
   * Used when switching projects or clearing state
   */
  const clearTrackedFiles = useCallback(() => {
    fileMetadataRef.current.clear();
    console.log('[FileConflict] Cleared all tracked file metadata');
  }, []);

  /**
   * Get current tracking status for debugging
   */
  const getConflictDetectionStatus = useCallback(() => {
    const tracked: Record<string, FileMetadata> = {};
    fileMetadataRef.current.forEach((metadata, filePath) => {
      tracked[filePath] = metadata;
    });

    return {
      trackedFilesCount: fileMetadataRef.current.size,
      trackedFiles: tracked,
      enabledAt: 'app startup'
    };
  }, []);

  return {
    registerFileLoad,
    registerFileSave,
    checkFileConflict,
    checkMultipleFileConflicts,
    clearTrackedFiles,
    getConflictDetectionStatus
  } as const;
}
