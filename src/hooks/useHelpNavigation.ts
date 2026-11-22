import { useCallback, useState } from 'react';
import type { HelpTarget } from '@/help/helpTopics';
import { canGoHelp as canGoHelpTarget, layerForHelpTarget, type HelpLayer } from '@/help/helpNavigation';

type Controls = {
  currentProjectPath?: string | null;
  setShowSettings?: (show: boolean) => void;
} | undefined | null;

type LayerHost = {
  layers?: HelpLayer[];
  handleSetActiveLayer?: (id: string) => unknown;
} | undefined | null;

type Options = {
  controls: Controls;
  layersObj: LayerHost;
  hasSettings: boolean;
  onHelpClose?: () => void;
  onCloseSettings?: () => void;
  setQuestMapOpen: (open: boolean) => void;
  persistQuestMapOpen?: (open: boolean) => void;
};

/** Help "Go there": open Engine Settings on a tab, or switch to the layer the topic talks about. */
export default function useHelpNavigation({
  controls, layersObj, hasSettings, onHelpClose, onCloseSettings, setQuestMapOpen, persistQuestMapOpen,
}: Options) {
  const [settingsTab, setSettingsTab] = useState<'general' | 'save' | 'display' | undefined>(undefined);

  const closeSettings = useCallback(() => {
    setSettingsTab(undefined);
    onCloseSettings?.();
  }, [onCloseSettings]);

  const canGoHelp = useCallback((target: HelpTarget) => canGoHelpTarget(target, {
    hasSettings,
    layerTypes: (layersObj?.layers ?? []).map((layer) => layer.type),
    hasProjectPath: !!controls?.currentProjectPath,
  }), [controls, layersObj, hasSettings]);

  const goHelp = useCallback((target: HelpTarget) => {
    onHelpClose?.();
    if (target === 'display') {
      setSettingsTab('display');
      controls?.setShowSettings?.(true);
      return;
    }
    const layer = layerForHelpTarget(target, layersObj?.layers);
    if (layer) { try { void layersObj?.handleSetActiveLayer?.(layer.id); } catch { /* ignore */ } }
    if (target === 'quest-map') {
      setQuestMapOpen(true);
      persistQuestMapOpen?.(true);
    }
  }, [controls, layersObj, onHelpClose, persistQuestMapOpen, setQuestMapOpen]);

  return { settingsTab, closeSettings, canGoHelp, goHelp };
}
