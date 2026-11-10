import { useState, useEffect } from 'react';

export default function usePreferences() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('isDarkMode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    } catch {
      // ignore storage errors
    }
  }, [isDarkMode]);

  return {
    isDarkMode,
    setIsDarkMode,
  } as const;
}
