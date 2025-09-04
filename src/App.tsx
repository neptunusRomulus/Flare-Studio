import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Undo2, Redo2, Plus, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle } from 'lucide-react';
import { TileMapEditor } from './editor/TileMapEditor';
import { TileLayer } from './types';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import WelcomeScreen from './components/WelcomeScreen';

interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
}

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [editor, setEditor] = useState<TileMapEditor | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapWidth, setMapWidth] = useState(20);
  const [mapHeight, setMapHeight] = useState(15);
  const [activeGid] = useState('(none)'); // Removed unused setter
  const [hoverInfo] = useState('Hover: -'); // Removed unused setter
  const [showMinimap, setShowMinimap] = useState(true);
  const [layers, setLayers] = useState<TileLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<number | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [editingLayerType, setEditingLayerType] = useState<'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc'>('background');
  const [showAddLayerDropdown, setShowAddLayerDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [hasTileset, setHasTileset] = useState(false);
  const [showEmptyTilesetTooltip, setShowEmptyTilesetTooltip] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (canvasRef.current && !showWelcome && !editor) {
      const tileEditor = new TileMapEditor(canvasRef.current);
      setEditor(tileEditor);
    }
  }, [showWelcome, editor]);

  // Layer management functions
  const updateLayersList = useCallback(() => {
    if (editor) {
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]); // Create a new array to ensure React detects changes
      const activeId = editor.getActiveLayerId();
      setActiveLayerId(activeId);
      
      // Check if active layer has a tileset
      const activeLayer = currentLayers.find(layer => layer.id === activeId);
      if (activeLayer) {
        setHasTileset(editor.hasLayerTileset(activeLayer.type));
      } else {
        setHasTileset(false);
      }
    }
  }, [editor]);

  useEffect(() => {
    if (editor) {
      updateLayersList();
    }
  }, [editor, updateLayersList]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      if (showAddLayerDropdown) {
        setShowAddLayerDropdown(false);
      }
    };

    if (showAddLayerDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showAddLayerDropdown]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => {
    const file = event.target.files?.[0];
    if (file && editor?.handleFileUpload) {
      editor.handleFileUpload(file, type);
    }
  };

  const handleAddLayer = () => {
    setShowAddLayerDropdown(!showAddLayerDropdown);
  };

  const handleCreateLayer = (type: 'npc' | 'enemy' | 'event' | 'collision' | 'object' | 'background') => {
    if (editor) {
      // Check if this type already exists
      const existingLayer = layers.find(layer => layer.type === type);
      if (existingLayer) {
        toast({
          variant: "destructive",
          title: "Cannot add layer",
          description: `A ${type} layer already exists. Only one layer per type is allowed.`,
        });
        setShowAddLayerDropdown(false);
        return;
      }

      // Generate appropriate default name for the layer type
      const defaultNames = {
        'npc': 'NPCs',
        'enemy': 'Enemies', 
        'event': 'Events',
        'collision': 'Collision',
        'object': 'Objects',
        'background': 'Background'
      };

      const success = editor.addLayer(defaultNames[type], type);
      if (success) {
        updateLayersList();
        // Set the new layer for editing
        const newLayers = editor.getLayers();
        const newLayer = newLayers.find(layer => layer.name === defaultNames[type] && layer.type === type);
        if (newLayer) {
          setEditingLayerId(newLayer.id);
          setEditingLayerName(newLayer.name);
          setEditingLayerType(newLayer.type);
        }
      }
      setShowAddLayerDropdown(false);
    }
  };

  const handleSaveLayerEdit = () => {
    if (editor && editingLayerId !== null && editingLayerName.trim()) {
      // Check if changing to a type that already exists (except for the current layer)
      const existingLayer = layers.find(layer => 
        layer.type === editingLayerType && layer.id !== editingLayerId
      );
      
      if (existingLayer) {
        toast({
          variant: "destructive",
          title: "Cannot change layer type",
          description: `A ${editingLayerType} layer already exists. Only one layer per type is allowed.`,
        });
        return;
      }

      editor.renameLayer(editingLayerId, editingLayerName.trim());
      editor.setLayerType(editingLayerId, editingLayerType);
      updateLayersList();
      setEditingLayerId(null);
    }
  };

  const handleCancelLayerEdit = () => {
    setEditingLayerId(null);
    setEditingLayerName('');
    setEditingLayerType('background');
  };

  const handleDeleteLayer = (layerId: number) => {
    if (editor) {
      const success = editor.deleteLayer(layerId);
      if (success) {
        updateLayersList();
      } else {
        toast({
          variant: "destructive",
          title: "Cannot delete layer",
          description: "There must be at least one layer.",
        });
      }
    }
  };

  const handleSetActiveLayer = (layerId: number) => {
    if (editor) {
      editor.setActiveLayer(layerId);
      setActiveLayerId(layerId);
    }
  };

  const handleToggleLayerVisibility = (layerId: number) => {
    if (editor) {
      editor.toggleLayerVisibility(layerId);
      // Force a fresh state update by creating a new array
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]); // Create a new array to trigger re-render
      
      // Also update tileset status for the active layer
      const activeId = editor.getActiveLayerId();
      const activeLayer = currentLayers.find(layer => layer.id === activeId);
      if (activeLayer) {
        setHasTileset(editor.hasLayerTileset(activeLayer.type));
      }
    }
  };

  const handleMapResize = () => {
    if (editor?.resizeMap) {
      editor.resizeMap(mapWidth, mapHeight);
    }
  };

  const handleZoomIn = () => {
    if (editor?.zoomIn) {
      editor.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (editor?.zoomOut) {
      editor.zoomOut();
    }
  };

  const handleResetZoom = () => {
    if (editor?.resetZoom) {
      editor.resetZoom();
    }
  };

  const handleUndo = () => {
    if (editor?.undo) {
      editor.undo();
      updateLayersList(); // Update UI after undo
    }
  };

  const handleRedo = () => {
    if (editor?.redo) {
      editor.redo();
      updateLayersList(); // Update UI after redo
    }
  };

  const handleExportMap = () => {
    if (editor?.exportFlareMap) {
      editor.exportFlareMap();
    }
  };

  const handleToggleMinimap = () => {
    if (editor?.toggleMinimap) {
      editor.toggleMinimap();
    }
    setShowMinimap(!showMinimap);
  };

  const handleCreateNewMap = (config: MapConfig) => {
    setMapWidth(config.width);
    setMapHeight(config.height);
    setShowWelcome(false);
    
    // Initialize editor with new configuration
    if (canvasRef.current) {
      const newEditor = new TileMapEditor(canvasRef.current);
      newEditor.setMapSize(config.width, config.height);
      setEditor(newEditor);
      updateLayersList();
    }
  };

  const handleOpenMap = async (projectPath: string) => {
    try {
      if (window.electronAPI?.openMapProject) {
        const mapConfig = await window.electronAPI.openMapProject(projectPath);
        if (mapConfig) {
          setMapWidth(mapConfig.width);
          setMapHeight(mapConfig.height);
          setShowWelcome(false);
          
          // Initialize editor with loaded configuration
          if (canvasRef.current) {
            const newEditor = new TileMapEditor(canvasRef.current);
            newEditor.setMapSize(mapConfig.width, mapConfig.height);
            setEditor(newEditor);
            updateLayersList();
          }
          
          toast({
            title: "Map Loaded",
            description: `Successfully loaded ${mapConfig.name}`,
            variant: "default",
          });
        }
      } else {
        // Fallback for web
        console.log('Opening map project:', projectPath);
        toast({
          title: "Feature Unavailable",
          description: "Map loading requires the desktop app.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error opening map project:', error);
      toast({
        title: "Error",
        description: "Failed to open map project. Please try again.",
        variant: "destructive",
      });
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

  return (
    <>
      {showWelcome ? (
        <WelcomeScreen 
          onCreateNewMap={handleCreateNewMap}
          onOpenMap={handleOpenMap}
        />
      ) : (
        <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Custom Title Bar */}
      <div className="bg-gray-800 text-white flex justify-between items-center px-4 py-1 select-none drag-region">
        <div className="text-sm font-medium">Flare Map Editor</div>
        <div className="flex no-drag">
          <button 
            onClick={handleMinimize}
            className="hover:bg-gray-600 p-1 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={handleMaximize}
            className="hover:bg-gray-600 p-1 rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClose}
            className="hover:bg-red-600 p-1 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside className="w-80 border-r bg-muted/30 p-4 overflow-y-auto">
          {/* Tileset Section */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Tileset</h2>
              <Button variant="outline" size="sm" className="relative">
                <Upload className="w-4 h-4 mr-2" />
                PNG
                <input
                  type="file"
                  accept="image/png"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => handleFileUpload(e, 'layerTileset')}
                />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              <div><span className="font-medium">{activeLayerId ? `${layers.find(l => l.id === activeLayerId)?.type || 'none'} tileset` : 'none tileset'}</span></div>
            </div>
            <div id="tilesetMeta" className="text-sm text-muted-foreground mb-2"></div>
            
            {/* Tiles Container with conditional tooltip */}
            <div className="relative">
              <div id="tilesContainer" className="tile-palette"></div>
              
              {!hasTileset && showEmptyTilesetTooltip && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-gray-100 rounded-lg shadow-lg border p-6 mx-4 my-4 relative max-w-sm">
                    {/* Close button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 w-6 h-6 p-0 hover:bg-gray-200"
                      onClick={() => setShowEmptyTilesetTooltip(false)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    
                    {/* Content */}
                    <div className="text-center pt-4">
                      <div className="flex items-center justify-center mb-3">
                        <Upload className="w-10 h-10 text-gray-500" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">No Tileset Imported</h3>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Import your tileset and start to paint map in the selected layer.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">Active GID: <span id="activeGid">{activeGid}</span></p>
          </section>

          {/* Layers Section */}
          <section>
            <h2 className="text-sm font-semibold mb-2">Layers</h2>
            
            {/* Layers List */}
            <div className="mb-2 space-y-1">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`p-2 border rounded transition-colors text-sm ${
                    activeLayerId === layer.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {editingLayerId === layer.id ? (
                    // Editing mode
                    <div className="space-y-2">
                      <Input
                        value={editingLayerName}
                        onChange={(e) => setEditingLayerName(e.target.value)}
                        className="text-sm h-6"
                        autoFocus
                      />
                      <Select 
                        value={editingLayerType} 
                        onValueChange={(value) => setEditingLayerType(value as 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc')}
                      >
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="background">Background</SelectItem>
                          <SelectItem value="object">Object</SelectItem>
                          <SelectItem value="collision">Collision</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="enemy">Enemy</SelectItem>
                          <SelectItem value="npc">NPC</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={handleSaveLayerEdit} className="h-6 text-xs px-2">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelLayerEdit} className="h-6 text-xs px-2">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Normal display mode
                    <div 
                      className="cursor-pointer"
                      onClick={() => handleSetActiveLayer(layer.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLayerVisibility(layer.id);
                            }}
                            className="w-6 h-6 p-0 hover:bg-gray-200"
                            title={layer.visible ? "Hide layer" : "Show layer"}
                          >
                            {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                          </Button>
                          <span className="text-sm font-medium">{layer.name}</span>
                          <span className="text-xs text-gray-500">({layer.type})</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLayer(layer.id);
                            }}
                            className="text-xs hover:bg-red-200 p-1 rounded text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add Layer Dropdown */}
              <div className="relative">
                <div
                  className="p-2 border rounded cursor-pointer transition-colors text-sm border-dashed border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddLayer();
                  }}
                >
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Add Layer</span>
                  </div>
                </div>
                
                {/* Dropdown Menu */}
                {showAddLayerDropdown && (
                  <div 
                    className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const allTypes: ('npc' | 'enemy' | 'event' | 'collision' | 'object' | 'background')[] = 
                        ['npc', 'enemy', 'event', 'collision', 'object', 'background'];
                      const existingTypes = layers.map(layer => layer.type);
                      const availableTypes = allTypes.filter(type => !existingTypes.includes(type));
                      
                      const typeLabels = {
                        'npc': 'NPC Layer',
                        'enemy': 'Enemy Layer',
                        'event': 'Event Layer',
                        'collision': 'Collision Layer',
                        'object': 'Object Layer',
                        'background': 'Background Layer'
                      };

                      if (availableTypes.length === 0) {
                        return (
                          <div className="p-2 text-xs text-gray-500 text-center">
                            All layer types already exist
                          </div>
                        );
                      }

                      return availableTypes.map(type => (
                        <div
                          key={type}
                          className="p-2 text-sm hover:bg-gray-100 cursor-pointer transition-colors"
                          onClick={() => handleCreateLayer(type)}
                        >
                          {typeLabels[type]}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </section>
        </aside>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Map Settings</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Map Width</label>
                  <Input
                    type="number"
                    value={mapWidth}
                    onChange={(e) => setMapWidth(Number(e.target.value))}
                    min="1"
                    max="100"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Map Height</label>
                  <Input
                    type="number"
                    value={mapHeight}
                    onChange={(e) => setMapHeight(Number(e.target.value))}
                    min="1"
                    max="100"
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSettings(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    handleMapResize();
                    setShowSettings(false);
                  }}
                  className="flex-1"
                >
                  Apply Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Center Area */}
        <section className="flex-1 min-w-0 flex flex-col relative">
          {/* Zoom Controls & Undo/Redo */}
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleRedo}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-8 h-8 p-0"
              onClick={handleResetZoom}
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant={showMinimap ? "default" : "outline"}
              className="w-8 h-8 p-0"
              onClick={handleToggleMinimap}
              title="Toggle Minimap"
            >
              <Map className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="bg-gray-100 flex-1 min-h-0 flex items-center justify-center overflow-hidden relative">
            {/* Canvas Tooltip Panel */}
            {showTooltip && (
              <div className="absolute top-4 left-4 z-20 p-3 bg-white/90 backdrop-blur-sm rounded-lg border shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 w-6 h-6 p-0"
                  onClick={() => setShowTooltip(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
                
                <div className="space-y-2 pr-6">
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <MousePointer2 className="w-4 h-4" />
                    <span>Left Click to Paint</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <Mouse className="w-4 h-4" />
                    <span>Right Click to Delete</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <Move className="w-4 h-4" />
                    <span>Spacebar + Mouse to Pan</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <div className="relative">
                      <Mouse className="w-4 h-4" />
                      <Circle className="w-2 h-2 absolute top-1 left-1.5 opacity-60" />
                    </div>
                    <span>Mouse Wheel to Zoom In-Out</span>
                  </div>
                </div>
              </div>
            )}
            
            <canvas
              ref={canvasRef}
              id="mapCanvas"
              className="tile-canvas w-full h-full max-w-full max-h-full"
            />
          </div>
          <div className="text-sm text-muted-foreground p-2 flex-shrink-0" id="hoverInfo">{hoverInfo}</div>
        </section>
      </main>
      
      {/* Fixed Export and Settings Buttons at Bottom of Screen */}
      <div className="fixed bottom-4 left-4 z-40">
        <div className="flex gap-2">
          <Button 
            onClick={handleExportMap} 
            title="Export Flare map.txt and tileset definition"
            className="w-10 h-10 p-0 shadow-lg"
            size="sm"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => setShowSettings(true)} 
            title="Map Settings"
            className="w-10 h-10 p-0 shadow-lg"
            variant="outline"
            size="sm"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <Toaster />
        </div>
      )}
    </>
  );
}

export default App;
