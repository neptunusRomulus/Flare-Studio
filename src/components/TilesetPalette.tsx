import React, { useEffect } from 'react';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type TilesetPaletteProps = {
  editor: TileMapEditor | null;
  activeLayer: TileLayer | null;
  tabTick: number;
  setTabTick: React.Dispatch<React.SetStateAction<number>>;
  brushTool: string;
  stampsState?: unknown;
};

const TilesetPalette = ({
  editor,
  activeLayer,
  tabTick,
  setTabTick,
  brushTool,
  stampsState: _stampsState
}: TilesetPaletteProps) => {
  void _stampsState;
  useEffect(() => {
    if (!editor) return;
    console.log('[DEBUG] TilesetPalette useEffect: editor changed or activeLayer/tabTick changed, refreshing palette');
    console.log('[DEBUG] TilesetPalette: activeLayer =', activeLayer?.type, 'tabTick =', tabTick);
    try {
      console.log('[DEBUG] TilesetPalette: Calling refreshTilePalette(true) immediately in useEffect');
      editor.refreshTilePalette(true);
      console.log('[DEBUG] TilesetPalette: refreshTilePalette(true) completed');
    } catch (err) { console.warn('[DEBUG] TilesetPalette: refreshTilePalette failed immediately:', err); }

    // Retry shortly in case the DOM container wasn't present when tileset was applied
    const t1 = setTimeout(() => {
      console.log('[DEBUG] TilesetPalette: Retrying refreshTilePalette after 75ms');
      try { editor.refreshTilePalette(true); } catch (err) { console.warn('[DEBUG] TilesetPalette: Retry at 75ms failed:', err); }
    }, 75);
    const t2 = setTimeout(() => {
      console.log('[DEBUG] TilesetPalette: Retrying refreshTilePalette after 300ms');
      try { editor.refreshTilePalette(true); } catch (err) { console.warn('[DEBUG] TilesetPalette: Retry at 300ms failed:', err); }
    }, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [editor, activeLayer, tabTick]);
  return (
  <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0 m-0">
    {(() => {
      const activeLayerType = activeLayer?.type;
      const showTabs = activeLayerType === 'background' || activeLayerType === 'object';
      if (editor && activeLayerType) {
        const tabs = editor.getLayerTabs ? editor.getLayerTabs(activeLayerType) : [];
        const activeTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(activeLayerType) : null;
        console.log('[DEBUG UI] tabs for', activeLayerType, ':', tabs.length, 'tabs', JSON.stringify(tabs.map((t: { id: number; name?: string }) => ({ id: t.id, name: t.name }))));
        console.log('[DEBUG UI] activeTabId for', activeLayerType, ':', activeTabId);
        console.log('[DEBUG UI] Tab ID match check: tab IDs are', tabs.map((t: { id: number; name?: string }) => t.id), 'and looking for active ID', activeTabId);
      }
      if (!showTabs) return null;
      return (
        <div key={tabTick} className="flex items-center gap-2 px-2 py-2">
          <div
            className={`flex-1 flex items-center gap-1 overflow-x-auto tabs-scroll ${(() => {
              try {
                const tabs = editor && activeLayerType ? (editor.getLayerTabs ? editor.getLayerTabs(activeLayerType) : []) : [];
                return tabs && tabs.length > 7 ? 'tabs-limited' : '';
              } catch { return ''; }
            })()}`}
            onWheel={(event: React.WheelEvent<HTMLDivElement>) => {
              const el = event.currentTarget as HTMLDivElement;
              if (el.scrollWidth > el.clientWidth) {
                event.preventDefault();
                el.scrollLeft += event.deltaY;
              }
            }}
          >
            {editor ? (
              (editor.getLayerTabs ? editor.getLayerTabs(activeLayerType!) : []).map((tab: { id: number; name?: string; }, idx: number) => {
                console.log('[DEBUG UI] Rendering button for tab:', tab.id, 'index:', idx, 'isActive:', editor.getActiveLayerTabId && editor.getActiveLayerTabId(activeLayerType) === tab.id);
                return (
                  <button
                    key={tab.id}
                    className={`w-5 h-5 flex items-center justify-center rounded-full text-white text-xs font-medium transition-colors shadow-sm ${editor && editor.getCurrentLayerType() === activeLayerType && editor.getActiveLayerTabId && editor.getActiveLayerTabId(activeLayerType) === tab.id ? 'opacity-100 scale-100 ring-2 ring-offset-1' : 'opacity-90 scale-95'}`}
                    onClick={() => {
                      if (!editor) return;
                      editor.setActiveLayerTab(activeLayerType!, tab.id);
                      try { editor.refreshTilePalette(true); } catch { /* ignore */ }
                      setTabTick(t => t + 1);
                    }}
                    style={{
                      background: (editor && editor.getActiveLayerTabId && editor.getActiveLayerTabId(activeLayerType) === tab.id) ? '#ea580c' : '#f97316'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })
            ) : (
              <div className="text-xs text-muted-foreground">No tabs</div>
            )}
          </div>
        </div>
      );
    })()}
    <div className="relative flex-1 min-h-0 overflow-auto flex flex-col">
      <div
        id="tilesContainer"
        className="tile-palette flex flex-col flex-1 min-h-0 overflow-y-auto p-0 m-0 justify-start pb-12"
        onWheel={(event: React.WheelEvent<HTMLDivElement>) => {
          const el = event.currentTarget as HTMLDivElement;
          if (el.scrollWidth > el.clientWidth) {
            event.preventDefault();
            el.scrollLeft += event.deltaY;
          }
        }}
      ></div>
      <div data-brush-tool={brushTool} className="hidden"></div>
    </div>
  </div>
);

};

export default TilesetPalette;
