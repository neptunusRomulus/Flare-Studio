import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Folder, Plus } from 'lucide-react';

type Props = {
  mapsDropdownOpen: boolean;
  mapsDropdownPos: { left: number; top: number } | null;
  mapsPortalRef: React.RefObject<HTMLDivElement>;
  mapsSubOpen: boolean;
  currentProjectPath: string | null;
  projectMaps: string[];
  setMapsSubOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMapsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  
  handleOpenCreateMapDialog: () => void;
  handleOpenMap: (path: string) => Promise<void>;
  toast: (args: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
};

const MapsDropdown: React.FC<Props> = ({
  mapsDropdownOpen,
  mapsDropdownPos,
  mapsPortalRef,
  mapsSubOpen,
  currentProjectPath,
  projectMaps,
  setMapsSubOpen,
  setMapsDropdownOpen,
  handleOpenCreateMapDialog,
  handleOpenMap,
  toast
}) => {
  useEffect(() => {
    if (!mapsDropdownOpen) return;
    // nothing to do here for now; parent triggers refresh before toggling
  }, [mapsDropdownOpen]);

  if (!mapsDropdownOpen || !mapsDropdownPos) return null;

  return createPortal(
    <div
      ref={mapsPortalRef}
      style={{ left: mapsDropdownPos.left, top: mapsDropdownPos.top, position: 'absolute', transform: 'translateY(-100%)' }}
      className="w-56 bg-background border border-border rounded shadow-lg z-[9999]"
    >
      <div className="max-h-60 overflow-y-auto minimal-scroll">
        {currentProjectPath ? (
          <>
            <div className="relative">
              <button
                className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
                onClick={() => setMapsSubOpen(s => !s)}
              >
                <span className="flex items-center gap-2"><Folder className="w-3 h-3" /><span>Open map</span></span>
                <svg className={`w-3 h-3 transition-transform ${mapsSubOpen ? 'transform rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>

              {/* nested maps list portal handled by parent when mapsSubOpen is true */}
            </div>

            <div className="p-2 text-xs">{projectMaps.length === 0 ? 'No maps found in project.' : null}</div>

            {projectMaps.map((m) => (
              <button
                key={m}
                className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
                onClick={async () => {
                  try {
                    // Extract map name from filename (e.g., "m1.json" -> "m1")
                    const mapName = m.replace(/\.(json|txt)$/i, '');
                    // Pass currentProjectPath, createTab flag, and mapName correctly
                    if (currentProjectPath) {
                      await handleOpenMap(currentProjectPath, false, mapName);
                    } else {
                      toast({ title: 'Error', description: 'No project path available.', variant: 'destructive' });
                    }
                    setMapsDropdownOpen(false);
                  } catch (err) {
                    console.error('Open map failed', err);
                    toast({ title: 'Open failed', description: 'Unable to open map.', variant: 'destructive' });
                  }
                }}
              >
                <span className="truncate">{m}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <button
              className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
              onClick={async () => {
                  try {
                    // ask parent to handle open directory; parent previously used electronAPI.selectDirectory
                    // fall back to toast if unavailable
                    const selectDir = (window as unknown as { electronAPI?: { selectDirectory?: () => Promise<string | null> } })?.electronAPI?.selectDirectory;
                    if (selectDir) {
                      const selected = await selectDir();
                      if (selected) {
                        await handleOpenMap(selected);
                      }
                    } else {
                      toast({ title: 'Open unavailable', description: 'Open project requires the desktop app.', variant: 'destructive' });
                    }
                } catch (err) {
                  console.error('Failed to select directory:', err);
                  toast({ title: 'Open failed', description: 'Unable to open project directory.', variant: 'destructive' });
                }
              }}
            >
              <Folder className="w-3 h-3" />
              <span>Open project...</span>
            </button>

            <div className="border-t border-border" />

            <div className="p-2 text-xs">No project is currently open. Open a project to list maps and enable Export.</div>

            <div className="border-t border-border" />

            <button
              className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
              onClick={() => {
                setMapsDropdownOpen(false);
                handleOpenCreateMapDialog();
              }}
            >
              <Plus className="w-3 h-3" />
              <span>Create new map</span>
            </button>
          </>
        )}
      </div>
    </div>, document.body
  );
};

export default MapsDropdown;
