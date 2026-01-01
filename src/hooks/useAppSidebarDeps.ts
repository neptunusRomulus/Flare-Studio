import useEditorRefs from './useEditorRefs';
import useEditorSetup from './useEditorSetup';

export default function useAppSidebarDeps(): { sidebarDeps: Record<string, unknown> } {
  const editorRefs = useEditorRefs();
  const editorSetup = useEditorSetup(editorRefs.editorOptsRef);

  const sidebarDeps: Record<string, unknown> = {
    editor: (editorSetup as unknown as Record<string, unknown>)['editor'],
    tabs: []
  };

  return { sidebarDeps };
}
