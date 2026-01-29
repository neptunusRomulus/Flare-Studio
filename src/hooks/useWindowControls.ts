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
    else void 0;
  }, []);

  const handleMaximize = useCallback(() => {
    const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: ElectronAPI }).electronAPI : undefined;
    if (api?.maximize) api.maximize();
    else void 0;
  }, []);

  const handleClose = useCallback(() => {
    const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: ElectronAPI }).electronAPI : undefined;
    if (api?.close) api.close();
    else void 0;
  }, []);

  return { handleMinimize, handleMaximize, handleClose };
}
