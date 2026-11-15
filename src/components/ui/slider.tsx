import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  showTicks?: boolean
}

export const Slider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = "",
  showTicks = true,
}: SliderProps) => {
  const percentage = max === min ? 0 : ((value - min) / (max - min)) * 100
  const emit = (next: number) => {
    onChange(Number.isInteger(step) ? parseInt(String(next), 10) : next)
  }

  return (
    <div className={cn("relative w-full py-4 group", className)}>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => emit(vals[0] ?? min)}
        className="relative flex w-full touch-none select-none items-center h-6"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted border border-border/50">
          <SliderPrimitive.Range className="absolute h-full bg-orange-500 transition-all duration-150" />
        </SliderPrimitive.Track>
        {showTicks && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 flex justify-between px-0.5 pointer-events-none">
            {Array.from({ length: 11 }).map((_, i) => (
              <div
                key={i}
                className={`w-0.5 h-full rounded-full transition-colors ${
                  percentage >= i * 10 ? "bg-orange-600/40" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        )}
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-orange-500 bg-background shadow-md transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-hover:scale-110" />
      </SliderPrimitive.Root>

      <div
        className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
        style={{ left: `calc(${percentage}% - 12px)` }}
      >
        {value}%
      </div>

      <div className="flex justify-between w-full mt-2 text-[10px] text-muted-foreground font-medium pointer-events-none">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
