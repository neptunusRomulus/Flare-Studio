import useActorsSidebar from './useActorsSidebar';
import useMapsSidebar from './useMapsSidebar';
import useTilesetSidebar from './useTilesetSidebar';

export default function useAssembledSidebar(params: any) {
  const actors = useActorsSidebar(params);
  const maps = useMapsSidebar(params);
  const tileset = useTilesetSidebar(params);

  return {
    actors,
    maps,
    tileset
  } as any;
}
