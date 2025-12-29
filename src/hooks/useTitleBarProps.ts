import type { EditorTab } from './useEditorTabs';

type Params = {
  tabs: EditorTab[];
  activeTabId: string | null;
  switchToTab: (tabId: string) => void | Promise<void>;
  setShowMapSettingsOnly: (b: boolean) => void;
  setPendingEnemyTabCloseId: (id: string | null) => void;
  setShowCreateMapDialog: (b: boolean) => void;
  saveStatus: 'saving' | 'saved' | 'error' | 'unsaved';
  lastSaveTime: number;
  handleMinimize: () => void;
  handleMaximize: () => void;
  handleClose: () => void;
  flareIconUrl: string;
};

export default function useTitleBarProps(params: Params) {
  const {
    tabs,
    activeTabId,
    switchToTab,
    setShowMapSettingsOnly,
    setPendingEnemyTabCloseId,
    setShowCreateMapDialog,
    saveStatus,
    lastSaveTime,
    handleMinimize,
    handleMaximize,
    handleClose,
    flareIconUrl
  } = params;

  return {
    tabs,
    activeTabId,
    onSwitchTab: (tabId: string) => { void switchToTab(tabId); },
    onOpenMapSettings: () => setShowMapSettingsOnly(true),
    onCloseEnemyTab: (tabId: string) => setPendingEnemyTabCloseId(tabId),
    onCreateNewMap: () => setShowCreateMapDialog(true),
    saveStatus,
    lastSaveTime,
    onMinimize: handleMinimize,
    onMaximize: handleMaximize,
    onClose: handleClose,
    flareIconUrl
  };
}
