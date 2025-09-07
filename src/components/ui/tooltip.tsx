import React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

export default function Tooltip({ content, side = 'top', className = '', children }: TooltipProps) {
  // Basic shadcn-like tooltip using Tailwind. Keeps markup simple and local.
  const posClass = {
    top: '-translate-y-2 bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }[side];

  return (
    <span className={`relative inline-flex group ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none absolute z-50 ${posClass}`}
      >
        <span className="inline-block bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-md">{content}</span>
      </span>
    </span>
  );
}
