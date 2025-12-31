import { useEffect } from 'react';
import useEditorState from './useEditorState';
import type { MutableRefObject } from 'react';

export default function useEditorSetup(editorOptsRef: MutableRefObject<Record<string, unknown> | null>) {
  const editorState = useEditorState(editorOptsRef);

  const { syncMapObjectsRef, updateLayersListRef, syncMapObjects, updateLayersList } = editorState;

  useEffect(() => {
    syncMapObjectsRef.current = syncMapObjects;
  }, [syncMapObjects, syncMapObjectsRef]);

  useEffect(() => {
    updateLayersListRef.current = updateLayersList;
  }, [updateLayersList, updateLayersListRef]);

  return editorState;
}
