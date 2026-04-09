import useActorsSidebar, { ActorsSidebarParams } from './useActorsSidebar';
import useMapsSidebar from './useMapsSidebar';
import useTilesetSidebar, { TilesetSidebarParams } from './useTilesetSidebar';

export default function useAssembledSidebar(params: unknown) {
  const paramsRecord = params as Record<string, unknown>;
  
  // Extract nested objects that we've added
  const events = paramsRecord['events'] as unknown;
  const layersObj = paramsRecord['layers'] as unknown;
  
  // Extract and flatten actors data from the nested structure
  const actorsData = paramsRecord['actors'] as Record<string, unknown> | undefined;
  const rulesData = paramsRecord['rules'] as Record<string, unknown> | undefined;
  const itemsData = paramsRecord['items'] as Record<string, unknown> | undefined;
  
  // Flatten the nested structure for useActorsSidebar which expects flat params
  const flattenedParams: Partial<ActorsSidebarParams> = {
    isNpcLayer: actorsData?.['isNpcLayer'] as boolean | undefined,
    isEnemyLayer: actorsData?.['isEnemyLayer'] as boolean | undefined,
    actorEntries: actorsData?.['actorEntries'] as any | undefined,
    draggingNpcId: actorsData?.['draggingNpcId'] as number | null | undefined,
    handleEditObject: actorsData?.['handleEditObject'] as any | undefined,
    handleEditEnemyTemplate: actorsData?.['handleEditEnemyTemplate'] as any | undefined,
    handleDuplicateObject: actorsData?.['handleDuplicateObject'] as any | undefined,
    handleDeleteObject: actorsData?.['handleDeleteObject'] as any | undefined,
    handleReorderActors: actorsData?.['handleReorderActors'] as any | undefined,
    setNpcHoverTooltip: actorsData?.['setNpcHoverTooltip'] as any | undefined,
    handleNpcDragStart: actorsData?.['handleNpcDragStart'] as any | undefined,
    handleNpcDragEnd: actorsData?.['handleNpcDragEnd'] as any | undefined,
    handleOpenActorDialog: actorsData?.['handleOpenActorDialog'] as any | undefined,
    isRulesLayer: rulesData?.['isRulesLayer'] as boolean | undefined,
    rulesList: rulesData?.['rulesList'] as any | undefined,
    handleAddRule: rulesData?.['handleAddRule'] as any | undefined,
    isItemsLayer: itemsData?.['isItemsLayer'] as boolean | undefined,
    itemsList: itemsData?.['itemsList'] as any | undefined,
    expandedItemCategories: itemsData?.['expandedItemCategories'] as any | undefined,
    setExpandedItemCategories: itemsData?.['setExpandedItemCategories'] as any | undefined,
    handleOpenItemEdit: itemsData?.['handleOpenItemEdit'] as any | undefined,
    handleOpenItemDialog: itemsData?.['handleOpenItemDialog'] as any | undefined
  };
  
  const actorsResult = useActorsSidebar(flattenedParams);
  const maps = useMapsSidebar(params as Record<string, unknown>);
  const tilesetResult = useTilesetSidebar(params as TilesetSidebarParams);

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
    layers: layersObj,
    maps,
    tileset: tilesetResult.tileset,
    // pass through any layers/controls provided via deps so the main builder
    // can merge them into the final sidebar context.
    layersObj: layersObj ?? actorsResult.layersObj ?? paramsRecord
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
