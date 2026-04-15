import { useCallback, useRef, useState } from 'react';
import useEditorRefs from './useEditorRefs';
import useEditorSetup from './useEditorSetup';
import useLoadProjectData from './useLoadProjectData';
import usePreferences from './usePreferences';
import useDarkModeSync from './useDarkModeSync';
import useAppState from './useAppState';
import useToolbarState from './useToolbarState';
import useHelpState from './useHelpState';
import useItems from './useItems';
import useVendorState from './useVendorState';
import { normalizeItemsForState } from '@/utils/items';
import { toast } from '@/hooks/use-toast';
import type { TileMapEditor } from '@/editor/TileMapEditor';

export type ImportReviewData = {
  tilesetFileName: string;
  detectedAssets: Array<{
    gid: number;
    sourceX: number;
    sourceY: number;
    width: number;
    height: number;
    confidence?: number;
  }>;
  _meta?: {
    file: File;
    layerType: string;
    tabId: number;
    projectPath?: string | null;
    manualTileWidth?: number;
    manualTileHeight?: number;
    forceGridSlicing?: boolean;
  };
};

export type AssetOriginPreset = 'top-left' | 'top-center' | 'center' | 'bottom-left' | 'bottom-center';

export type QuestDraft = {
  name: string;
  complete_status: string;
  quest_text: string;
  requires_status: string;
  requires_not_status: string;
  requires_level: string;
  requires_not_level: string;
  requires_currency: string;
  requires_not_currency: string;
  itemRequirements: unknown[];
  requires_class: string;
  requires_not_class: string;
};

export default function useAppMainState() {
  const editorRefs = useEditorRefs();
  const editorSetup = useEditorSetup(editorRefs.editorOptsRef);
  const { loadProjectData } = useLoadProjectData();

  const preferences = usePreferences();
  useDarkModeSync(preferences.isDarkMode, editorSetup.editor as TileMapEditor | null);

  const appState = useAppState();
  const toolbarState = useToolbarState();
  const helpState = useHelpState();

  const [showActiveGid, setShowActiveGid] = useState<boolean>(true);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);

  const [showImportReview, setShowImportReview] = useState<boolean>(false);
  const [importReviewOriginPreset, setImportReviewOriginPreset] = useState<AssetOriginPreset>('bottom-center');
  const [importReviewData, setImportReviewData] = useState<ImportReviewData | null>(null);

  const itemsHook = useItems({ currentProjectPath, toast, normalizeItemsForState });
  const vendorState = useVendorState();

  const [mapsDropdownOpen, setMapsDropdownOpen] = useState(false);
  const [mapsSubOpen, setMapsSubOpen] = useState(false);
  const [mapsDropdownPos, setMapsDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const mapsButtonRef = useRef<HTMLButtonElement | null>(null);
  const mapsPortalRef = useRef<HTMLDivElement | null>(null);

  const [showQuestDialog, setShowQuestDialog] = useState<boolean>(false);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [questDraft, setQuestDraft] = useState<QuestDraft>(() => ({
    name: '',
    complete_status: '',
    quest_text: '',
    requires_status: '',
    requires_not_status: '',
    requires_level: '',
    requires_not_level: '',
    requires_currency: '',
    requires_not_currency: '',
    itemRequirements: [],
    requires_class: '',
    requires_not_class: ''
  }));
  const [rulesList, setRulesList] = useState<Array<{ id: string; name: string; startType: 'player' | 'game'; triggerId: string }>>([]);

  const handleOpenQuestDialog = useCallback(() => {
    setEditingQuestId(null);
    setQuestDraft({
      name: '',
      complete_status: '',
      quest_text: '',
      requires_status: '',
      requires_not_status: '',
      requires_level: '',
      requires_not_level: '',
      requires_currency: '',
      requires_not_currency: '',
      itemRequirements: [],
      requires_class: '',
      requires_not_class: ''
    });
    setShowQuestDialog(true);
  }, []);

  const handleCloseQuestDialog = useCallback(() => {
    setShowQuestDialog(false);
    setEditingQuestId(null);
  }, []);

  const handleOpenQuestEditDialog = useCallback((ruleId: string) => {
    const existingRule = rulesList.find((rule) => rule.id === ruleId);
    if (!existingRule) return;

    setEditingQuestId(ruleId);
    setQuestDraft({
      name: existingRule.name,
      complete_status: '',
      quest_text: '',
      requires_status: '',
      requires_not_status: '',
      requires_level: '',
      requires_not_level: '',
      requires_currency: '',
      requires_not_currency: '',
      itemRequirements: [],
      requires_class: '',
      requires_not_class: ''
    });
    setShowQuestDialog(true);
  }, [rulesList]);

  const handleSaveQuest = useCallback(() => {
    const nextName = questDraft.name.trim() || `Quest ${rulesList.length + 1}`;
    setRulesList((prev) => {
      if (editingQuestId) {
        return prev.map((rule) =>
          rule.id === editingQuestId
            ? { ...rule, name: nextName }
            : rule
        );
      }
      return [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          name: nextName,
          startType: 'player',
          triggerId: ''
        }
      ];
    });

    setShowQuestDialog(false);
    setEditingQuestId(null);
    setQuestDraft({
      name: '',
      complete_status: '',
      quest_text: '',
      requires_status: '',
      requires_not_status: '',
      requires_level: '',
      requires_not_level: '',
      requires_currency: '',
      requires_not_currency: '',
      itemRequirements: [],
      requires_class: '',
      requires_not_class: ''
    });
  }, [editingQuestId, questDraft, rulesList.length]);

  return {
    editorRefs,
    editorSetup,
    loadProjectData,
    preferences,
    appState,
    toolbarState,
    helpState,
    currentProjectPath,
    setCurrentProjectPath,
    showActiveGid,
    setShowActiveGid,
    showImportReview,
    setShowImportReview,
    importReviewOriginPreset,
    setImportReviewOriginPreset,
    importReviewData,
    setImportReviewData,
    itemsHook,
    vendorState,
    mapsDropdownOpen,
    setMapsDropdownOpen,
    mapsSubOpen,
    setMapsSubOpen,
    mapsDropdownPos,
    setMapsDropdownPos,
    mapsButtonRef,
    mapsPortalRef,
    showQuestDialog,
    setShowQuestDialog,
    editingQuestId,
    questDraft,
    setQuestDraft,
    rulesList,
    handleOpenQuestDialog,
    handleCloseQuestDialog,
    handleOpenQuestEditDialog,
    handleSaveQuest
  };
}
