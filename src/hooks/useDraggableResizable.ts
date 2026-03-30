import { useState, useEffect, useRef } from 'react';

interface UseDraggableResizableOptions {
  id?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export const useDraggableResizable = (options: UseDraggableResizableOptions = {}) => {
  const {
    id,
    initialWidth = 800,
    initialHeight = 600,
    minWidth = 400,
    minHeight = 300,
  } = options;

  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Initialize from exact localStorage values if available, otherwise use center
  const getInitialState = () => {
    let defaultPos = {
      x: (typeof window !== 'undefined' ? window.innerWidth - initialWidth : 0) / 2,
      y: (typeof window !== 'undefined' ? window.innerHeight - initialHeight : 0) / 2,
    };
    let defaultSize = { width: initialWidth, height: initialHeight };

    if (id && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`draggable_window_${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          
          // Ensure saved position is within window bounds
          const safeX = Math.max(0, Math.min(parsed.position.x, window.innerWidth - 100));
          const safeY = Math.max(0, Math.min(parsed.position.y, window.innerHeight - 100));
          
          defaultPos = { x: safeX, y: safeY };
          defaultSize = { 
            width: Math.max(minWidth, parsed.size.width), 
            height: Math.max(minHeight, parsed.size.height) 
          };
        }
      } catch (e) {
        console.error('Failed to parse saved window state', e);
      }
    }
    return { position: defaultPos, size: defaultSize };
  };

  const initialState = getInitialState();
  const [position, setPosition] = useState(initialState.position);
  const [size, setSize] = useState(initialState.size);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start dragging if clicking on buttons or inputs
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  useEffect(() => {
    let currentPos = position;
    let currentSize = size;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        currentPos = {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        };
        setPosition(currentPos);
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        currentSize = {
          width: Math.max(minWidth, resizeStart.width + deltaX),
          height: Math.max(minHeight, resizeStart.height + deltaY),
        };
        setSize(currentSize);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      
      // Save state on mouse up when id is provided
      if (id) {
        localStorage.setItem(`draggable_window_${id}`, JSON.stringify({
          position: currentPos,
          size: currentSize
        }));
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, minWidth, minHeight, id, position, size]);

  return {
    position,
    size,
    isDragging,
    isResizing,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  };
};
