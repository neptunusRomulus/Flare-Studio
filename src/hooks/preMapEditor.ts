/**
 * Empty project (no maps yet): the editor must still exist so the sidebar and palette dock can render.
 * useEditorState's instantiation effect never re-runs when the Welcome screen closes (its deps don't include
 * showWelcome), so nothing created an editor for a project with no maps.
 */
export function shouldCreatePreMapEditor(s: {
  hasEditor: boolean; canvasMounted: boolean; showWelcome: boolean; isOpeningProject: boolean;
  hasPendingMapConfig: boolean; mapInitialized: boolean; projectPath: string | null | undefined;
}): boolean {
  return !s.hasEditor && s.canvasMounted && !s.showWelcome && !s.isOpeningProject
    && !s.hasPendingMapConfig && !s.mapInitialized && !!s.projectPath;
}

export function shouldShowPanels(s: { hasMap: boolean; hasEditor: boolean; projectPath: string | null | undefined }): boolean {
  return s.hasMap || (s.hasEditor && !!s.projectPath);
}
