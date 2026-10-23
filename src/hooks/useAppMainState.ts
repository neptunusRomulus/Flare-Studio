import { useCallback, useEffect, useRef, useState } from 'react';
import { canonicalJson, contentSlug, exportQuestFile, importQuestText } from '../adapters/flare/flareAdapter.cjs';
import { projectRoot, writeProjectFiles } from '../editor/projectFiles';
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

export type QuestItemRequirement = {
  id: string;
  type: 'requires_item' | 'requires_not_item';
  itemId: string;
  itemQuantity: number;
};

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
  itemRequirements: QuestItemRequirement[];
  requires_class: string;
  requires_not_class: string;
  start_type?: 'player' | 'game';
};

export type StoredQuest = QuestDraft & {
  id: string;
  startType: 'player' | 'game';
  triggerId: string;
};

const emptyQuestDraft = (): QuestDraft => ({
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

function storedQuestFromRecord(value: Record<string, unknown>, fallbackId: string): StoredQuest {
  const itemRequirements = Array.isArray(value.itemRequirements)
    ? value.itemRequirements as QuestItemRequirement[]
    : emptyQuestDraft().itemRequirements;
  const startType = value.startType === 'game' || value.start_type === 'game' ? 'game' : 'player';
  return {
    ...emptyQuestDraft(),
    name: typeof value.name === 'string' ? value.name : fallbackId,
    complete_status: typeof value.complete_status === 'string' ? value.complete_status : '',
    quest_text: typeof value.quest_text === 'string' ? value.quest_text : '',
    requires_status: typeof value.requires_status === 'string' ? value.requires_status : '',
    requires_not_status: typeof value.requires_not_status === 'string' ? value.requires_not_status : '',
    requires_level: typeof value.requires_level === 'string' ? value.requires_level : '',
    requires_not_level: typeof value.requires_not_level === 'string' ? value.requires_not_level : '',
    requires_currency: typeof value.requires_currency === 'string' ? value.requires_currency : '',
    requires_not_currency: typeof value.requires_not_currency === 'string' ? value.requires_not_currency : '',
    requires_class: typeof value.requires_class === 'string' ? value.requires_class : '',
    requires_not_class: typeof value.requires_not_class === 'string' ? value.requires_not_class : '',
    start_type: startType,
    itemRequirements,
    id: typeof value.id === 'string' && value.id ? value.id : fallbackId,
    startType,
    triggerId: typeof value.triggerId === 'string' ? value.triggerId : ''
  };
}

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
  const [questDraft, setQuestDraft] = useState<QuestDraft>(() => emptyQuestDraft());
  const [rulesList, setRulesList] = useState<StoredQuest[]>([]);

  const handleOpenQuestDialog = useCallback(() => {
    setEditingQuestId(null);
    setQuestDraft(emptyQuestDraft());
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
      ...emptyQuestDraft(),
      ...existingRule,
      name: existingRule.name,
      start_type: existingRule.startType,
      itemRequirements: existingRule.itemRequirements || []
    });
    setShowQuestDialog(true);
  }, [rulesList]);

  useEffect(() => {
    if (!currentProjectPath || !window.electronAPI?.readDir || !window.electronAPI.readFile) return;
    let cancelled = false;
    const root = projectRoot(currentProjectPath);
    const load = async () => {
      const loaded: StoredQuest[] = [];
      const seen = new Set<string>();
      const jsonEntries = await window.electronAPI.readDir(`${root}/content/quests`);
      for (const entry of jsonEntries || []) {
        if (entry.isDirectory || !entry.name.endsWith('.json')) continue;
        const text = await window.electronAPI.readFile(`${root}/content/quests/${entry.name}`);
        if (!text) continue;
        try {
          const id = entry.name.replace(/\.json$/, '');
          loaded.push(storedQuestFromRecord(JSON.parse(text) as Record<string, unknown>, id));
          seen.add(id);
        } catch {
          /* skip a broken quest document */
        }
      }
      const txtEntries = await window.electronAPI.readDir(`${root}/quests`);
      for (const entry of txtEntries || []) {
        if (entry.isDirectory || !entry.name.endsWith('.txt')) continue;
        const id = entry.name.replace(/\.txt$/, '');
        if (seen.has(id)) continue;
        const text = await window.electronAPI.readFile(`${root}/quests/${entry.name}`);
        if (!text) continue;
        const parsed = importQuestText(text) as Record<string, unknown>;
        loaded.push(storedQuestFromRecord({ ...parsed, id }, id));
      }
      if (!cancelled && loaded.length > 0) setRulesList(loaded);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentProjectPath]);

  const handleSaveQuest = useCallback(() => {
    const nextName = questDraft.name.trim() || `Quest ${rulesList.length + 1}`;
    const existing = rulesList.find((rule) => rule.id === editingQuestId);
    const id = existing?.id || contentSlug(nextName, 'quest');
    const startType = questDraft.start_type || existing?.startType || 'player';
    const stored: StoredQuest = {
      ...questDraft,
      id,
      name: nextName,
      startType,
      start_type: startType,
      triggerId: existing?.triggerId || '',
      itemRequirements: questDraft.itemRequirements || []
    };
    setRulesList((prev) => {
      if (existing) return prev.map((rule) => (rule.id === existing.id ? stored : rule));
      return [...prev, stored];
    });

    setShowQuestDialog(false);
    setEditingQuestId(null);
    setQuestDraft(emptyQuestDraft());

    if (!currentProjectPath) return;
    const text = exportQuestFile(stored);
    void writeProjectFiles(currentProjectPath, [
      { path: `quests/${id}.txt`, content: text },
      { path: `content/quests/${id}.json`, content: canonicalJson('quest', stored) }
    ]).then((saved) => {
      if (!saved) {
        toast({ title: 'Quest save failed', description: 'Could not write the quests folder.', variant: 'destructive' });
      }
    });
  }, [currentProjectPath, editingQuestId, questDraft, rulesList]);

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
