import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FolderOpen, Map, Grid3X3, Folder, Minus, Square, X } from 'lucide-react';

interface WelcomeScreenProps {
  onCreateNewMap: (config: MapConfig) => void;
  onOpenMap: (projectPath: string) => void;
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

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onCreateNewMap, onOpenMap }) => {
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
          
          onCreateNewMap(mapConfig);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        {/* Custom Title Bar */}
        <div className="bg-gray-100 text-orange-600 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200">
          <div className="text-sm font-medium">Tile Map Editor</div>
          <div className="flex no-drag">
            <button 
              onClick={handleMinimize}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 px-3 py-1 text-sm rounded transition-colors"
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button 
              onClick={handleMaximize}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 px-3 py-1 text-sm rounded transition-colors"
              title="Maximize"
            >
              <Square className="w-4 h-4" />
            </button>
            <button 
              onClick={handleClose}
              className="text-gray-500 hover:text-red-600 hover:bg-gray-200 px-3 py-1 text-sm rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
              <Map className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Map</h2>
            <p className="text-gray-600 mt-2">Configure your new tile map project</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Map Name
              </label>
              <Input
                value={mapConfig.name}
                onChange={(e) => setMapConfig({ ...mapConfig, name: e.target.value })}
                placeholder="Enter map name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Custom Title Bar */}
      <div className="bg-gray-100 text-orange-600 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200">
        <div className="text-sm font-medium">Tile Map Editor</div>
        <div className="flex no-drag">
          <button 
            onClick={handleMinimize}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 px-3 py-1 text-sm rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={handleMaximize}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 px-3 py-1 text-sm rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClose}
            className="text-gray-500 hover:text-red-600 hover:bg-gray-200 px-3 py-1 text-sm rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Recent Maps */}
        <div className="w-80 bg-white border-r border-slate-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Maps</h3>
            <div className="space-y-2">
              {recentMaps.map((map) => (
                <div
                  key={map.id}
                  className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => handleOpenRecentMap(map)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                      <Grid3X3 className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{map.name}</p>
                      <p className="text-sm text-gray-500">{map.lastModified}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {recentMaps.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Grid3X3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No recent maps</p>
              <p className="text-sm">Create your first map to get started</p>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            {/* Logo */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mb-4 shadow-lg">
                <Map className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Tile Map Editor</h1>
              <p className="text-gray-600 text-lg">Create stunning isometric tile maps for your games</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="w-full h-12 text-lg"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Map
              </Button>

              <Button 
                variant="outline"
                onClick={handleOpenMapProject}
                className="w-full h-12 text-lg"
                size="lg"
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                Open Map Project
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
