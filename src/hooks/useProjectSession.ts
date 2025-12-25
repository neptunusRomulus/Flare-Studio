import { useEffect } from 'react';
import type { EditorTab } from './useEditorTabs';

type SessionOptions = {
  tabs: EditorTab[];
  activeTabId: string | null;
  currentProjectPath: string | null;
};

const useProjectSession = ({ tabs, activeTabId, currentProjectPath }: SessionOptions) => {
  useEffect(() => {
    const saveSession = async () => {
      if (!currentProjectPath || !window.electronAPI?.writeSession) return;
      if (tabs.length === 0) return;

      const normalizedProjectPath = currentProjectPath.replace(/\\/g, '/').toLowerCase();
      const projectTabs = tabs
        .filter(t => {
          const normalizedTabPath = t.projectPath?.replace(/\\/g, '/').toLowerCase() || '';
          return normalizedTabPath === normalizedProjectPath;
        })
        .map(t => ({
          id: t.id,
          name: t.name,
          projectPath: t.projectPath ?? undefined
        }));

      if (projectTabs.length === 0) return;

      const seenNames = new Set<string>();
      const uniqueTabs = projectTabs.filter(t => {
        const lowerName = t.name.toLowerCase();
        if (seenNames.has(lowerName)) {
          console.log('Session save: removing duplicate tab:', t.name);
          return false;
        }
        seenNames.add(lowerName);
        return true;
      });

      try {
        const validActiveTabId = activeTabId && uniqueTabs.some(t => t.id === activeTabId)
          ? activeTabId
          : (uniqueTabs.length > 0 ? uniqueTabs[0].id : null);
        const sessionData = {
          tabs: uniqueTabs,
          activeTabId: validActiveTabId,
          lastOpened: new Date().toISOString()
        };
        await window.electronAPI.writeSession(currentProjectPath, sessionData);
        console.log('Session saved to project:', currentProjectPath, uniqueTabs.length, 'tabs');
      } catch (e) {
        console.warn('Failed to save session to project:', e);
      }
    };

    void saveSession();
  }, [tabs, activeTabId, currentProjectPath]);
};

export default useProjectSession;
