export default function buildConfirmActionHandlers(params: Record<string, any>) {
  const {
    confirmAction,
    tabToDelete,
    confirmPayloadRef,
    editor,
    setTabTick,
    setTabToDelete,
    setConfirmAction
  } = params;

  const onCancel = () => { setConfirmAction(null); };

  const onConfirm = () => {
    try {
      if (!confirmAction) return;
      if (confirmAction.type === 'removeBrush') {
        const brushId = confirmAction.payload as number;
        if (editor) editor.removeBrush?.(brushId);
      } else if (confirmAction.type === 'removeTileset') {
        if (editor) editor.removeLayerTileset?.();
      } else if (confirmAction.type === 'removeTab') {
        const payload = tabToDelete ?? confirmPayloadRef.current ?? (confirmAction.payload as any);
        if (editor && payload && payload.layerType) {
          const liveActive = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(payload.layerType) : null;
          const finalTabId = (typeof liveActive === 'number' && liveActive !== null) ? liveActive : payload.tabId;
          if (typeof finalTabId === 'number') {
            editor.removeLayerTab?.(payload.layerType, finalTabId);
            setTabTick((t: number) => t + 1);
            try { editor.refreshTilePalette?.(true); } catch (err) { console.warn('refreshTilePalette failed', err); }
            try {
              const newActive = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(payload.layerType) : null;
              if (typeof newActive === 'number') {
                editor.setActiveLayerTab?.(payload.layerType, newActive);
                setTabTick((t: number) => t + 1);
                try { editor.refreshTilePalette?.(true); } catch (err) { console.warn('refreshTilePalette failed', err); }
              }
            } catch (e) {
              console.warn('Post-remove setActiveLayerTab safeguard failed', e);
            }
          } else {
            console.warn('Confirm removeTab: no finalTabId available, aborting', payload);
          }
        }
        setTabToDelete(null);
        confirmPayloadRef.current = null;
      }
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setConfirmAction(null);
    }
  };

  return { onCancel, onConfirm };
}
