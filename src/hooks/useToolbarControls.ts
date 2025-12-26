import { useCallback, useRef } from 'react';
import useToolbarAutoCollapse from './useToolbarAutoCollapse';
import type { MutableRefObject, RefObject, FocusEvent } from 'react';

type Controls = {
  clearCollapseTimer: () => void;
  showTemporarily: () => void;
  setExpanded: (next: boolean) => void;
};

export type ToolbarControlsResult = {
  toolbarExpanded: boolean;
  toolbarContainerRef: MutableRefObject<HTMLDivElement | null> | RefObject<HTMLDivElement | null>;
  showToolbarTemporarily: () => void;
  handleToolbarMouseEnter: () => void;
  handleToolbarMouseLeave: () => void;
  handleToolbarFocus: () => void;
  handleToolbarBlur: (e: FocusEvent<HTMLDivElement>) => void;

  bottomToolbarExpanded: boolean;
  bottomToolbarContainerRef: MutableRefObject<HTMLDivElement | null> | RefObject<HTMLDivElement | null>;
  showBottomToolbarTemporarily: () => void;
  handleBottomToolbarMouseEnter: () => void;
  handleBottomToolbarMouseLeave: () => void;
  handleBottomToolbarFocus: () => void;
  handleBottomToolbarBlur: (e: FocusEvent<HTMLDivElement>) => void;

  brushToolbarExpanded: boolean;
  brushToolbarContainerRef: MutableRefObject<HTMLDivElement | null> | RefObject<HTMLDivElement | null>;
  showBrushToolbarTemporarily: () => void;

  setBrushToolbarNode: (node: HTMLDivElement | null) => void;
  setBottomToolbarNode: (node: HTMLDivElement | null) => void;

  // Controls for visibility hook
  toolbarControls: Controls;
  bottomToolbarControls: Controls;
  brushToolbarControls: Controls;
};

export default function useToolbarControls(): ToolbarControlsResult {
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomToolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const brushToolbarContainerRef = useRef<HTMLDivElement | null>(null);

  const toolbar = useToolbarAutoCollapse({ containerRef: toolbarContainerRef });
  const bottomToolbar = useToolbarAutoCollapse({ containerRef: bottomToolbarContainerRef });
  const brushToolbar = useToolbarAutoCollapse({ autoCollapse: false, containerRef: brushToolbarContainerRef });

  const {
    expanded: toolbarExpanded,
    showTemporarily: showToolbarTemporarily,
    handleMouseEnter: handleToolbarMouseEnter,
    handleMouseLeave: handleToolbarMouseLeave,
    handleFocus: handleToolbarFocus,
    handleBlur: handleToolbarBlur,
    clearCollapseTimer: toolbarClear,
    setExpanded: toolbarSetExpanded
  } = toolbar;

  const {
    expanded: bottomToolbarExpanded,
    showTemporarily: showBottomToolbarTemporarily,
    handleMouseEnter: handleBottomToolbarMouseEnter,
    handleMouseLeave: handleBottomToolbarMouseLeave,
    handleFocus: handleBottomToolbarFocus,
    handleBlur: handleBottomToolbarBlur,
    clearCollapseTimer: bottomClear,
    setExpanded: bottomSetExpanded
  } = bottomToolbar;

  const {
    expanded: brushToolbarExpanded,
    showTemporarily: showBrushToolbarTemporarily,
    clearCollapseTimer: brushClear,
    setExpanded: brushSetExpanded
  } = brushToolbar;

  const setBrushToolbarNode = useCallback((node: HTMLDivElement | null) => {
    (brushToolbarContainerRef as MutableRefObject<HTMLDivElement | null>).current = node;
  }, []);

  const setBottomToolbarNode = useCallback((node: HTMLDivElement | null) => {
    (bottomToolbarContainerRef as MutableRefObject<HTMLDivElement | null>).current = node;
  }, []);

  const toolbarControls: Controls = {
    clearCollapseTimer: toolbarClear,
    showTemporarily: showToolbarTemporarily,
    setExpanded: toolbarSetExpanded
  };
  const bottomToolbarControls: Controls = {
    clearCollapseTimer: bottomClear,
    showTemporarily: showBottomToolbarTemporarily,
    setExpanded: bottomSetExpanded
  };
  const brushToolbarControls: Controls = {
    clearCollapseTimer: brushClear,
    showTemporarily: showBrushToolbarTemporarily,
    setExpanded: brushSetExpanded
  };

  return {
    toolbarExpanded,
    toolbarContainerRef,
    showToolbarTemporarily,
    handleToolbarMouseEnter,
    handleToolbarMouseLeave,
    handleToolbarFocus,
    handleToolbarBlur,

    bottomToolbarExpanded,
    bottomToolbarContainerRef,
    showBottomToolbarTemporarily,
    handleBottomToolbarMouseEnter,
    handleBottomToolbarMouseLeave,
    handleBottomToolbarFocus,
    handleBottomToolbarBlur,

    brushToolbarExpanded,
    brushToolbarContainerRef,
    showBrushToolbarTemporarily,

    setBrushToolbarNode,
    setBottomToolbarNode,

    toolbarControls,
    bottomToolbarControls,
    brushToolbarControls
  };
}
