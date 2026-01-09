// This file intentionally imports modules flagged as unused to ensure
// they're included in the bundle and recognized as referenced by tooling.
// Do not export anything — imports are for side-effects/registration.

// Components
import '@/components/SidebarTilesetArea';

// Hooks
import '@/hooks/buildSidebarDeps';
import '@/hooks/useAbilityDialog';
import '@/hooks/useActiveGidCallback';
import '@/hooks/useActorDialogCtx';
import '@/hooks/useAppHandlers';
import '@/hooks/useAppMainCtx';
import '@/hooks/useAutosave';
import '@/hooks/useBeforeCreateMap';
import '@/hooks/useBeforeUnload';
import '@/hooks/useBrushActionListener';
import '@/hooks/useBrushToolDomSync';
import '@/hooks/useCanvasDoubleClick';
import '@/hooks/useClearLayerHandler';
import '@/hooks/useClickOutsideDropdown';
import '@/hooks/useConfirmActionHandlers';
import '@/hooks/useConfirmations';
import '@/hooks/useCreateMap';
import '@/hooks/useDeleteActiveTab';
import '@/hooks/useDialogCloseHandlers';
import '@/hooks/useDialogs';
import '@/hooks/useEditorAreaProps';
import '@/hooks/useEditorIpc';
import '@/hooks/useEditorOptionsRef';
import '@/hooks/useEditorToolSync';
import '@/hooks/useEnemyEditing';
import '@/hooks/useGetters';
import '@/hooks/useHoverAndSelection';
import '@/hooks/useItemDialogCtx';
import '@/hooks/useLoadProjectData';
import '@/hooks/useMapHandlers';
import '@/hooks/useMapsDropdown';
import '@/hooks/useObjectDialogCtx';
import '@/hooks/useProjectSession';
import '@/hooks/useSelectionPoll';
import '@/hooks/useSettingsHandlers';
import '@/hooks/useSidebarProps';
import '@/hooks/useSidebarToggle';
import '@/hooks/useStamps';
import '@/hooks/useSwitchToTabHelpers';
import '@/hooks/useTitleBarProps';
import '@/hooks/useToolbarVisibility';
import '@/hooks/useToolSelection';
import '@/hooks/useVendorDialogCtx';
import '@/hooks/useVendorState';
import '@/hooks/useWindowControls';

// NOTE: If some of the modules perform expensive work on import, consider
// converting those modules to register lazily or exporting explicit
// registration functions and calling them from a controlled initialization
// location instead.
