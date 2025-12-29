import { useCallback } from 'react';

type ElectronAPI = {
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
};

export default function useWindowControls() {
  const handleMinimize = useCallback(() => {
    const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: ElectronAPI }).electronAPI : undefined;
    if (api?.minimize) api.minimize();
    else console.log('Minimize clicked - Electron API not available');
  }, []);

  const handleMaximize = useCallback(() => {
    const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: ElectronAPI }).electronAPI : undefined;
    if (api?.maximize) api.maximize();
    else console.log('Maximize clicked - Electron API not available');
  }, []);

  const handleClose = useCallback(() => {
    const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: ElectronAPI }).electronAPI : undefined;
    if (api?.close) api.close();
    else console.log('Close clicked - Electron API not available');
  }, []);

  return { handleMinimize, handleMaximize, handleClose };
}
