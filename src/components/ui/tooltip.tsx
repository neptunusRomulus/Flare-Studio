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
const Tooltip: React.FC<TooltipProps> = ({ content, side = 'top', className = '', children, offsetY = 8 }: TooltipProps) => {
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
      } catch (e) {
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
    const centerX = trig.left + trig.width / 2;

    // For initial positioning, estimate tooltip height (will be refined later)
    const estimatedTooltipHeight = 40; // reasonable estimate for single line tooltip
    
    // compute default top depending on side
    let top = trig.top;
    if (side === 'top') top = trig.top - estimatedTooltipHeight - localOffset; // above
    else if (side === 'bottom' || side === 'auto') top = trig.bottom + localOffset; // below
    else top = trig.top + trig.height / 2;

    setPos({ left: centerX, top });
    // measurement and fine adjustment will run in effect after portal renders
  }, [side, getLocalOffset]);

  React.useEffect(() => {
    // recompute on resize so the tooltip stays inside when the window changes
  window.addEventListener('resize', computeOffset);
  return () => window.removeEventListener('resize', computeOffset);
  }, [computeOffset]);

  // recompute when the tooltip becomes visible via hover/focus. We attach handlers
  // on the wrapper to trigger measurement.
  const onTriggerEnter = () => {
    // measure on next frame so layout is stable
    requestAnimationFrame(() => computeOffset());
    setHovered(true);
  };

  const onTriggerLeave = () => {
    setHovered(false);
  };

  // after portal tooltip renders, measure and clamp its position
  React.useEffect(() => {
    if (!hovered || !portalRef.current || !wrapperRef.current) return;
    const portalRect = portalRef.current.getBoundingClientRect();
    const trig = wrapperRef.current.getBoundingClientRect();
    const localOffset = getLocalOffset();

    const halfWidth = portalRect.width / 2;
    let left = trig.left + trig.width / 2;
    const minCenter = 8 + halfWidth;
    const maxCenter = window.innerWidth - 8 - halfWidth;
    if (left < minCenter) left = minCenter;
    if (left > maxCenter) left = maxCenter;

    // For top/bottom we position the portal with transform translateX(-50%) so left is center
    let top = trig.top - portalRect.height - localOffset;
    if (side === 'bottom' || side === 'auto') top = trig.bottom + localOffset;
    // clamp vertical to viewport
    top = Math.max(8, Math.min(window.innerHeight - portalRect.height - 8, top));

    setPos({ left, top });
  }, [hovered, side, getLocalOffset]);

  // Render wrapper and portal tooltip to avoid clipping by overflow parents
  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={onTriggerEnter}
        onFocus={onTriggerEnter}
        onMouseLeave={onTriggerLeave}
        onBlur={onTriggerLeave}
        className={`relative inline-flex ${className}`}
      >
        {trigger}
      </span>
      {typeof document !== 'undefined' && pos && hovered && createPortal(
        <div
          ref={portalRef}
          id={id}
          role="tooltip"
          className={`pointer-events-none opacity-100 scale-100 transition duration-150 ease-out select-none absolute z-50`}
          style={{
            left: pos.left,
            top: pos.top,
            transform: 'translateX(-50%)',
            pointerEvents: 'none'
          }}
        >
          <span
            ref={tooltipRef}
            className="inline-block bg-black text-white text-xs px-3 py-1.5 rounded-md shadow-md max-w-[18rem] break-words"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {content}
          </span>
          {/* arrow */}
          <span className="absolute left-1/2 -translate-x-1/2 mt-[-6px] w-2 h-2 rotate-45 bg-black" aria-hidden />
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
