import { useCallback, useEffect, useRef, useState } from 'react';

type ToolSelectionOptions = {
  onCloseStampDialog: () => void;
};

const useToolSelection = ({ onCloseStampDialog }: ToolSelectionOptions) => {
  const [selectedTool, setSelectedTool] = useState('brush');
  const [showBrushOptions, setShowBrushOptions] = useState(false);
  const [showSelectionOptions, setShowSelectionOptions] = useState(false);
  const [showShapeOptions, setShowShapeOptions] = useState(false);

  const [selectedBrushTool, setSelectedBrushTool] = useState('brush');
  const [selectedSelectionTool, setSelectedSelectionTool] = useState('rectangular');
  const [selectedShapeTool, setSelectedShapeTool] = useState('rectangle');

  const brushOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectionOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shapeOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearOptionTimeouts = useCallback(() => {
    if (brushOptionsTimeoutRef.current) {
      clearTimeout(brushOptionsTimeoutRef.current);
    }
    if (selectionOptionsTimeoutRef.current) {
      clearTimeout(selectionOptionsTimeoutRef.current);
    }
    if (shapeOptionsTimeoutRef.current) {
      clearTimeout(shapeOptionsTimeoutRef.current);
    }
  }, []);

  const handleShowBrushOptions = useCallback(() => {
    clearOptionTimeouts();
    setShowSelectionOptions(false);
    setShowShapeOptions(false);
    onCloseStampDialog();
    setShowBrushOptions(true);
  }, [clearOptionTimeouts, onCloseStampDialog]);

  const handleHideBrushOptions = useCallback(() => {
    brushOptionsTimeoutRef.current = setTimeout(() => {
      setShowBrushOptions(false);
    }, 1000);
  }, []);

  const handleShowSelectionOptions = useCallback(() => {
    clearOptionTimeouts();
    setShowBrushOptions(false);
    setShowShapeOptions(false);
    onCloseStampDialog();
    setShowSelectionOptions(true);
  }, [clearOptionTimeouts, onCloseStampDialog]);

  const handleHideSelectionOptions = useCallback(() => {
    selectionOptionsTimeoutRef.current = setTimeout(() => {
      setShowSelectionOptions(false);
    }, 1000);
  }, []);

  const handleShowShapeOptions = useCallback(() => {
    clearOptionTimeouts();
    setShowBrushOptions(false);
    setShowSelectionOptions(false);
    setShowShapeOptions(true);
  }, [clearOptionTimeouts]);

  const handleHideShapeOptions = useCallback(() => {
    shapeOptionsTimeoutRef.current = setTimeout(() => {
      setShowShapeOptions(false);
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      clearOptionTimeouts();
    };
  }, [clearOptionTimeouts]);

  return {
    selectedTool,
    setSelectedTool,
    showBrushOptions,
    showSelectionOptions,
    showShapeOptions,
    selectedBrushTool,
    setSelectedBrushTool,
    selectedSelectionTool,
    setSelectedSelectionTool,
    selectedShapeTool,
    setSelectedShapeTool,
    handleShowBrushOptions,
    handleHideBrushOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    handleShowShapeOptions,
    handleHideShapeOptions
  };
};

export default useToolSelection;
