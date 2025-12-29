import React, { useEffect } from 'react';

export default function useEditorOptionsRef<T extends Record<string, unknown>>(editorOptsRef: React.MutableRefObject<T | null>, opts: T, deps: React.DependencyList) {
  useEffect(() => {
    editorOptsRef.current = opts;
  // deps intentionally provided by caller to avoid object-reference churn
  }, deps);
}
