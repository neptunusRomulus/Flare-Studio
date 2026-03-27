import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CellContextMenuPosition {
  x: number;
  y: number;
}

export interface CellContextMenuProps {
  isOpen: boolean;
  position: CellContextMenuPosition | null;
  onClose: () => void;
  children?: React.ReactNode;
  isDarkMode?: boolean;
}

export const CellContextMenu = React.forwardRef<HTMLDivElement, CellContextMenuProps>(
  ({ isOpen, position, onClose, children, isDarkMode = false }, ref) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = useState<CellContextMenuPosition | null>(null);
    const [visiblePortal, setVisiblePortal] = useState(isOpen);

    // Manage portal visibility
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (isOpen) {
        setVisiblePortal(true);
        return;
      }

      const timer = setTimeout(() => setVisiblePortal(false), 150);
      return () => clearTimeout(timer);
    }, [isOpen]);

    // Adjust position to ensure menu stays within viewport
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (!isOpen || !position) {
        setAdjustedPos(null);
        return;
      }

      // If menuRef hasn't been created yet, use position directly to allow portal to render
      if (!menuRef.current) {
        setAdjustedPos(position);
        return;
      }

      const rect = menuRef.current.getBoundingClientRect();
      let x = position.x;
      let y = position.y;

      const padding = 8;
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      if (x + rect.width + padding > viewport.width) {
        x = Math.max(0, viewport.width - rect.width - padding);
      }

      if (y + rect.height + padding > viewport.height) {
        y = Math.max(0, viewport.height - rect.height - padding);
      }

      const finalPos = { x, y };
      setAdjustedPos(finalPos);
    }, [isOpen, position]);

    // After DOM is painted, measure and adjust position if needed
    useLayoutEffect(() => {
      if (!isOpen || !position || !menuRef.current || !adjustedPos) {
        return;
      }

      const rect = menuRef.current.getBoundingClientRect();
      
      // Only adjust if the element has real dimensions now
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      let x = adjustedPos.x;
      let y = adjustedPos.y;
      const padding = 8;
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const needsAdjust = 
        (x + rect.width + padding > viewport.width) ||
        (y + rect.height + padding > viewport.height);

      if (needsAdjust) {
        if (x + rect.width + padding > viewport.width) {
          x = Math.max(0, viewport.width - rect.width - padding);
        }

        if (y + rect.height + padding > viewport.height) {
          y = Math.max(0, viewport.height - rect.height - padding);
        }

        const finalPos = { x, y };
        setAdjustedPos(finalPos);
      }
    }, [isOpen, adjustedPos, position]);

    // Close on escape key
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Close on click outside
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      };

      // Use capture phase to ensure we catch clicks early
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isOpen, onClose]);

    if (!visiblePortal || !adjustedPos) {
      return null;
    }

    const classNameStr = isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none';
    const bgClass = isDarkMode ? 'bg-neutral-900/95 backdrop-blur-sm' : 'bg-white/95 backdrop-blur-sm';
    const borderClass = isDarkMode ? 'border-gray-400/30' : 'border-gray-200/50';
    const shadowClass = isDarkMode ? 'shadow-lg' : 'shadow-sm';

    return createPortal(
      <div
        ref={(node) => {
          if (node) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (menuRef as any).current = node;
          }
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (ref as any).current = node;
          }
        }}
        className={`fixed z-50 min-w-[140px] rounded-md ${borderClass} ${bgClass} ${shadowClass} transition-opacity duration-150 border ${classNameStr}`}
        style={{
          left: `${adjustedPos.x}px`,
          top: `${adjustedPos.y}px`,
        }}
        role="menu"
        aria-orientation="vertical"
      >
        {children}
      </div>,
      document.body
    );
  }
);

CellContextMenu.displayName = 'CellContextMenu';

export const CellContextMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => {
  console.log('[CellContextMenuContent] rendering');
  return (
    <div
      ref={ref}
      className={`py-0.5 ${className}`}
      {...props}
    />
  );
});

CellContextMenuContent.displayName = 'CellContextMenuContent';

export interface CellContextMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label: string;
  destructive?: boolean;
}

export const CellContextMenuItem = React.forwardRef<
  HTMLButtonElement,
  CellContextMenuItemProps
>(({ icon, label, destructive = false, className = '', ...props }, ref) => {
  console.log('[CellContextMenuItem] rendering -', label);
  
  // Determine if we're in dark mode by checking the document class
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  const bgHoverClass = destructive 
    ? isDarkMode ? 'hover:bg-red-900/40' : 'hover:bg-red-50'
    : isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/60';
  
  const textClass = destructive 
    ? isDarkMode ? 'text-red-400' : 'text-red-600'
    : isDarkMode ? 'text-gray-200' : 'text-gray-700';
  
  const fullClassName = `w-full px-2 py-1.5 text-left text-xs font-medium flex items-center gap-2 transition-colors duration-100 cursor-pointer ${bgHoverClass} ${textClass} ${className}`;

  return (
    <button
      ref={ref}
      className={fullClassName}
      role="menuitem"
      {...props}
    >
      {icon && <span className="flex-shrink-0 w-3.5 h-3.5">{icon}</span>}
      <span>{label}</span>
    </button>
  );
});

CellContextMenuItem.displayName = 'CellContextMenuItem';

export const CellContextMenuDivider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const dividerClass = isDarkMode ? 'bg-gray-600/30' : 'bg-gray-200/50';
  
  return (
    <div
      ref={ref}
      className={`h-px ${dividerClass} my-0.5 ${className}`}
      role="separator"
      {...props}
    />
  );
});

CellContextMenuDivider.displayName = 'CellContextMenuDivider';
