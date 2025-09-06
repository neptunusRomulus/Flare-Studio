import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Undo2, Redo2, Plus, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle, Paintbrush2, PaintBucket, Eraser, MousePointer, Wand2, Target, Shapes, Pen, Stamp, Pipette, Sun, Moon, Sliders, MapPin, Save, ArrowUpDown, Link2, Scissors, Trash2, Check } from 'lucide-react';
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
  const [tileCount, setTileCount] = useState(0);
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
  const [pendingMapConfig, setPendingMapConfig] = useState<MapConfig | null>(null);
  
  // Toolbar states
  const [selectedTool, setSelectedTool] = useState('brush');
  const [showBrushOptions, setShowBrushOptions] = useState(false);
  const [showSelectionOptions, setShowSelectionOptions] = useState(false);
  const [showShapeOptions, setShowShapeOptions] = useState(false);
  
  // Sub-tool states
  const [selectedBrushTool, setSelectedBrushTool] = useState('brush');
  const [selectedSelectionTool, setSelectedSelectionTool] = useState('rectangular');
  const [selectedShapeTool, setSelectedShapeTool] = useState('rectangle');
  
  // Brush management states
  const [brushTool, setBrushTool] = useState<'none' | 'move' | 'merge' | 'separate' | 'remove'>('none');
  const [selectedBrushes, setSelectedBrushes] = useState<number[]>([]);
  
  // Stamp states
  const [stamps, setStamps] = useState<import('./types').Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<'select' | 'create' | 'place'>('select');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [newStampName, setNewStampName] = useState('');
  
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
  // Current project path for Electron saves
  const [projectPath, setProjectPath] = useState<string | null>(null);
  // When true, we're in the middle of opening an existing project
  // and should avoid creating a blank editor instance.
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  
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
  
  // Selection state
  const [selectionCount, setSelectionCount] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);
  
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
      // Persist to disk automatically when running in Electron with a project path
      try {
        if (window.electronAPI && projectPath) {
          await editorInstance.saveProjectData(projectPath);
        }
      } catch (e) {
        console.warn('Auto-save to disk failed:', e);
      }
      setLastSaveTime(Date.now());
    });

    editorInstance.setSaveStatusCallback((status) => {
      setSaveStatus(status);
      setHasUnsavedChanges(status === 'unsaved' || status === 'error');
    });

    editorInstance.setAutoSaveEnabled(autoSaveEnabled);
    
    // Set up eyedropper callback to switch back to brush tool
    editorInstance.setEyedropperCallback(() => {
      setSelectedTool('brush');
      setSelectedBrushTool('brush');
    });
    
    // Set up stamp callback to update stamps list
    editorInstance.setStampCallback((stampsList) => {
      setStamps(stampsList);
    });
  }, [autoSaveEnabled, projectPath]);

  // Wire Electron menu actions (Save/Open/New)
  // Moved after function definitions

  useEffect(() => {
    // Only create a default editor when switching from welcome screen to editor
    // Skip if we're actively opening a project (handleOpenMap will create the editor)
    if (canvasRef.current && !showWelcome && !editor && !isOpeningProject) {
      const tileEditor = new TileMapEditor(canvasRef.current);
      // Do NOT call loadFromLocalStorage() here - let the user manually load if needed
      setupAutoSave(tileEditor);
      setEditor(tileEditor);
      setTileCount(tileEditor.getTileCount());
    }
  }, [showWelcome, editor, setupAutoSave, isOpeningProject]);

  // Update tileCount when tileset changes
  useEffect(() => {
    if (editor) {
      setTileCount(editor.getTileCount());
    }
  }, [editor, hasTileset, layers]);

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

  // Sync tool selection with editor
  useEffect(() => {
    if (editor && selectedTool === 'brush') {
      // Map selectedBrushTool to editor tool types
      const toolMap: {[key: string]: 'brush' | 'eraser' | 'bucket'} = {
        'brush': 'brush',
        'bucket': 'bucket',
        'eraser': 'eraser'
      };
      const editorTool = toolMap[selectedBrushTool] || 'brush';
      editor.setCurrentTool(editorTool);
    } else if (editor && selectedTool === 'selection') {
      // Set the editor to selection mode and update selection tool
      const selectionToolMap: {[key: string]: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular'} = {
        'rectangular': 'rectangular',
        'magic-wand': 'magic-wand',
        'same-tile': 'same-tile',
        'circular': 'circular'
      };
      const editorSelectionTool = selectionToolMap[selectedSelectionTool] || 'rectangular';
      editor.setCurrentSelectionTool(editorSelectionTool);
    } else if (editor && selectedTool === 'shape') {
      // Set the editor to shape mode and update shape tool
      const shapeToolMap: {[key: string]: 'rectangle' | 'circle' | 'line'} = {
        'rectangle': 'rectangle',
        'circle': 'circle',
        'line': 'line'
      };
      const editorShapeTool = shapeToolMap[selectedShapeTool] || 'rectangle';
      editor.setCurrentShapeTool(editorShapeTool);
    } else if (editor && selectedTool === 'eyedropper') {
      // Set the editor to eyedropper mode
      editor.setEyedropperTool();
    } else if (editor && selectedTool === 'stamp') {
      // Set the editor to stamp mode
      editor.setStampTool();
    }
  }, [editor, selectedTool, selectedBrushTool, selectedSelectionTool, selectedShapeTool]);

  // Stamp mode synchronization
  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    editor.setCurrentStampMode(stampMode);
  }, [editor, selectedTool, stampMode]);

  // Stamp selection synchronization
  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    editor.setActiveStamp(selectedStamp);
  }, [editor, selectedTool, selectedStamp]);

  // Track selection state
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const selection = editor.getSelection();
      const hasActiveSelection = editor.hasActiveSelection();
      setSelectionCount(selection.length);
      setHasSelection(hasActiveSelection);
    };

    // Poll selection state (could be optimized with callbacks)
    const intervalId = setInterval(updateSelection, 100);

    return () => clearInterval(intervalId);
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
    setShowStampDialog(false);
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
    setShowStampDialog(false);
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

  // Stamp handlers
  const handleCreateStamp = useCallback(() => {
    if (!editor || !newStampName.trim()) return;
    
    const success = editor.createStampFromSelection(newStampName.trim());
    if (success) {
      setNewStampName('');
      setShowStampDialog(false);
      setStampMode('select');
    }
  }, [editor, newStampName]);

  const handleStampSelect = useCallback((stampId: string) => {
    setSelectedStamp(stampId);
    setStampMode('place');
  }, []);

  const handleDeleteStamp = useCallback((stampId: string) => {
    if (!editor) return;
    editor.deleteStamp(stampId);
    if (selectedStamp === stampId) {
      setSelectedStamp(null);
      setStampMode('select');
    }
  }, [editor, selectedStamp]);

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

  // Brush management handlers
  const handleMergeBrushes = useCallback(() => {
    if (!editor || selectedBrushes.length < 2) return;
    
    try {
      editor.mergeBrushes(selectedBrushes);
      setSelectedBrushes([]);
      setBrushTool('none');
    } catch (error) {
      console.error('Failed to merge brushes:', error);
    }
  }, [editor, selectedBrushes]);

  const handleCancelMerge = useCallback(() => {
    setSelectedBrushes([]);
    setBrushTool('none');
  }, []);

  const handleSeparateBrush = useCallback((brushId: number) => {
    if (!editor) return;
    
    try {
      editor.separateBrush(brushId);
    } catch (error) {
      console.error('Failed to separate brush:', error);
    }
  }, [editor]);

  const handleRemoveBrush = useCallback((brushId: number) => {
    if (!editor) return;
    
    console.log(`handleRemoveBrush called with brushId: ${brushId}`);
    const confirmed = window.confirm('Are you sure you want to remove this brush?');
    if (confirmed) {
      try {
        editor.removeBrush(brushId);
      } catch (error) {
        console.error('Failed to remove brush:', error);
      }
    } else {
      console.log('Brush removal cancelled by user');
    }
  }, [editor]);

  const handleBrushReorder = useCallback((fromTileIndex: number, toTileIndex: number) => {
    if (!editor) return;
    
    try {
      // Get the current brush order to find array indices
      const tileInfo = editor.getDetectedTileInfo();
      const fromIndex = tileInfo.findIndex(tile => tile.gid === fromTileIndex);
      const toIndex = tileInfo.findIndex(tile => tile.gid === toTileIndex);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        editor.reorderBrush(fromIndex, toIndex);
        console.log(`Reordered brush ${fromTileIndex} to position of ${toTileIndex}`);
      }
    } catch (error) {
      console.error('Failed to reorder brush:', error);
    }
  }, [editor]);

  // Effect to handle brush tool state changes
  useEffect(() => {
    console.log(`Brush tool changed to: ${brushTool}`);
    const brushToolElement = document.querySelector('[data-brush-tool]');
    if (brushToolElement) {
      brushToolElement.setAttribute('data-brush-tool', brushTool);
      console.log(`Updated existing data-brush-tool attribute to: ${brushTool}`);
    } else {
      // Create the brush tool state element if it doesn't exist
      const stateElement = document.createElement('div');
      stateElement.setAttribute('data-brush-tool', brushTool);
      stateElement.style.display = 'none';
      document.body.appendChild(stateElement);
      console.log(`Created new data-brush-tool element with value: ${brushTool}`);
    }
  }, [brushTool]);

  // Effect to listen for brush events from the editor
  useEffect(() => {
    const handleBrushAction = (event: CustomEvent) => {
      const { action, tileIndex } = event.detail;
      
      switch (action) {
        case 'select':
          setSelectedBrushes(prev => [...prev, tileIndex]);
          break;
        case 'deselect':
          setSelectedBrushes(prev => prev.filter(id => id !== tileIndex));
          break;
        case 'separate':
          handleSeparateBrush(tileIndex);
          break;
        case 'remove':
          handleRemoveBrush(tileIndex);
          break;
        case 'drop':
          if (event.detail.from && event.detail.to) {
            handleBrushReorder(event.detail.from, event.detail.to);
          }
          break;
      }
    };

    document.addEventListener('brushAction', handleBrushAction as EventListener);
    
    return () => {
      document.removeEventListener('brushAction', handleBrushAction as EventListener);
    };
  }, [handleSeparateBrush, handleRemoveBrush, handleBrushReorder]);

  // Helper function to load project data into editor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadProjectData = useCallback(async (newEditor: TileMapEditor, mapConfig: any) => {
    try {
      console.log('=== LOAD PROJECT DATA DEBUG ===');
      console.log('Map config received:', {
        name: mapConfig.name,
        tilesets: mapConfig.tilesets ? mapConfig.tilesets.length : 0,
        tilesetImages: mapConfig.tilesetImages ? Object.keys(mapConfig.tilesetImages).length : 0,
        layers: mapConfig.layers ? mapConfig.layers.length : 0
      });

      // Debug the map config structure in detail
      console.log('Map config full structure:', mapConfig);
      
      // Create layers from the saved config
      console.log('Creating layers from config...');
      const layers = mapConfig.layers || [];
      console.log('Layers from config:', layers);
      
      for (const layerData of layers) {
        console.log('Processing layer:', layerData);
        const layerAdded = newEditor.addLayer(layerData.name, layerData.type);
        
        if (layerAdded) {
          console.log(`Created layer: ${layerData.type} - ${layerData.name}`);
          
          // Find the newly created layer and set its data
          const createdLayer = newEditor.getLayers().find(l => l.type === layerData.type);
          if (createdLayer && layerData.data && Array.isArray(layerData.data)) {
            console.log(`Setting data for layer ${createdLayer.id} with ${layerData.data.length} tiles`);
            createdLayer.data = layerData.data;
          }
        } else {
          console.log(`Failed to create layer: ${layerData.type} - ${layerData.name}`);
        }
      }

      // Load tileset data from mapConfig
      console.log('=== LOADING TILESETS FROM CONFIG ===');
      console.log('Available tilesets in config:', mapConfig.tilesets);
      console.log('Available tileset images:', Object.keys(mapConfig.tilesetImages || {}));

      // Process each tileset from the config
      if (mapConfig.tilesets && Array.isArray(mapConfig.tilesets)) {
        for (const tileset of mapConfig.tilesets) {
          console.log('Processing tileset:', {
            fileName: tileset.fileName,
            name: tileset.name,
            detectedTiles: tileset.detectedTiles ? tileset.detectedTiles.length : 0
          });

          // Try to find the tileset image data
          if (tileset.fileName && mapConfig.tilesetImages && mapConfig.tilesetImages[tileset.fileName]) {
            console.log('Found tileset image data for:', tileset.fileName);
            console.log('Tileset filename:', tileset.fileName);
            console.log('Image data length:', mapConfig.tilesetImages[tileset.fileName].length);
            
            try {
              await newEditor.loadTilesetFromDataURL(mapConfig.tilesetImages[tileset.fileName], tileset.fileName);
              console.log('Successfully loaded tileset from data URL');
              
              // Load detected tile data if available
              if (tileset.detectedTiles && Array.isArray(tileset.detectedTiles)) {
                console.log('Loading detected tiles:', tileset.detectedTiles.length);
                // The detectedTileData is already loaded via the main loadProjectData call
                // Just log for now since the tileset data structure is handled internally
                console.log('Detected tiles will be preserved from project data');
              }
              
            } catch (tilesetError) {
              console.error('Failed to load tileset from data URL:', tilesetError);
            }
          } else {
            console.log('No image data found for tileset:', tileset.fileName);
            console.log('Available image keys:', Object.keys(mapConfig.tilesetImages || {}));
          }
        }
      }

      console.log('Project data loading completed');
      return true;
    } catch (error) {
      console.error('Error loading project data:', error);
      return false;
    }
  }, []);

  // Effect to handle pending map config when canvas becomes available
  useEffect(() => {
    if (pendingMapConfig && canvasRef.current && !showWelcome) {
      console.log('Canvas available and map config pending, creating editor...');
      
      const createEditorWithConfig = async () => {
        try {
          console.log('Creating new editor with pending config...');
          const newEditor = new TileMapEditor(canvasRef.current!);
          
          // Clear auto-save backup to prevent old data from loading
          console.log('Clearing local storage backup...');
          newEditor.clearLocalStorageBackup();
          
          console.log('Setting map size...');
          newEditor.setMapSize(pendingMapConfig.width, pendingMapConfig.height);
          
          // Load project data
          console.log('Loading project data...');
          const projectDataLoaded = await loadProjectData(newEditor, pendingMapConfig);
          console.log('Project data loading result:', projectDataLoaded);

          // Check editor state after loadProjectData
          console.log('=== EDITOR STATE AFTER loadProjectData ===');
          console.log('Tile count after loadProjectData:', newEditor.getTileCount());
          console.log('Active layer after loadProjectData:', newEditor.getActiveLayerId());
          console.log('Layers after loadProjectData:', newEditor.getLayers().map(l => ({ id: l.id, name: l.name, type: l.type })));

          // Discover and assign tilesets
          if (window.electronAPI?.discoverTilesetImages && projectPath) {
            console.log('Calling discoverTilesetImages for path:', projectPath);
            const found = await window.electronAPI.discoverTilesetImages(projectPath);
            
            const images = found?.tilesetImages || {};
            const imageKeys = Object.keys(images);

            if (imageKeys.length > 0) {
              const normalize = (s: string) => (s || '')
                .toLowerCase()
                .replace(/\.[^/.]+$/, '') // drop extension
                .replace(/[^a-z0-9]+/g, ' ') // non-alnum to space
                .trim();

              // Preserve the currently intended active layer to restore later
              const intendedActive = newEditor.getActiveLayerId();
              const layersToAssign = newEditor.getLayers();
              let assignedAny = false;

              for (const layer of layersToAssign) {
                // Try exact and fuzzy matches by filename
                const nameTargets = [normalize(layer.type), normalize(layer.name)];
                let matchKey: string | null = null;

                for (const key of imageKeys) {
                  const keyNorm = normalize(key);
                  if (nameTargets.includes(keyNorm)) {
                    matchKey = key;
                    break;
                  }
                }

                if (!matchKey) {
                  // Fallback: pick any key that contains layer type/name as substring
                  const keyByIncludes = imageKeys.find(k => {
                    const kn = normalize(k);
                    return nameTargets.some(t => t && kn.includes(t));
                  });
                  if (keyByIncludes) matchKey = keyByIncludes;
                }

                if (!matchKey && imageKeys.length === 1) {
                  // Final fallback: single image for the project
                  matchKey = imageKeys[0];
                }

                if (matchKey) {
                  console.log(`Assigning tileset '${matchKey}' to layer ${layer.id} (${layer.type})`);
                  // Make this layer active to store tileset under its type
                  newEditor.setActiveLayer(layer.id);
                  await newEditor.loadTilesetFromDataURL(images[matchKey], matchKey);
                  assignedAny = true;
                } else {
                  console.log(`No matching tileset found for layer ${layer.id} (${layer.type})`);
                }
              }

              // Restore intended active layer selection
              if (intendedActive !== null) {
                newEditor.setActiveLayer(intendedActive);
              }

              if (assignedAny) {
                setHasTileset(true);
                setTileCount(newEditor.getTileCount());
                // Trigger auto-save to preserve imported tilesets
                newEditor.forceSave();
              }
            }
          }

          console.log('Setting up autosave and updating UI...');
          setupAutoSave(newEditor);
          setEditor(newEditor);
          
          // Update layers list and UI state after everything is loaded
          setTimeout(() => {
            updateLayersList();
            // Force UI state update after loading
            const currentTileCount = newEditor.getTileCount();
            console.log('Final UI update - tile count:', currentTileCount);
            setHasTileset(currentTileCount > 0);
            setTileCount(currentTileCount);
            
            // Force a final redraw to ensure everything is visible
            newEditor.redraw();
          }, 150);

          // Clear pending config
          setPendingMapConfig(null);
          
          toast({
            title: "Project loaded",
            description: "The map has been loaded successfully."
          });
          
        } catch (error) {
          console.error('Failed to create editor with pending config:', error);
          toast({
            title: "Error",
            description: "Failed to load the project.",
            variant: "destructive"
          });
          setPendingMapConfig(null);
        }
      };

      createEditorWithConfig();
    }
  }, [pendingMapConfig, showWelcome, projectPath, setupAutoSave, updateLayersList, toast]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleManualSave = useCallback(async () => {
    if (!editor) return;
    setIsManuallySaving(true);
    try {
      if (window.electronAPI && projectPath) {
        const success = await editor.saveProjectData(projectPath);
        await new Promise(resolve => setTimeout(resolve, 300));
        if (success) {
          setLastSaveTime(Date.now());
          toast({
            title: "Saved",
            description: "Project saved to disk, including tileset.",
            variant: "default",
          });
        } else {
          toast({
            title: "Save Error",
            description: "Failed to save the project to disk.",
            variant: "destructive",
          });
        }
      } else {
        editor.forceSave();
        await new Promise(resolve => setTimeout(resolve, 500));
        toast({
          title: "Saved (Local Backup)",
          description: "Saved to local backup. Open a project folder to save to disk.",
          variant: "default",
        });
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
  }, [editor, projectPath, toast]);

  const handleToggleMinimap = () => {
    if (editor?.toggleMinimap) {
      editor.toggleMinimap();
    }
    setShowMinimap(!showMinimap);
  };

  const handleCreateNewMap = (config: MapConfig, newProjectPath?: string) => {
    // Clear any localStorage data immediately
    localStorage.removeItem('tilemap_autosave_backup');
    
    // Save the project path if provided (Electron)
    setProjectPath(newProjectPath ?? null);
    
    setMapWidth(config.width);
    setMapHeight(config.height);
    setMapName(config.name);
    setShowWelcome(false);
    
    // Clear existing editor state first
    if (editor) {
      setEditor(null);
    }
    
    // Initialize editor with new configuration
    if (canvasRef.current) {
      const newEditor = new TileMapEditor(canvasRef.current);
      // Reset all data to ensure clean state
      newEditor.resetForNewProject();
      newEditor.setMapSize(config.width, config.height);
      setupAutoSave(newEditor);
      setEditor(newEditor);
      updateLayersList();
      setTileCount(0); // Reset tile count for new project
      setHasTileset(false); // Reset tileset state
    }
  };

  const handleOpenMap = useCallback(async (projectPath: string) => {
    console.log('=== HANDLE OPEN MAP CALLED ===', projectPath);
    console.log('Project path details:', {
      path: projectPath,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Block the default editor creation effect while we open
      setIsOpeningProject(true);
      // Remember project path for subsequent saves
      setProjectPath(projectPath);
      if (window.electronAPI?.openMapProject) {
        console.log('Calling electronAPI.openMapProject...');
        const mapConfig = await window.electronAPI.openMapProject(projectPath);
        console.log('=== RAW MAP CONFIG RECEIVED ===');
        console.log('Full mapConfig object:', JSON.stringify(mapConfig, null, 2));
        
        if (mapConfig) {
          console.log('=== MAP CONFIG ANALYSIS ===');
          console.log('Map dimensions:', { width: mapConfig.width, height: mapConfig.height });
          console.log('Map name:', mapConfig.name);
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const extendedConfig = mapConfig as any;
          console.log('Tilesets count:', extendedConfig.tilesets ? extendedConfig.tilesets.length : 0);
          console.log('Tileset images count:', extendedConfig.tilesetImages ? Object.keys(extendedConfig.tilesetImages).length : 0);
          console.log('Layers count:', extendedConfig.layers ? extendedConfig.layers.length : 0);
          
          if (extendedConfig.tilesets) {
            console.log('=== TILESETS DETAILS ===');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extendedConfig.tilesets.forEach((tileset: any, index: number) => {
              console.log(`Tileset ${index}:`, {
                fileName: tileset.fileName,
                tileWidth: tileset.tileWidth,
                tileHeight: tileset.tileHeight,
                spacing: tileset.spacing,
                margin: tileset.margin,
                tileCount: tileset.tileCount
              });
            });
          }
          
          if (extendedConfig.layers) {
            console.log('=== LAYERS DETAILS ===');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extendedConfig.layers.forEach((layer: any, index: number) => {
              console.log(`Layer ${index}:`, {
                id: layer.id,
                name: layer.name,
                type: layer.type,
                visible: layer.visible,
                opacity: layer.opacity,
                dataLength: layer.data ? layer.data.length : 0
              });
            });
          }
          
          if (extendedConfig.tilesetImages) {
            console.log('=== TILESET IMAGES DETAILS ===');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.entries(extendedConfig.tilesetImages).forEach(([key, data]: [string, any]) => {
              console.log(`Image ${key}:`, {
                dataType: typeof data,
                dataLength: data ? data.length : 0,
                isDataURL: typeof data === 'string' && data.startsWith('data:')
              });
            });
          }
          
          console.log('Setting map dimensions and clearing editor...');
          setMapWidth(mapConfig.width);
          setMapHeight(mapConfig.height);
          setShowWelcome(false);
          
          // Clear existing editor state first
          console.log('Clearing existing editor...');
          if (editor) {
            console.log('Found existing editor, clearing it');
            setEditor(null);
          } else {
            console.log('No existing editor to clear');
          }
          
          // Store the map config for deferred editor creation
          // The editor will be created by the useEffect when canvas becomes available
          console.log('Storing map config for deferred editor creation');
          setPendingMapConfig(mapConfig);          toast({
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
    finally {
      // Re-enable default editor creation for other flows
      setIsOpeningProject(false);
    }
  }, [editor, setupAutoSave, toast, updateLayersList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire Electron menu actions (Save/Open/New)
  useEffect(() => {
    if (!window.electronAPI) return;
    // Save Map
    window.electronAPI.onMenuSaveMap(async () => {
      await handleManualSave();
    });
    // Open Map
    window.electronAPI.onMenuOpenMap(async () => {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        await handleOpenMap(selected);
      }
    });
    // New Map
    window.electronAPI.onMenuNewMap(() => {
      setShowWelcome(true);
    });
    // No cleanup provided by preload; handlers are idempotent in this simple flow
  }, [handleManualSave, handleOpenMap]);

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

  const handleFillSelection = () => {
    if (editor) {
      editor.fillSelection();
    }
  };

  const handleClearSelection = () => {
    if (editor) {
      editor.clearSelection();
    }
  };

  const handleDeleteSelection = () => {
    if (editor) {
      editor.deleteSelection();
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
              
              {/* Brush Management Tools */}
              <div className="mt-2 border-t pt-2">
                <div className="text-xs text-muted-foreground mb-2">Brush Tools</div>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    variant={brushTool === 'move' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-2 py-1 h-7"
                    onClick={() => setBrushTool(brushTool === 'move' ? 'none' : 'move')}
                    title="Move/Reorder brushes"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={brushTool === 'merge' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-2 py-1 h-7"
                    onClick={() => setBrushTool(brushTool === 'merge' ? 'none' : 'merge')}
                    title="Merge brushes"
                  >
                    <Link2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={brushTool === 'separate' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-2 py-1 h-7"
                    onClick={() => setBrushTool(brushTool === 'separate' ? 'none' : 'separate')}
                    title="Separate brushes"
                  >
                    <Scissors className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={brushTool === 'remove' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-2 py-1 h-7"
                    onClick={() => setBrushTool(brushTool === 'remove' ? 'none' : 'remove')}
                    title="Remove brushes"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                
                {/* Merge Tool Controls */}
                {brushTool === 'merge' && (
                  <div className="mt-2 flex gap-2 items-center">
                    <div className="text-xs text-muted-foreground">
                      Selected: {selectedBrushes.length}
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="text-xs px-2 py-1 h-6"
                      onClick={handleMergeBrushes}
                      disabled={selectedBrushes.length < 2}
                      title="Approve merge"
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs px-2 py-1 h-6"
                      onClick={handleCancelMerge}
                      title="Cancel merge"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                
                {/* Tool Instructions */}
                {brushTool !== 'none' && (
                  <div className="mt-2 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                    {brushTool === 'move' && 'Drag brushes to reorder them'}
                    {brushTool === 'merge' && 'Click brushes to select them, then approve to merge'}
                    {brushTool === 'separate' && 'Click on merged brushes to separate them'}
                    {brushTool === 'remove' && 'Click on brushes to remove them (with confirmation)'}
                  </div>
                )}
              </div>
              
              {tileCount === 0 && showEmptyTilesetTooltip && (
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
            
            {/* Selection Info Display */}
            {hasSelection && (
              <div className="absolute bottom-4 left-32 z-10 p-2 bg-orange-600/90 backdrop-blur-sm rounded-md border border-orange-500 text-white text-xs flex items-center gap-3">
                <div className="flex items-center gap-2 font-mono">
                  <Square className="w-4 h-4 text-orange-200" />
                  <span>{selectionCount} tiles selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                    onClick={handleFillSelection}
                    title="Fill selection with active tile"
                  >
                    Fill
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                    onClick={handleDeleteSelection}
                    title="Delete selected tiles (DEL)"
                  >
                    Delete
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                    onClick={handleClearSelection}
                    title="Clear selection (ESC)"
                  >
                    Clear
                  </Button>
                </div>
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
                      variant={selectedBrushTool === 'brush' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedBrushTool('brush')}
                      onMouseEnter={(e) => showTooltipWithDelay('Brush Tool', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Paintbrush2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={selectedBrushTool === 'bucket' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedBrushTool('bucket')}
                      onMouseEnter={(e) => showTooltipWithDelay('Bucket Fill', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <PaintBucket className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={selectedBrushTool === 'eraser' ? 'default' : 'ghost'} 
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
                      variant={selectedSelectionTool === 'rectangular' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedSelectionTool('rectangular')}
                      onMouseEnter={(e) => showTooltipWithDelay('Rectangular Selection', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={selectedSelectionTool === 'magic-wand' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedSelectionTool('magic-wand')}
                      onMouseEnter={(e) => showTooltipWithDelay('Magic Wand', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={selectedSelectionTool === 'same-tile' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedSelectionTool('same-tile')}
                      onMouseEnter={(e) => showTooltipWithDelay('Select Same Tile', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Target className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={selectedSelectionTool === 'circular' ? 'default' : 'ghost'} 
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
                      variant={selectedShapeTool === 'rectangle' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedShapeTool('rectangle')}
                      title="Rectangle Shape"
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={selectedShapeTool === 'circle' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button"
                      onClick={() => setSelectedShapeTool('circle')}
                      title="Circle Shape"
                    >
                      <Circle className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={selectedShapeTool === 'line' ? 'default' : 'ghost'} 
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
              <div className="relative">
                <Button
                  variant={selectedTool === 'stamp' ? 'default' : 'ghost'}
                  size="sm"
                  className="w-8 h-8 p-0 tool-button"
                  onClick={() => setSelectedTool('stamp')}
                  title="Stamp Tool - Group tiles into a stamp and place them together"
                >
                  <Stamp className="w-4 h-4" />
                </Button>

                {selectedTool === 'stamp' && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-[200px] z-10">
                    <div className="flex flex-col gap-2">
                      {/* Stamp Mode Controls */}
                      <div className="flex gap-1">
                        <Button
                          variant={stampMode === 'select' ? 'default' : 'ghost'}
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setStampMode('select')}
                          title="Select and place existing stamps"
                        >
                          Select
                        </Button>
                        <Button
                          variant={stampMode === 'create' ? 'default' : 'ghost'}
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setStampMode('create')}
                          title="Create stamp from selection"
                        >
                          Create
                        </Button>
                      </div>

                      {/* Create Stamp Section */}
                      {stampMode === 'create' && (
                        <div className="border-t pt-2">
                          <div className="text-xs font-medium mb-1">Create New Stamp</div>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Stamp name"
                              value={newStampName}
                              onChange={(e) => setNewStampName(e.target.value)}
                              className="flex-1 text-xs px-2 py-1 border rounded"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCreateStamp();
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              className="text-xs"
                              onClick={handleCreateStamp}
                              disabled={!newStampName.trim()}
                            >
                              Create
                            </Button>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            First select tiles, then create stamp
                          </div>
                        </div>
                      )}

                      {/* Stamps List */}
                      {stampMode === 'select' && (
                        <div className="border-t pt-2 max-h-32 overflow-y-auto">
                          <div className="text-xs font-medium mb-1">Available Stamps</div>
                          {stamps.length === 0 ? (
                            <div className="text-xs text-gray-500">No stamps created yet</div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {stamps.map((stamp) => (
                                <div key={stamp.id} className="flex items-center gap-1">
                                  <Button
                                    variant={selectedStamp === stamp.id ? 'default' : 'ghost'}
                                    size="sm"
                                    className="flex-1 text-xs justify-start"
                                    onClick={() => handleStampSelect(stamp.id)}
                                    title={`${stamp.name} (${stamp.width}x${stamp.height})`}
                                  >
                                    {stamp.name}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-6 h-6 p-0 text-red-500"
                                    onClick={() => handleDeleteStamp(stamp.id)}
                                    title="Delete stamp"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                                               </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
