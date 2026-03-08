import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { ZoomIn, ZoomOut, Upload, X, XCircle } from 'lucide-react';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import useBrushToolbar from '@/hooks/useBrushToolbar';

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
  currentProjectPath?: string | null;
};

const BrushToolbar = ({
  editor,
  activeLayer,
  isCollisionLayer,
  brushToolbarExpanded,
  showBrushToolbarTemporarily,
  setTabTick,
  setBrushToolbarNode,
  onOpenActorDialog,
  onDeleteActiveTab,
  toast,
  onZoomIn,
  onZoomOut,
  onClearSelection,
  hasSelection,
  zoom,
  currentProjectPath
}: BrushToolbarProps) => {
  
  // Initialize refs with current prop values IMMEDIATELY
  const editorRef = React.useRef<TileMapEditor | null>(editor);
  const activeLayerRef = React.useRef<TileLayer | null>(activeLayer);
  
  // Track tab count to disable delete button if only one tab
  const [tabCount, setTabCount] = React.useState<number>(0);
  
  const fallback = useBrushToolbar();
  const expanded = typeof brushToolbarExpanded === 'boolean' ? brushToolbarExpanded : fallback.brushToolbarExpanded;
  const setNode = setBrushToolbarNode ?? fallback.setBrushToolbarNode;
  const showTemporarily = showBrushToolbarTemporarily ?? fallback.showBrushToolbarTemporarily;

  // Keep refs synchronized with props in useEffect
  React.useEffect(() => {
    editorRef.current = editor;
    activeLayerRef.current = activeLayer;
  }, [editor, activeLayer]);
  
  // Update tab count when editor or active layer changes
  React.useEffect(() => {
    if (!editor || !activeLayer) {
      setTabCount(0);
      return;
    }
    const tabs = editor.getLayerTabs ? editor.getLayerTabs(activeLayer.type) : [];
    setTabCount(tabs ? tabs.length : 0);
  }, [editor, activeLayer]);

  // App context fallback - not calling useAppContext here to avoid hook rules violation
  // This is only used as a last resort fallback
  const appCtx = null;

  // Auto-slice feature removed; importing is currently disabled.

  // Safe toast invoker — handles either function or useToast hook object
  type ToastOptions = { title?: string; description?: string; variant?: 'default' | 'destructive' };
  const toastInvoke = (opts: ToastOptions = {}) => {
    try {
      if (!toast) return;
      if (typeof toast === 'function') {
        (toast as (opts: ToastOptions) => void)(opts);
        return;
      }
      const toastObj = toast as { toast?: (opts: ToastOptions) => void };
      if (typeof toastObj?.toast === 'function') {
        toastObj.toast(opts);
        return;
      }
    } catch (e) {
      void e; // Intentionally swallow errors
    }
  };

  // Safely increment the tab tick. Some callers pass a React state dispatcher
  const safeIncrementTabTick = () => {
    try {
      if (typeof setTabTick === 'function') {
        try {
          // Prefer dispatcher/updater signature
          (setTabTick as React.Dispatch<React.SetStateAction<number>>)((t: number) => (typeof t === 'number' ? t + 1 : 1));
          return;
        } catch {
          // Fallback to zero-arg function
          try { (setTabTick as () => void)(); return; } catch { void 0; }
        }
      }
    } catch (e) {
      void e; // Intentionally swallow errors
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
                      if (tabs && tabs.length >= 5) {
                        toastInvoke({ title: 'Maximum tabs reached', description: 'You can have up to 5 tabs per layer.', variant: 'destructive' });
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

                          // Keep layers panel visible while importing to avoid hover-collapse
                          try {
                            // Set a global guard so UI mouseleave handlers can opt out
                            try { (window as unknown as { __preventLayersAutoCollapse?: boolean }).__preventLayersAutoCollapse = true; } catch { void 0; }
                            if (appCtx && (appCtx as unknown as { layersObj?: { setLayersPanelExpanded?: (v: boolean) => void } }).layersObj && typeof (appCtx as unknown as { layersObj: { setLayersPanelExpanded?: (v: boolean) => void } }).layersObj.setLayersPanelExpanded === 'function') {
                              (appCtx as unknown as { layersObj: { setLayersPanelExpanded: (v: boolean) => void } }).layersObj.setLayersPanelExpanded(true);
                            }
                          } catch (e) { void e; }


                          // Resolve current editor and active layer (fall back to refs)
                          const currentEditor = editorRef.current;
                          const currentActiveLayer = activeLayerRef.current;
                          // appCtx is null to avoid React hook violations, so we can't use it as fallback
                          // Final editor-derived fallback
                          if (!currentActiveLayer && currentEditor) {
                            // currentLayerType could be used in future enhancements
                            // No fallback available since appCtx is null
                            void 0;
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
                              if (tabs && tabs.length >= 5) {
                                  toastInvoke({ title: 'Maximum tabs reached', description: 'You can have up to 5 tabs per layer.', variant: 'destructive' });
                                  return;
                                }
                              targetTabId = currentEditor.createLayerTab(layerType);
                              currentEditor.setActiveLayerTab(layerType, targetTabId);
                            }

                            // Import into the editor/tab so it persists
                            await currentEditor.importBrushImageToLayerTab(layerType, targetTabId, file, currentProjectPath ?? undefined);

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
                            currentEditor.setActiveLayerTab(layerType, targetTabId);
                            // Note: We no longer call refreshTilePalette - React handles rendering via tabTick
                            
                            // Increment tabTick to trigger TilesetPalette effect
                            safeIncrementTabTick();
                            
                            toastInvoke({ title: 'Imported', description: 'Imported tileset saved to layer tab.' });
                          } catch {
                            toastInvoke({ title: 'Import failed', description: 'Unable to import into editor', variant: 'destructive' });
                          }
                          finally {
                            // Clear the temporary guard so hover behavior resumes
                            try { (window as unknown as { __preventLayersAutoCollapse?: boolean }).__preventLayersAutoCollapse = false; } catch { void 0; }
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
            {/* Remove brushes button removed */}
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${expanded ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
            >
              <Tooltip content={tabCount <= 1 ? 'Cannot delete - must have at least one tab' : 'Delete tileset tab'}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs px-1 py-1 h-6 border-red-500 hover:border-red-600 hover:bg-red-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    showTemporarily();
                    onDeleteActiveTab();
                  }}
                  disabled={tabCount <= 1}
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
