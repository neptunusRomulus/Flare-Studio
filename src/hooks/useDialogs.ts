import { useCallback, useState } from 'react';

export type HeroEditData = {
  currentX: number;
  currentY: number;
  mapWidth: number;
  mapHeight: number;
  onConfirm: (x: number, y: number) => void;
};

export default function useDialogs() {
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [ruleDialogStep, setRuleDialogStep] = useState<'start' | 'actions'>('start');
  const [ruleDialogError, setRuleDialogError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMapSettingsOnly, setShowMapSettingsOnly] = useState(false);

  const [showHeroEditDialog, setShowHeroEditDialog] = useState(false);
  const [heroEditData, setHeroEditData] = useState<HeroEditData | null>(null);

  const openRuleDialog = useCallback(() => {
    setRuleDialogStep('start');
    setRuleDialogError(null);
    setShowRuleDialog(true);
  }, []);
  const closeRuleDialog = useCallback(() => setShowRuleDialog(false), []);

  const handleHeroEditConfirm = useCallback((x: number, y: number) => {
    if (heroEditData?.onConfirm) heroEditData.onConfirm(x, y);
    setShowHeroEditDialog(false);
    setHeroEditData(null);
  }, [heroEditData]);

  const handleHeroEditCancel = useCallback(() => {
    setShowHeroEditDialog(false);
    setHeroEditData(null);
  }, []);

  return {
    // Rule dialog
    showRuleDialog,
    openRuleDialog,
    closeRuleDialog,
    ruleDialogStep,
    setRuleDialogStep,
    ruleDialogError,
    setRuleDialogError,

    // Engine / map settings
    showSettings,
    setShowSettings,
    showMapSettingsOnly,
    setShowMapSettingsOnly,

    // Hero edit
    showHeroEditDialog,
    setShowHeroEditDialog,
    heroEditData,
    setHeroEditData,
    handleHeroEditConfirm,
    handleHeroEditCancel
  } as const;
}
