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
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    name: 'New Map',
    width: 20,
    height: 15,
    tileSize: 64, // Fixed tile size for isometric tiles
    location: ''
  });

  // Load recent maps from localStorage on component mount
  useEffect(() => {
    const savedRecentMaps = localStorage.getItem('recentMaps');
    if (savedRecentMaps) {
      setRecentMaps(JSON.parse(savedRecentMaps));
    }
  }, []);

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
          <div className="text-sm font-medium">Tile Map Editor</div>
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
            <p className="text-gray-600 dark:text-gray-300 mt-2">Configure your new project</p>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Width (tiles)
                </label>
                <Input
                  type="number"
                  value={mapConfig.width}
                  onChange={(e) => setMapConfig({ ...mapConfig, width: parseInt(e.target.value) || 20 })}
                  min="5"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Height (tiles)
                </label>
                <Input
                  type="number"
                  value={mapConfig.height}
                  onChange={(e) => setMapConfig({ ...mapConfig, height: parseInt(e.target.value) || 15 })}
                  min="5"
                  max="100"
                />
              </div>
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
              Create Map
            </Button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-900 dark:to-neutral-800 flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      {/* Custom Title Bar */}
      <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700">
        <div className="text-sm font-medium">Flarism</div> {/* TODO: ADD A SMALL ICON BEFORE THIS TEXT */}
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
      
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Recent Maps */}
        <div className="w-80 bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-700 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Projects</h3>
            <div className="space-y-2">
              {recentMaps.map((map) => (
                <div
                  key={map.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                  onClick={() => handleOpenRecentMap(map)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded flex items-center justify-center">
                      <Grid3X3 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{map.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{map.lastModified}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {recentMaps.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <Grid3X3 className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>No recent project</p>
              <p className="text-sm">Create your first projet to get started</p>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            {/* Logo */}
            <div className="mb-3">
              <div className="inline-flex items-center justify-center w-50 h-20">
                <img src="/flare-logo.png" alt="Flare Logo" className="w-100 h-100 object-contain"/>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-lg">Modern & Simple GUI for Flare</p>
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
