import { useCallback, useEffect, useState, useRef } from 'react';
import useToolbarAutoCollapse from './useToolbarAutoCollapse';
import useStampState from './useStampState';

// Delay (in ms) before hiding option menus when mouse leaves
const HIDE_OPTIONS_DELAY = 300;

export default function useToolbarState() {
  const toolbar = useToolbarAutoCollapse();
  const bottomToolbar = useToolbarAutoCollapse({ autoCollapse: false });
  const brushToolbar = useToolbarAutoCollapse({ autoCollapse: false });

  const [selectedTool, setSelectedTool] = useState<'brush' | 'selection' | 'shape' | 'eyedropper' | 'stamp'>('brush');
  const [isCtrlSelectionActive, setIsCtrlSelectionActive] = useState(false);
  const [selectedBrushTool, setSelectedBrushTool] = useState<'brush' | 'bucket' | 'eraser' | 'clear'>('brush');
  const [selectedSelectionTool, setSelectedSelectionTool] = useState<'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular'>('rectangular');
  const [selectedShapeTool, setSelectedShapeTool] = useState<'rectangle' | 'circle' | 'line'>('rectangle');
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [activeGidValue, setActiveGidValue] = useState<string>('(none)');
  const [hoverGidValue, setHoverGidValue] = useState<string>('(none)');

  // Refs for timeout management
  const brushOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectionOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shapeOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToolbarTemporarily = useCallback(() => toolbar.showTemporarily(), [toolbar]);
  const showBottomToolbarTemporarily = useCallback(() => bottomToolbar.showTemporarily(), [bottomToolbar]);
  const showBrushToolbarTemporarily = useCallback(() => brushToolbar.showTemporarily(), [brushToolbar]);

  const toolbarExpanded = toolbar.expanded;
  const toolbarContainerRef = toolbar.containerRef;
  const handleToolbarMouseEnter = toolbar.handleMouseEnter;
  const handleToolbarMouseLeave = toolbar.handleMouseLeave;
  const handleToolbarFocus = toolbar.handleFocus;
  const handleToolbarBlur = (event?: React.FocusEvent<HTMLDivElement>) => toolbar.handleBlur(event as React.FocusEvent<HTMLDivElement>);

  const bottomToolbarExpanded = bottomToolbar.expanded;
  const setBottomToolbarNode = (node: HTMLDivElement | null) => { bottomToolbar.setContainerRef(node); };
  const handleBottomToolbarMouseEnter = bottomToolbar.handleMouseEnter;
  const handleBottomToolbarMouseLeave = bottomToolbar.handleMouseLeave;
  const handleBottomToolbarFocus = bottomToolbar.handleFocus;
  const handleBottomToolbarBlur = bottomToolbar.handleBlur;

  const brushToolbarExpanded = brushToolbar.expanded;
  const setBrushToolbarNode = (node: HTMLDivElement | null) => { brushToolbar.setContainerRef(node); };

  const [showBrushOptions, setShowBrushOptions] = useState(false);
  const handleShowBrushOptions = useCallback(() => {
    if (brushOptionsTimeoutRef.current) clearTimeout(brushOptionsTimeoutRef.current);
    setShowBrushOptions(true);
  }, []);
  const handleHideBrushOptions = useCallback(() => {
    brushOptionsTimeoutRef.current = setTimeout(() => {
      setShowBrushOptions(false);
    }, HIDE_OPTIONS_DELAY);
  }, []);

  const [showSelectionOptions, setShowSelectionOptions] = useState(false);
  const handleShowSelectionOptions = useCallback(() => {
    if (selectionOptionsTimeoutRef.current) clearTimeout(selectionOptionsTimeoutRef.current);
    setShowSelectionOptions(true);
  }, []);
  const handleHideSelectionOptions = useCallback(() => {
    selectionOptionsTimeoutRef.current = setTimeout(() => {
      setShowSelectionOptions(false);
    }, HIDE_OPTIONS_DELAY);
  }, []);

  const [showShapeOptions, setShowShapeOptions] = useState(false);
  const handleShowShapeOptions = useCallback(() => {
    if (shapeOptionsTimeoutRef.current) clearTimeout(shapeOptionsTimeoutRef.current);
    setShowShapeOptions(true);
  }, []);
  const handleHideShapeOptions = useCallback(() => {
    shapeOptionsTimeoutRef.current = setTimeout(() => {
      setShowShapeOptions(false);
    }, HIDE_OPTIONS_DELAY);
  }, []);

  const stampState = useStampState();

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Control') return;
      if (event.altKey || event.metaKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      setIsCtrlSelectionActive(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setIsCtrlSelectionActive(false);
      }
    };

    const handleWindowBlur = () => setIsCtrlSelectionActive(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const effectiveSelectedTool: 'brush' | 'selection' | 'shape' | 'eyedropper' | 'stamp' =
    isCtrlSelectionActive ? 'selection' : selectedTool;
  const effectiveSelectedSelectionTool: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular' =
    isCtrlSelectionActive ? 'multi-cell' : selectedSelectionTool;

  return {
    // raw controls for compatibility with existing visibility hook
    toolbarControls: toolbar,
    brushToolbarControls: brushToolbar,
    bottomToolbarControls: bottomToolbar,
    // toolbar collapse helpers
    toolbarExpanded,
    toolbarContainerRef,
    handleToolbarMouseEnter,
    handleToolbarMouseLeave,
    handleToolbarFocus,
    handleToolbarBlur,
    bottomToolbarExpanded,
    setBottomToolbarNode,
    handleBottomToolbarMouseEnter,
    handleBottomToolbarMouseLeave,
    handleBottomToolbarFocus,
    handleBottomToolbarBlur,
    brushToolbarExpanded,
    setBrushToolbarNode,
    showToolbarTemporarily,
    showBottomToolbarTemporarily,
    showBrushToolbarTemporarily,

    // selection/tool state
    selectedTool,
    effectiveSelectedTool,
    setSelectedTool,
    selectedBrushTool,
    setSelectedBrushTool,
    selectedSelectionTool,
    effectiveSelectedSelectionTool,
    setSelectedSelectionTool,
    selectedShapeTool,
    setSelectedShapeTool,
    hoverCoords,
    setHoverCoords,
    selectionCount,
    setSelectionCount,
    hasSelection,
    setHasSelection,
    activeGidValue,
    setActiveGidValue,
    hoverGidValue,
    setHoverGidValue,

    // option popovers
    showBrushOptions,
    setShowBrushOptions,
    handleShowBrushOptions,
    handleHideBrushOptions,
    showSelectionOptions,
    setShowSelectionOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    showShapeOptions,
    setShowShapeOptions,
    handleShowShapeOptions,
    handleHideShapeOptions,

    // stamps + brush state from useStampState
    ...stampState
  };
}
