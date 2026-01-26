import { Button } from '@/components/ui/button';
import { Moon, Sun, Target, X, HelpCircle } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { Dispatch, SetStateAction } from 'react';

type EngineSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  setIsDarkMode: Dispatch<SetStateAction<boolean>>;
  editor: TileMapEditor | null;
  autoSaveEnabled: boolean;
  setAutoSaveEnabledState: Dispatch<SetStateAction<boolean>>;
  showActiveGid: boolean;
  setShowActiveGid: Dispatch<SetStateAction<boolean>>;
  showSidebarToggle: boolean;
  setShowSidebarToggle: Dispatch<SetStateAction<boolean>>;
};

const EngineSettingsDialog = ({
  open,
  onClose,
  isDarkMode,
  setIsDarkMode,
  editor,
  autoSaveEnabled,
  setAutoSaveEnabledState,
  showActiveGid,
  setShowActiveGid,
  showSidebarToggle,
  setShowSidebarToggle
}: EngineSettingsDialogProps) => {
  if (!open) return null; 

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
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
            <label className="block text-sm font-medium mb-2">Auto-Save</label>
            <div className="flex items-center gap-2">
              <span className="text-sm">Disabled</span>
              <button
                onClick={() => {
                  const newEnabled = !autoSaveEnabled;
                  setAutoSaveEnabledState(newEnabled);
                  if (editor) {
                    editor.setAutoSaveEnabled(newEnabled);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoSaveEnabled ? 'bg-orange-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
                <span className="sr-only">Toggle auto-save</span>
              </button>
              <span className="text-sm">
                Enabled
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Automatically saves your work every 8 seconds
            </p>
          </div>
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
      </div>
    </div>
  );
};

export default EngineSettingsDialog;
