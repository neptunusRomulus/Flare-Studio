import { useMemo } from 'react';

export default function useSidebarDeps(params: Record<string, unknown>) {
  return useMemo(() => params, [params]);
}
