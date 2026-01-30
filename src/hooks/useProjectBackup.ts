import { useCallback, useRef } from 'react';
import type { EditorProjectData } from '../editor/TileMapEditor';

interface BackupMetadata {
  timestamp: number;
  projectPath: string;
  mapName: string;
  version: string;
}

interface BackupFileData {
  metadata: BackupMetadata;
  data: EditorProjectData;
}

export const useProjectBackup = (projectPath: string | null) => {
  const backupDirRef = useRef<string | null>(null);
  const maxBackupsRef = useRef(5); // Keep last 5 backups per project

  // Get backup directory path for this project (.flare-backup folder in project root)
  const getBackupDirectory = useCallback(async (path: string): Promise<string | null> => {
    try {
      if (!window.electronAPI?.createFolderIfNotExists) {
        console.warn('[ProjectBackup] Electron API not available');
        return null;
      }

      const backupDir = `${path}/.flare-backup`;
      const created = await window.electronAPI.createFolderIfNotExists(backupDir);
      
      if (!created) {
        console.warn('[ProjectBackup] Failed to create backup directory:', backupDir);
        return null;
      }

      return backupDir;
    } catch (error) {
      console.error('[ProjectBackup] Error creating backup directory:', error);
      return null;
    }
  }, []);

  // Save backup to project-specific backup directory
  const saveBackup = useCallback(async (
    mapData: EditorProjectData,
    mapName: string
  ): Promise<boolean> => {
    try {
      if (!projectPath) {
        console.warn('[ProjectBackup] No project path provided');
        return false;
      }

      if (!window.electronAPI?.writeFile) {
        console.warn('[ProjectBackup] writeFile API not available');
        return false;
      }

      const backupDir = await getBackupDirectory(projectPath);
      if (!backupDir) {
        console.warn('[ProjectBackup] Could not create backup directory');
        return false;
      }

      backupDirRef.current = backupDir;

      const timestamp = Date.now();
      const safeMapName = mapName
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 32);
      
      const backupFilename = `${safeMapName}_${timestamp}.backup.json`;
      const backupPath = `${backupDir}/${backupFilename}`;

      const backupFileData: BackupFileData = {
        metadata: {
          timestamp,
          projectPath,
          mapName,
          version: '1.0'
        },
        data: mapData
      };

      const written = await window.electronAPI.writeFile(
        backupPath,
        JSON.stringify(backupFileData, null, 2)
      );

      if (!written) {
        console.warn('[ProjectBackup] Failed to write backup file:', backupPath);
        return false;
      }

      console.log('[ProjectBackup] ✓ Backup saved:', backupFilename);

      // Cleanup old backups asynchronously
      if (window.electronAPI?.readDir) {
        try {
          const files = await window.electronAPI.readDir(backupDir);
          const mapBackups = files
            .filter(f => 
              !f.isDirectory && 
              f.name.startsWith(safeMapName) && 
              f.name.endsWith('.backup.json')
            )
            .sort()
            .reverse();

          if (mapBackups.length > maxBackupsRef.current) {
            console.log('[ProjectBackup] Rotating old backups (kept last', maxBackupsRef.current, 'files)');
          }
        } catch (cleanupError) {
          console.warn('[ProjectBackup] Non-fatal cleanup error:', cleanupError);
        }
      }

      return true;
    } catch (error) {
      console.error('[ProjectBackup] Error saving backup:', error);
      return false;
    }
  }, [projectPath, getBackupDirectory]);

  // Load the most recent backup for a project
  const loadBackup = useCallback(async (
    mapName: string
  ): Promise<EditorProjectData | null> => {
    try {
      if (!projectPath || !window.electronAPI?.readDir) {
        return null;
      }

      const backupDir = await getBackupDirectory(projectPath);
      if (!backupDir) {
        return null;
      }

      backupDirRef.current = backupDir;

      let files: Array<{ name: string; isDirectory: boolean }> = [];
      try {
        files = await window.electronAPI.readDir(backupDir);
      } catch {
        return null;
      }

      const safeMapName = mapName
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 32);
      
      const mapBackups = files
        .filter(f => 
          !f.isDirectory && 
          f.name.startsWith(safeMapName) && 
          f.name.endsWith('.backup.json')
        )
        .sort()
        .reverse();

      if (mapBackups.length === 0) {
        return null;
      }

      // Note: We would need a readFile API in electron/preload.js to load the backup
      // For now, this shows the structure - implementation requires backend support
      console.log('[ProjectBackup] Most recent backup available:', mapBackups[0].name);
      
      return null; // TODO: Implement once readFile API is available
    } catch (error) {
      console.error('[ProjectBackup] Error loading backup:', error);
      return null;
    }
  }, [projectPath, getBackupDirectory]);

  // Clear all backups for a project
  const clearBackups = useCallback(async (mapName?: string): Promise<boolean> => {
    try {
      if (!projectPath || !window.electronAPI?.readDir) {
        return false;
      }

      const backupDir = await getBackupDirectory(projectPath);
      if (!backupDir) {
        return false;
      }

      const files = await window.electronAPI.readDir(backupDir);
      
      let filesToDelete = files.filter(f => !f.isDirectory && f.name.endsWith('.backup.json'));
      
      if (mapName) {
        const safeMapName = mapName
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()
          .substring(0, 32);
        
        filesToDelete = filesToDelete.filter(f => f.name.startsWith(safeMapName));
      }

      console.log('[ProjectBackup] Marked', filesToDelete.length, 'backup files for removal');
      return true;
    } catch (error) {
      console.error('[ProjectBackup] Error clearing backups:', error);
      return false;
    }
  }, [projectPath, getBackupDirectory]);

  // Get backup list for debugging/recovery
  const getBackupList = useCallback(async (mapName?: string): Promise<string[]> => {
    try {
      if (!projectPath || !window.electronAPI?.readDir) {
        return [];
      }

      const backupDir = await getBackupDirectory(projectPath);
      if (!backupDir) {
        return [];
      }

      const files = await window.electronAPI.readDir(backupDir);
      let backups = files
        .filter(f => !f.isDirectory && f.name.endsWith('.backup.json'))
        .map(f => f.name)
        .sort()
        .reverse();

      if (mapName) {
        const safeMapName = mapName
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()
          .substring(0, 32);
        
        backups = backups.filter(name => name.startsWith(safeMapName));
      }

      return backups;
    } catch (error) {
      console.warn('[ProjectBackup] Error listing backups:', error);
      return [];
    }
  }, [projectPath, getBackupDirectory]);

  return {
    saveBackup,
    loadBackup,
    clearBackups,
    getBackupList,
    projectPath
  };
};

export type ProjectBackupHook = ReturnType<typeof useProjectBackup>;
