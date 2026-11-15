/**
 * Empty project (no maps yet): the editor must still exist so left-side panels can render.
 * The right palette dock stays hidden until a map is open (see shouldShowRightSidebar).
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

/** Right palette dock: hidden in a fresh/empty project, and after the last open map is closed or deleted. */
export function shouldShowRightSidebar(s: { hasMap: boolean }): boolean {
  return s.hasMap;
}
