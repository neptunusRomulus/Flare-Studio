import useActorsSidebar, { ActorsSidebarParams } from './useActorsSidebar';
import useMapsSidebar from './useMapsSidebar';
import useTilesetSidebar, { TilesetSidebarParams } from './useTilesetSidebar';

export default function useAssembledSidebar(params: unknown) {
  const actorsResult = useActorsSidebar(params as ActorsSidebarParams);
  const maps = useMapsSidebar(params as Record<string, unknown>);
  const tilesetResult = useTilesetSidebar(params as TilesetSidebarParams);
  const paramsRecord = params as Record<string, unknown>;
  const events = paramsRecord['events'] as unknown;
  const layers = paramsRecord['layers'] as unknown;

  // `useActorsSidebar` returns an object containing `actors`, `rules`, and `items`.
  // Flatten those into the assembled sidebar top-level so callers (the main
  // builder) can read `sb['actors']`, `sb['rules']`, and `sb['items']` as
  // expected.
  // `useTilesetSidebar` returns `{ tileset: {...} }` so unwrap it.
  return {
    actors: actorsResult.actors,
    rules: actorsResult.rules,
    items: actorsResult.items,
    events,
    layers,
    maps,
    tileset: tilesetResult.tileset,
    // pass through any layers/controls provided via deps so the main builder
    // can merge them into the final sidebar context.
    layersObj: layers ?? actorsResult.layersObj ?? paramsRecord
  } as unknown as {
    actors: ReturnType<typeof useActorsSidebar>['actors'];
    rules: ReturnType<typeof useActorsSidebar>['rules'];
    items: ReturnType<typeof useActorsSidebar>['items'];
    events: unknown;
    layers: unknown;
    maps: ReturnType<typeof useMapsSidebar>;
    tileset: ReturnType<typeof useTilesetSidebar>['tileset'];
  };
}
