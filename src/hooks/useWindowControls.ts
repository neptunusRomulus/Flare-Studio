import { useCallback } from 'react';

export default function useWindowControls() {
  const handleMinimize = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    } else {
      console.log('Minimize clicked - Electron API not available');
    }
  }, []);

  const handleMaximize = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.maximize) {
      (window as any).electronAPI.maximize();
    } else {
      console.log('Maximize clicked - Electron API not available');
    }
  }, []);

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    } else {
      console.log('Close clicked - Electron API not available');
    }
  }, []);

  return { handleMinimize, handleMaximize, handleClose };
}
