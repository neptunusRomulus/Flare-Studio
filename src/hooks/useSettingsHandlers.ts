import React, { useCallback } from 'react';

export default function useSettingsHandlers(args: {
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMapSettingsOnly: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { setShowSettings, setShowMapSettingsOnly, setShowHelp } = args;

  const handleCloseSettings = useCallback(() => setShowSettings(false), [setShowSettings]);
  const handleCloseMapSettings = useCallback(() => setShowMapSettingsOnly(false), [setShowMapSettingsOnly]);
  const handleHelpClose = useCallback(() => setShowHelp(false), [setShowHelp]);

  return { handleCloseSettings, handleCloseMapSettings, handleHelpClose };
}
