import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Link2, Scan, Scissors, Trash2, Upload, X } from 'lucide-react';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import useBrushToolbar from '@/hooks/useBrushToolbar';
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
  toast
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
                        toast({ title: 'Maximum tabs reached', description: 'You can have up to 8 tabs per layer.', variant: 'destructive' });
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
                            toast({ title: 'Not implemented', description: 'Create Event will be implemented later.' });
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
                          console.log('[DEBUG] BrushToolbar file input onChange fired');
                          let currentEditor = editorRef.current;
                          let currentActiveLayer = activeLayerRef.current;
                          console.log('[DEBUG] BrushToolbar: Using refs - editor =', !!currentEditor, 'activeLayer =', !!currentActiveLayer, 'activeLayer.type =', currentActiveLayer?.type);
                          // If refs are not set (props were null/stale), attempt to read from app context
                          if (!currentEditor || !currentActiveLayer) {
                            console.log('[DEBUG] BrushToolbar: refs empty, trying app context fallback');
                            if (appCtx) {
                              currentEditor = (appCtx?.tileset?.editor ?? appCtx?.editor) as TileMapEditor | null;
                              currentActiveLayer = (appCtx?.tileset?.activeLayer ?? appCtx?.activeLayer) as TileLayer | null;
                              console.log('[DEBUG] BrushToolbar: appCtx fallback - editor =', !!currentEditor, 'activeLayer =', !!currentActiveLayer, 'activeLayer.type =', currentActiveLayer?.type);
                            }
                          }

                          // Final fallback: attempt to derive active layer from editor internals
                          if (!currentActiveLayer && currentEditor) {
                            try {
                              const currentLayerType = currentEditor.getCurrentLayerType ? currentEditor.getCurrentLayerType() : null;
                              const byId = currentEditor.tileLayers ? currentEditor.tileLayers.find((l: any) => l.id === currentEditor.activeLayerId) : null;
                              const byType = currentEditor.tileLayers ? currentEditor.tileLayers.find((l: any) => l.type === currentLayerType) : null;
                              currentActiveLayer = byId || byType || null;
                              console.log('[DEBUG] BrushToolbar: editor-derived fallback - activeLayer found byId=', !!byId, 'byType=', !!byType, 'currentLayerType=', currentLayerType);
                            } catch (e) {
                              console.warn('[DEBUG] BrushToolbar: editor-derived fallback failed', e);
                            }
                          }

                          if (!currentEditor || !currentActiveLayer) {
                            console.log('[DEBUG] BrushToolbar: Missing editor or activeLayer after fallback, returning - editor exists:', !!currentEditor, 'activeLayer exists:', !!currentActiveLayer);
                            return;
                          }
                          const file = event.target.files?.[0];
                          console.log('[DEBUG] BrushToolbar: file =', file?.name);
                          if (!file) return;
                          const layerType = currentActiveLayer.type;
                          console.log('[DEBUG] BrushToolbar: layerType =', layerType);
                          if (layerType === 'background' || layerType === 'object') {
                            console.log('[DEBUG] BrushToolbar: Is background/object layer, using importBrushImageToLayerTab');
                            const tabs = currentEditor.getLayerTabs ? currentEditor.getLayerTabs(layerType) : [];
                            let targetTabId = currentEditor.getActiveLayerTabId ? currentEditor.getActiveLayerTabId(layerType) : null;
                            console.log('[DEBUG] BrushToolbar: tabs count =', tabs?.length, 'activeTabId =', targetTabId);
                            if (typeof targetTabId !== 'number' || targetTabId === null) {
                              if (tabs && tabs.length >= 8) {
                                console.log('[DEBUG] BrushToolbar: Max tabs reached');
                                toast({ title: 'Maximum tabs reached', description: 'You can have up to 8 tabs per layer.', variant: 'destructive' });
                                return;
                              }
                              console.log('[DEBUG] BrushToolbar: Creating new tab');
                              targetTabId = currentEditor.createLayerTab(layerType);
                              console.log('[DEBUG] BrushToolbar: Created tab with id =', targetTabId);
                              currentEditor.setActiveLayerTab(layerType, targetTabId);
                            }
                            console.log('[DEBUG] BrushToolbar: Calling importBrushImageToLayerTab with tabId =', targetTabId);
                            await currentEditor.importBrushImageToLayerTab(layerType, targetTabId, file);
                            console.log('[DEBUG] BrushToolbar: importBrushImageToLayerTab completed, calling refreshTilePalette');
                            currentEditor.refreshTilePalette(true);
                            setTabTick(t => t + 1);
                          } else {
                            console.log('[DEBUG] BrushToolbar: Not background/object, using onFileUpload');
                            onFileUpload(event as React.ChangeEvent<HTMLInputElement>, 'layerTileset');
                          }
                        }}
                      />
                    </Button>
                  </Tooltip>
                );
              })()}
            </div>
            <div className="flex-shrink-0 overflow-visible transition-all duration-300 ease-out opacity-100 scale-100 max-w-[2.5rem] w-auto">
              <Tooltip content="Move/Reorder brushes">
                <Button
                  variant={brushTool === 'move' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-1 py-1 h-6 shadow-sm"
                  onClick={() => onToggleBrushTool('move')}
                >
                  <Scan className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${expanded || brushTool === 'merge' ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
            >
              <Tooltip content="Merge brushes">
                <Button
                  variant={brushTool === 'merge' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-1 py-1 h-6 shadow-sm"
                  onClick={() => onToggleBrushTool('merge')}
                >
                  <Link2 className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${expanded || brushTool === 'separate' ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
            >
              <Tooltip content="Separate brushes">
                <Button
                  variant={brushTool === 'separate' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-1 py-1 h-6 shadow-sm"
                  onClick={() => onToggleBrushTool('separate')}
                >
                  <Scissors className="w-3 h-3" />
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
