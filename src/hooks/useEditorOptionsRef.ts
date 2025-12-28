import { useEffect } from 'react';

export default function useEditorOptionsRef<T extends Record<string, any>>(editorOptsRef: React.MutableRefObject<T | null>, opts: T, deps: any[]) {
  useEffect(() => {
    editorOptsRef.current = opts;
  // deps intentionally provided by caller to avoid object-reference churn
  }, deps);
}
