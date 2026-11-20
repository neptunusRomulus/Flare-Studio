import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const STUDIO_HINTS_STORAGE_KEY = 'flare.studioHints';

export type StudioHintsValue = {
  hintsEnabled: boolean;
  setHintsEnabled: (_enabled: boolean) => void;
};

const DEFAULT: StudioHintsValue = {
  hintsEnabled: true,
  setHintsEnabled: () => undefined,
};

const StudioHintsContext = createContext<StudioHintsValue | null>(null);

function readStoredHints(): boolean {
  try {
    const raw = localStorage.getItem(STUDIO_HINTS_STORAGE_KEY);
    if (raw === '0' || raw === 'false') return false;
    if (raw === '1' || raw === 'true') return true;
  } catch { /* ignore */ }
  return true;
}

export function StudioHintsProvider({ children, defaultEnabled }: { children: React.ReactNode; defaultEnabled?: boolean }) {
  const [hintsEnabled, setHintsEnabledState] = useState(() => (
    defaultEnabled ?? (typeof window === 'undefined' ? true : readStoredHints())
  ));

  const setHintsEnabled = useCallback((enabled: boolean) => {
    setHintsEnabledState(enabled);
    try { localStorage.setItem(STUDIO_HINTS_STORAGE_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ hintsEnabled, setHintsEnabled }), [hintsEnabled, setHintsEnabled]);
  return <StudioHintsContext.Provider value={value}>{children}</StudioHintsContext.Provider>;
}

/** Defaults to on when no provider is mounted (tests, isolated screens). */
export function useStudioHints(): StudioHintsValue {
  return useContext(StudioHintsContext) ?? DEFAULT;
}
