import useActorsSidebar, { ActorsSidebarParams } from './useActorsSidebar';
import useMapsSidebar from './useMapsSidebar';
import useTilesetSidebar, { TilesetSidebarParams } from './useTilesetSidebar';

export default function useAssembledSidebar(params: unknown) {
  const actors = useActorsSidebar(params as ActorsSidebarParams);
  const maps = useMapsSidebar(params as Record<string, unknown>);
  const tileset = useTilesetSidebar(params as TilesetSidebarParams);

  return {
    actors,
    maps,
    tileset
  } as {
    actors: ReturnType<typeof useActorsSidebar>;
    maps: ReturnType<typeof useMapsSidebar>;
    tileset: ReturnType<typeof useTilesetSidebar>;
  };
}
