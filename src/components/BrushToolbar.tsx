import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { ZoomIn, ZoomOut, Trash2, Upload, X, XCircle } from 'lucide-react';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import useBrushToolbar from '@/hooks/useBrushToolbar';
import usePreferences from '@/hooks/usePreferences';
import { useAppContext } from '@/context/AppContext';

type BrushToolbarProps = {
  editor: TileMapEditor | null;
  activeLayer: TileLayer | null;
  isCollisionLayer: boolean;
  brushTool: 'none' | 'move' | 'merge' | 'separate' | 'remove';
  brushToolbarExpanded?: boolean;
  showBrushToolbarTemporarily?: () => void;
  setTabTick: React.Dispatch<React.SetStateAction<number>>;
  setBrushToolbarNode?: (node: HTMLDivElement | null) => void;
  onOpenActorDialog: (type: 'npc' | 'enemy') => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => void;
  onToggleBrushTool: (tool: 'move' | 'merge' | 'separate' | 'remove') => void;
  onDeleteActiveTab: () => void;
  toast: (args: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
  // New zoom and selection props
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onClearSelection?: () => void;
  hasSelection?: boolean;
  zoom?: number;
};

const BrushToolbar = ({
  editor,
  activeLayer,
  isCollisionLayer,
  brushTool,
  brushToolbarExpanded,
  showBrushToolbarTemporarily,
  setTabTick,
  setBrushToolbarNode,
  onOpenActorDialog,
  onFileUpload,
  onToggleBrushTool,
  onDeleteActiveTab,
  toast,
  onZoomIn,
  onZoomOut,
  onClearSelection,
  hasSelection,
  zoom
}: BrushToolbarProps) => {
  console.log('[DEBUG] BrushToolbar render: editor =', !!editor, 'activeLayer =', !!activeLayer);
  
  // Initialize refs with current prop values IMMEDIATELY
  const editorRef = React.useRef<TileMapEditor | null>(editor);
  const activeLayerRef = React.useRef<TileLayer | null>(activeLayer);
  
  const fallback = useBrushToolbar();
  const expanded = typeof brushToolbarExpanded === 'boolean' ? brushToolbarExpanded : fallback.brushToolbarExpanded;
  const setNode = setBrushToolbarNode ?? fallback.setBrushToolbarNode;
  const showTemporarily = showBrushToolbarTemporarily ?? fallback.showBrushToolbarTemporarily;

  // Keep refs synchronized with props in useEffect
  React.useEffect(() => {
    console.log('[DEBUG] BrushToolbar useEffect: Syncing refs - editor =', !!editor, 'activeLayer =', !!activeLayer);
    editorRef.current = editor;
    activeLayerRef.current = activeLayer;
  }, [editor, activeLayer]);

  // App context fallback so the handler can always get latest values
  const appCtx = (() => {
    try { return useAppContext() as any; } catch { return null; }
  })();
  console.log('[DEBUG] BrushToolbar: appCtx available =', !!appCtx, 'appCtx.tileset?.editor =', !!appCtx?.tileset?.editor, 'appCtx.tileset?.activeLayer =', !!appCtx?.tileset?.activeLayer);

  // Auto-slice feature removed; importing is currently disabled.

  // Safe toast invoker — handles either function or useToast hook object
  const toastInvoke = (opts: { title?: string; description?: string; variant?: 'default' | 'destructive' } = {}) => {
    try {
      if (!toast) return;
      if (typeof toast === 'function') {
        (toast as any)(opts);
        return;
      }
      if (typeof (toast as any).toast === 'function') {
        (toast as any).toast(opts);
        return;
      }
      console.warn('[DEBUG] BrushToolbar: toast not callable, skipping', toast);
    } catch (e) {
      console.warn('[DEBUG] BrushToolbar: toast invocation failed', e);
    }
  };

  // Safely increment the tab tick. Some callers pass a React state dispatcher, others
  // provide a zero-arg increment helper. Try dispatcher form first, then zero-arg.
  const safeIncrementTabTick = () => {
    try {
      if (typeof setTabTick === 'function') {
        try {
          // Prefer dispatcher/updater signature
          (setTabTick as React.Dispatch<React.SetStateAction<number>>)((t: number) => (typeof t === 'number' ? t + 1 : 1));
          return;
        } catch (e) {
          // Fallback to zero-arg function
          try { (setTabTick as any)(); return; } catch (err) { void err; }
        }
      }

      // Try app context tileset helper if present
      if (appCtx && appCtx.tileset && typeof (appCtx.tileset as any).setTabTick === 'function') {
        try {
          (appCtx.tileset as any).setTabTick((t: number) => (typeof t === 'number' ? t + 1 : 1));
          return;
        } catch (e) {
          try { (appCtx.tileset as any).setTabTick(); return; } catch (err) { void err; }
        }
      }
    } catch (e) {
      console.warn('[DEBUG] BrushToolbar: safeIncrementTabTick failed', e);
    }
  };

  return (
  <div className="sticky bottom-0 z-10 bg-transparent py-2">
    <div className="text-xs text-muted-foreground"></div>
    <div className="w-full flex justify-center">
      <div
        ref={setNode}
        className="flex items-center transition-all duration-300 ease-in-out gap-1 transform -translate-x-1 mt-2 mb-2"
      >
        {!isCollisionLayer && (
          <>
            <div className="flex-shrink-0 flex items-center gap-1">
              {(activeLayer?.type === 'background' || activeLayer?.type === 'object') && (
                <Tooltip content="Add tab" side="bottom">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-1 py-1 h-6"
                    onClick={() => {
                      if (!editor || !activeLayer) return;
                      const tabs = editor.getLayerTabs ? editor.getLayerTabs(activeLayer.type) : [];
                      if (tabs && tabs.length >= 8) {
                        toastInvoke({ title: 'Maximum tabs reached', description: 'You can have up to 8 tabs per layer.', variant: 'destructive' });
                        return;
                      }
                      const newId = editor.createLayerTab(activeLayer.type);
                      editor.setActiveLayerTab(activeLayer.type, newId);
                      setTabTick(t => t + 1);
                    }}
                  >
                    +
                  </Button>
                </Tooltip>
              )}

              {(() => {
                const isNpc = activeLayer?.type === 'npc';
                const isEventLayer = activeLayer?.type === 'event';
                const isActorLayer = isNpc || isEventLayer;
                const tooltip = isActorLayer ? `Add ${isEventLayer ? 'Event' : 'NPC'}` : 'Import a PNG tileset or brush for the active layer tab';
                if (isNpc || isEventLayer) {
                  return (
                    <Tooltip content={tooltip} side="bottom">
                      <Button
                        variant="default"
                        size="sm"
                        aria-label={tooltip}
                        className="relative z-20 text-xs px-1 py-1 h-6 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          if (isNpc) {
                            onOpenActorDialog('npc');
                          } else {
                                toastInvoke({ title: 'Not implemented', description: 'Create Event will be implemented later.' });
                          }
                        }}
                        role="button"
                      >
                        <Upload className="w-3 h-3 text-white" />
                      </Button>
                    </Tooltip>
                  );
                }

                return (
                  <Tooltip content={tooltip} side="bottom">
                    <Button
                      variant="default"
                      size="sm"
                      aria-label={tooltip}
                      className="relative text-xs px-1 py-1 h-6 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                    >
                      <Upload className="w-3 h-3 text-white" />
                      <input
                        type="file"
                        accept="image/png"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.type !== 'image/png') {
                            toastInvoke({ title: 'Invalid file', description: 'Please select a PNG image', variant: 'destructive' });
                            return;
                          }

                          console.log('[DEBUG] BrushToolbar: importing PNG file', file.name);

                          // Resolve current editor and active layer (fall back to appCtx/editor-derived)
                          let currentEditor = editorRef.current;
                          let currentActiveLayer = activeLayerRef.current;
                          if (!currentEditor || !currentActiveLayer) {
                            console.log('[DEBUG] BrushToolbar: refs empty, trying app context fallback');
                            if (appCtx) {
                              currentEditor = (appCtx?.tileset?.editor ?? appCtx?.editor) as TileMapEditor | null;
                              currentActiveLayer = (appCtx?.tileset?.activeLayer ?? appCtx?.activeLayer) as any;
                              console.log('[DEBUG] BrushToolbar: appCtx fallback - editor =', !!currentEditor, 'activeLayer =', !!currentActiveLayer);
                            }
                          }
                          // Final editor-derived fallback
                          if (!currentActiveLayer && currentEditor) {
                            try {
                              const currentLayerType = currentEditor.getCurrentLayerType ? currentEditor.getCurrentLayerType() : null;
                              const byId = currentEditor.tileLayers ? currentEditor.tileLayers.find((l: any) => l.id === currentEditor.activeLayerId) : null;
                              const byType = currentEditor.tileLayers ? currentEditor.tileLayers.find((l: any) => l.type === currentLayerType) : null;
                              currentActiveLayer = byId || byType || null;
                              console.log('[DEBUG] BrushToolbar: editor-derived fallback - activeLayer found byId=', !!byId, 'byType=', !!byType, 'currentLayerType=', currentLayerType);
                            } catch (e) { console.warn('[DEBUG] BrushToolbar: editor-derived fallback failed', e); }
                          }

                          if (!currentEditor || !currentActiveLayer) {
                            toastInvoke({ title: 'No editor', description: 'Editor or active layer not available', variant: 'destructive' });
                            return;
                          }

                          try {
                            const layerType = currentActiveLayer.type;
                            // Ensure there is an active tab for the layer
                            const tabs = currentEditor.getLayerTabs ? currentEditor.getLayerTabs(layerType) : [];
                            let targetTabId = currentEditor.getActiveLayerTabId ? currentEditor.getActiveLayerTabId(layerType) : null;
                            if (typeof targetTabId !== 'number' || targetTabId === null) {
                              if (tabs && tabs.length >= 8) {
                                toastInvoke({ title: 'Maximum tabs reached', description: 'You can have up to 8 tabs per layer.', variant: 'destructive' });
                                return;
                              }
                              targetTabId = currentEditor.createLayerTab(layerType);
                              currentEditor.setActiveLayerTab(layerType, targetTabId);
                            }

                            // Import into the editor/tab so it persists
                            await currentEditor.importBrushImageToLayerTab(layerType, targetTabId, file);

                            // Compute placement origin (snap to 32) based on current viewport/zoom and set on the tab
                            try {
                              const container = document.getElementById('tilesContainer');
                              const wrapper = container ? container.closest('.tile-palette') as HTMLElement | null : null;
                              const computed = wrapper ? getComputedStyle(wrapper) : null;
                              const zoomVal = computed && computed.zoom ? parseFloat(computed.zoom as string) || 1 : 1;
                              const scrollLeft = wrapper ? wrapper.scrollLeft : 0;
                              const scrollTop = wrapper ? wrapper.scrollTop : 0;
                              const contentX = Math.round((scrollLeft / zoomVal) / 32) * 32;
                              const contentY = Math.round((scrollTop / zoomVal) / 32) * 32;
                              const tabs = currentEditor.getLayerTabs ? currentEditor.getLayerTabs(layerType) : [];
                              const tab = tabs.find(t => t.id === targetTabId);
                              if (tab && tab.tileset) {
                                (tab.tileset as unknown as { originX?: number }).originX = contentX;
                                (tab.tileset as unknown as { originY?: number }).originY = contentY;
                              }
                            } catch (e) { console.warn('Failed to set tab origin after import', e); }

                            // Ensure tab is active and refresh palette
                            console.log('[DEBUG] BrushToolbar: After import, setting active tab and refreshing palette');
                            currentEditor.setActiveLayerTab(layerType, targetTabId);
                            // Note: We no longer call refreshTilePalette - React handles rendering via tabTick
                            
                            // Increment tabTick to trigger TilesetPalette effect
                            console.log('[DEBUG] BrushToolbar: Incrementing tabTick to refresh TilesetPalette');
                            safeIncrementTabTick();
                            
                            toastInvoke({ title: 'Imported', description: 'Imported tileset saved to layer tab.' });
                          } catch (err) {
                            console.warn('[DEBUG] BrushToolbar: Import into editor failed', err);
                            toastInvoke({ title: 'Import failed', description: 'Unable to import into editor', variant: 'destructive' });
                          }
                        }}
                      />
                    </Button>
                  </Tooltip>
                );
              })()}
            </div>
            {/* Zoom In button */}
            <div className="flex-shrink-0 overflow-visible transition-all duration-300 ease-out opacity-100 scale-100 max-w-[2.5rem] w-auto">
              <Tooltip content={`Zoom In${zoom ? ` (${Math.round(zoom * 100)}%)` : ''}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs px-1 py-1 h-6 shadow-sm"
                  onClick={() => onZoomIn?.()}
                >
                  <ZoomIn className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
            {/* Zoom Out button */}
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${expanded ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
            >
              <Tooltip content={`Zoom Out${zoom ? ` (${Math.round(zoom * 100)}%)` : ''}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs px-1 py-1 h-6 shadow-sm"
                  onClick={() => onZoomOut?.()}
                >
                  <ZoomOut className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
            {/* Clear Selection button */}
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${(expanded || hasSelection) ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
            >
              <Tooltip content="Clear Selection">
                <Button
                  variant={hasSelection ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-1 py-1 h-6 shadow-sm"
                  onClick={() => onClearSelection?.()}
                  disabled={!hasSelection}
                >
                  <XCircle className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${expanded || brushTool === 'remove' ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
            >
              <Tooltip content="Remove brushes">
                <Button
                  variant={brushTool === 'remove' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-1 py-1 h-6 shadow-sm"
                  onClick={() => onToggleBrushTool('remove')}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${expanded ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
            >
              <Tooltip content="Delete tileset tab">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs px-1 py-1 h-6 border-red-500 hover:border-red-600 hover:bg-red-50 shadow-sm"
                  onClick={() => {
                    showTemporarily();
                    onDeleteActiveTab();
                  }}
                >
                  <X className="w-3 h-3 text-red-500" />
                </Button>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
  );
}

export default BrushToolbar;
