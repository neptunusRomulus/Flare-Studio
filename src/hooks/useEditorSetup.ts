import useEditorState from './useEditorState';
import type { MutableRefObject } from 'react';

export default function useEditorSetup(editorOptsRef: MutableRefObject<Record<string, unknown> | null>) {
  return useEditorState(editorOptsRef);
}
