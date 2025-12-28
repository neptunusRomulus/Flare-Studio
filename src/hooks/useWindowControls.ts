import { useCallback } from 'react';

export default function useWindowControls() {
  const handleMinimize = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    } else {
      // no-op on web
      // eslint-disable-next-line no-console
      console.log('Minimize clicked - Electron API not available');
    }
  }, []);

  const handleMaximize = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    } else {
      // eslint-disable-next-line no-console
      console.log('Maximize clicked - Electron API not available');
    }
  }, []);

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      // eslint-disable-next-line no-console
      console.log('Close clicked - Electron API not available');
    }
  }, []);

  return { handleMinimize, handleMaximize, handleClose };
}
