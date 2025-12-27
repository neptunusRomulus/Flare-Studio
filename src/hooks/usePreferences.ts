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

  const [showSidebarToggle, setShowSidebarToggle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('showSidebarToggle');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('showSidebarToggle', JSON.stringify(showSidebarToggle));
    } catch {
      // ignore storage errors
    }
  }, [showSidebarToggle]);

  return {
    isDarkMode,
    setIsDarkMode,
    showSidebarToggle,
    setShowSidebarToggle,
  } as const;
}
