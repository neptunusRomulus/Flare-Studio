import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Download, Undo2, Redo2, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle, Paintbrush2, PaintBucket, Eraser, MousePointer, Wand2, Target, Shapes, Pen, Stamp, Pipette, Sun, Moon, Blend, MapPin, Save, ArrowUpDown, Link2, Scissors, Trash2, Check, HelpCircle } from 'lucide-react';
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
  const [showHelp, setShowHelp] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
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
    content: React.ReactNode;
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
    
    // Update editor dark mode if it exists
    if (editor) {
      editor.setDarkMode(isDarkMode);
    }
    
    // Save to localStorage
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode, editor]);

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
      // Set initial dark mode state
      tileEditor.setDarkMode(isDarkMode);
      // Do NOT call loadFromLocalStorage() here - let the user manually load if needed
      setupAutoSave(tileEditor);
      setEditor(tileEditor);
    }
  }, [showWelcome, editor, setupAutoSave, isOpeningProject, isDarkMode]);

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
  const showTooltipWithDelay = useCallback((content: React.ReactNode, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 10;
    
    setTooltip({
      content,
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

      // Load the complete project data into the editor
      console.log('=== CALLING EDITOR loadProjectData ===');
      newEditor.loadProjectData(mapConfig);
      
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

          // Discover and assign tilesets - only for projects without per-layer tileset data
          if (window.electronAPI?.discoverTilesetImages && projectPath) {
            console.log('Calling discoverTilesetImages for path:', projectPath);
            const found = await window.electronAPI.discoverTilesetImages(projectPath);
            
            const images = found?.tilesetImages || {};
            const imageKeys = Object.keys(images);
            
            // Check if the project already has per-layer tilesets loaded
            const mapConfigWithTilesets = pendingMapConfig as { tilesets?: Array<{ layerType?: string }> };
            const hasPerLayerTilesets = mapConfigWithTilesets.tilesets && 
              Array.isArray(mapConfigWithTilesets.tilesets) && 
              mapConfigWithTilesets.tilesets.some((ts) => ts.layerType);
            
            console.log('Has per-layer tilesets in project:', hasPerLayerTilesets);
            console.log('Available discovered images:', imageKeys);
            
            // Only use fallback tileset assignment if no per-layer tilesets exist
            if (!hasPerLayerTilesets && imageKeys.length > 0) {
              console.log('No per-layer tilesets found, using fallback assignment');
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
                // Trigger auto-save to preserve imported tilesets
                newEditor.forceSave();
              }
            } else {
              console.log('Per-layer tilesets already loaded, skipping fallback assignment');
              // Just update UI state based on what was loaded
            }
          }

          console.log('Setting up autosave and updating UI...');
          // Set dark mode state
          newEditor.setDarkMode(isDarkMode);
          setupAutoSave(newEditor);
          setEditor(newEditor);
          
          // Update layers list and UI state after everything is loaded
          setTimeout(() => {
            updateLayersList();
            // Force UI state update after loading - check current active layer
            const activeLayerId = newEditor.getActiveLayerId();
            const activeLayer = newEditor.getLayers().find(l => l.id === activeLayerId);
            console.log('Final UI update - checking active layer:', activeLayerId, activeLayer?.type);
            
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

  const handleSetActiveLayer = (layerId: number) => {
    if (editor) {
      editor.setActiveLayer(layerId);
      setActiveLayerId(layerId);
      
      // Update hasTileset state based on the new active layer
    }
  };

  const handleToggleLayerVisibility = (layerId: number) => {
    if (editor) {
      editor.toggleLayerVisibility(layerId);
      // Force a fresh state update by creating a new array
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]); // Create a new array to trigger re-render
      
      // Also update tileset status for the active layer
    }
  };

  const handleLayerTransparencyChange = (layerId: number, delta: number) => {
    if (editor) {
      const layer = layers.find(l => l.id === layerId);
      if (layer) {
        const currentTransparency = layer.transparency || 0;
        const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
        editor.setLayerTransparency(layerId, newTransparency);
        updateLayersList(); // Update UI to reflect changes
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
      // Set dark mode state
      newEditor.setDarkMode(isDarkMode);
      setupAutoSave(newEditor);
      setEditor(newEditor);
      updateLayersList();
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
          isDarkMode={isDarkMode}
        />
      ) : (
        <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Custom Title Bar */}
      <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700">
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
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={handleMaximize}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClose}
            className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside className="w-80 border-r border-border bg-muted/30 p-4 overflow-y-auto">
          {/* Tileset Section */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Tileset</h2>
              <Button variant="outline" size="sm" className="relative bg-orange-500 hover:bg-orange-600 text-white border-orange-500 hover:border-orange-600 h-6 text-xs px-2 shadow-sm">
                <Upload className="w-3 h-3 mr-1" />
                Import Tileset
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
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'move' ? 'none' : 'move')}
                    title="Move/Reorder brushes"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={brushTool === 'merge' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'merge' ? 'none' : 'merge')}
                    title="Merge brushes"
                  >
                    <Link2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={brushTool === 'separate' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'separate' ? 'none' : 'separate')}
                    title="Separate brushes"
                  >
                    <Scissors className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={brushTool === 'remove' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'remove' ? 'none' : 'remove')}
                    title="Remove brushes"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-1 py-1 h-6 border-red-500 hover:border-red-600 hover:bg-red-50 shadow-sm"
                    onClick={() => {
                      if (editor) {
                        if (window.confirm('Are you sure you want to remove the tileset for this layer? This will clear the tileset but keep any placed tiles.')) {
                          editor.removeLayerTileset();
                        }
                      }
                    }}
                    title="Remove tileset for current layer"
                  >
                    <X className="w-3 h-3 text-red-500" />
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
              
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">Active GID: <span id="activeGid">{activeGid}</span></p>
          </section>

          {/* Layers Section */}
          <section>
            <h2 className="text-sm font-semibold mb-2">Layers</h2>
            
            {/* Layers List */}
            <div className="mb-2 space-y-0.5">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`px-2 py-1 border rounded transition-colors text-xs ${
                    activeLayerId === layer.id 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400' 
                      : 'border-border hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => handleSetActiveLayer(layer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLayerVisibility(layer.id);
                          }}
                          className="w-4 h-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                          title={layer.visible ? "Hide layer" : "Show layer"}
                        >
                          {layer.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-4 h-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                          onMouseEnter={(e) => {
                            const transparencyPercent = Math.round((layer.transparency || 0) * 100);
                            showTooltipWithDelay(
                              <div className="flex items-center gap-1">
                                <Mouse className="w-3 h-3" />
                                Transparency ({transparencyPercent}%)
                              </div>,
                              e.currentTarget
                            );
                          }}
                          onMouseLeave={hideTooltip}
                          onWheel={(e) => {
                            e.preventDefault();
                            const delta = e.deltaY > 0 ? 0.1 : -0.1; // 10% steps
                            const currentTransparency = layer.transparency || 0;
                            const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
                            
                            handleLayerTransparencyChange(layer.id, delta);
                            
                            // Update tooltip with new value immediately
                            const newPercent = Math.round(newTransparency * 100);
                            showTooltipWithDelay(
                              <div className="flex items-center gap-1">
                                <Mouse className="w-3 h-3" />
                                Transparency ({newPercent}%)
                              </div>,
                              e.currentTarget
                            );
                          }}
                        >
                          <Blend className="w-2.5 h-2.5" />
                        </Button>
                        
                        <span className="text-xs font-medium truncate">{layer.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-96">
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
                  <label className="block text-sm font-medium mb-2">Theme (Experimental)</label>
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

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-[800px] max-h-[80vh] overflow-y-auto help-modal">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-foreground">Help & Documentation</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowHelp(false)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-6">
                {/* Getting Started */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    Getting Started
                  </h4>
                  <div className="space-y-2 text-foreground">
                    <p>Welcome to the Isometric Tile Map Editor! This tool allows you to create beautiful isometric tile-based maps.</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Start by creating a new map or loading an existing one</li>
                      <li>Import tilesets to begin designing</li>
                      <li>Use layers to organize different elements of your map</li>
                      <li>Export your finished map for use in your projects</li>
                    </ul>
                  </div>
                </section>

                {/* Map Management */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Map className="w-5 h-5 text-green-600" />
                    Map Management
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Save className="w-4 h-4 mt-1 text-blue-500" />
                      <div>
                        <h5 className="font-medium">Save/Export</h5>
                        <p className="text-sm text-gray-600">Save your map as JSON or export as PNG image</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Upload className="w-4 h-4 mt-1 text-blue-500" />
                      <div>
                        <h5 className="font-medium">Load Map</h5>
                        <p className="text-sm text-gray-600">Load previously saved JSON map files</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Settings className="w-4 h-4 mt-1 text-blue-500" />
                      <div>
                        <h5 className="font-medium">Map Settings</h5>
                        <p className="text-sm text-gray-600">Configure map dimensions, tile size, and other properties</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Layers */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <ArrowUpDown className="w-5 h-5 text-purple-600" />
                    Layer System
                  </h4>
                  <div className="space-y-3">
                    <p className="text-foreground">Layers help organize your map content. Each layer can have its own tileset and transparency.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-start gap-3">
                        <Eye className="w-4 h-4 mt-1 text-green-500" />
                        <div>
                          <h5 className="font-medium">Visibility Toggle</h5>
                          <p className="text-sm text-gray-600">Show/hide layers to focus on specific elements</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Blend className="w-4 h-4 mt-1 text-orange-500" />
                        <div>
                          <h5 className="font-medium">Transparency</h5>
                          <p className="text-sm text-gray-600">Hover and use mouse wheel to adjust layer opacity</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Link2 className="w-4 h-4 mt-1 text-blue-500" />
                        <div>
                          <h5 className="font-medium">Lock/Unlock</h5>
                          <p className="text-sm text-gray-600">Prevent accidental edits to completed layers</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Trash2 className="w-4 h-4 mt-1 text-red-500" />
                        <div>
                          <h5 className="font-medium">Clear Layer</h5>
                          <p className="text-sm text-gray-600">Remove all tiles from the selected layer</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Drawing Tools */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Paintbrush2 className="w-5 h-5 text-red-600" />
                    Drawing Tools
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <Paintbrush2 className="w-4 h-4 mt-1 text-blue-500" />
                      <div>
                        <h5 className="font-medium">Brush Tool</h5>
                        <p className="text-sm text-gray-600">Paint individual tiles by clicking</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <PaintBucket className="w-4 h-4 mt-1 text-green-500" />
                      <div>
                        <h5 className="font-medium">Bucket Fill</h5>
                        <p className="text-sm text-gray-600">Fill connected areas with the same tile</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Eraser className="w-4 h-4 mt-1 text-gray-500" />
                      <div>
                        <h5 className="font-medium">Eraser</h5>
                        <p className="text-sm text-gray-600">Remove tiles from the map</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Pipette className="w-4 h-4 mt-1 text-purple-500" />
                      <div>
                        <h5 className="font-medium">Eyedropper</h5>
                        <p className="text-sm text-gray-600">Select a tile from the map to use as brush</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Tileset Management */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Square className="w-5 h-5 text-indigo-600" />
                    Tileset Management
                  </h4>
                  <div className="space-y-3">
                    <p className="text-foreground">Each layer can have its own tileset. Import PNG images to use as tilesets.</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Upload className="w-4 h-4 mt-1 text-blue-500" />
                        <div>
                          <h5 className="font-medium">Import Tileset</h5>
                          <p className="text-sm text-gray-600">Click the upload button for each layer to import a tileset image</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <X className="w-4 h-4 mt-1 text-red-500" />
                        <div>
                          <h5 className="font-medium">Remove Tileset</h5>
                          <p className="text-sm text-gray-600">Use the red X button to remove a tileset from a layer</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Navigation & Viewport */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Move className="w-5 h-5 text-cyan-600" />
                    Navigation & Viewport
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <ZoomIn className="w-4 h-4 mt-1 text-blue-500" />
                      <div>
                        <h5 className="font-medium">Zoom Controls</h5>
                        <p className="text-sm text-gray-600">Use +/- buttons or mouse wheel to zoom in/out</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Move className="w-4 h-4 mt-1 text-green-500" />
                      <div>
                        <h5 className="font-medium">Pan View</h5>
                        <p className="text-sm text-gray-600">Hold and drag the middle mouse button to pan</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <RotateCcw className="w-4 h-4 mt-1 text-purple-500" />
                      <div>
                        <h5 className="font-medium">Reset View</h5>
                        <p className="text-sm text-gray-600">Reset zoom and center the view</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 mt-1 text-orange-500" />
                      <div>
                        <h5 className="font-medium">Coordinates</h5>
                        <p className="text-sm text-gray-600">Hover over the map to see tile coordinates</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Keyboard Shortcuts */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-yellow-600" />
                    Keyboard Shortcuts
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-neutral-900 p-4 rounded-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Z</span>
                        <span className="text-sm">Undo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Y</span>
                        <span className="text-sm">Redo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+S</span>
                        <span className="text-sm">Save Map</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Mouse Wheel</span>
                        <span className="text-sm">Zoom</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Middle Click + Drag</span>
                        <span className="text-sm">Pan</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Hover + Wheel</span>
                        <span className="text-sm">Layer Transparency</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Tips & Best Practices */}
                <section>
                  <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-pink-600" />
                    Tips & Best Practices
                  </h4>
                  <div className="space-y-2 text-foreground">
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Use separate layers for different map elements (background, objects, decorations)</li>
                      <li>Name your layers descriptively for better organization</li>
                      <li>Lock completed layers to prevent accidental changes</li>
                      <li>Adjust layer transparency to see underlying elements while editing</li>
                      <li>Use the eyedropper tool to quickly select tiles from existing map areas</li>
                      <li>Save frequently to avoid losing work</li>
                      <li>Test your map export to ensure it looks correct in your target application</li>
                    </ul>
                  </div>
                </section>

                {/* Footer */}
                <div className="pt-4 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-500">
                    Isometric Tile Map Editor - Create beautiful tile-based maps with ease
                  </p>
                </div>
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
              <div className="absolute top-4 left-4 z-20 p-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 w-6 h-6 p-0"
                  onClick={() => setShowTooltip(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
                
                <div className="space-y-2 pr-6">
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <MousePointer2 className="w-4 h-4" />
                    <span>Left Click to Paint</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <Mouse className="w-4 h-4" />
                    <span>Right Click to Delete</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <Move className="w-4 h-4" />
                    <span>Spacebar + Mouse to Pan</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
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
              <div className="absolute bottom-4 left-4 z-10 p-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-md border border-gray-200 dark:border-neutral-600 text-gray-800 dark:text-white text-xs font-mono flex items-center gap-2 shadow-sm">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
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
          <div className="flex-shrink-0 bg-gray-50 dark:bg-neutral-900 border-t border-border p-2">
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
                    className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
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
                    <Button 
                      variant={selectedBrushTool === 'clear' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="w-8 h-8 p-0 sub-tool-button border-red-500 hover:border-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (editor) {
                          if (window.confirm('Are you sure you want to clear all tiles from the current layer? This action cannot be undone.')) {
                            editor.clearLayer();
                            setSelectedBrushTool('brush'); // Reset to brush tool after clearing
                          }
                        }
                      }}
                      onMouseEnter={(e) => showTooltipWithDelay('Clear Layer', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <X className="w-4 h-4 text-red-500" />
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
                    className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
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
                    className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
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
            className="shadow-sm flex items-center gap-1 px-3 py-1 h-7 text-xs"
            size="sm"
          >
            <Download className="w-3 h-3" />
            <span>Export Map</span>
          </Button>
          <Button 
            onClick={handleManualSave}
            title={hasUnsavedChanges ? "Save changes" : "All changes saved"}
            className={`w-7 h-7 p-0 shadow-sm transition-colors ${
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
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-3 h-3" />
            )}
          </Button>
          <Button 
            onClick={() => setShowHelp(true)} 
            title="Help & Documentation"
            className="w-7 h-7 p-0 shadow-sm"
            variant="outline"
            size="sm"
          >
            <HelpCircle className="w-3 h-3" />
          </Button>
          <Button 
            onClick={() => setShowSettings(true)} 
            title="Map Settings"
            className="w-7 h-7 p-0 shadow-sm"
            variant="outline"
            size="sm"
          >
            <Settings className="w-3 h-3" />
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
          {tooltip.content}
        </div>
      )}
        </div>
      )}
    </>
  );
}

export default App;
