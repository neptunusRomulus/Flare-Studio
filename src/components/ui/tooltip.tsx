import React from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  className?: string;
  // vertical offset in pixels from the trigger to the tooltip (default 8)
  offsetY?: number;
  children: React.ReactNode;
}
const Tooltip: React.FC<TooltipProps> = ({ content, side = 'top', className = '', children, offsetY = 14 }: TooltipProps) => {
  // Basic shadcn-like tooltip using Tailwind. Keeps markup simple and local.
  // Note: positioning is handled by the portal-based tooltip rendering below.

  // accessibility: give each tooltip a stable id and link it via aria-describedby
  const id = `tooltip-${React.useId()}`;

  // If children is a single React element, clone it and add aria-describedby so
  // screen readers and keyboard users can reference the tooltip. Otherwise wrap
  // the children in a span with the attribute.
  const trigger = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement, {
        'aria-describedby': id,
      })
    : (
        <span tabIndex={0} aria-describedby={id} className="inline-flex">
          {children}
        </span>
      );

  // refs for measuring and avoiding overflow
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipRef = React.useRef<HTMLSpanElement | null>(null);
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  // keep the portal mounted briefly to allow CSS fade-out
  const [visiblePortal, setVisiblePortal] = React.useState(false);

  // Helper to get the offset from props or dataset
  const getLocalOffset = React.useCallback(() => {
    let localOffset = offsetY;
    if (wrapperRef.current) {
      try {
        const ds = (wrapperRef.current as HTMLElement).dataset;
        if (ds && ds.tooltipOffset) {
          const parsed = parseInt(ds.tooltipOffset, 10);
          if (!Number.isNaN(parsed)) localOffset = parsed;
        }
      } catch {
        // ignore dataset parsing errors
      }
    }
    return localOffset;
  }, [offsetY]);

  const computeOffset = React.useCallback(() => {
    if (!wrapperRef.current) return;
    const trig = wrapperRef.current.getBoundingClientRect();
    const localOffset = getLocalOffset();

    // initial center x for tooltip
    // For initial positioning, estimate tooltip dimensions (will be refined later)
    const estimatedTooltipHeight = 40; // reasonable estimate for single line tooltip
    const estimatedTooltipWidth = 120;

    // compute default positions depending on side
    let left = trig.left + trig.width / 2;
    let top = trig.top;

    if (side === 'top') {
      top = trig.top - estimatedTooltipHeight - localOffset; // above
      left = trig.left + trig.width / 2;
    } else if (side === 'bottom' || side === 'auto') {
      top = trig.bottom + localOffset + 6; // below (extra gap so cursor doesn't cover tooltip)
      left = trig.left + trig.width / 2;
    } else if (side === 'right') {
      left = trig.right + localOffset; // to the right of trigger
      top = trig.top + trig.height / 2;
    } else if (side === 'left') {
      left = trig.left - estimatedTooltipWidth - localOffset; // to the left
      top = trig.top + trig.height / 2;
    }

    setPos({ left, top });
    // measurement and fine adjustment will run in effect after portal renders
  }, [side, getLocalOffset]);

  React.useEffect(() => {
    // recompute on resize so the tooltip stays inside when the window changes
  window.addEventListener('resize', computeOffset);
  return () => window.removeEventListener('resize', computeOffset);
  }, [computeOffset]);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCloseTimer = React.useCallback((delay = 1500) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setHovered(false);
      setIsExpanded(false);
      window.setTimeout(() => setVisiblePortal(false), 100);
    }, delay);
  }, [clearTimer]);

  // recompute when the tooltip becomes visible via hover/focus. We attach handlers
  // on the wrapper to trigger measurement.
  const onTriggerEnter = () => {
    clearTimer();
    // measure on next frame so layout is stable
    requestAnimationFrame(() => computeOffset());
    setHovered(true);
    setVisiblePortal(true);
  };

  const onTriggerLeave = () => {
    if (isExpanded) {
      startCloseTimer(1500);
    } else {
      setHovered(false);
      // allow fade-out animation before removing portal
      window.setTimeout(() => setVisiblePortal(false), 100);
    }
  };

  const onPortalEnter = () => {
    if (isExpanded) {
      clearTimer();
      setHovered(true);
    }
  };

  const onPortalLeave = () => {
    if (isExpanded) {
      startCloseTimer(1500);
    }
  };

  React.useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    // re-measure since size changed
    requestAnimationFrame(() => computeOffset());
  };

  // after portal tooltip renders, measure and clamp its position
  React.useEffect(() => {
    if (!hovered || !portalRef.current || !wrapperRef.current) return;
    const portalRect = portalRef.current.getBoundingClientRect();
    const trig = wrapperRef.current.getBoundingClientRect();
    const localOffset = getLocalOffset();

    let left = 0;
    let top = 0;

    if (side === 'right') {
      left = trig.right + localOffset;
      // avoid clipping on the right
      left = Math.min(left, window.innerWidth - portalRect.width - 8);
      top = trig.top + trig.height / 2 - portalRect.height / 2; // center vertically
      top = Math.max(8, Math.min(window.innerHeight - portalRect.height - 8, top));
    } else if (side === 'left') {
      left = trig.left - portalRect.width - localOffset;
      left = Math.max(8, left);
      top = trig.top + trig.height / 2 - portalRect.height / 2;
      top = Math.max(8, Math.min(window.innerHeight - portalRect.height - 8, top));
    } else {
      const halfWidth = portalRect.width / 2;
      left = trig.left + trig.width / 2;
      const minCenter = 8 + halfWidth;
      const maxCenter = window.innerWidth - 8 - halfWidth;
      if (left < minCenter) left = minCenter;
      if (left > maxCenter) left = maxCenter;

      // For top/bottom we position the portal with transform translateX(-50%) so left is center
      top = trig.top - portalRect.height - localOffset;
      if (side === 'bottom' || side === 'auto') top = trig.bottom + localOffset + 6;
      // clamp vertical to viewport
      top = Math.max(8, Math.min(window.innerHeight - portalRect.height - 8, top));
    }

    setPos({ left, top });
  }, [hovered, side, getLocalOffset, isExpanded]);

  // Render wrapper and portal tooltip to avoid clipping by overflow parents
  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={onTriggerEnter}
        onFocus={onTriggerEnter}
        onMouseLeave={onTriggerLeave}
        onBlur={onTriggerLeave}
        onClick={handleToggleExpand}
        className={`relative inline-flex cursor-help ${className}`}
      >
        {trigger}
      </span>
      {typeof document !== 'undefined' && pos && visiblePortal && createPortal(
        <div
          ref={portalRef}
          id={id}
          role="tooltip"
          onMouseEnter={onPortalEnter}
          onMouseLeave={onPortalLeave}
          className={`custom-tooltip transition-all duration-100 ${hovered ? 'visible' : 'fade-out'}`}
          style={(() => {
            const base = side === 'right' || side === 'left' 
              ? { left: pos.left, top: pos.top, transform: 'translateY(-50%)' } 
              : { left: pos.left, top: pos.top, transform: 'translateX(-50%)' };
            
            if (isExpanded) {
              return { 
                ...base, 
                zIndex: 100,
              } as React.CSSProperties;
            }
            return base as React.CSSProperties;
          })()}
        >
          <span
            ref={tooltipRef}
            className={`inline-block text-xs px-3 py-2 rounded-md shadow-xl transition-all duration-100 break-words bg-black text-white border border-white/10 ${isExpanded ? 'max-w-[24rem]' : 'max-w-[18rem]'}`}
            style={{
              display: isExpanded ? 'block' : '-webkit-box',
              WebkitLineClamp: isExpanded ? 'none' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: isExpanded ? 'visible' : 'hidden'
            }}
          >
            {content}
          </span>
          {/* arrow for left/right/top/bottom */}
          {side === 'right' && (
            <span className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-black" aria-hidden />
          )}
          {side === 'left' && (
            <span className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-black" aria-hidden />
          )}
          {(side === 'top' || side === 'bottom' || side === 'auto') && (
            <span className="absolute left-1/2 -translate-x-1/2 mt-[-6px] w-2 h-2 rotate-45 bg-black" aria-hidden />
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
