import React from 'react';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  showTicks?: boolean;
}

export const Slider = ({ 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  step = 1, 
  className = '',
  showTicks = true
}: SliderProps) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`relative w-full py-4 group ${className}`}>
      {/* Background Track */}
      <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
        <div 
          className="h-full bg-orange-500 transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Tick Marks */}
      {showTicks && (
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-3 flex justify-between px-0.5 pointer-events-none">
          {Array.from({ length: 11 }).map((_, i) => (
            <div 
              key={i} 
              className={`w-0.5 h-full rounded-full transition-colors ${
                percentage >= i * 10 ? 'bg-orange-600/40' : 'bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>
      )}

      {/* Hidden Range Input */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="absolute top-1/2 -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer z-10"
      />

      {/* Visual Thumb */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-background border-2 border-orange-500 rounded-full shadow-md transition-all duration-150 pointer-events-none group-hover:scale-110 active:scale-95"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
      
      {/* Value Indicator */}
      <div 
        className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
        style={{ left: `calc(${percentage}% - 12px)` }}
      >
        {value}%
      </div>
    </div>
  );
};
