import { useCallback, useState } from 'react';

type Ability = { id: string; name: string; type: string };

export default function useAbilityDialog() {
  const [showAbilityDialog, setShowAbilityDialog] = useState(false);
  const [abilityNameInput, setAbilityNameInput] = useState('');
  const [abilitiesList, setAbilitiesList] = useState<Ability[]>([]);

  const handleCloseAbilityDialog = useCallback(() => {
    setShowAbilityDialog(false);
    setAbilityNameInput('');
  }, []);

  const handleCreateAbility = useCallback((name: string) => {
    setAbilitiesList((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, name, type: 'Standard' }
    ]);
    setShowAbilityDialog(false);
    setAbilityNameInput('');
  }, []);

  return {
    showAbilityDialog,
    setShowAbilityDialog,
    abilityNameInput,
    setAbilityNameInput,
    handleCloseAbilityDialog,
    handleCreateAbility,
    abilitiesList
  };
}
