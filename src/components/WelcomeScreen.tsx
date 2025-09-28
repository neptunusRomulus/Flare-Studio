import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Plus, FolderOpen, Grid3X3, Folder, Minus, Square, X } from 'lucide-react';

interface WelcomeScreenProps {
  onCreateNewMap: (config: MapConfig, projectPath?: string) => void;
  onOpenMap: (projectPath: string) => void;
  isDarkMode: boolean;
}

interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
  isStartingMap?: boolean;
}

interface RecentMap {
  id: string;
  name: string;
  lastModified: string;
  path: string;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onCreateNewMap, onOpenMap, isDarkMode }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [recentMaps, setRecentMaps] = useState<RecentMap[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    name: 'ProjectName',
    width: 20,
    height: 15,
    tileSize: 64, // Fixed tile size for isometric tiles
    location: '',
    isStartingMap: false
  });

  // Load recent maps from localStorage on component mount and prune any missing projects (desktop)
  useEffect(() => {
    const loadAndPrune = async () => {
      const savedRecentMaps = localStorage.getItem('recentMaps');
      if (!savedRecentMaps) return;

      let maps: RecentMap[] = JSON.parse(savedRecentMaps);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api: any = (window as any).electronAPI;
      if (api && typeof api.checkProjectExists === 'function') {
        try {
          const checks = await Promise.all(maps.map(async (m) => {
            try {
              const exists = await api.checkProjectExists(m.path);
              return exists ? m : null;
            } catch (e) {
              // If check fails, keep the entry to avoid accidental deletion
              return m;
            }
          }));

          const filtered = checks.filter(Boolean) as RecentMap[];
          maps = filtered;
          // Persist pruned list if changed
          if (filtered.length !== JSON.parse(savedRecentMaps).length) {
            localStorage.setItem('recentMaps', JSON.stringify(filtered));
          }
        } catch (e) {
          console.warn('Prune recent maps failed:', e);
        }
      }

      setRecentMaps(maps);
    };

    loadAndPrune();
    // run only on mount
  }, []);

  // Load thumbnails for recent maps (try electron API, then file fallback)
  useEffect(() => {
    if (!recentMaps || recentMaps.length === 0) return;

    const loadFor = async (map: RecentMap) => {
      // If recentMaps entry already contains a thumbnailDataUrl, use it
      // (Some flows might store it in localStorage)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyMap = map as any;
      if (anyMap.thumbnailDataUrl) {
        setThumbnails(prev => ({ ...prev, [map.id]: anyMap.thumbnailDataUrl }));
        return;
      }

      try {
        // Preferred: ask preload/electron to return a data URL for the project's minimap
        // We check for a permissive API but gracefully continue if it doesn't exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api: any = (window as any).electronAPI;
        if (api && typeof api.getProjectThumbnail === 'function') {
          const dataUrl = await api.getProjectThumbnail(map.path);
          if (dataUrl) {
            setThumbnails(prev => ({ ...prev, [map.id]: dataUrl }));
            return;
          }
        }

        // If the preload API doesn't provide thumbnails, avoid attempting file:// access
        // from the renderer; it will be blocked by CSP in many dev setups. Instead
        // we simply mark the thumbnail as unavailable and rely on the preload API
        // or other flows to supply thumbnails.
        if (!(api && typeof api.getProjectThumbnail === 'function')) {
          setThumbnails(prev => ({ ...prev, [map.id]: null }));
          return;
        }
      } catch (e) {
        console.error('Failed to load thumbnail for', map.path, e);
      }

      // No thumbnail available
      setThumbnails(prev => ({ ...prev, [map.id]: null }));
    };

    recentMaps.forEach(m => {
      // kick off loading but do not block render
      loadFor(m);
    });

    // Cleanup: revoke object URLs on unmount
    return () => {
      Object.values(thumbnails).forEach(v => {
        if (v && v.startsWith('blob:')) URL.revokeObjectURL(v);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentMaps]);

  

  // Save recent maps to localStorage
  const saveRecentMaps = (maps: RecentMap[]) => {
    localStorage.setItem('recentMaps', JSON.stringify(maps));
    setRecentMaps(maps);
  };

  const handleSelectLocation = async () => {
    try {
      // Use the File System Access API or electron dialog
      if (window.electronAPI?.selectDirectory) {
        const selectedPath = await window.electronAPI.selectDirectory();
        if (selectedPath) {
          setMapConfig({ ...mapConfig, location: selectedPath });
        }
      } else {
        // Fallback for web - use directory picker if available
        if ('showDirectoryPicker' in window) {
          const dirHandle = await (window as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker();
          setMapConfig({ ...mapConfig, location: dirHandle.name });
        } else {
          // Fallback - just set a default location
          const defaultLocation = 'C:\\Users\\' + (navigator.userAgent.includes('Windows') ? process.env.USERNAME || 'User' : 'User') + '\\Documents\\TileMaps';
          setMapConfig({ ...mapConfig, location: defaultLocation });
        }
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  const handleCreateMap = async () => {
    if (!mapConfig.location) {
      alert('Please select a location for your map project');
      return;
    }

    const normalizedName = mapConfig.name.trim().toLowerCase();
    if (recentMaps.some((map) => map.name.trim().toLowerCase() === normalizedName)) {
      alert("There can't be maps that have the same name. Please type another name.");
      return;
    }

    try {
      // Create the project folder and save the map
      const projectPath = `${mapConfig.location}\\${mapConfig.name}`;
      
      if (window.electronAPI?.createMapProject) {
        const success = await window.electronAPI.createMapProject(mapConfig);
        if (success) {
          // Add to recent maps
          const newRecentMap: RecentMap = {
            id: Date.now().toString(),
            name: mapConfig.name,
            lastModified: 'Just now',
            path: projectPath
          };
          
          const updatedRecents = [newRecentMap, ...recentMaps.slice(0, 9)]; // Keep only 10 recent
          saveRecentMaps(updatedRecents);
          
          onCreateNewMap(mapConfig, projectPath);
        }
      } else {
        // Fallback for web - just proceed without actual file creation
        console.log('Creating map project:', mapConfig);
        onCreateNewMap(mapConfig);
      }
    } catch (error) {
      console.error('Error creating map project:', error);
      alert('Error creating map project. Please try again.');
    }
  };

  const handleOpenRecentMap = (recentMap: RecentMap) => {
    onOpenMap(recentMap.path);
  };

  const handleOpenMapProject = async () => {
    try {
      if (window.electronAPI?.selectDirectory) {
        const selectedPath = await window.electronAPI.selectDirectory();
        if (selectedPath) {
          onOpenMap(selectedPath);
        }
      } else {
        // Fallback for web
        alert('Open Map Project functionality requires the desktop app');
      }
    } catch (error) {
      console.error('Error opening map project:', error);
    }
  };

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    } else {
      console.log('Minimize clicked - Electron API not available');
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    } else {
      console.log('Maximize clicked - Electron API not available');
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      console.log('Close clicked - Electron API not available');
    }
  };

  if (showCreateForm) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-900 dark:to-neutral-800 flex flex-col ${isDarkMode ? 'dark' : ''}`}>
        {/* Custom Title Bar */}
        <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <img 
              src="/flare-ico.png" 
              alt="Flare Studio Logo" 
              className="w-6 h-6"
            />
            <span className="text-sm font-semibold">Flare Studio</span>
          </div>
          <div className="flex no-drag">
            <Tooltip content="Minimize">
              <button 
                onClick={handleMinimize}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700 px-3 py-1 text-sm rounded transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Maximize">
              <button 
                onClick={handleMaximize}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700 px-3 py-1 text-sm rounded transition-colors"
              >
                <Square className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Close">
              <button 
                onClick={handleClose}
                className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 px-3 py-1 text-sm rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center">
              <img src="/flare-logo.png" alt="Flare Logo" className="w-40 h-40 object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create a New Flare Project</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Name
              </label>
              <Input
                value={mapConfig.name}
                onChange={(e) => setMapConfig({ ...mapConfig, name: e.target.value })}
                placeholder="Enter map name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Location
              </label>
              <div className="flex gap-2">
                <Input
                  value={mapConfig.location}
                  onChange={(e) => setMapConfig({ ...mapConfig, location: e.target.value })}
                  placeholder="Select folder for your project"
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectLocation}
                >
                  <Folder className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowCreateForm(false)}
              className="flex-1"
            >
              Back
            </Button>
            <Button 
              onClick={handleCreateMap}
              className="flex-1"
            >
              Confirm
            </Button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-900 dark:to-neutral-800 flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      {/* Custom Title Bar */}
      <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700">
        <div className="flex items-center gap-1">
          <img 
            src="/flare-ico.png" 
            alt="Flare Studio Logo" 
            className="w-4 h-6"
          />
          <span className="text-sm font-semibold">Flare Studio</span>
        </div>
        <div className="flex no-drag">
          <Tooltip content="Minimize">
            <button 
              onClick={handleMinimize}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700 px-3 py-1 text-sm rounded transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Maximize">
            <button 
              onClick={handleMaximize}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700 px-3 py-1 text-sm rounded transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Close">
            <button 
              onClick={handleClose}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 px-3 py-1 text-sm rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
  {/* Left Sidebar - Recent Maps (scroll confined here) */}
  <div className="w-80 bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-700 p-6 flex flex-col h-full">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Projects</h3>
          </div>

          <div className="flex-1 min-h-0 h-full">
            <div className="space-y-2 overflow-y-auto minimal-scroll px-1 py-1 h-full">
              {recentMaps.map((map) => (
                <div
                  key={map.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                  onClick={() => handleOpenRecentMap(map)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900 rounded overflow-hidden flex items-center justify-center">
                      {thumbnails[map.id] ? (
                        <img src={thumbnails[map.id] || ''} alt={`${map.name} thumbnail`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Grid3X3 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{map.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{map.lastModified}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {recentMaps.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Grid3X3 className="w-20 h-20 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p>No recent project</p>
                <p className="text-sm">Create your first projet to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            {/* Logo */}
            <div className="mb-3">
              <div className="inline-flex items-center justify-center w-50 h-20">
                <img src="/flare-logo.png" alt="Flare Logo" className="w-100 h-100 object-contain"/>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-lg">Flare Studio is an unofficial, community-made editor inspired by the Flare engine. It is not affiliated with the official Flare developers.</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="w-full h-12 text-lg"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Projet
              </Button>

              <Button 
                variant="outline"
                onClick={handleOpenMapProject}
                className="w-full h-12 text-lg"
                size="lg"
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                Open Existing Project
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
