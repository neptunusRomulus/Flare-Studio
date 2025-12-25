import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

type TooltipState = {
  content: ReactNode;
  x: number;
  y: number;
  visible: boolean;
  fadeOut: boolean;
} | null;

type TooltipOptions = {
  toolbarRef?: RefObject<HTMLDivElement>;
  canvasRef?: RefObject<HTMLCanvasElement>;
};

const useTooltip = ({ toolbarRef, canvasRef }: TooltipOptions = {}) => {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltipWithDelay = useCallback((content: ReactNode, element: HTMLElement) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    if (toolbarRef?.current) {
      const tb = toolbarRef.current.getBoundingClientRect();
      let x = window.innerWidth / 2;
      if (canvasRef?.current) {
        const cr = canvasRef.current.getBoundingClientRect();
        x = cr.left + cr.width / 2;
      }
      const y = Math.max(8, tb.top - 60);
      setTooltip({
        content,
        x,
        y,
        visible: true,
        fadeOut: false
      });
    } else {
      const rect = element.getBoundingClientRect();
      const tooltipX = rect.left + rect.width / 2;
      const tooltipY = rect.top - 10;
      setTooltip({
        content,
        x: tooltipX,
        y: tooltipY,
        visible: true,
        fadeOut: false
      });
    }

    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip(prev => prev ? { ...prev, fadeOut: true } : null);
      setTimeout(() => {
        setTooltip(null);
      }, 300);
    }, 1000);
  }, [canvasRef, toolbarRef]);

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltip(null);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return {
    tooltip,
    showTooltipWithDelay,
    hideTooltip
  };
};

export default useTooltip;
