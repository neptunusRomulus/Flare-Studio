import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Undo2, Redo2, Plus, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle, Paintbrush2, PaintBucket, Eraser, MousePointer, Wand2, Target, Shapes, Pen, Stamp, Pipette, Sun, Moon, Sliders, MapPin, Save } from 'lucide-react';
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
  const [showMinimap, setShowMinimap] = useState(true);
  const [layers, setLayers] = useState<TileLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [showAddLayerDropdown, setShowAddLayerDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [hasTileset, setHasTileset] = useState(false);
  const [showEmptyTilesetTooltip, setShowEmptyTilesetTooltip] = useState(true);
  
  // Toolbar states
  const [selectedTool, setSelectedTool] = useState('brush');
  const [showBrushOptions, setShowBrushOptions] = useState(false);
  const [showSelectionOptions, setShowSelectionOptions] = useState(false);
  const [showShapeOptions, setShowShapeOptions] = useState(false);
  
  // Sub-tool states
  const [selectedBrushTool, setSelectedBrushTool] = useState('brush');
  const [selectedSelectionTool, setSelectedSelectionTool] = useState('rectangular');
  const [selectedShapeTool, setSelectedShapeTool] = useState('rectangle');
  
  // Settings states
  const [mapName, setMapName] = useState('Untitled Map');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from localStorage or default to false
    const savedTheme = localStorage.getItem('isDarkMode');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });
  
  // Auto-save states
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | 'unsaved'>('saved');
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [isManuallySaving, setIsManuallySaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  
  // Custom tooltip states
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    visible: boolean;
    fadeOut: boolean;
  } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Tool dropdown timeout refs
  const brushOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectionOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shapeOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Transparency states
  const [showTransparencySlider, setShowTransparencySlider] = useState<number | null>(null);
  const [layerTransparencies, setLayerTransparencies] = useState<{[key: number]: number}>({});
  
  // Hover coordinates state
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  
  const { toast } = useToast();

  // Handle dark mode toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Save to localStorage
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Helper function to set up auto-save for an editor instance
  const setupAutoSave = useCallback((editorInstance: TileMapEditor) => {
    // Set up optional callback for additional auto-save actions
    editorInstance.setAutoSaveCallback(async () => {
      // Optional: Add any additional save operations here
      // The main auto-save is handled internally by TileMapEditor
      setLastSaveTime(Date.now());
    });

    editorInstance.setSaveStatusCallback((status) => {
      setSaveStatus(status);
      setHasUnsavedChanges(status === 'unsaved' || status === 'error');
    });

    editorInstance.setAutoSaveEnabled(autoSaveEnabled);
  }, [autoSaveEnabled]);

  useEffect(() => {
    if (canvasRef.current && !showWelcome && !editor) {
      const tileEditor = new TileMapEditor(canvasRef.current);
      
      // Try to load from localStorage backup first
      const hasBackup = tileEditor.loadFromLocalStorage();
      if (hasBackup) {
        console.log('Loaded from localStorage backup');
        // Update UI to reflect loaded data
        setMapWidth(tileEditor.getMapWidth());
        setMapHeight(tileEditor.getMapHeight());
      }
      
      setupAutoSave(tileEditor);
      setEditor(tileEditor);
    }
  }, [showWelcome, editor, setupAutoSave]);

  // Track hover coordinates
  useEffect(() => {
    if (!editor) return;

    const updateHoverCoords = () => {
      const coords = editor.getHoverCoordinates();
      setHoverCoords(coords);
    };

    // Update hover coordinates on animation frame for smooth updates
    let animationFrameId: number;
    const pollHoverCoords = () => {
      updateHoverCoords();
      animationFrameId = requestAnimationFrame(pollHoverCoords);
    };

    pollHoverCoords();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [editor]);

  // Layer management functions
  const updateLayersList = useCallback(() => {
    if (editor) {
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]); // Create a new array to ensure React detects changes
      const activeId = editor.getActiveLayerId();
      setActiveLayerId(activeId);
      
      // Initialize transparency values for new layers
      setLayerTransparencies(prev => {
        const newTransparencies = { ...prev };
        currentLayers.forEach(layer => {
          if (!(layer.id in newTransparencies)) {
            newTransparencies[layer.id] = Math.round((layer.transparency || 1.0) * 100);
          }
        });
        return newTransparencies;
      });
      
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

  // Custom tooltip handlers
  const showTooltipWithDelay = useCallback((text: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 10;
    
    setTooltip({
      text,
      x,
      y,
      visible: true,
      fadeOut: false
    });

    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    // Set timeout to start fade out after 1 second
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip(prev => prev ? { ...prev, fadeOut: true } : null);
      
      // Remove tooltip completely after fade animation
      setTimeout(() => {
        setTooltip(null);
      }, 300); // Match CSS transition duration
    }, 1000);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltip(null);
  }, []);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      // Cleanup dropdown timeouts
      if (brushOptionsTimeoutRef.current) {
        clearTimeout(brushOptionsTimeoutRef.current);
      }
      if (selectionOptionsTimeoutRef.current) {
        clearTimeout(selectionOptionsTimeoutRef.current);
      }
      if (shapeOptionsTimeoutRef.current) {
        clearTimeout(shapeOptionsTimeoutRef.current);
      }
    };
  }, []);

  // Tool dropdown handlers
  const handleShowBrushOptions = useCallback(() => {
    // Clear all dropdown timeouts
    if (brushOptionsTimeoutRef.current) {
      clearTimeout(brushOptionsTimeoutRef.current);
    }
    if (selectionOptionsTimeoutRef.current) {
      clearTimeout(selectionOptionsTimeoutRef.current);
    }
    if (shapeOptionsTimeoutRef.current) {
      clearTimeout(shapeOptionsTimeoutRef.current);
    }
    
    // Close other dropdowns and show brush options
    setShowSelectionOptions(false);
    setShowShapeOptions(false);
    setShowBrushOptions(true);
  }, []);

  const handleHideBrushOptions = useCallback(() => {
    brushOptionsTimeoutRef.current = setTimeout(() => {
      setShowBrushOptions(false);
    }, 1000);
  }, []);

  const handleShowSelectionOptions = useCallback(() => {
    // Clear all dropdown timeouts
    if (brushOptionsTimeoutRef.current) {
      clearTimeout(brushOptionsTimeoutRef.current);
    }
    if (selectionOptionsTimeoutRef.current) {
      clearTimeout(selectionOptionsTimeoutRef.current);
    }
    if (shapeOptionsTimeoutRef.current) {
      clearTimeout(shapeOptionsTimeoutRef.current);
    }
    
    // Close other dropdowns and show selection options
    setShowBrushOptions(false);
    setShowShapeOptions(false);
    setShowSelectionOptions(true);
  }, []);

  const handleHideSelectionOptions = useCallback(() => {
    selectionOptionsTimeoutRef.current = setTimeout(() => {
      setShowSelectionOptions(false);
    }, 1000);
  }, []);

  const handleShowShapeOptions = useCallback(() => {
    // Clear all dropdown timeouts
    if (brushOptionsTimeoutRef.current) {
      clearTimeout(brushOptionsTimeoutRef.current);
    }
    if (selectionOptionsTimeoutRef.current) {
      clearTimeout(selectionOptionsTimeoutRef.current);
    }
    if (shapeOptionsTimeoutRef.current) {
      clearTimeout(shapeOptionsTimeoutRef.current);
    }
    
    // Close other dropdowns and show shape options
    setShowBrushOptions(false);
    setShowSelectionOptions(false);
    setShowShapeOptions(true);
  }, []);

  const handleHideShapeOptions = useCallback(() => {
    shapeOptionsTimeoutRef.current = setTimeout(() => {
      setShowShapeOptions(false);
    }, 1000);
  }, []);

  // Icon helper functions
  const getBrushIcon = () => {
    switch (selectedBrushTool) {
      case 'bucket':
        return <PaintBucket className="w-4 h-4" />;
      case 'eraser':
        return <Eraser className="w-4 h-4" />;
      default:
        return <Paintbrush2 className="w-4 h-4" />;
    }
  };

  const getSelectionIcon = () => {
    switch (selectedSelectionTool) {
      case 'magic-wand':
        return <Wand2 className="w-4 h-4" />;
      case 'same-tile':
        return <Target className="w-4 h-4" />;
      case 'circular':
        return <Circle className="w-4 h-4" />;
      default:
        return <MousePointer className="w-4 h-4" />;
    }
  };

  const getShapeIcon = () => {
    switch (selectedShapeTool) {
      case 'circle':
        return <Circle className="w-4 h-4" />;
      case 'line':
        return <Pen className="w-4 h-4" />;
      default:
        return <Shapes className="w-4 h-4" />;
    }
  };

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

      // Generate appropriate default name for the layer type with "Layer" suffix
      const defaultNames = {
        'npc': 'NPC Layer',
        'enemy': 'Enemy Layer', 
        'event': 'Event Layer',
        'collision': 'Collision Layer',
        'object': 'Object Layer',
        'background': 'Background Layer'
      };

      const success = editor.addLayer(defaultNames[type], type);
      if (success) {
        updateLayersList();
        toast({
          title: "Layer created",
          description: `${defaultNames[type]} has been created successfully.`,
        });
      }
      setShowAddLayerDropdown(false);
    }
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

  const handleTransparencyChange = (layerId: number, transparency: number) => {
    setLayerTransparencies(prev => ({
      ...prev,
      [layerId]: transparency
    }));
    
    if (editor) {
      editor.setLayerTransparency(layerId, transparency / 100);
    }
  };

  const handleToggleTransparencySlider = (layerId: number) => {
    setShowTransparencySlider(prev => prev === layerId ? null : layerId);
  };

  const handleLayerTypeChange = (layerId: number, newType: 'npc' | 'enemy' | 'event' | 'collision' | 'object' | 'background') => {
    if (!editor) return;

    // Check if this type already exists in another layer
    const existingLayer = layers.find(layer => layer.type === newType && layer.id !== layerId);
    if (existingLayer) {
      toast({
        variant: "destructive",
        title: "Cannot change layer type",
        description: `A ${newType} layer already exists. Only one layer per type is allowed.`,
      });
      return;
    }

    // Generate appropriate name for the new type
    const typeNames = {
      'npc': 'NPC Layer',
      'enemy': 'Enemy Layer', 
      'event': 'Event Layer',
      'collision': 'Collision Layer',
      'object': 'Object Layer',
      'background': 'Background Layer'
    };

    // Update the layer type and name
    const success = editor.changeLayerType(layerId, newType, typeNames[newType]);
    if (success) {
      updateLayersList();
      toast({
        title: "Layer type changed",
        description: `Layer has been changed to ${typeNames[newType]}.`,
      });
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

  const handleManualSave = async () => {
    if (!editor) return;

    setIsManuallySaving(true);
    try {
      let success = false;
      
      if (currentProjectPath) {
        // Save to existing project
        success = await editor.saveProjectData(currentProjectPath);
      } else {
        // No project path - just save to localStorage
        editor.forceSave();
        success = true;
      }
      
      // Add a small delay to show the loading animation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (success) {
        toast({
          title: "Saved",
          description: currentProjectPath 
            ? "Your map project has been saved successfully."
            : "Your map has been saved to browser storage.",
          variant: "default",
        });
      } else {
        throw new Error("Save operation failed");
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save Error",
        description: "Failed to save your map. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsManuallySaving(false);
    }
  };

  const handleToggleMinimap = () => {
    if (editor?.toggleMinimap) {
      editor.toggleMinimap();
    }
    setShowMinimap(!showMinimap);
  };

  const handleCreateNewMap = (config: MapConfig, projectPath?: string) => {
    setMapWidth(config.width);
    setMapHeight(config.height);
    setCurrentProjectPath(projectPath || null); // Track project path
    setShowWelcome(false);
    
    // Initialize editor with new configuration
    if (canvasRef.current) {
      const newEditor = new TileMapEditor(canvasRef.current);
      newEditor.setMapSize(config.width, config.height);
      setupAutoSave(newEditor);
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
          setCurrentProjectPath(projectPath); // Track project path
          setShowWelcome(false);
          
          // Initialize editor with loaded configuration
          if (canvasRef.current) {
            const newEditor = new TileMapEditor(canvasRef.current);
            newEditor.setMapSize(mapConfig.width, mapConfig.height);
            
            // Try to load project data including tileset images
            await loadProjectData(newEditor, mapConfig);
            
            setupAutoSave(newEditor);
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

  // Helper function to load project data into editor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadProjectData = async (newEditor: TileMapEditor, mapConfig: any) => {
    try {
      // Load basic project data (layers, objects, dimensions)
      newEditor.loadProjectData(mapConfig);
      
      // If there are tileset images, load them
      if (mapConfig.tilesets && mapConfig.tilesets.length > 0) {
        const tileset = mapConfig.tilesets[0];
        if (tileset.fileName && mapConfig.tilesetImages && mapConfig.tilesetImages[tileset.fileName]) {
          await newEditor.loadTilesetFromDataURL(mapConfig.tilesetImages[tileset.fileName], tileset.fileName);
        }
      }
      
      newEditor.redraw();
    } catch (error) {
      console.error('Error loading project data:', error);
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
      <div className="bg-gray-100 text-orange-600 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">Flare Map Editor</div>
          {/* Save Status Indicator */}
          <div className="flex items-center gap-1 text-xs">
            {saveStatus === 'saving' && (
              <>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-orange-600">Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && lastSaveTime > 0 && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600">Saved</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-red-600">Save Error</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-yellow-600">Unsaved</span>
              </>
            )}
          </div>
        </div>
        <div className="flex no-drag">
          <button 
            onClick={handleMinimize}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={handleMaximize}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1 rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClose}
            className="text-gray-500 hover:text-red-600 hover:bg-gray-200 p-1 rounded transition-colors"
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
                    activeLayerId === layer.id ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'
                  }`}
                >
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
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTransparencySlider(layer.id);
                          }}
                          className="w-6 h-6 p-0 hover:bg-gray-200"
                          title="Adjust layer transparency"
                        >
                          <Sliders className="w-3 h-3" />
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
                  
                  {/* Transparency Slider */}
                  {showTransparencySlider === layer.id && (
                    <div className="mt-2 p-3 bg-gray-50 rounded border">
                      {/* Layer Type Selector */}
                      <div className="mb-3">
                        <label className="text-xs font-medium mb-1 block">Layer Type:</label>
                        <Select
                          value={layer.type}
                          onValueChange={(newType: 'npc' | 'enemy' | 'event' | 'collision' | 'object' | 'background') => 
                            handleLayerTypeChange(layer.id, newType)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
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
                      </div>
                      
                      {/* Transparency Control */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium">Transparency:</span>
                        <span className="text-xs text-gray-600">
                          {Math.round((layerTransparencies[layer.id] || 100))}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={layerTransparencies[layer.id] || 100}
                        onChange={(e) => handleTransparencyChange(layer.id, Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #ea580c 0%, #ea580c ${layerTransparencies[layer.id] || 100}%, #e5e7eb ${layerTransparencies[layer.id] || 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Transparent</span>
                        <span>Opaque</span>
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
                  <label className="block text-sm font-medium mb-2">Map Name</label>
                  <Input
                    type="text"
                    value={mapName}
                    onChange={(e) => setMapName(e.target.value)}
                    placeholder="Enter map name"
                    className="w-full"
                  />
                </div>
                
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
                
                <div>
                  <label className="block text-sm font-medium mb-2">Theme</label>
                  <div className="flex items-center justify-between">
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
                  <label className="block text-sm font-medium mb-2">Auto-Save</label>
                  <div className="flex items-center justify-between">
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
            
            {/* Hover Coordinates Display */}
            {hoverCoords && (
              <div className="absolute bottom-4 left-4 z-10 p-2 bg-gray-800/90 backdrop-blur-sm rounded-md border border-gray-600 text-white text-xs font-mono flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-300" />
                <span>{hoverCoords.x}, {hoverCoords.y}</span>
              </div>
            )}
          </div>
          
          {/* Toolbar */}
          <div className="flex-shrink-0 bg-gray-50 border-t p-2">
            <div className="flex gap-1 justify-center">
              
              {/* Brush Tool */}
              <div className="relative">
                <Button
                  variant={selectedTool === 'brush' ? 'default' : 'ghost'}
                  size="sm"
                  className="w-8 h-8 p-0 tool-button"
                  onClick={() => setSelectedTool('brush')}
                  onMouseEnter={(e) => {
                    handleShowBrushOptions();
                    showTooltipWithDelay('Brush Tool', e.currentTarget);
                  }}
                  onMouseLeave={() => {
                    handleHideBrushOptions();
                    hideTooltip();
                  }}
                >
                  {getBrushIcon()}
                </Button>
                
                {showBrushOptions && (
                  <div 
                    className="absolute bottom-full left-0 mb-1 bg-white border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
                    onMouseEnter={handleShowBrushOptions}
                    onMouseLeave={handleHideBrushOptions}
                  >
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedBrushTool('brush')}
                      onMouseEnter={(e) => showTooltipWithDelay('Brush Tool', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Paintbrush2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedBrushTool('bucket')}
                      onMouseEnter={(e) => showTooltipWithDelay('Bucket Fill', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <PaintBucket className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedBrushTool('eraser')}
                      onMouseEnter={(e) => showTooltipWithDelay('Eraser', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Eraser className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Selection Tool */}
              <div className="relative">
                <Button
                  variant={selectedTool === 'selection' ? 'default' : 'ghost'}
                  size="sm"
                  className="w-8 h-8 p-0 tool-button"
                  onClick={() => setSelectedTool('selection')}
                  onMouseEnter={(e) => {
                    handleShowSelectionOptions();
                    showTooltipWithDelay('Selection Tool', e.currentTarget);
                  }}
                  onMouseLeave={() => {
                    handleHideSelectionOptions();
                    hideTooltip();
                  }}
                >
                  {getSelectionIcon()}
                </Button>
                
                {showSelectionOptions && (
                  <div 
                    className="absolute bottom-full left-0 mb-1 bg-white border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
                    onMouseEnter={handleShowSelectionOptions}
                    onMouseLeave={handleHideSelectionOptions}
                  >
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedSelectionTool('rectangular')}
                      onMouseEnter={(e) => showTooltipWithDelay('Rectangular Selection', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedSelectionTool('magic-wand')}
                      onMouseEnter={(e) => showTooltipWithDelay('Magic Wand', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedSelectionTool('same-tile')}
                      onMouseEnter={(e) => showTooltipWithDelay('Select Same Tile', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Target className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedSelectionTool('circular')}
                      onMouseEnter={(e) => showTooltipWithDelay('Circular Select', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Circle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Shape Tool */}
              <div className="relative">
                <Button
                  variant={selectedTool === 'shape' ? 'default' : 'ghost'}
                  size="sm"
                  className="w-8 h-8 p-0 tool-button"
                  onClick={() => setSelectedTool('shape')}
                  onMouseEnter={() => handleShowShapeOptions()}
                  onMouseLeave={() => handleHideShapeOptions()}
                  title="Shape Tool"
                >
                  {getShapeIcon()}
                </Button>
                
                {showShapeOptions && (
                  <div 
                    className="absolute bottom-full left-0 mb-1 bg-white border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
                    onMouseEnter={handleShowShapeOptions}
                    onMouseLeave={handleHideShapeOptions}
                  >
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedShapeTool('rectangle')}
                      title="Rectangle Shape"
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedShapeTool('circle')}
                      title="Circle Shape"
                    >
                      <Circle className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedShapeTool('line')}
                      title="Line Shape"
                    >
                      <Pen className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Stamp Tool */}
              <Button
                variant={selectedTool === 'stamp' ? 'default' : 'ghost'}
                size="sm"
                className="w-8 h-8 p-0 tool-button"
                onClick={() => setSelectedTool('stamp')}
                title="Stamp Tool - Group tiles into a stamp and place them together"
              >
                <Stamp className="w-4 h-4" />
              </Button>

              {/* Eyedropper Tool */}
              <Button
                variant={selectedTool === 'eyedropper' ? 'default' : 'ghost'}
                size="sm"
                className="w-8 h-8 p-0 tool-button"
                onClick={() => setSelectedTool('eyedropper')}
                title="Eyedropper Tool - Pick a tile from the map to reuse"
              >
                <Pipette className="w-4 h-4" />
              </Button>

            </div>
          </div>
        </section>
      </main>
      
      {/* Fixed Export and Settings Buttons at Bottom of Screen */}
      <div className="fixed bottom-4 left-0 w-80 z-40">
        <div className="flex gap-2 justify-center px-4">
          <Button 
            onClick={handleExportMap} 
            title="Export Flare map.txt and tileset definition"
            className="shadow-lg flex items-center gap-2 px-4 py-2"
            size="sm"
          >
            <Download className="w-4 h-4" />
            <span>Export Map</span>
          </Button>
          <Button 
            onClick={handleManualSave}
            title={hasUnsavedChanges ? "Save changes" : "All changes saved"}
            className={`w-10 h-10 p-0 shadow-lg transition-colors ${
              isManuallySaving 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : hasUnsavedChanges 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
            disabled={isManuallySaving}
            size="sm"
          >
            {isManuallySaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
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
      
      {/* Custom Tooltip */}
      {tooltip && (
        <div
          className={`custom-tooltip ${tooltip.visible ? 'visible' : ''} ${tooltip.fadeOut ? 'fade-out' : ''}`}
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.text}
        </div>
      )}
        </div>
      )}
    </>
  );
}

export default App;
