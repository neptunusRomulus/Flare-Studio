/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';

export default function useEditorOptionsRef<T extends Record<string, unknown>>(editorOptsRef: React.MutableRefObject<T | null>, opts: T, deps: React.DependencyList) {
  // deps intentionally provided by caller to avoid object-reference churn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    editorOptsRef.current = opts;
  }, deps);
}
