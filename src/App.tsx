import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download, Undo2, Redo2, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle, Paintbrush2, PaintBucket, Eraser, MousePointer, Wand2, Target, Shapes, Pen, Stamp, Pipette, Sun, Moon, Blend, MapPin, Save, ArrowUpDown, Link2, Scissors, Trash2, Check, HelpCircle, Folder, Shield } from 'lucide-react';
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
  const [activeHelpTab, setActiveHelpTab] = useState('engine');
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
  const [showSeparateDialog, setShowSeparateDialog] = useState(false);
  const [brushToSeparate, setBrushToSeparate] = useState<number | null>(null);
  
  // Stamp states
  const [stamps, setStamps] = useState<import('./types').Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<'select' | 'create' | 'place'>('select');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [newStampName, setNewStampName] = useState('');
  // Clear layer confirmation dialog state (replaces window.confirm)
  const [showClearLayerDialog, setShowClearLayerDialog] = useState(false);
  // Generic confirmation dialog for other destructive actions
  const [confirmAction, setConfirmAction] = useState<null | { type: 'removeBrush' | 'removeTileset'; payload?: number }>(null);
  
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
  
  // Export loading state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  
  // Custom tooltip states
  const [tooltip, setTooltip] = useState<{
    content: React.ReactNode;
    x: number;
    y: number;
    visible: boolean;
    fadeOut: boolean;
  } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Object management states  
  const [showObjectDialog, setShowObjectDialog] = useState(false);
  const [editingObject, setEditingObject] = useState<import('./types').MapObject | null>(null);
  
  // Tool dropdown timeout refs
  const brushOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectionOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shapeOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Floating toolbar ref for anchored tooltip
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  
  // Hover coordinates state
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  
  // Selection state
  const [selectionCount, setSelectionCount] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);
  
  const { toast } = useToast();

  // Keep 'toast' referenced to avoid unused variable errors while toasts are suppressed.
  // This creates a stable noop reference that will never show UI.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _noopToast = toast;
    return () => {
      // no-op cleanup
    };
  }, [toast]);

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
    // If a toolbarRef exists, anchor the tooltip to the left of the floating toolbar
    if (toolbarRef.current) {
      const tb = toolbarRef.current.getBoundingClientRect();
      // Place tooltip centered on screen and above the floating toolbar
  // Center horizontally then nudge a bit to the right and higher above the toolbar
      // Center horizontally to the canvas grid area if available, otherwise fall back to window center.
      let x = window.innerWidth / 2;
      if (canvasRef && canvasRef.current) {
        const cr = canvasRef.current.getBoundingClientRect();
        x = cr.left + cr.width / 2;
      }
  const y = Math.max(8, tb.top - 60); // 60px above the toolbar top (a little higher)

      setTooltip({
        content,
        x,
        y,
        visible: true,
        fadeOut: false
      });
    } else {
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
    }

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
    setBrushToSeparate(brushId);
    setShowSeparateDialog(true);
  }, []);

  const confirmSeparateBrush = useCallback(() => {
    if (!editor || brushToSeparate === null) return;
    
    try {
      // Call the editor's separate brush method
      editor.separateBrush(brushToSeparate);
      console.log(`Separated brush with ID: ${brushToSeparate}`);
    } catch (error) {
      console.error('Failed to separate brush:', error);
    }
    
    setShowSeparateDialog(false);
    setBrushToSeparate(null);
    setBrushTool('none'); // Exit separate mode after action
  }, [editor, brushToSeparate]);

  const handleRemoveBrush = useCallback((brushId: number) => {
    if (!editor) return;
    
    console.log(`handleRemoveBrush called with brushId: ${brushId}`);
  // Open generic confirm dialog
  setConfirmAction({ type: 'removeBrush', payload: brushId });
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

  // Object management handlers
  const handleEditObject = useCallback((objectId: number) => {
    if (!editor) return;
    
    const obj = editor.getMapObjects().find((o: import('./types').MapObject) => o.id === objectId);
    if (obj) {
      setEditingObject(obj);
      setShowObjectDialog(true);
    }
  }, [editor]);

  const handleUpdateObject = useCallback((updatedObject: import('./types').MapObject) => {
    if (!editor) return;
    
    editor.updateMapObject(updatedObject.id, updatedObject);
    setEditingObject(null);
    setShowObjectDialog(false);
  }, [editor]);

  // Canvas double-click handler for editing objects
  useEffect(() => {
    if (!editor || !canvasRef.current) return;

    const handleCanvasDoubleClick = (_event: MouseEvent) => {
      // Get hover coordinates from editor
      const hoverCoords = editor.getHoverCoordinates();
      
      if (hoverCoords) {
        // Check if there's an object at this position
        const objects = editor.getMapObjects();
        const objectAtPosition = objects.find(obj => 
          obj.x === hoverCoords.x && obj.y === hoverCoords.y
        );
        
        if (objectAtPosition) {
          handleEditObject(objectAtPosition.id);
        }
      }
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);

    return () => {
      canvas.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [editor, handleEditObject]);

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
          
          // toast suppressed: Project loaded
          
        } catch (error) {
          console.error('Failed to create editor with pending config:', error);
          // toast suppressed: Failed to load the project
          setPendingMapConfig(null);
        }
      };

      createEditorWithConfig();
    }
  }, [pendingMapConfig, showWelcome, projectPath, setupAutoSave, updateLayersList]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleExportMap = async () => {
    if (!editor || !projectPath) {
      toast({
        title: "Export Failed",
        description: "No project loaded or editor not initialized.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress updates
      setExportProgress(25);
      
      // Generate the map and tileset content
      const mapTxt = editor.generateFlareMapTxt();
      setExportProgress(50);
      
      const tilesetDef = editor.generateFlareTilesetDef();
      setExportProgress(75);
      
      // Save files to project folder using Electron API
      if (window.electronAPI?.saveExportFiles) {
        const success = await window.electronAPI.saveExportFiles(projectPath, mapName, mapTxt, tilesetDef);
        setExportProgress(100);
        
        if (success) {
          // Show success modal after a delay to let the loading bar animation complete
          setTimeout(() => {
            setShowExportSuccess(true);
          }, 1500);
        } else {
          throw new Error("Failed to save export files");
        }
      } else {
        // Fallback to original download method if Electron API not available
        editor.exportFlareMap();
        setExportProgress(100);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the map.",
        variant: "destructive",
      });
    } finally {
      // Reset loading state after a brief delay to show completion
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
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
          // toast suppressed: Project saved to disk
        } else {
          // toast suppressed: Failed to save the project to disk
        }
      } else {
  editor.forceSave();
  await new Promise(resolve => setTimeout(resolve, 500));
  // toast suppressed: Saved to local backup
      }
    } catch (error) {
      console.error('Save error:', error);
      // toast suppressed: Failed to save your map
    } finally {
      setIsManuallySaving(false);
    }
  }, [editor, projectPath]);

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
          setPendingMapConfig(mapConfig);
          // toast suppressed: Map Loaded
        }
        } else {
        // Fallback for web
        console.log('Opening map project:', projectPath);
        // toast suppressed: Feature Unavailable (requires desktop app)
      }
    } catch (error) {
      console.error('Error opening map project:', error);
      // toast suppressed: Failed to open map project
    }
    finally {
      // Re-enable default editor creation for other flows
      setIsOpeningProject(false);
    }
  }, [editor, setupAutoSave, updateLayersList]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <Tooltip content="Minimize">
            <button 
              onClick={handleMinimize}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Maximize">
            <button 
              onClick={handleMaximize}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Close">
            <button 
              onClick={handleClose}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside className="w-80 border-r border-border bg-muted/30 p-4 overflow-y-auto flex flex-col">
          {/* Tileset Brushes Section */}
          <section className="flex flex-col flex-1">
            {/* Header with Import Button */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Tileset Brushes</h2>
              <Tooltip content="Import a PNG tileset for the active layer" side="bottom">
                <Button variant="outline" size="sm" className="relative bg-orange-500 hover:bg-orange-600 text-white border-orange-500 hover:border-orange-600 h-6 text-xs px-2 shadow-sm">
                  <Upload className="w-3 h-3 mr-1" />
                  Import
                  <input
                    type="file"
                    accept="image/png"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload(e, 'layerTileset')}
                  />
                </Button>
              </Tooltip>
            </div>
            
            <div id="tilesetMeta" className="text-sm text-muted-foreground mb-2"></div>
            
            {/* Tileset Brushes Window - Takes maximum space */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative flex-1 min-h-0 overflow-auto h-full">
                <div id="tilesContainer" className="tile-palette h-full"></div>
                
                {/* Hidden element to track brush tool state */}
                <div data-brush-tool={brushTool} className="hidden"></div>
                
                {/* Active GID Badge - Fixed position at bottom-left */}
                <div className="absolute bottom-2 left-2 z-10">
                  <Tooltip content="Active GID number of selected tilebrush">
                    <Badge variant="secondary" className="text-xs px-2 py-1 bg-black/80 text-white border-gray-600 hover:bg-black/90">
                      <span id="activeGid">{activeGid}</span>
                    </Badge>
                  </Tooltip>
                </div>
              </div>
            </div>
            
            {/* Brush Tools Header */}
            <div className="flex items-center justify-between mb-1 mt-2">
              <div className="text-xs text-muted-foreground">Brush Tools</div>
              <div className="flex gap-1">
                <Tooltip content="Move/Reorder brushes">
                  <Button
                    variant={brushTool === 'move' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'move' ? 'none' : 'move')}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Merge brushes">
                  <Button
                    variant={brushTool === 'merge' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'merge' ? 'none' : 'merge')}
                  >
                    <Link2 className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Separate brushes">
                  <Button
                    variant={brushTool === 'separate' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'separate' ? 'none' : 'separate')}
                  >
                    <Scissors className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Remove brushes">
                  <Button
                    variant={brushTool === 'remove' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'remove' ? 'none' : 'remove')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Remove tileset for current layer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-1 py-1 h-6 border-red-500 hover:border-red-600 hover:bg-red-50 shadow-sm"
                    onClick={() => {
                      setConfirmAction({ type: 'removeTileset' });
                    }}
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </section>

          {/* Layers Section */}
          <section className="mb-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Layers</h2>
            
            {/* Layers List */}
            <div className="mb-2 space-y-0.5 max-h-48 overflow-y-auto">
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
                        <Tooltip content={layer.visible ? "Hide layer" : "Show layer"}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLayerVisibility(layer.id);
                            }}
                            className="w-4 h-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            {layer.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500" />}
                          </Button>
                        </Tooltip>
                        
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
                            const delta = e.deltaY > 0 ? 0.1 : -0.1;
                            const currentTransparency = layer.transparency || 0;
                            const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
                            
                            handleLayerTransparencyChange(layer.id, delta);
                            
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

          {/* Bottom Action Buttons */}
          <section className="flex-shrink-0">
            {/* Export Loading Bar - Always reserve space */}
            <div className="w-full h-1.5 mb-2">
              {isExporting ? (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all duration-1000 ease-out rounded-full"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              ) : (
                <div className="w-full h-full" />
              )}
            </div>
            
            <div className="flex gap-2 justify-center">
              <Tooltip content="Export the map file and tilesetdef">
                <Button 
                  onClick={handleExportMap} 
                  className="shadow-sm flex items-center gap-1 px-3 py-1 h-7 text-xs w-20"
                  size="sm"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Export</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </>
                  )}
                </Button>
              </Tooltip>
              <Tooltip content={hasUnsavedChanges ? 'Save changes' : 'All changes saved'}>
                <Button 
                  onClick={handleManualSave}
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
              </Tooltip>
              <Tooltip content="Help & Documentation">
                <Button 
                  onClick={() => setShowHelp(true)} 
                  className="w-7 h-7 p-0 shadow-sm"
                  variant="outline"
                  size="sm"
                >
                  <HelpCircle className="w-3 h-3" />
                </Button>
              </Tooltip>
              <Tooltip content="Map Settings">
                <Button 
                  onClick={() => setShowSettings(true)} 
                  className="w-7 h-7 p-0 shadow-sm"
                  variant="outline"
                  size="sm"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </Tooltip>
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
                  <label className="block text-sm font-medium mb-2">Debug Mode</label>
                  <div className="flex items-center justify-between">
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

        {/* Clear Layer Confirmation Dialog (replaces native confirm) */}
        {showClearLayerDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-80">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Clear Layer</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowClearLayerDialog(false)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-sm text-foreground mb-4">Are you sure you want to clear all tiles from the current layer? This action cannot be undone.</div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowClearLayerDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (editor) {
                      editor.clearLayer();
                    }
                    setSelectedBrushTool('brush'); // Reset to brush tool after clearing
                    setShowClearLayerDialog(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Generic Confirmation Dialog for destructive actions */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-80">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Confirm</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setConfirmAction(null)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-sm text-foreground mb-4">
                {confirmAction.type === 'removeBrush' && 'Are you sure you want to remove this brush?'}
                {confirmAction.type === 'removeTileset' && 'Are you sure you want to remove the tileset for this layer? This will clear the tileset but keep any placed tiles.'}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    try {
                      if (confirmAction.type === 'removeBrush') {
                        const brushId = confirmAction.payload as number;
                        if (editor) editor.removeBrush(brushId);
                      } else if (confirmAction.type === 'removeTileset') {
                        if (editor) editor.removeLayerTileset();
                      }
                    } catch (error) {
                      console.error('Confirm action failed:', error);
                    } finally {
                      setConfirmAction(null);
                    }
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-0 w-[800px] max-h-[80vh] overflow-y-auto help-modal relative">
              {/* Modal-local header that stays visible while the modal body scrolls */}
              <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border py-3 px-4 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Help & Documentation</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHelp(false)}
                    className="w-8 h-8 p-0"
                    aria-label="Close Help"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {/* Tab Navigation */}
                <div className="flex space-x-1 mt-3 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveHelpTab('engine')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeHelpTab === 'engine'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Target className="w-4 h-4 inline mr-2" />
                    Engine
                  </button>
                  <button
                    onClick={() => setActiveHelpTab('collisions')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeHelpTab === 'collisions'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Shield className="w-4 h-4 inline mr-2" />
                    Collisions
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Engine Tab Content */}
                {activeHelpTab === 'engine' && (
                  <>
                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Target className="w-5 h-5 text-orange-500" />
                        Getting Started
                      </h4>
                      <div className="space-y-2 text-gray-700 dark:text-gray-400">
                        <p>Welcome to the Isometric Tile Map Editor! This tool allows you to create beautiful isometric tile-based maps.</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 dark:text-gray-400">
                          <li>Start by creating a new map or loading an existing one</li>
                          <li>Import tilesets to begin designing</li>
                          <li>Use layers to organize different elements of your map</li>
                          <li>Export your finished map for use in your projects</li>
                        </ul>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                        <Map className="w-5 h-5 text-orange-500" />
                        Map Management
                      </h4>
                      <div className="space-y-3">
                        <p className="text-gray-700 dark:text-gray-400">Layers help organize your map content. Each layer can have its own tileset and transparency.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-start gap-3">
                            <Save className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Save/Export</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Save your map as JSON or export as PNG image</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Upload className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Load Map</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Load previously saved JSON map files</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Settings className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Map Settings</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Configure map dimensions, tile size, and other properties</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Link2 className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Lock/Unlock</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Prevent accidental edits to completed layers</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Paintbrush2 className="w-5 h-5 text-orange-500" />
                        Drawing Tools
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3">
                          <Paintbrush2 className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Brush Tool</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Paint individual tiles by clicking</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <PaintBucket className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Bucket Fill</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Fill connected areas with the same tile</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Eraser className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Eraser</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Remove tiles from the map</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Pipette className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Eyedropper</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Select a tile from the map to use as brush</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Square className="w-5 h-5 text-orange-500" />
                        Tileset Management
                      </h4>
                      <div className="space-y-3">
                        <p className="text-gray-700 dark:text-gray-400">Each layer can have its own tileset. Import PNG images to use as tilesets.</p>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <Upload className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Import Tileset</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Click the upload button for each layer to import a tileset image</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <X className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Remove Tileset</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Use the red X button to remove a tileset from a layer</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Move className="w-5 h-5 text-orange-500" />
                        Navigation & Viewport
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3">
                          <ZoomIn className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Zoom Controls</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Use +/- buttons or mouse wheel to zoom in/out</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Move className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Pan View</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Hold and drag the middle mouse button to pan</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <RotateCcw className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Reset View</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Reset zoom and center the view</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Coordinates</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Hover over the map to see tile coordinates</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-orange-500" />
                        Keyboard Shortcuts
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-neutral-900 p-4 rounded-lg">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Z</span>
                            <span className="text-sm text-gray-400">Undo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Y</span>
                            <span className="text-sm text-gray-400">Redo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+S</span>
                            <span className="text-sm text-gray-400">Save Map</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Mouse Wheel</span>
                            <span className="text-sm text-gray-400">Zoom</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Middle Click + Drag</span>
                            <span className="text-sm text-gray-400">Pan</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Hover + Wheel</span>
                            <span className="text-sm text-gray-400">Layer Transparency</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-orange-500" />
                        Tips & Best Practices
                      </h4>
                      <div className="space-y-2 text-gray-700 dark:text-gray-400">
                        <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 dark:text-gray-400">
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
                  </>
                )}

                {/* Collisions Tab Content */}
                {activeHelpTab === 'collisions' && (
                  <>
                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Shield className="w-5 h-5 text-orange-500" />
                        Summary of Collision Values for Flare
                      </h4>
                      <div className="space-y-4">
                        <p className="text-gray-700 dark:text-gray-400">
                          Collision values in Flare Engine determine how entities interact with map tiles. Each value has specific behavior that affects movement and visibility.
                        </p>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Value</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Type</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Behavior</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-700 dark:text-gray-300">
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-red-50 dark:bg-red-900/20">1</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-red-600 dark:text-red-400">Red Block</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Impassable wall, visible on minimap</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-red-50 dark:bg-red-900/20">2</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-red-600 dark:text-red-400">Dithered Red</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Still blocks entities, minimap shows dithered tile</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-blue-50 dark:bg-blue-900/20">3</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-blue-600 dark:text-blue-400">Pit (Blue)</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Ground entities blocked; air can pass</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-blue-50 dark:bg-blue-900/20">4</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-blue-600 dark:text-blue-400">Dithered Pit</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Same as 3, but minimap shows dithered</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Usage Guidelines
                          </h5>
                          <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1 list-disc list-inside">
                            <li><strong>Value 1 (Red Block):</strong> Use for walls, buildings, and solid obstacles that should be clearly visible on the minimap</li>
                            <li><strong>Value 2 (Dithered Red):</strong> Use for partial barriers or decorative walls that still block movement</li>
                            <li><strong>Value 3 (Pit):</strong> Use for water, lava, or ground hazards that flying entities can cross</li>
                            <li><strong>Value 4 (Dithered Pit):</strong> Use for shallow water or transitional pit areas</li>
                          </ul>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                          <h5 className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Important Notes</h5>
                          <ul className="text-amber-700 dark:text-amber-300 text-sm space-y-1 list-disc list-inside">
                            <li>Collision values are set in the <strong>Collision Layer</strong> of your map</li>
                            <li>Each tile position can only have one collision value</li>
                            <li>Collision affects AI pathfinding and player movement</li>
                            <li>Minimap visualization helps players understand map layout</li>
                          </ul>
                        </div>
                      </div>
                    </section>
                  </>
                )}

                <div className="pt-4 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Flarism | GUI for Flare Engine by ism.
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
            <Tooltip content="Undo (Ctrl+Z)" side="bottom">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-8 h-8 p-0"
                onClick={handleUndo}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Redo (Ctrl+Y)" side="bottom">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-8 h-8 p-0"
                onClick={handleRedo}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Zoom In" side="bottom">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-8 h-8 p-0"
                onClick={handleZoomIn}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Zoom Out" side="bottom">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-8 h-8 p-0"
                onClick={handleZoomOut}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Reset View" side="bottom">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-8 h-8 p-0"
                onClick={handleResetZoom}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Toggle Minimap" side="bottom">
              <Button 
                size="sm" 
                variant={showMinimap ? "default" : "outline"}
                className="w-8 h-8 p-0"
                onClick={handleToggleMinimap}
              >
                <Map className="w-4 h-4" />
              </Button>
            </Tooltip>
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
                  <Tooltip content="Fill selection with active tile">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                      onClick={handleFillSelection}
                    >
                      Fill
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete selected tiles (DEL)">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                      onClick={handleDeleteSelection}
                    >
                      Delete
                    </Button>
                  </Tooltip>
                  <Tooltip content="Clear selection (ESC)">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                      onClick={handleClearSelection}
                    >
                      Clear
                    </Button>
                  </Tooltip>
                </div>
              </div>
            )}
            {/* Floating Toolbar (inside canvas, centered, pill-sized) */}
            <div ref={toolbarRef} className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
              <div className="flex items-center gap-1 bg-white/90 dark:bg-neutral-900/90 border border-border rounded-full px-2 py-1 shadow-md">
                {/* Brush Tool */}
                <div className="relative">
                  <Button
                        variant={selectedTool === 'brush' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-7 h-7 p-1 rounded-full tool-button"
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
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedBrushTool('brush')}
                        onMouseEnter={(e) => showTooltipWithDelay('Brush Tool', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Paintbrush2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedBrushTool === 'bucket' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedBrushTool('bucket')}
                        onMouseEnter={(e) => showTooltipWithDelay('Bucket Fill', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <PaintBucket className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedBrushTool === 'eraser' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedBrushTool('eraser')}
                        onMouseEnter={(e) => showTooltipWithDelay('Eraser', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Eraser className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedBrushTool === 'clear' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button border-red-500 hover:border-red-600 hover:bg-red-50"
                        onClick={() => setShowClearLayerDialog(true)}
                        onMouseEnter={(e) => showTooltipWithDelay('Clear Layer', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <X className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Selection Tool */}
                <div className="relative">
                  <Button
                      variant={selectedTool === 'selection' ? 'default' : 'ghost'}
                      size="sm"
                      className="w-7 h-7 p-1 rounded-full tool-button"
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
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('rectangular')}
                        onMouseEnter={(e) => showTooltipWithDelay('Rectangular Selection', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Square className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedSelectionTool === 'magic-wand' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('magic-wand')}
                        onMouseEnter={(e) => showTooltipWithDelay('Magic Wand', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Wand2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedSelectionTool === 'same-tile' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('same-tile')}
                        onMouseEnter={(e) => showTooltipWithDelay('Select Same Tile', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Target className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedSelectionTool === 'circular' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('circular')}
                        onMouseEnter={(e) => showTooltipWithDelay('Circular Select', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Circle className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Shape Tool */}
                <div className="relative">
                  <Button
                      variant={selectedTool === 'shape' ? 'default' : 'ghost'}
                      size="sm"
                      className="w-7 h-7 p-1 rounded-full tool-button"
                      onClick={() => setSelectedTool('shape')}
                      onMouseEnter={(e) => { handleShowShapeOptions(); showTooltipWithDelay('Shape Tool', e.currentTarget); }}
                      onMouseLeave={() => { handleHideShapeOptions(); hideTooltip(); }}
                    >
                      {getShapeIcon()}
                    </Button>

                  {showShapeOptions && (
                    <div
                      className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
                      onMouseEnter={handleShowShapeOptions}
                      onMouseLeave={handleHideShapeOptions}
                    >
                      <Tooltip content="Rectangle Shape">
                        <Button
                          variant={selectedShapeTool === 'rectangle' ? 'default' : 'ghost'}
                          size="sm"
                          className="w-6 h-6 p-1 rounded-full sub-tool-button"
                          onClick={() => setSelectedShapeTool('rectangle')}
                        >
                          <Square className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Circle Shape">
                        <Button
                          variant={selectedShapeTool === 'circle' ? 'default' : 'ghost'}
                          size="sm"
                          className="w-6 h-6 p-1 rounded-full sub-tool-button"
                          onClick={() => setSelectedShapeTool('circle')}
                        >
                          <Circle className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Line Shape">
                        <Button
                          variant={selectedShapeTool === 'line' ? 'default' : 'ghost'}
                          size="sm"
                          className="w-6 h-6 p-1 rounded-full sub-tool-button"
                          onClick={() => setSelectedShapeTool('line')}
                        >
                          <Pen className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {/* Stamp Tool */}
                <div className="relative">
                  <Button
                      variant={selectedTool === 'stamp' ? 'default' : 'ghost'}
                      size="sm"
                      className="w-7 h-7 p-1 rounded-full tool-button"
                      onClick={() => setSelectedTool('stamp')}
                      onMouseEnter={(e) => showTooltipWithDelay('Stamp Tool - Group tiles into a stamp and place them together', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Stamp className="w-3 h-3" />
                    </Button>

                  {selectedTool === 'stamp' && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-[200px] z-10">
                      <div className="flex flex-col gap-2">
                        {/* Stamp Mode Controls */}
                        <div className="flex gap-1">
                          <Tooltip content="Select and place existing stamps">
                            <Button
                              variant={stampMode === 'select' ? 'default' : 'ghost'}
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => setStampMode('select')}
                            >
                              Select
                            </Button>
                          </Tooltip>
                          <Tooltip content="Create stamp from selection">
                            <Button
                              variant={stampMode === 'create' ? 'default' : 'ghost'}
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => setStampMode('create')}
                            >
                              Create
                            </Button>
                          </Tooltip>
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
                            <div className="text-xs text-gray-500 mt-1">First select tiles, then create stamp</div>
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
                                    <Tooltip content={`${stamp.name} (${stamp.width}x${stamp.height})`}>
                                      <Button
                                        variant={selectedStamp === stamp.id ? 'default' : 'ghost'}
                                        size="sm"
                                        className="flex-1 text-xs justify-start"
                                        onClick={() => handleStampSelect(stamp.id)}
                                      >
                                        {stamp.name}
                                      </Button>
                                    </Tooltip>
                                    <Tooltip content="Delete stamp">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-6 h-6 p-0 text-red-500"
                                        onClick={() => handleDeleteStamp(stamp.id)}
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </Tooltip>
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
                  className="w-7 h-7 p-1 rounded-full tool-button"
                  onClick={() => setSelectedTool('eyedropper')}
                  onMouseEnter={(e) => showTooltipWithDelay('Eyedropper Tool - Pick a tile from the map to reuse', e.currentTarget)}
                  onMouseLeave={hideTooltip}
                >
                  <Pipette className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Toaster />
      
      {/* Separate Brush Confirmation Dialog */}
      <Dialog open={showSeparateDialog} onOpenChange={setShowSeparateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Separate Brush</DialogTitle>
            <DialogDescription>
              Are you sure you want to separate this brush?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeparateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSeparateBrush}>
              Separate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Object Management Dialog */}
      <Dialog open={showObjectDialog} onOpenChange={setShowObjectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingObject ? `Edit ${editingObject.type}` : 'Add Object'}
            </DialogTitle>
            <DialogDescription>
              Configure {editingObject?.type || 'object'} properties for Flare engine compatibility.
            </DialogDescription>
          </DialogHeader>
          
          {editingObject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input
                    value={editingObject.name || ''}
                    onChange={(e) => setEditingObject({...editingObject, name: e.target.value})}
                    placeholder="Object name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <Input
                    value={editingObject.category || ''}
                    onChange={(e) => setEditingObject({...editingObject, category: e.target.value})}
                    placeholder={editingObject.type === 'enemy' ? 'creature' : 'block'}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">X Position</label>
                  <Input
                    type="number"
                    value={editingObject.x}
                    onChange={(e) => setEditingObject({...editingObject, x: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Y Position</label>
                  <Input
                    type="number"
                    value={editingObject.y}
                    onChange={(e) => setEditingObject({...editingObject, y: Number(e.target.value)})}
                  />
                </div>
              </div>

              {editingObject.type === 'enemy' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Level</label>
                    <Input
                      type="number"
                      value={editingObject.level || 1}
                      onChange={(e) => setEditingObject({...editingObject, level: Number(e.target.value)})}
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Number</label>
                    <Input
                      type="number"
                      value={editingObject.number || 1}
                      onChange={(e) => setEditingObject({...editingObject, number: Number(e.target.value)})}
                      min="1"
                    />
                  </div>
                </div>
              )}

              {editingObject.type === 'enemy' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Wander Radius</label>
                  <Input
                    type="number"
                    value={editingObject.wander_radius || 4}
                    onChange={(e) => setEditingObject({...editingObject, wander_radius: Number(e.target.value)})}
                    min="0"
                  />
                </div>
              )}

              {editingObject.type === 'event' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Activate</label>
                    <Input
                      value={editingObject.activate || 'on_trigger'}
                      onChange={(e) => setEditingObject({...editingObject, activate: e.target.value})}
                      placeholder="on_trigger, on_load, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Hotspot</label>
                    <Input
                      value={editingObject.hotspot || '0,0,1,1'}
                      onChange={(e) => setEditingObject({...editingObject, hotspot: e.target.value})}
                      placeholder="x,y,width,height"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tooltip</label>
                    <Input
                      value={editingObject.tooltip || ''}
                      onChange={(e) => setEditingObject({...editingObject, tooltip: e.target.value})}
                      placeholder="Hover text"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowObjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => editingObject && handleUpdateObject(editingObject)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Export Success Modal */}
      {showExportSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black rounded-lg shadow-xl p-6 max-w-md mx-4 relative">
            {/* Close button */}
            <button
              onClick={() => setShowExportSuccess(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Content */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Export Successful
              </h3>
            </div>
            
            <p className="text-gray-300 flex items-center gap-2">
              Map files and tile definitions saved to 
              <span className="inline-flex items-center gap-1 font-medium text-white">
                <Folder className="w-4 h-4" />
                Export
              </span>.
            </p>
          </div>
        </div>
      )}

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
