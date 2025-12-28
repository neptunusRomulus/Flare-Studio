import { useCallback } from 'react';
import type { EditorProjectData } from '@/editor/TileMapEditor';

export default function useGetters(args: {
  createTabForRef: React.RefObject<((name: string, projectPath: string | null, config: EditorProjectData) => void) | null>;
  beforeCreateMapRef: React.RefObject<(() => Promise<void>) | null>;
}) {
  const { createTabForRef, beforeCreateMapRef } = args;

  const getCreateTabFor = useCallback(() => createTabForRef.current, [createTabForRef]);
  const getBeforeCreateMap = useCallback(() => beforeCreateMapRef.current, [beforeCreateMapRef]);

  return { getCreateTabFor, getBeforeCreateMap };
}
