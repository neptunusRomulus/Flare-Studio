import type { FocusEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

type UseToolbarAutoCollapseOptions = {
  delayMs?: number;
  defaultExpanded?: boolean;
  autoCollapse?: boolean;
};

const useToolbarAutoCollapse = ({
  delayMs = 500,
  defaultExpanded = true,
  autoCollapse = true
}: UseToolbarAutoCollapseOptions = {}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const collapseTimerRef = useRef<number | null>(null);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    if (!autoCollapse) {
      return;
    }
    clearCollapseTimer();
    collapseTimerRef.current = window.setTimeout(() => {
      setExpanded(false);
    }, delayMs);
  }, [autoCollapse, clearCollapseTimer, delayMs]);

  const showTemporarily = useCallback(() => {
    setExpanded(true);
    scheduleCollapse();
  }, [scheduleCollapse]);

  const handleMouseEnter = useCallback(() => {
    clearCollapseTimer();
    setExpanded(true);
  }, [clearCollapseTimer]);

  const handleMouseLeave = useCallback(() => {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    if (activeElement && containerRef.current?.contains(activeElement)) {
      return;
    }
    scheduleCollapse();
  }, [scheduleCollapse]);

  const handleFocus = useCallback(() => {
    clearCollapseTimer();
    setExpanded(true);
  }, [clearCollapseTimer]);

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextTarget)) {
      scheduleCollapse();
    }
  }, [scheduleCollapse]);

  return {
    expanded,
    setExpanded,
    containerRef,
    // Provide a setter to assign the DOM node without mutating hook return values externally
    setContainerRef: (node: HTMLDivElement | null) => { containerRef.current = node; },
    clearCollapseTimer,
    scheduleCollapse,
    showTemporarily,
    handleMouseEnter,
    handleMouseLeave,
    handleFocus,
    handleBlur
  };
};

export default useToolbarAutoCollapse;
