import { useMemo } from 'react';

/** Identity wrapper that keeps the caller's dependency-bag type. */
export default function useSidebarDeps<T>(params: T): T {
  return useMemo(() => params, [params]);
}
