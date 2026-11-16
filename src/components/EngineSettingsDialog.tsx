import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Moon, Sun, Target, X, Save, Settings, Eye, History, HelpCircle, FileText } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import UndoPersistencePanel from '@/components/UndoPersistencePanel';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import ResizeHandle from '@/components/ResizeHandle';
import { useDisplayScale } from '@/hooks/useInterfaceScale';
import { openEngineStudio } from '@/components/studio/engineStudio';

type SettingsTab = 'general' | 'save' | 'display' | 'files';

type EngineSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  setIsDarkMode: Dispatch<SetStateAction<boolean>>;
  editor: TileMapEditor | null;
  showActiveGid: boolean;
  setShowActiveGid: Dispatch<SetStateAction<boolean>>;
  debugMode: boolean;
  setDebugMode: Dispatch<SetStateAction<boolean>>;
  undoPersistenceEnabled?: boolean;
  setUndoPersistenceEnabled?: Dispatch<SetStateAction<boolean>>;
  onClearUndoHistory?: () => void;
  /** Tab to show when the dialog opens (e.g. 'display' from Help). */
  initialTab?: SettingsTab;
};

const EngineSettingsDialog = ({
  open,
  onClose,
  isDarkMode,
  setIsDarkMode,
  editor,
  showActiveGid,
  setShowActiveGid,
  debugMode,
  setDebugMode,
  undoPersistenceEnabled = false,
  setUndoPersistenceEnabled,
  onClearUndoHistory,
  initialTab
}: EngineSettingsDialogProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [, setForceRender] = useState(0);
  const { interfaceScale, textScale, setInterfaceScale, setTextScale, stepInterfaceScale, resetInterfaceScale } = useDisplayScale();
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'engine_settings', initialWidth: 450, initialHeight: 500, minWidth: 380, minHeight: 400 });

  useEffect(() => { if (open && initialTab) setActiveTab(initialTab); }, [open, initialTab]);

  if (!open) return null;

  const tabs: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
    { id: 'general', icon: <Settings className="w-4 h-4" />, label: 'General' },
    { id: 'save', icon: <Save className="w-4 h-4" />, label: 'Save & History' },
    { id: 'display', icon: <Eye className="w-4 h-4" />, label: 'Display' },
    { id: 'files', icon: <FileText className="w-4 h-4" />, label: 'Game files' },
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
              <Button
                type="button"
                variant="ghost"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-auto p-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-orange-600 text-white hover:bg-orange-600 hover:text-white'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
              </Button>
            </Tooltip>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium mb-2">Theme (Experimental)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Light Mode</span>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={isDarkMode}
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0 hover:bg-transparent transition-colors ${
                      isDarkMode ? 'bg-orange-600 hover:bg-orange-600' : 'bg-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isDarkMode ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    <span className="sr-only">Toggle dark mode</span>
                  </Button>
                  <span className="text-sm flex items-center gap-1">
                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    Dark Mode
                  </span>
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">Debug Mode</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Disabled</span>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={debugMode}
                    onClick={() => {
                      const next = !debugMode;
                      if (editor && editor.getDebugMode() !== next) editor.toggleDebugMode();
                      setDebugMode(next);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0 hover:bg-transparent transition-colors ${
                      debugMode ? 'bg-orange-600 hover:bg-orange-600' : 'bg-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        debugMode ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    <span className="sr-only">Toggle debug mode</span>
                  </Button>
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
                <Label className="block text-sm font-medium mb-2">Minimap View Mode</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Bird's-eye (Orthogonal)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={editor?.getMinimapMode() === 'isometric'}
                    onClick={() => {
                      if (editor) {
                        editor.toggleMinimapMode();
                        setForceRender(prev => prev + 1);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0 hover:bg-transparent transition-colors ${
                      editor?.getMinimapMode() === 'isometric' ? 'bg-orange-600 hover:bg-orange-600' : 'bg-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editor?.getMinimapMode() === 'isometric' ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    <span className="sr-only">Toggle Minimap View Mode</span>
                  </Button>
                  <span className="text-sm">Isometric (Grid)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Switches the minimap between orthogonal top-down and isometric views.
                </p>
              </div>

              <div>
                <Label className="block text-sm font-medium mb-1">Minimap Window Size</Label>
                <div className="flex items-center gap-3">
                  <SliderPrimitive.Root
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    value={[editor?.getMinimapWindowScale() || 1.0]}
                    onValueChange={(vals) => {
                      if (editor) {
                        editor.setMinimapWindowScale(vals[0] ?? 1.0);
                        setForceRender(prev => prev + 1);
                      }
                    }}
                    className="relative flex flex-1 touch-none select-none items-center h-4"
                    aria-label="Minimap window size"
                  >
                    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
                      <SliderPrimitive.Range className="absolute h-full bg-orange-600" />
                    </SliderPrimitive.Track>
                    <SliderPrimitive.Thumb className="block h-3 w-3 rounded-full border-2 border-orange-600 bg-background shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                  </SliderPrimitive.Root>
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
                />
              ) : (
                <p className="text-sm text-muted-foreground">Save manually using the logo menu or Ctrl+S.</p>
              )}
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 min-w-0">
                    <Label className="text-sm font-medium">Interface size</Label>
                    <Tooltip content="Scales the whole window. Ctrl + / Ctrl - to change, Ctrl 0 to reset.">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-md border border-border text-sm hover:bg-muted" aria-label="Smaller interface" onClick={() => stepInterfaceScale(-1)}>−</Button>
                    <span className="w-12 text-center text-sm tabular-nums">{interfaceScale}%</span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-md border border-border text-sm hover:bg-muted" aria-label="Larger interface" onClick={() => stepInterfaceScale(1)}>+</Button>
                    {interfaceScale !== 100 && (
                      <Button type="button" variant="ghost" className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:bg-muted" onClick={resetInterfaceScale}>Reset</Button>
                    )}
                  </div>
                </div>
                <SliderPrimitive.Root
                  min={75}
                  max={200}
                  step={10}
                  value={[interfaceScale]}
                  onValueChange={(vals) => setInterfaceScale(vals[0] ?? interfaceScale)}
                  className="relative flex w-full touch-none select-none items-center h-4"
                  aria-label="Interface size"
                >
                  <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
                    <SliderPrimitive.Range className="absolute h-full bg-primary" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb className="block h-3 w-3 rounded-full border-2 border-primary bg-background shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </SliderPrimitive.Root>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 min-w-0">
                    <Label className="text-sm font-medium">Text size</Label>
                    <Tooltip content="Scales text only, on top of interface size.">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-md border border-border text-sm hover:bg-muted" aria-label="Smaller text" onClick={() => setTextScale(textScale - 10)}>−</Button>
                    <span className="w-12 text-center text-sm tabular-nums">{textScale}%</span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-md border border-border text-sm hover:bg-muted" aria-label="Larger text" onClick={() => setTextScale(textScale + 10)}>+</Button>
                  </div>
                </div>
                <SliderPrimitive.Root
                  min={75}
                  max={200}
                  step={10}
                  value={[textScale]}
                  onValueChange={(vals) => setTextScale(vals[0] ?? textScale)}
                  className="relative flex w-full touch-none select-none items-center h-4"
                  aria-label="Text size"
                >
                  <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
                    <SliderPrimitive.Range className="absolute h-full bg-primary" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb className="block h-3 w-3 rounded-full border-2 border-primary bg-background shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </SliderPrimitive.Root>
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">Active GID Indicator</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Show</span>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={showActiveGid}
                    onClick={() => {
                      const newVal = !showActiveGid;
                      setShowActiveGid(newVal);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0 hover:bg-transparent transition-colors ${
                      showActiveGid ? 'bg-orange-600 hover:bg-orange-600' : 'bg-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showActiveGid ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    <span className="sr-only">Toggle Active GID Indicator</span>
                  </Button>
                  <span className="text-sm">{showActiveGid ? 'Shown' : 'Hidden'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Toggle whether the Active GID badge is visible next to the hover coordinates.</p>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Engine data files including stats, the XP table, titles, loot currency, hero appearance and equipment layers.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 rounded-md border border-border text-sm hover:bg-muted"
                onClick={() => openEngineStudio('files')}
              >
                Open engine files
              </Button>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <ResizeHandle onMouseDown={handleResizeMouseDown} />
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
};

export default EngineSettingsDialog;