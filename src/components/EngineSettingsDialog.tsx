import { Button } from '@/components/ui/button';
import { Moon, Sun, Target, X, Save, Settings, Eye, PanelLeft, History } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import UndoPersistencePanel from '@/components/UndoPersistencePanel';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';

type SettingsTab = 'general' | 'save' | 'display';

type EngineSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  setIsDarkMode: Dispatch<SetStateAction<boolean>>;
  editor: TileMapEditor | null;
  showActiveGid: boolean;
  setShowActiveGid: Dispatch<SetStateAction<boolean>>;
  showSidebarToggle: boolean;
  setShowSidebarToggle: Dispatch<SetStateAction<boolean>>;
  undoPersistenceEnabled?: boolean;
  setUndoPersistenceEnabled?: Dispatch<SetStateAction<boolean>>;
  onClearUndoHistory?: () => void;
  undoStorageSizeKB?: number;
};

const EngineSettingsDialog = ({
  open,
  onClose,
  isDarkMode,
  setIsDarkMode,
  editor,
  showActiveGid,
  setShowActiveGid,
  showSidebarToggle,
  setShowSidebarToggle,
  undoPersistenceEnabled = false,
  setUndoPersistenceEnabled,
  onClearUndoHistory,
  undoStorageSizeKB
}: EngineSettingsDialogProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [, setForceRender] = useState(0);
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'engine_settings', initialWidth: 450, initialHeight: 500, minWidth: 380, minHeight: 400 });

  if (!open) return null; 

  const tabs: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
    { id: 'general', icon: <Settings className="w-4 h-4" />, label: 'General' },
    { id: 'save', icon: <Save className="w-4 h-4" />, label: 'Save & History' },
    { id: 'display', icon: <Eye className="w-4 h-4" />, label: 'Display' },
  ];

  const dialogContent = (
    <>
      <div 
        ref={dialogRef}
        className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 50,
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex justify-between items-center p-4 border-b border-border cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <h3 className="text-lg font-semibold">Engine Settings</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation - Icon only with tooltips */}
        <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
          {tabs.map((tab) => (
            <Tooltip key={tab.id} content={tab.label} side="top">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`p-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-orange-600 text-white'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Theme (Experimental)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Light Mode</span>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isDarkMode ? 'bg-orange-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isDarkMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                    <span className="sr-only">Toggle dark mode</span>
                  </button>
                  <span className="text-sm flex items-center gap-1">
                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    Dark Mode
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Debug Mode</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Disabled</span>
                  <button
                    onClick={() => {
                      if (editor) {
                        editor.toggleDebugMode();
                        setForceRender(prev => prev + 1);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editor?.getDebugMode() ? 'bg-orange-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editor?.getDebugMode() ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                    <span className="sr-only">Toggle debug mode</span>
                  </button>
                  <span className="text-sm flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    Debug Tiles
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Shows tile boundaries and coordinates for debugging
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Minimap View Mode</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Bird's-eye (Orthogonal)</span>
                  <button
                    onClick={() => {
                      if (editor) {
                        editor.toggleMinimapMode();
                        setForceRender(prev => prev + 1);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editor?.getMinimapMode() === 'isometric' ? 'bg-orange-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editor?.getMinimapMode() === 'isometric' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                    <span className="sr-only">Toggle Minimap View Mode</span>
                  </button>
                  <span className="text-sm">Isometric (Grid)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Switches the minimap between orthogonal top-down and isometric views.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Minimap Window Size</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0.5" 
                    max="3.0" 
                    step="0.1" 
                    value={editor?.getMinimapWindowScale() || 1.0}
                    onChange={(e) => {
                      if (editor) {
                        editor.setMinimapWindowScale(parseFloat(e.target.value));
                        setForceRender(prev => prev + 1);
                      }
                    }}
                    className="flex-1 accent-orange-600"
                  />
                  <span className="text-xs font-mono w-10 text-right">
                    {((editor?.getMinimapWindowScale() || 1.0) * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Changes the dimensions of the minimap UI box.
                </p>
              </div>
            </div>
          )}

          {/* Save Tab */}
          {activeTab === 'save' && (
            <div className="space-y-4">
              {/* Undo Persistence Settings */}
              {setUndoPersistenceEnabled ? (
                <UndoPersistencePanel
                  enabled={undoPersistenceEnabled}
                  onEnabledChange={setUndoPersistenceEnabled}
                  onClearHistory={onClearUndoHistory}
                  storageSizeKB={undoStorageSizeKB}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Save manually using the Save button in the sidebar or Ctrl+S.</p>
              )}
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Active GID Indicator</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Show</span>
                  <button
                    onClick={() => {
                      const newVal = !showActiveGid;
                      setShowActiveGid(newVal);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showActiveGid ? 'bg-orange-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showActiveGid ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                    <span className="sr-only">Toggle Active GID Indicator</span>
                  </button>
                  <span className="text-sm">{showActiveGid ? 'Shown' : 'Hidden'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Toggle whether the Active GID badge is visible next to the hover coordinates.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sidebar Collapse Button</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Show toggle</span>
                  <button
                    onClick={() => setShowSidebarToggle((s: boolean) => !s)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showSidebarToggle ? 'bg-orange-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showSidebarToggle ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                    <span className="sr-only">Toggle sidebar collapse button</span>
                  </button>
                  <span className="text-sm">{showSidebarToggle ? 'Shown' : 'Hidden'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Show or hide the left-edge sidebar collapse/expand toggle.</p>
              </div>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
          title="Drag to resize"
        >
          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
};

export default EngineSettingsDialog;
